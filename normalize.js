const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_ABBR = { monday: "M", tuesday: "T", wednesday: "W", thursday: "R", friday: "F", saturday: "S", sunday: "U" };

const toMin = (t) => (t ? parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(2), 10) : null);

const fmtMin = (m) => {
  const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "AM" : "PM"}`;
};

const toISODate = (d) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || "");
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
};

function parseGur(description) {
  const rest = description.replace(/^GUR\s+/, "");
  const i = rest.indexOf("-");
  return i === -1 ? { code: rest, label: rest } : { code: rest.slice(0, i), label: rest.slice(i + 1) };
}

function normalizeSection(raw) {
  const meetings = (raw.meetingsFaculty || []).map((m) => m.meetingTime).filter(Boolean);
  return {
    crn: raw.courseReferenceNumber,
    courseKey: raw.subjectCourse,
    term: raw.term,
    termDesc: raw.termDesc,
    title: raw.courseTitle,
    subject: raw.subject,
    number: raw.courseNumber,
    type: raw.scheduleTypeDescription,
    credits: raw.creditHours ?? raw.creditHourLow,
    seats: raw.seatsAvailable,
    capacity: raw.maximumEnrollment,
    waitCount: raw.waitCount,
    open: raw.openSection,
    linked: raw.isSectionLinked ? raw.linkIdentifier : null,
    instructor: (raw.faculty || []).find((f) => f.primaryIndicator)?.displayName ?? "TBA",
    gurs: (raw.sectionAttributes || [])
      .filter((a) => a.description?.startsWith("GUR"))
      .map((a) => parseGur(a.description)),
    blocks: meetings
      .filter((m) => m.beginTime && m.endTime)
      .map((m) => ({
        days: DAYS.filter((d) => m[d]),
        start: toMin(m.beginTime),
        end: toMin(m.endTime),
        where: m.building ? `${m.building} ${m.room ?? ""}`.trim() : "TBA",
        whereLong: m.buildingDescription ? `${m.buildingDescription} ${m.room ?? ""}`.trim() : "",
        startDate: toISODate(m.startDate),
        endDate: toISODate(m.endDate),
      })),
    async: meetings.length === 0 || meetings.some((m) => !m.beginTime),
    seenAt: Date.now(),
  };
}

function conflicts(a, b) {
  return a.blocks.some((x) =>
    b.blocks.some((y) =>
      x.days.some((d) => y.days.includes(d)) && x.start < y.end && y.start < x.end));
}

function describeBlocks(s, { withRoom = true } = {}) {
  if (!s.blocks.length) return s.async ? "No set time (online)" : "TBA";
  return s.blocks
    .map((b) => `${b.days.map((d) => DAY_ABBR[d]).join("")} ${fmtMin(b.start)}–${fmtMin(b.end)}` +
      (withRoom ? ` (${b.where})` : ""))
    .join(" + ");
}
