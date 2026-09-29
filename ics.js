const ICS = (() => {
  const TERM_CALENDAR = {
    "202640": {
      classesBegin: "2026-09-23",
      lastClassDay: "2026-12-04",
      noClasses: [
        "2026-11-11",
        "2026-11-25", "2026-11-26", "2026-11-27",
      ],
    },
  };

  const BYDAY = { monday: "MO", tuesday: "TU", wednesday: "WE", thursday: "TH", friday: "FR", saturday: "SA", sunday: "SU" };
  const DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

  const toUTC = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fromUTC = (dt) => dt.toISOString().slice(0, 10);
  const addDays = (iso, n) => { const d = toUTC(iso); d.setUTCDate(d.getUTCDate() + n); return fromUTC(d); };
  const weekday = (iso) => toUTC(iso).getUTCDay();
  const compact = (iso) => iso.replace(/-/g, "");
  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;
  const maxDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
  const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

  function firstMeeting(from, days) {
    const wanted = new Set(days.map((d) => DAY_INDEX[d]));
    for (let i = 0; i < 7; i++) { const d = addDays(from, i); if (wanted.has(weekday(d))) return d; }
    return from;
  }

  const escText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  function fold(line) {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;
    const out = [];
    let cur = "", curLen = 0;
    for (const ch of line) {
      const len = new TextEncoder().encode(ch).length;
      if (curLen + len > (out.length ? 74 : 75)) { out.push(cur); cur = ""; curLen = 0; }
      cur += ch; curLen += len;
    }
    out.push(cur);
    return out.join("\r\n ");
  }

  const VTIMEZONE = [
    "BEGIN:VTIMEZONE", "TZID:America/Los_Angeles",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0800", "TZOFFSETTO:-0700", "TZNAME:PDT",
    "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:-0700", "TZOFFSETTO:-0800", "TZNAME:PST",
    "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
    "END:VTIMEZONE",
  ];

  function build({ term, termDesc, classes, now = new Date() }) {
    const cal = TERM_CALENDAR[term];
    const warnings = [];
    if (!cal) warnings.push(`Holidays and finals week aren't built in for ${termDesc || "this term"} yet, so classes may appear on days off. Double-check your calendar.`);
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WWU Class Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      `X-WR-CALNAME:${escText(`WWU ${termDesc || "classes"}`)}`, "X-WR-TIMEZONE:America/Los_Angeles",
      ...VTIMEZONE,
    ];
    let eventCount = 0;
    const skipped = [];

    for (const c of classes) {
      const blocks = c.section?.blocks || [];
      if (!blocks.length) { skipped.push(`${c.label} (CRN ${c.crn})`); continue; }
      blocks.forEach((b, i) => {
        if (!b.days?.length) return;
        const start = maxDate(b.startDate, cal?.classesBegin);
        const end = cal ? minDate(b.endDate, cal.lastClassDay) || cal.lastClassDay : b.endDate;
        if (!start || !end) { skipped.push(`${c.label} (CRN ${c.crn})`); return; }
        const first = firstMeeting(start, b.days);
        if (first > end) return;
        const tz = "TZID=America/Los_Angeles";
        const exdates = (cal?.noClasses || [])
          .filter((d) => d >= first && d <= end && b.days.some((day) => DAY_INDEX[day] === weekday(d)))
          .map((d) => `${compact(d)}T${hhmm(b.start)}`);
        const until = `${compact(addDays(end, 1))}T075959Z`;
        const where = b.whereLong || b.where || "";
        const known = !!(c.instructor || b.where);
        const readable = (n) => { const parts = n.split(","); return parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : n; };
        const professor = c.instructor && c.instructor !== "TBA" ? readable(c.instructor) : "TBA";
        const room = where && where !== "TBA" ? where : "TBA";
        const format = c.section?.async ? "Hybrid (part of this class is online)" : "In person";
        const desc = [
          `Professor: ${professor}`,
          `Location: ${room}`,
          known ? `Format: ${format}` : null,
          "Added with Web5u.",
        ].filter(Boolean).join("\n");

        lines.push(
          "BEGIN:VEVENT",
          `UID:${term}-${c.crn}-${i}@wwu-class-planner`,
          `DTSTAMP:${stamp}`,
          `DTSTART;${tz}:${compact(first)}T${hhmm(b.start)}`,
          `DTEND;${tz}:${compact(first)}T${hhmm(b.end)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${b.days.map((d) => BYDAY[d]).join(",")};UNTIL=${until}`,
          ...(exdates.length ? [`EXDATE;${tz}:${exdates.join(",")}`] : []),
          `SUMMARY:${escText(`${c.label} — ${c.title}`.replace(/ — $/, ""))}`,
          ...(where && where !== "TBA" ? [`LOCATION:${escText(where)}`] : []),
          `DESCRIPTION:${escText(desc)}`,
          "END:VEVENT",
        );
        eventCount++;
      });
    }
    lines.push("END:VCALENDAR");
    if (skipped.length) warnings.push(`${[...new Set(skipped)].join(", ")} ${skipped.length === 1 ? "has" : "have"} no set meeting time, so ${skipped.length === 1 ? "it isn't" : "they aren't"} in the file.`);
    return { text: lines.map(fold).join("\r\n") + "\r\n", warnings, eventCount };
  }

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.style.display = "none";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return { build, download, TERM_CALENDAR };
})();
