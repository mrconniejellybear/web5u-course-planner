const Registered = (() => {
  const DAYS_BY_INDEX = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const crnOf = (o) => String(o.courseReferenceNumber ?? o.crn ?? "").trim() || null;

  function parseLocal(dt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(dt || "");
    if (!m) return null;
    const dayIdx = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
    return { day: DAYS_BY_INDEX[dayIdx], min: +m[4] * 60 + +m[5], date: `${m[1]}-${m[2]}-${m[3]}` };
  }

  const looksDropped = (o) =>
    /(delete|dropp|withdr|cancel)/i.test(`${o.statusDescription ?? ""} ${o.registrationStatusDescription ?? ""} ${o.courseRegistrationStatusDescription ?? ""}`);

  function fromEvents(json) {
    const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : null;
    if (!list) return null;
    const byCrn = new Map();
    for (const e of list) {
      if (!e || typeof e !== "object") continue;
      const crn = crnOf(e);
      const s = parseLocal(e.start), en = parseLocal(e.end);
      if (!crn || !s || !en || looksDropped(e)) continue;
      if (e.className && /(pending|delete|drop)/i.test(e.className)) continue;
      if (!byCrn.has(crn)) {
        byCrn.set(crn, {
          crn,
          term: e.term || null,
          subject: e.subject || null,
          number: e.courseNumber || null,
          courseKey: e.subject && e.courseNumber ? `${e.subject}${e.courseNumber}` : null,
          title: e.title || e.courseTitle || "",
          credits: null,
          blocks: [],
          async: false,
          source: "events",
        });
      }
      const r = byCrn.get(crn);
      let b = r.blocks.find((x) => x.start === s.min && x.end === en.min);
      if (!b) { b = { days: [], start: s.min, end: en.min, where: "", whereLong: "", startDate: null, endDate: null }; r.blocks.push(b); }
      if (!b.days.includes(s.day)) b.days.push(s.day);
    }
    for (const r of byCrn.values()) {
      for (const b of r.blocks) b.days.sort((a, c) => ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].indexOf(a) -
        ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].indexOf(c));
    }
    return byCrn;
  }

  function fromSubmit(json) {
    const registered = new Set(), dropped = new Set();
    const walk = (o, depth = 0) => {
      if (!o || typeof o !== "object" || depth > 6) return;
      if (Array.isArray(o)) { o.forEach((x) => walk(x, depth + 1)); return; }
      const crn = crnOf(o);
      const status = `${o.statusDescription ?? ""} ${o.registrationStatusDescription ?? ""} ${o.courseRegistrationStatusDescription ?? ""}`;
      if (crn && status.trim()) {
        const failed = /(error|prevent|fail)/i.test(status) || o.errorFlag === "F" || o.errorFlag === "E" || o.error === true ||
          (Array.isArray(o.messages) && o.messages.some((m) => /error|fatal/i.test(m?.type ?? "")));
        if (!failed && /regist/i.test(status) && !looksDropped(o)) registered.add(crn);
        else if (looksDropped(o)) dropped.add(crn);
      }
      for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, depth + 1);
    };
    walk(json);
    return { registered, dropped };
  }

  function fromAdd(json) {
    const out = new Map();
    const list = Array.isArray(json?.aaData) ? json.aaData : Array.isArray(json?.data) ? json.data : [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const model = entry.model && typeof entry.model === "object" ? entry.model : entry;
      const crn = crnOf(model) || crnOf(entry);
      if (!crn) continue;
      const msgs = [entry.message, model.message,
        ...(Array.isArray(entry.messages) ? entry.messages : []), ...(Array.isArray(model.messages) ? model.messages : [])]
        .map((m) => (typeof m === "string" ? m : m?.message)).filter(Boolean);
      const status = `${model.statusDescription ?? ""} ${model.registrationStatusDescription ?? ""}`.trim();
      const failed = entry.success === false || model.errorFlag === "F" || model.errorFlag === "E" ||
        /(error|prevent|fail)/i.test(status);
      out.set(crn, { ok: !failed, message: [...new Set(msgs)].join(" ") || status || (failed ? "Web4U didn't accept this class." : "Added as Pending") });
    }
    return out;
  }

  function shape(json) {
    if (Array.isArray(json)) return `array(${json.length})${json[0] && typeof json[0] === "object" ? ` of {${Object.keys(json[0]).join(", ")}}` : ""}`;
    if (json && typeof json === "object") return `{${Object.keys(json).join(", ")}}`;
    return typeof json;
  }

  return { fromEvents, fromSubmit, fromAdd, shape, parseLocal };
})();
