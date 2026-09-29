const PlannerCalendar = (() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DAY_LIST = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const SHORT = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
  const PX_PER_MIN = 0.9;
  const MINI_PX_PER_MIN = 0.3;

  const t12 = (m) => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return `${((h + 11) % 12) + 1}:${mm}`; };
  const ampm = (m) => (m < 720 ? "AM" : "PM");
  const range = (b) => `${t12(b.start)}–${t12(b.end)} ${ampm(b.end)}`;
  const spoken = (b) => `${b.days.map((d) => SHORT[d]).join(" ")} ${t12(b.start)} ${ampm(b.start)} to ${t12(b.end)} ${ampm(b.end)}`;
  const dur = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  function frame(sectionLists) {
    let lo = 8 * 60, hi = 17 * 60;
    const days = new Set(["monday", "tuesday", "wednesday", "thursday", "friday"]);
    for (const s of sectionLists) for (const b of s.blocks || []) {
      lo = Math.min(lo, Math.floor(b.start / 60) * 60);
      hi = Math.max(hi, Math.ceil(b.end / 60) * 60);
      b.days.forEach((d) => days.add(d));
    }
    return { lo, hi, days: DAY_LIST.filter((d) => days.has(d)) };
  }

  function layout(evts) {
    evts.sort((a, b) => a.start - b.start || b.end - a.end);
    let group = [], groupEnd = -1;
    const finish = () => {
      const cols = [];
      for (const e of group) {
        let i = cols.findIndex((end) => end <= e.start);
        if (i === -1) { i = cols.length; cols.push(0); }
        cols[i] = e.end; e.col = i;
      }
      group.forEach((e) => { e.ncol = cols.length; });
    };
    for (const e of evts) {
      if (group.length && e.start >= groupEnd) { finish(); group = []; groupEnd = -1; }
      group.push(e); groupEnd = Math.max(groupEnd, e.end);
    }
    if (group.length) finish();
    return evts;
  }

  const pos = (e, lo, px) =>
    `top:${(e.start - lo) * px}px;height:${Math.max((e.end - e.start) * px - 2, 14)}px;` +
    `left:calc(${(e.col / e.ncol) * 100}% + 2px);width:calc(${100 / e.ncol}% - 4px);`;

  function seatText(s) {
    if (s.seats > 0) return `${s.seats} open`;
    return s.waitCount > 0 ? `Full · ${s.waitCount} waitlisted` : "Full";
  }

  function schedule(ctx) {
    const { ws, planId, weekData, pick, colorOf, registered, exportInfo, send } = ctx;
    const courses = Plan.orderedCourses(ws);
    const regKeys = new Set(registered.map((r) => r.courseKey).filter(Boolean));
    const conflictPairs = Plan.weekConflicts(weekData.items);
    const inConflict = new Set(conflictPairs.flat().map((it) => it.key));
    const stats = Plan.stats(weekData);

    const everything = [...weekData.items.map((i) => i.section)];
    courses.forEach((c) => Plan.includedSections(c).forEach((s) => everything.push(s)));
    const fr = frame(everything);
    const height = (fr.hi - fr.lo) * PX_PER_MIN;

    const perDay = Object.fromEntries(fr.days.map((d) => [d, []]));
    const noTime = [];
    for (const it of weekData.items) {
      const timed = it.section.blocks || [];
      if (!timed.length) noTime.push(it);
      timed.forEach((b) => b.days.forEach((d) => perDay[d]?.push({ ...b, it })));
    }

    const pickCourse = pick && ws.courses[pick.key];
    const ghostPerDay = Object.fromEntries(fr.days.map((d) => [d, []]));
    const ghostNoTime = [];
    const firstGhost = new Set();
    if (pickCourse) {
      const options = Plan.includedSections(pickCourse)
        .sort((a, b) => (a.blocks[0]?.start ?? 9999) - (b.blocks[0]?.start ?? 9999));
      for (const s of options) {
        const clash = Plan.conflictsWith(s, weekData.items, pickCourse.key);
        const g = {
          s, clash,
          status: clash.length ? "conflict" : s.seats > 0 ? "ok" : "full",
          current: ws.plans[planId].choices[pickCourse.key] === s.crn,
        };
        if (!s.blocks.length) ghostNoTime.push(g);
        s.blocks.forEach((b) => b.days.forEach((d) => ghostPerDay[d]?.push({ ...b, g })));
      }
    }

    const ghostLabel = (g) => {
      const parts = [
        `${pickCourse.subject} ${pickCourse.number}`,
        g.s.blocks.length ? g.s.blocks.map(spoken).join(" and ") : "no set meeting time",
        g.s.instructor, seatText(g.s),
      ];
      if (g.clash.length) parts.push(`conflicts with ${g.clash.map((c) => c.label).join(", ")}`);
      if (g.current) parts.push("current choice");
      return parts.join(", ");
    };

    const ghostButton = (e, g, style) => {
      const focusable = !firstGhost.has(g.s.crn);
      firstGhost.add(g.s.crn);
      return `<button class="ghost ${g.status}${g.current ? " current" : ""}" style="${style}"
        data-action="choose" data-key="${esc(pickCourse.key)}" data-crn="${esc(g.s.crn)}" data-drop="${esc(g.s.crn)}"
        ${focusable ? `tabindex="0" aria-label="${esc(ghostLabel(g))}"` : `tabindex="-1" aria-hidden="true"`}
        title="${esc(ghostLabel(g))}">
        <span class="g-time">${esc(e ? range(e) : "No set time")}</span>
        <span class="g-who">${esc(g.s.instructor)}</span>
        <span class="g-tag">${esc(g.clash.length ? `Conflicts: ${g.clash.map((c) => c.label).join(", ")}` : seatText(g.s))}</span>
      </button>`;
    };

    const blockHtml = (e, style) => {
      const it = e.it;
      const color = colorOf(it.key);
      const where = e.where && e.where !== "TBA" ? e.where : "";
      if (it.kind === "registered") {
        return `<div class="blk reg" style="${style}" title="${esc(`${it.label} ${it.title} — registered`)}">
          <b>${esc(it.label)}</b><span>${esc(range(e))}</span><span class="lock">Registered</span></div>`;
      }
      const label = `${it.label}, ${spoken(e)}${where ? `, ${where}` : ""}${inConflict.has(it.key) ? ", conflicts with another class" : ""}. Press to change or remove.`;
      return `<button class="blk c${color}${inConflict.has(it.key) ? " clash" : ""}${pick?.key === it.key ? " lifting" : ""}"
        style="${style}" data-action="pick" data-key="${esc(it.key)}" data-drag-key="${esc(it.key)}"
        aria-label="${esc(label)}" title="${esc(`${it.label} — ${it.title}`)}">
        <b>${esc(it.label)}</b><span>${esc(range(e))}</span>${where ? `<span>${esc(where)}</span>` : ""}</button>`;
    };

    const hours = [];
    for (let m = fr.lo; m <= fr.hi; m += 60) hours.push(m);

    const cols = fr.days.map((d) => {
      const main = layout(perDay[d]).map((e) => blockHtml(e, pos(e, fr.lo, PX_PER_MIN))).join("");
      const ghosts = pickCourse ? layout(ghostPerDay[d]).map((e) => ghostButton(e, e.g, pos(e, fr.lo, PX_PER_MIN))).join("") : "";
      return `<div class="col" style="height:${height}px">${main}${ghosts ? `<div class="ghost-layer">${ghosts}</div>` : ""}</div>`;
    }).join("");

    const chips = courses.map((c) => {
      const color = colorOf(c.key);
      if (regKeys.has(c.key)) {
        return `<div class="chip reg"><span class="chip-code">${esc(c.subject)} ${esc(c.number)}</span><span class="chip-sub">Registered</span></div>`;
      }
      const placed = weekData.items.find((i) => i.key === c.key);
      const opts = Plan.includedSections(c).length;
      const sub = placed
        ? (placed.section.blocks.length ? placed.section.blocks.map((b) => `${b.days.map((d) => SHORT[d][0] === "T" && d === "thursday" ? "R" : SHORT[d][0]).join("")} ${t12(b.start)}`).join(" + ") : "No set time")
        : `${plural(opts, "option")} · not placed`;
      const lab = `${c.subject} ${c.number}, ${placed ? `placed, ${placed.section.blocks.map(spoken).join(" and ") || "no set time"}` : "not placed"}${inConflict.has(c.key) ? ", has a conflict" : ""}. Press to choose a time.`;
      return `<button class="chip c${color}${placed ? " placed" : ""}${pick?.key === c.key ? " active" : ""}${inConflict.has(c.key) ? " clash" : ""}"
        data-action="pick" data-key="${esc(c.key)}" data-drag-key="${esc(c.key)}" ${opts ? "" : "disabled"}
        aria-label="${esc(lab)}" aria-pressed="${pick?.key === c.key}">
        <span class="swatch" aria-hidden="true"></span>
        <span class="chip-code">${esc(c.subject)} ${esc(c.number)}</span>
        <span class="chip-sub">${esc(sub)}</span></button>`;
    }).join("");
    const regOnly = registered.filter((r) => !r.courseKey || !ws.courses[r.courseKey]);

    const tabs = Plan.PLAN_IDS.map((id) => {
      const n = Object.keys(ws.plans[id].choices).length;
      return `<button class="ptab${id === planId ? " on" : ""}" data-action="plan" data-plan="${id}" aria-pressed="${id === planId}">
        Plan ${id}<span class="ptab-n">${n}</span></button>`;
    }).join("");
    const others = Plan.PLAN_IDS.filter((id) => id !== planId);
    const chosenCrns = weekData.items.filter((i) => i.kind === "chosen").map((i) => i.crn);

    const pickBar = pickCourse ? `
      <div class="pickbar" role="status">
        <span><b>Choose a time for ${esc(pickCourse.subject)} ${esc(pickCourse.number)}.</b>
          ${plural(Plan.includedSections(pickCourse).length, "option")}. Drop or press one. Esc to cancel.</span>
        <span class="pickbar-btns">
          ${ws.plans[planId].choices[pickCourse.key] ? `<button class="btn ghosty" data-action="unplace" data-key="${esc(pickCourse.key)}" data-drop="unplace">Remove from calendar</button>` : ""}
          <button class="btn ghosty" data-action="cancelpick">Cancel</button>
        </span>
      </div>` : "";

    const noTimeHtml = (noTime.length || ghostNoTime.length) ? `
      <div class="notime"><h4>No set meeting time</h4><div class="notime-row">
        ${noTime.map((it) => it.kind === "registered"
          ? `<div class="chip reg small"><span class="chip-code">${esc(it.label)}</span><span class="chip-sub">Registered · online</span></div>`
          : `<button class="chip small c${colorOf(it.key)} placed" data-action="pick" data-key="${esc(it.key)}" data-drag-key="${esc(it.key)}"
              aria-label="${esc(`${it.label}, online with no set time. Press to change or remove.`)}">
              <span class="swatch" aria-hidden="true"></span><span class="chip-code">${esc(it.label)}</span><span class="chip-sub">Online</span></button>`).join("")}
        ${ghostNoTime.map((g) => ghostButton(null, g, "")).join("")}
      </div></div>` : "";

    const conflictHtml = conflictPairs.length ? `
      <div class="conflicts" role="note" ><b style="display: flex; align-items: center;" ><svg xmlns="http://www.w3.org/2000/svg" height="13.4px" viewBox="0 -960 960 960" width="13.4px" fill="currentColor" style="margin-right:6px;"><path d="M86.93-80.15q-16.19 0-28.91-8.48-12.72-8.48-20.19-20.44-7.48-11.71-7.86-26.67-.38-14.96 7.86-29.91l393.06-677.28q8.24-14.96 21.32-21.44 13.07-6.48 27.79-6.48 14.72 0 27.79 6.48 13.08 6.48 21.32 21.44l393.06 677.28q8.24 14.95 7.86 29.91-.38 14.96-7.86 26.79-7.47 11.84-20.19 20.32-12.72 8.48-28.91 8.48H86.93Zm92-109.59h602.14L480-708.26 178.93-189.74Zm338.85-43.3q15.26-15.26 15.26-36.91 0-21.64-15.26-36.9-15.26-15.26-36.9-15.26t-37.02 15.26q-15.38 15.26-15.38 36.9 0 21.65 15.38 36.91 15.38 15.26 37.02 15.26t36.9-15.26Zm-.83-138.46q14.9-15.02 14.9-36.07v-98.71q0-21.29-14.9-36.19-14.91-14.9-36.07-14.9t-36.18 14.9q-15.03 14.9-15.03 36.19v98.71q0 21.05 15.03 36.07 15.02 15.02 36.18 15.02t36.07-15.02ZM480-449Z"/></svg>
Time conflicts</b><ul>${conflictPairs.map(([a, b]) => {
        const days = [...new Set(a.section.blocks.flatMap((x) => b.section.blocks.flatMap((y) =>
          x.days.filter((d) => y.days.includes(d) && x.start < y.end && y.start < x.end))))].map((d) => SHORT[d]);
        return `<li>${esc(a.label)} overlaps ${esc(b.label)} on ${esc(days.join(", "))}</li>`;
      }).join("")}</ul></div>` : "";

    const statLine = `
      <div class="statline">
        <span><b>${stats.credits}</b> credits${stats.creditsUnknown ? ` <span class="muted">+ ${`${stats.creditsUnknown} registered ${stats.creditsUnknown === 1 ? "class" : "classes"}`}</span>` : ""}</span>
        <span><b>${stats.placed}</b> placed${weekData.unplaced.length ? ` · ${weekData.unplaced.length} not yet` : ""}</span>
        ${stats.days.length ? `<span>On campus <b>${stats.days.map((d) => SHORT[d]).join(", ")}</b></span>` : ""}
        ${stats.days.length ? `<span><b>${dur(stats.gapMinutes)}</b> between classes / week</span>` : ""}
      </div>`;

    return `
      <div class="sched">
        <div class="planbar">
          <div class="ptabs" role="group" aria-label="Choose a plan">${tabs}</div>
          <div class="ptools">

            <button class="btn ghosty" data-action="copycrns" ${chosenCrns.length ? "" : "disabled"}>

            <svg width="19px" height="19px" version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
 <path d="m70 34h-2v-4c0-6.6289-5.3711-12-12-12h-26c-6.6289 0-12 5.3711-12 12v26c0 6.6289 5.3711 12 12 12h4v2c0 6.6289 5.3711 12 12 12h24c6.6289 0 12-5.3711 12-12v-24c0-6.6289-5.3711-12-12-12zm-36 12v14h-4c-2.2109 0-4-1.7891-4-4v-26c0-2.2109 1.7891-4 4-4h26c1.0625 0 2.0781 0.42188 2.8281 1.1719s1.1719 1.7656 1.1719 2.8281v4h-14c-6.6289 0-12 5.3711-12 12zm40 24c0 1.0625-0.42188 2.0781-1.1719 2.8281s-1.7656 1.1719-2.8281 1.1719h-24c-2.2109 0-4-1.7891-4-4v-24c0-2.2109 1.7891-4 4-4h24c1.0625 0 2.0781 0.42188 2.8281 1.1719s1.1719 1.7656 1.1719 2.8281z"/>
</svg>

            Copy CRNs</button>
            <button class="btn primary" data-action="sendprep" ${chosenCrns.length && !send ? "" : "disabled"}
              title="Types these CRNs into Web4U and add them to your Summary. You still press Submit."><svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor"><path d="M427-427H233.78q-22.08 0-37.54-15.46-15.46-15.45-15.46-37.54t15.46-37.54Q211.7-533 233.78-533H427v-193.22q0-22.08 15.46-37.54 15.45-15.46 37.54-15.46t37.54 15.46Q533-748.3 533-726.22V-533h193.22q22.08 0 37.54 15.46 15.46 15.45 15.46 37.54t-15.46 37.54Q748.3-427 726.22-427H533v193.22q0 22.08-15.46 37.54-15.45 15.46-37.54 15.46t-37.54-15.46Q427-211.7 427-233.78V-427Z"/></svg>Add Plan ${planId} to Web4U</button>
            <button class="btn ghosty danger-text" data-action="clearplan" ${Object.keys(ws.plans[planId].choices).length ? "" : "disabled"}>
            <svg width="19px" height="19px" fill="currentColor" version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<path d="m54 18h-8c-5.5234 0-10 4.4766-10 10v5h-11.828c-2.1094-0.042969-3.9102 1.5156-4.1719 3.6094-0.10938 1.1289 0.26172 2.2461 1.0234 3.0859 0.76172 0.83594 1.8438 1.3086 2.9766 1.3047h1v31c0 2.6523 1.0547 5.1953 2.9297 7.0703s4.418 2.9297 7.0703 2.9297h30c2.6523 0 5.1953-1.0547 7.0703-2.9297s2.9297-4.418 2.9297-7.0703v-31h0.82812c2.1094 0.042969 3.9102-1.5156 4.1719-3.6094 0.10938-1.1289-0.26172-2.2461-1.0234-3.0859-0.76172-0.83594-1.8438-1.3086-2.9766-1.3047h-12v-5c0-2.6523-1.0547-5.1953-2.9297-7.0703s-4.418-2.9297-7.0703-2.9297zm-10 10c0-1.1055 0.89453-2 2-2h8c0.53125 0 1.0391 0.21094 1.4141 0.58594s0.58594 0.88281 0.58594 1.4141v5h-12zm23 13v31c0 0.53125-0.21094 1.0391-0.58594 1.4141s-0.88281 0.58594-1.4141 0.58594h-30c-1.1055 0-2-0.89453-2-2v-31z"/>
</svg>
            Clear Schedule ${planId}</button>
          </div>
        </div>
        <div class="sched-main">
          <aside class="cart" data-drop="unplace" data-scroll="cart">
            <h3>Courses</h3>
            <p class="tip">Drag a course onto the calendar, or press it to pick a time.</p>
            ${chips || `<p class="tip">Add courses from your search results first.</p>`}
            ${regOnly.length ? `<h3>Registered</h3>${regOnly.map((r) => `<div class="chip reg"><span class="chip-code">${esc(r.subject ? `${r.subject} ${r.number}` : `CRN ${r.crn}`)}</span><span class="chip-sub">${esc(r.title || "Registered")}</span></div>`).join("")}` : ""}
          </aside>
          <div class="cal-wrap" data-scroll="cal">
            ${send ? sendSheet(send) : pickBar}
            <div class="cal ${pickCourse ? "picking" : ""}" role="group" aria-label="Weekly calendar for Plan ${planId}" style="--ncols:${fr.days.length}">
              <div class="cal-head"><div></div>${fr.days.map((d) => `<div class="dh">${SHORT[d]}</div>`).join("")}</div>
              <div class="cal-body">
                <div class="gutter" style="height:${height}px">${hours.map((m) => `<span style="top:${(m - fr.lo) * PX_PER_MIN}px">${t12(m).replace(":00", "")} ${ampm(m)}</span>`).join("")}</div>
                ${cols}
              </div>
            </div>
            ${noTimeHtml}
            ${conflictHtml}
            ${statLine}
            ${exportSection(exportInfo, planId)}
          </div>
        </div>
      </div>`;
  }

  function sendSheet(send) {
    const inc = send.items.filter((i) => i.include);
    const stateText = (i) => {
      if (!i.include) return i.registered ? "Already registered, skipped" : "Skipped";
      if (send.stage === "preview") return "";
      if (i.state === "typing") return "Typing CRN…";
      if (i.state === "checked" && send.stage === "running")
        return i.checkOk === false ? `✗ ${i.checkMsg}` : `✓ Web4U found it${i.checkMsg ? `: ${i.checkMsg}` : ""}`;
      if (i.state === "done") return i.ok === false ? `✗ ${i.message}` : i.ok ? "✓ In your Summary (Pending)" : i.message;
      return "Waiting…";
    };
    const cls = (i) => !i.include ? "skip" : i.state === "done" ? (i.ok === false ? "bad" : "good")
      : i.state === "checked" && i.checkOk === false ? "bad" : "";
    const rows = send.items.map((i) => `
      <li class="${cls(i)}">
        ${send.stage === "preview"
          ? `<input type="checkbox" id="send-${esc(i.crn)}" data-action="sendtoggle" data-crn="${esc(i.crn)}" ${i.include ? "checked" : ""} ${i.registered ? "disabled" : ""}>`
          : `<span class="send-dot" aria-hidden="true"></span>`}
        <label for="send-${esc(i.crn)}">
          <b>${esc(i.label)}</b> <span class="muted">CRN ${esc(i.crn)} · ${esc(i.when)}</span>
          ${send.stage === "preview" ? i.flags.map((f) => `<span class="flag">${esc(f)}</span>`).join("") : ""}
          ${stateText(i) ? `<span class="send-state">${esc(stateText(i))}</span>` : ""}
        </label>
      </li>`).join("");

    let intro, buttons;
    if (send.stage === "preview") {
      intro = `<p>The planner will type ${inc.length === 1 ? "this CRN" : "these CRNs"} into Web4U's <b>Enter CRNs</b> tab and press <b>Add to Summary</b>, just like you would.
        They'll show up in your Summary as <b>Pending</b>. <b>Nothing is registered until you press Submit in Web4U yourself.</b></p>`;
      buttons = `<button class="btn primary" data-action="sendgo" ${inc.length ? "" : "disabled"}>Add ${inc.length} ${inc.length === 1 ? "class" : "classes"} to Summary</button>
        <button class="btn ghosty" data-action="sendclose">Cancel</button>`;
    } else if (send.stage === "running") {
      intro = `<p role="status">Working in Web4U… one CRN at a time, waiting for Web4U to check each one.</p>`;
      buttons = "";
    } else if (send.stage === "done") {
      const good = inc.filter((i) => i.ok !== false).length;
      intro = `<p><b>${good} of ${inc.length} ${inc.length === 1 ? "class" : "classes"} ${good === 1 ? "is" : "are"} waiting in your Summary.</b>
        Review ${good === 1 ? "it" : "them"} in Web4U, then press <b>Submit</b> when you're ready. You can still remove anything first.</p>`;
      buttons = `<button class="btn primary" data-action="showsummary">Show me the Summary</button>
        <button class="btn ghosty" data-action="sendclose">Done</button>`;
    } else {
      intro = `<p class="send-err">${esc(send.error)}</p>`;
      buttons = `<button class="btn ghosty" data-action="sendclose">Close</button>`;
    }
    return `
      <section class="send" aria-labelledby="send-h">
        <h4 id="send-h">Add Plan ${esc(send.planId)} to your Web4U Summary</h4>
        ${intro}
        <ul class="send-list">${rows}</ul>
        ${send.unplaced.length && send.stage === "preview" ? `<p class="muted small">Not placed in Plan ${esc(send.planId)}, so not included: ${esc(send.unplaced.join(", "))}.</p>` : ""}
        <div class="send-btns">${buttons}</div>
      </section>`;
  }

  function exportSection(info, planId) {
    const howto = `
      <details class="howto"><summary>How do I import it?</summary>
        <ul>
          <li><b>Google Calendar</b> (on a computer): Settings (gear icon) → <i>Import &amp; export</i> → choose the file.</li>
          <li><b>Apple Calendar</b>: double-click the file on a Mac, or open it from the Files app on iPhone.</li>
          <li><b>Outlook</b>: open the file, or use <i>Add calendar → Upload from file</i>.</li>
        </ul>
        <p>Holidays (Veterans Day, Thanksgiving break) are skipped and classes stop before finals week. Always check against Web4U.</p>
      </details>`;
    if (info.registeredCount) {
      return `<section class="export">
        <div><b>You're registered for ${`${info.registeredCount} ${info.registeredCount === 1 ? "class" : "classes"}`}.</b>
          <p>Add them to Google Calendar, Apple Calendar or Outlook in one step.</p></div>
        <button class="btn primary" data-action="export" data-source="registered"><svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill="#fff"><path d="M457.66-345.2q-9.86-3.93-18.29-12.26L273.13-523.93q-16.96-16.72-16.61-39.79.35-23.08 17.37-39.9 16.96-17.05 40.01-17.05 23.06 0 40.01 17.19l68.74 69.5v-244.78q0-23.67 16.46-40.13t40.01-16.46q23.55 0 40.13 16.46 16.58 16.46 16.58 40.13v244.78l69.5-69.5q16.71-17.19 39.66-16.95 22.95.24 40.12 17.47 16.96 16.96 16.96 39.89 0 22.94-16.96 40.14L518.87-357.46q-8.44 8.33-18.31 12.26-9.87 3.94-21.45 3.94-11.59 0-21.45-3.94ZM237.83-124.65q-47.21 0-80.19-32.99-32.99-32.98-32.99-80.19v-63.41q0-23.34 16.46-39.96 16.46-16.63 40.01-16.63 23.55 0 40.13 16.63 16.58 16.62 16.58 39.96v63.41h484.34v-63.41q0-23.34 16.58-39.96 16.58-16.63 40.13-16.63 23.55 0 40.01 16.63 16.46 16.62 16.46 39.96v63.41q0 47.21-32.99 80.19-32.98 32.99-80.19 32.99H237.83Z"/></svg>Download calendar file (.ics)</button>
        ${howto}</section>`;
    }
    return `<section class="export quiet">
      <div><b>Calendar export</b><p>After you register, come back here to add your classes to Google or Apple Calendar.</p></div>
      ${info.planCount ? `<button class="btn ghosty" data-action="export" data-source="plan">Export Plan ${planId} instead</button>` : ""}
      ${howto}</section>`;
  }

  function compare(ctx) {
    const { ws, planId, weeks, colorOf } = ctx;
    const all = Plan.PLAN_IDS.flatMap((id) => weeks[id].items.map((i) => i.section));
    const fr = frame(all);
    const h = (fr.hi - fr.lo) * MINI_PX_PER_MIN;

    const cards = Plan.PLAN_IDS.map((id) => {
      const wk = weeks[id];
      const st = Plan.stats(wk);
      const perDay = Object.fromEntries(fr.days.map((d) => [d, []]));
      wk.items.forEach((it) => (it.section.blocks || []).forEach((b) => b.days.forEach((d) => perDay[d]?.push({ ...b, it }))));
      const mini = `
        <div class="mini" aria-hidden="true" style="--ncols:${fr.days.length}">
          <div class="mini-head">${fr.days.map((d) => `<span>${SHORT[d][0]}${d === "thursday" ? "h" : ""}</span>`).join("")}</div>
          <div class="mini-body">${fr.days.map((d) => `<div class="mini-col" style="height:${h}px">${
            layout(perDay[d]).map((e) => `<i class="${e.it.kind === "registered" ? "reg" : `c${colorOf(e.it.key)}`}" style="${pos(e, fr.lo, MINI_PX_PER_MIN)}"></i>`).join("")
          }</div>`).join("")}</div>
        </div>`;
      const empty = !wk.items.length;
      const row = (k, v, cls = "") => `<div class="row ${cls}"><dt>${k}</dt><dd>${v}</dd></div>`;
      return `
        <section class="cmp${id === planId ? " on" : ""}" aria-label="Plan ${id}">
          <header><h3>Plan ${id}</h3><button class="btn ghosty" data-action="plan" data-plan="${id}" data-goto="schedule"><svg width="18px" height="18px" fill="currentColor" version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
 <path d="m22 40c1.0625 0 2.0781-0.42188 2.8281-1.1719s1.1719-1.7656 1.1719-2.8281v-6c0-2.2109 1.7891-4 4-4h6c2.2109 0 4-1.7891 4-4s-1.7891-4-4-4h-6c-6.6289 0-12 5.3711-12 12v6c0 1.0625 0.42188 2.0781 1.1719 2.8281s1.7656 1.1719 2.8281 1.1719z"/>
 <path d="m64 82h6c6.6289 0 12-5.3711 12-12v-6c0-2.2109-1.7891-4-4-4s-4 1.7891-4 4v6c0 1.0625-0.42188 2.0781-1.1719 2.8281s-1.7656 1.1719-2.8281 1.1719h-6c-2.2109 0-4 1.7891-4 4s1.7891 4 4 4z"/>
 <path d="m80 38c0-4.7734-1.8945-9.3516-5.2734-12.727-3.375-3.3789-7.9531-5.2734-12.727-5.2734-2.6523-0.007812-5.1992 1.0508-7.0703 2.9297l-32 32c-1.8828 1.8711-2.9375 4.418-2.9297 7.0703v8c0 2.6523 1.0547 5.1953 2.9297 7.0703s4.418 2.9297 7.0703 2.9297h8c2.6523 0.007812 5.1992-1.0508 7.0703-2.9297l32-32c1.8828-1.8711 2.9375-4.418 2.9297-7.0703zm-8.5781 1.4102-32 32c-0.37891 0.37891-0.89062 0.58984-1.4219 0.58984h-8c-1.1055 0-2-0.89453-2-2v-8c0.003906-0.53125 0.21484-1.0352 0.58984-1.4102l32-32c0.375-0.375 0.87891-0.58594 1.4102-0.58984 2.6523 0 5.1953 1.0547 7.0703 2.9297s2.9297 4.418 2.9297 7.0703c-0.003906 0.53125-0.21484 1.0352-0.58984 1.4102z"/>
</svg>Edit Plan ${id}</button></header>
          ${mini}
          ${empty ? `<p class="tip">Nothing placed yet.</p>` : `<dl>
            ${row("Classes", `${st.placed}${wk.unplaced.length ? ` <span class="muted">(${wk.unplaced.length} not placed)</span>` : ""}`)}
            ${row("Credits", `${st.credits}${st.creditsUnknown ? ` <span class="muted">+ ${`${st.creditsUnknown} registered ${st.creditsUnknown === 1 ? "class" : "classes"}`}</span>` : ""}`)}
            ${row("Days on campus", st.days.length ? `${st.days.length} <span class="muted">(${st.days.map((d) => SHORT[d]).join(", ")})</span>` : "—")}
            ${row("Earliest start", st.earliest ? `${t12(st.earliest.min)} ${ampm(st.earliest.min)} <span class="muted">${SHORT[st.earliest.day]}</span>` : "—")}
            ${row("Latest end", st.latest ? `${t12(st.latest.min)} ${ampm(st.latest.min)} <span class="muted">${SHORT[st.latest.day]}</span>` : "—")}
            ${row("Longest day", st.longest ? `${dur(st.longest.min)} <span class="muted">${SHORT[st.longest.day]}</span>` : "—")}
            ${row("Time between classes", `${dur(st.gapMinutes)} <span class="muted">/ week</span>`)}
            ${row("Conflicts", st.conflicts, st.conflicts ? "bad" : "")}
          </dl>`}
        </section>`;
    }).join("");
    return `<div class="compare">${cards}</div>
      <p class="tip center"></p>`;
  }

  return { schedule, compare };
})();
