(() => {
  const TAG = "wwu-planner";
  const PREFS_KEY = "prefs";
  const planKey = (term) => `plan:${term}`;

  const seen = new Map();
  const idToCrn = new Map();
  const rowButtons = [];
  let lastResults = null;
  let ws = null;
  let prefs = { lastTerm: null, open: false, view: "courses" };
  let notice = "", noticeKind = "";

  let registeredEvents = new Map();
  const submitRegistered = new Set();
  const submitDropped = new Set();
  let submittedAt = null;

  let send = null;

  const waiters = [];
  function waitFor(pathRe, pred, timeout) {
    return new Promise((resolve) => {
      const w = { pathRe, pred, resolve };
      waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i !== -1) { waiters.splice(i, 1); resolve(null); } }, timeout);
    });
  }
  function notifyWaiters(url, json) {
    for (const w of [...waiters]) {
      if (w.pathRe.test(url) && w.pred(url, json)) { waiters.splice(waiters.indexOf(w), 1); w.resolve({ url, json }); }
    }
  }

  const alive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  async function storageGet(key) {
    if (!alive()) return undefined;
    try { return (await chrome.storage.local.get(key))[key]; } catch { return undefined; }
  }
  async function storageSet(obj) {
    if (!alive()) { setNotice("The planner was updated. Refresh this page to keep saving.", "warn"); return; }
    try { await chrome.storage.local.set(obj); } catch {  }
  }
  const saveWs = () => { ws.updatedAt = Date.now(); return storageSet({ [planKey(ws.term)]: ws }); };
  const savePrefs = () => storageSet({ [PREFS_KEY]: prefs });

  async function switchTerm(term, termDesc) {
    if (ws?.term === term) return;
    ws = Plan.migrate(await storageGet(planKey(term))) || Plan.emptyPlan(term, termDesc);
    if (!ws.termDesc && termDesc) ws.termDesc = termDesc;
    prefs.lastTerm = term;
    savePrefs();
  }

  function findSection(crn) {
    if (seen.has(crn)) return seen.get(crn);
    for (const c of Object.values(ws?.courses || {})) if (c.sections[crn]) return c.sections[crn];
    return null;
  }
  function registeredList() {
    if (!ws) return [];
    const crns = new Set([...registeredEvents.keys(), ...submitRegistered]);
    submitDropped.forEach((c) => crns.delete(c));
    const out = [];
    for (const crn of crns) {
      const ev = registeredEvents.get(crn);
      const s = findSection(crn);
      if (ev && ev.term && ev.term !== ws.term) continue;
      if (!ev && !s) continue;
      out.push({
        crn,
        courseKey: s?.courseKey || ev?.courseKey,
        subject: s?.subject || ev?.subject,
        number: s?.number || ev?.number,
        title: s?.title || ev?.title || "",
        credits: s?.credits ?? null,
        type: s?.type || "",
        instructor: s?.instructor || "",
        blocks: s?.blocks?.length ? s.blocks : ev?.blocks || [],
        async: s ? s.async : false,
      });
    }
    return out;
  }

  function colorIndex(key) {
    const keys = Plan.orderedCourses(ws).map((c) => c.key);
    registeredList().forEach((r) => { const k = r.courseKey || `crn${r.crn}`; if (!keys.includes(k)) keys.push(k); });
    const i = keys.indexOf(key);
    return i === -1 ? 0 : i;
  }

  const ui = PlannerUI.create({ onAction: handleAction });
  function setNotice(msg, kind = "") { notice = msg; noticeKind = kind; render(); }
  const render = () => {
    ui.render({ plan: ws, lastResults, notice, noticeKind, registered: registeredList(), submittedAt, colorIndex, view: prefs.view, send });
    updateRowButtons();
  };

  async function handleAction(action, { key, crn, plan: planId, view, source }) {
    switch (action) {
      case "open": ui.setOpen(true); prefs.open = true; savePrefs(); return;
      case "close": ui.setOpen(false); prefs.open = false; savePrefs(); return;
      case "view": prefs.view = view; savePrefs(); return;
      case "dismiss": notice = ""; render(); return;
      case "add": return addCourseByKey(key);
      case "remove": {
        const c = ws.courses[key];
        Plan.removeCourse(ws, key);
        await saveWs(); render();
        ui.announce(`Removed ${c ? `${c.subject} ${c.number}` : "course"} from your planner.`);
        return;
      }
      case "toggle": {
        Plan.toggleExcluded(ws, key, crn);
        await saveWs(); render();
        const off = ws.courses[key]?.excluded.includes(crn);
        ui.announce(`Section ${crn} ${off ? "removed from" : "kept in"} your options.`);
        return;
      }
      case "clear":
        Plan.clearCourses(ws);
        await saveWs(); render(); ui.announce("All courses cleared.");
        return;
      case "plan":
        ws.active = planId; await saveWs(); render(); ui.announce(`Showing Plan ${planId}.`);
        return;
      case "choose": {
        if (!Plan.choose(ws, ws.active, key, crn)) return;
        await saveWs(); render();
        const c = ws.courses[key], s = c.sections[crn];
        const clash = Plan.conflictsWith(s, Plan.week(ws, ws.active, registeredList()).items, key);
        ui.announce(`${c.subject} ${c.number} placed: ${describeBlocks(s, { withRoom: false })}.` +
          (clash.length ? ` Warning: conflicts with ${clash.map((x) => x.label).join(", ")}.` : ""));
        return;
      }
      case "unplace": {
        const c = ws.courses[key];
        Plan.unchoose(ws, ws.active, key);
        await saveWs(); render();
        ui.announce(`${c ? `${c.subject} ${c.number}` : "Course"} removed from the calendar.`);
        return;
      }
      case "copyplan":
        Plan.copyPlan(ws, ws.active, planId);
        await saveWs(); render();
        ui.announce(`Plan ${ws.active} copied to Plan ${planId}.`);
        return;
      case "clearplan":
        Plan.clearPlan(ws, ws.active);
        await saveWs(); render(); ui.announce(`Plan ${ws.active} cleared.`);
        return;
      case "copycrns": {
        const crns = Plan.week(ws, ws.active, []).items.map((i) => i.crn);
        try {
          await navigator.clipboard.writeText(crns.join(", "));
          ui.announce(`Copied ${crns.length} CRNs.`);
          setNotice(`Copied Plan ${ws.active} CRNs: ${crns.join(", ")}. Paste them into the "Enter CRNs" tab.`);
        } catch {
          setNotice(`Plan ${ws.active} CRNs: ${crns.join(", ")}`);
        }
        return;
      }
      case "export": return exportCalendar(source);
      case "sendprep": prepSend(); render(); ui.focusSel('[data-action="sendgo"]'); return;
      case "sendtoggle": {
        const it = send?.items.find((i) => i.crn === crn);
        if (it && !it.registered && send.stage === "preview") { it.include = !it.include; render(); }
        return;
      }
      case "sendgo": return runSend();
      case "sendclose": if (send?.stage !== "running") { send = null; render(); } return;
      case "showsummary": send = null; ui.setOpen(false, { focus: false }); prefs.open = false; savePrefs(); render(); return;
    }
  }

  function prepSend() {
    const reg = registeredList();
    const wk = Plan.week(ws, ws.active, reg);
    const regCrns = new Set(reg.map((r) => r.crn));
    const items = wk.items.filter((i) => i.kind === "chosen").map((it) => {
      const clash = Plan.conflictsWith(it.section, wk.items, it.key);
      const flags = [];
      if (clash.length) flags.push(`Conflicts with ${clash.map((c) => c.label).join(", ")}`);
      if (!(it.section.seats > 0)) flags.push("Full: Web4U may offer a waitlist");
      return {
        crn: it.crn, key: it.key, label: it.label, title: it.title,
        when: describeBlocks(it.section, { withRoom: false }),
        flags, registered: regCrns.has(it.crn), include: !regCrns.has(it.crn),
        state: "idle", checkOk: null, checkMsg: "", ok: null, message: "",
      };
    });
    send = { stage: "preview", planId: ws.active, items, unplaced: wk.unplaced.map((c) => `${c.subject} ${c.number}`), error: "" };
  }

  async function runSend() {
    if (!send || send.stage !== "preview") return;
    const chosen = send.items.filter((i) => i.include);
    if (!chosen.length) return;
    send.stage = "running";
    render();
    ui.announce(`Adding ${chosen.length} classes to your Web4U Summary. This takes a few seconds.`);
    try {
      const results = await SendCRNs.run({
        crns: chosen.map((i) => i.crn),
        waitFor,
        onStep: ({ crn, stage, ok, message }) => {
          const it = send.items.find((i) => i.crn === crn);
          if (!it) return;
          it.state = stage;
          if (stage === "checked") { it.checkOk = ok; it.checkMsg = message; }
          render();
        },
      });
      for (const it of chosen) {
        const r = results?.get(it.crn);
        it.state = "done";
        it.ok = r ? r.ok : null;
        it.message = r ? r.message : "Check the Summary panel in Web4U.";
      }
      send.stage = "done";
      const good = chosen.filter((i) => i.ok !== false).length;
      ui.announce(`${good} of ${chosen.length} classes are waiting in your Summary. Review them, then press Submit in Web4U when you're ready.`);
    } catch (e) {
      send.stage = "error";
      send.error = e.message || String(e);
      ui.announce(send.error);
    }
    render();
    ui.focusSel(send.stage === "done" ? '[data-action="showsummary"]' : '[data-action="sendclose"]');
  }

  function exportCalendar(source) {
    const list = source === "registered"
      ? registeredList().map((r) => ({ crn: r.crn, label: `${r.subject} ${r.number}`, title: r.title, type: r.type, instructor: r.instructor, section: r }))
      : Plan.week(ws, ws.active, registeredList()).items.map((i) => ({
        crn: i.crn, label: i.label, title: i.title, type: i.section.type, instructor: i.section.instructor, section: i.section }));
    if (!list.length) return;
    const { text, warnings, eventCount } = ICS.build({ term: ws.term, termDesc: ws.termDesc, classes: list });
    const name = `WWU ${ws.termDesc || ws.term}${source === "registered" ? "" : ` Plan ${ws.active}`}`.replace(/[^\w -]/g, "").trim().replace(/\s+/g, "-");
    ICS.download(`${name}.ics`, text);
    ui.announce(`Downloaded a calendar file with ${eventCount} weekly events.`);
    setNotice(`Downloaded ${name}.ics.${warnings.length ? ` Note: ${warnings.join(" ")}` : " Open it with your calendar app to import."}`,
      warnings.length ? "warn" : "");
  }

  async function addCourseByKey(key) {
    if (!ws) return;
    const sections = [...seen.values()].filter((s) => s.courseKey === key && s.term === ws.term);
    if (!sections.length) return;
    const already = !!ws.courses[key];
    const course = Plan.addCourse(ws, sections, { complete: !!lastResults?.get(key)?.complete });
    await saveWs();
    render();
    const label = `${course.subject} ${course.number}`;
    ui.announce(already ? `${label} is already in your planner.`
      : `Added ${label} with ${sections.length} section option${sections.length === 1 ? "" : "s"}.`);
  }

  function rowCrn(tr) {
    const id = tr.getAttribute("data-id");
    if (id && idToCrn.has(id)) return idToCrn.get(id);
    const cell = tr.querySelector('[data-property="courseReferenceNumber"]');
    const cellText = cell?.textContent.trim();
    if (cellText && seen.has(cellText)) return cellText;
    for (const m of tr.textContent.match(/\b\d{5}\b/g) || []) if (seen.has(m)) return m;
    return null;
  }

  function injectRowButtons() {
    if (!seen.size) return;
    for (const tr of document.querySelectorAll("tr")) {
      if (tr.closest("#wwu-planner-root") || tr.querySelector(".wwu-planner-rowbtn")) continue;
      const crn = rowCrn(tr);
      if (!crn) continue;
      const rb = PlannerUI.makeRowButton({
        crn,
        onClick: async (c) => {
          const s = seen.get(c);
          if (!s) return;
          if (ws.courses[s.courseKey]) { ui.setOpen(true); prefs.open = true; ui.revealCard(s.courseKey); return; }
          await addCourseByKey(s.courseKey);
        },
      });
      const bannerAdd = [...tr.querySelectorAll("button, input[type=button]")]
        .find((b) => /add/i.test(b.textContent || b.value || ""));
      if (bannerAdd) bannerAdd.insertAdjacentElement("afterend", rb.host);
      else (tr.lastElementChild || tr).appendChild(rb.host);
      rowButtons.push(rb);
    }
    updateRowButtons();
  }

  function updateRowButtons() {
    for (let i = rowButtons.length - 1; i >= 0; i--) {
      const rb = rowButtons[i];
      if (!rb.host.isConnected) { rowButtons.splice(i, 1); continue; }
      const s = seen.get(rb.crn);
      if (s) rb.update(!!ws?.courses[s.courseKey], `${s.subject} ${s.number}`);
    }
  }

  let scanTimer = null;
  new MutationObserver((muts) => {
    if (muts.every((m) => m.target.closest?.("#wwu-planner-root") || m.target.id === "wwu-planner-root")) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(injectRowButtons, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });

  async function onSearch(url, json) {
    if (!json?.success || !Array.isArray(json.data)) return;
    const sections = json.data.map((raw) => {
      const s = normalizeSection(raw);
      if (raw.id != null) idToCrn.set(String(raw.id), s.crn);
      return s;
    });
    sections.forEach((s) => seen.set(s.crn, s));
    lastResults = Plan.groupByCourse(sections);
    if (sections[0]) await switchTerm(sections[0].term, sections[0].termDesc);
    if (ws) {
      const complete = Plan.completeCourseKeys(url, json, sections);
      for (const k of complete) lastResults.get(k).complete = true;
      if (Plan.mergeSeen(ws, sections, complete)) await saveWs();
    }
    console.debug(`[WWU Planner] search: ${sections.length} sections (of ${json.totalCount})`);
    render();
    injectRowButtons();
  }

  async function onEvents(json) {
    const parsed = Registered.fromEvents(json);
    if (!parsed) return;
    registeredEvents = parsed;
    const term = [...parsed.values()].find((r) => r.term)?.term;
    if (term) await switchTerm(term);
    console.debug(`[WWU Planner] registered classes: ${parsed.size}`);
    render();
  }

  function onSubmit(json) {
    const { registered, dropped } = Registered.fromSubmit(json);
    registered.forEach((c) => { submitRegistered.add(c); submitDropped.delete(c); });
    dropped.forEach((c) => { submitDropped.add(c); submitRegistered.delete(c); registeredEvents.delete(c); });
    console.debug(`[WWU Planner] submit: +${registered.size} registered, -${dropped.size} dropped`);
    if (registered.size || dropped.size) {
      submittedAt = Date.now();
      if (registered.size) ui.announce("Registration submitted. You can now add your classes to your calendar from the planner.");
    }
    render();
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== TAG || msg.type !== "response") return;
    let json;
    try { json = JSON.parse(msg.text); } catch { return; }
    notifyWaiters(String(msg.url), json);
    const path = String(msg.url).split("?")[0];
    if (msg.url.includes("searchResults?")) return onSearch(msg.url, json);
    if (/getRegistrationEvents/i.test(path)) return onEvents(json);
    if (/submitRegistration/i.test(path)) return onSubmit(json);
    if (/getSectionDetailsFromCRN|addCRNRegistrationItems/i.test(path)) return;
    console.debug(`[WWU Planner] saw ${path.split("/").slice(-2).join("/")} → ${Registered.shape(json)}`);
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !ws) return;
      const ch = changes[planKey(ws.term)];
      if (ch?.newValue) { ws = Plan.migrate(ch.newValue); render(); }
    });
  } catch {  }

  (async () => {
    prefs = { ...prefs, ...((await storageGet(PREFS_KEY)) || {}) };
    if (prefs.lastTerm && !ws) ws = Plan.migrate(await storageGet(planKey(prefs.lastTerm))) || Plan.emptyPlan(prefs.lastTerm);
    render();
    if (prefs.open) ui.setOpen(true, { focus: false });
  })();
})();
