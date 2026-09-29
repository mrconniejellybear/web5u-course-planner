const Plan = (() => {
  const PLAN_IDS = ["A", "B", "C"];
  const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const emptyPlans = () => Object.fromEntries(PLAN_IDS.map((id) => [id, { choices: {} }]));
  const emptyPlan = (term, termDesc = "") =>
    ({ term, termDesc, courses: {}, plans: emptyPlans(), active: "A", updatedAt: Date.now() });

  function migrate(ws) {
    if (!ws) return ws;
    if (!ws.plans) {
      ws.plans = emptyPlans();
      for (const c of Object.values(ws.courses || {})) {
        if (c.chosen) ws.plans.A.choices[c.key] = c.chosen;
        delete c.chosen;
      }
    }
    for (const id of PLAN_IDS) ws.plans[id] ||= { choices: {} };
    if (!PLAN_IDS.includes(ws.active)) ws.active = "A";
    ws.courses ||= {};
    return ws;
  }

  function addCourse(ws, sectionsOfCourse, { complete = false } = {}) {
    if (!sectionsOfCourse.length) return null;
    const first = sectionsOfCourse[0];
    let course = ws.courses[first.courseKey];
    if (!course) {
      course = ws.courses[first.courseKey] = {
        key: first.courseKey, subject: first.subject, number: first.number, title: first.title,
        credits: first.credits, addedAt: Date.now(), complete: false, sections: {}, excluded: [],
      };
    }
    sectionsOfCourse.forEach((s) => { course.sections[s.crn] = s; });
    if (complete) course.complete = true;
    if (!ws.termDesc && first.termDesc) ws.termDesc = first.termDesc;
    return course;
  }

  function mergeSeen(ws, sections, completeKeys = new Set()) {
    let changed = false;
    for (const s of sections) {
      const course = ws.courses[s.courseKey];
      if (!course) continue;
      course.sections[s.crn] = s;
      changed = true;
    }
    for (const key of completeKeys) {
      if (ws.courses[key] && !ws.courses[key].complete) { ws.courses[key].complete = true; changed = true; }
    }
    return changed;
  }

  function removeCourse(ws, key) {
    delete ws.courses[key];
    for (const id of PLAN_IDS) delete ws.plans[id].choices[key];
  }

  function clearCourses(ws) {
    ws.courses = {};
    for (const id of PLAN_IDS) ws.plans[id].choices = {};
  }

  function toggleExcluded(ws, key, crn) {
    const c = ws.courses[key];
    if (!c) return;
    const i = c.excluded.indexOf(crn);
    if (i === -1) {
      c.excluded.push(crn);
      for (const id of PLAN_IDS) if (ws.plans[id].choices[key] === crn) delete ws.plans[id].choices[key];
    } else c.excluded.splice(i, 1);
  }

  const includedSections = (course) =>
    Object.values(course.sections).filter((s) => !course.excluded.includes(s.crn));

  const orderedCourses = (ws) => Object.values(ws.courses).sort((a, b) => a.addedAt - b.addedAt);

  function choose(ws, planId, key, crn) {
    const c = ws.courses[key];
    if (!c || !c.sections[crn] || c.excluded.includes(crn)) return false;
    ws.plans[planId].choices[key] = crn;
    return true;
  }
  function unchoose(ws, planId, key) { delete ws.plans[planId].choices[key]; }
  function clearPlan(ws, planId) { ws.plans[planId].choices = {}; }
  function copyPlan(ws, from, to) { ws.plans[to].choices = { ...ws.plans[from].choices }; }

  function week(ws, planId, registered = []) {
    const regKeys = new Set(registered.map((r) => r.courseKey).filter(Boolean));
    const items = registered.map((r) => ({
      kind: "registered", key: r.courseKey || `crn${r.crn}`, crn: r.crn,
      label: r.subject ? `${r.subject} ${r.number}` : `CRN ${r.crn}`, title: r.title || "", section: r,
    }));
    const unplaced = [];
    const choices = ws.plans[planId]?.choices || {};
    for (const c of orderedCourses(ws)) {
      if (regKeys.has(c.key)) continue;
      const crn = choices[c.key];
      const s = crn && c.sections[crn];
      if (s && !c.excluded.includes(crn)) {
        items.push({ kind: "chosen", key: c.key, crn, label: `${c.subject} ${c.number}`, title: c.title, section: s });
      } else unplaced.push(c);
    }
    return { items, unplaced };
  }

  function weekConflicts(items) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (conflicts(items[i].section, items[j].section)) out.push([items[i], items[j]]);
      }
    }
    return out;
  }

  const conflictsWith = (section, items, ownKey) =>
    items.filter((it) => it.key !== ownKey && conflicts(section, it.section));

  function stats(weekData) {
    const byDay = new Map();
    let credits = 0, creditsUnknown = 0;
    for (const it of weekData.items) {
      if (it.section.credits == null) creditsUnknown++;
      credits += Number(it.section.credits) || 0;
      for (const b of it.section.blocks || []) {
        for (const d of b.days) {
          if (!byDay.has(d)) byDay.set(d, []);
          byDay.get(d).push([b.start, b.end]);
        }
      }
    }
    let earliest = null, latest = null, longest = null, gapMinutes = 0;
    for (const [day, spans] of byDay) {
      spans.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const s of spans) {
        const last = merged[merged.length - 1];
        if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([...s]);
      }
      for (let i = 1; i < merged.length; i++) gapMinutes += merged[i][0] - merged[i - 1][1];
      const first = merged[0][0], end = merged[merged.length - 1][1];
      if (!earliest || first < earliest.min) earliest = { min: first, day };
      if (!latest || end > latest.min) latest = { min: end, day };
      if (!longest || end - first > longest.min) longest = { min: end - first, day };
    }
    const days = DAY_ORDER.filter((d) => byDay.has(d));
    return {
      credits, creditsUnknown,
      placed: weekData.items.length,
      unplaced: weekData.unplaced.length,
      days, earliest, latest, longest, gapMinutes,
      conflicts: weekConflicts(weekData.items).length,
    };
  }

  const NEUTRAL_PARAMS = new Set([
    "txt_subject", "txt_courseNumber", "txt_term", "txt_campus",
    "startDatepicker", "endDatepicker", "pageOffset", "pageMaxSize",
    "sortColumn", "sortDirection", "uniqueSessionId", "_",
  ]);
  function completeCourseKeys(url, json, sections) {
    const keys = new Set();
    try {
      const params = new URL(url, "https://example.invalid/").searchParams;
      for (const [k, v] of params) {
        if (!NEUTRAL_PARAMS.has(k) && v !== "" && v !== "false") return keys;
      }
      if ((json.pageOffset || 0) !== 0 || sections.length < json.totalCount) return keys;
      sections.forEach((s) => keys.add(s.courseKey));
    } catch (_) {  }
    return keys;
  }

  function groupByCourse(sections) {
    const map = new Map();
    for (const s of sections) {
      if (!map.has(s.courseKey)) map.set(s.courseKey, []);
      map.get(s.courseKey).push(s);
    }
    return map;
  }

  function summarize(ws) {
    const courses = orderedCourses(ws);
    const credits = courses.reduce((n, c) => n + (Number(c.credits) || 0), 0);
    const gurs = new Map();
    for (const c of courses) {
      for (const s of includedSections(c)) {
        for (const g of s.gurs || []) {
          if (!gurs.has(g.code)) gurs.set(g.code, { ...g, courses: new Set() });
          gurs.get(g.code).courses.add(`${c.subject} ${c.number}`);
        }
      }
    }
    return { courses, credits, gurs: [...gurs.values()] };
  }

  return {
    PLAN_IDS, emptyPlan, migrate,
    addCourse, mergeSeen, removeCourse, clearCourses, toggleExcluded, includedSections, orderedCourses,
    choose, unchoose, clearPlan, copyPlan, week, weekConflicts, conflictsWith, stats,
    completeCourseKeys, groupByCourse, summarize,
  };
})();
