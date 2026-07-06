// Best-effort "is this restaurant open at a given local time?" check.
//
// openingHours is free-form JSON. Two shapes are understood:
//   1. Google Places: { weekdayDescriptions: ["Montag: 11:00–22:00 Uhr", ...] }
//   2. Plain OSM-style string: "Mo-Fr 11:00-22:00; Sa 12:00-23:00"
// Anything else (or unparseable parts) yields null = unknown, and unknown
// must never exclude a restaurant.

export type LocalTime = { day: number; minutes: number }; // day: 0=Sunday … 6=Saturday

type DayRanges = { open: number; close: number }[]; // minutes since midnight

const DAY_NAMES: Record<string, number> = {
  // German full
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6,
  // English full
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  // OSM / German abbreviations
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
  so: 0, di: 2, mi: 3, do: 4,
};

function dayNumber(name: string): number | null {
  return DAY_NAMES[name.toLowerCase()] ?? null;
}

// "11:00", "9:30", also tolerates narrow spaces and a trailing " Uhr".
const TIME_RE = /(\d{1,2}):(\d{2})/;

// A time range like "11:30–22:00" (hyphen, en-dash or "bis").
const RANGE_RE = /(\d{1,2}:\d{2})\s*(?:[-–—]|bis)\s*(\d{1,2}:\d{2})/g;

function toMinutes(time: string): number | null {
  const m = TIME_RE.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return (h % 24) * 60 + min;
}

// Extracts all "HH:MM-HH:MM" ranges from a description of a single day.
// Returns null when the text carries no usable information.
function parseRanges(text: string): DayRanges | null {
  const cleaned = text.replace(/ | /g, " ");
  if (/24\s*(stunden|hours)|24\/7|durchgehend/i.test(cleaned)) {
    return [{ open: 0, close: 24 * 60 }];
  }
  if (/geschlossen|closed|ruhetag/i.test(cleaned)) return [];

  const ranges: DayRanges = [];
  for (const m of cleaned.matchAll(RANGE_RE)) {
    const open = toMinutes(m[1]);
    const close = toMinutes(m[2]);
    if (open == null || close == null) continue;
    ranges.push({ open, close });
  }
  return ranges.length > 0 ? ranges : null;
}

function inRanges(ranges: DayRanges, minutes: number): boolean {
  return ranges.some((r) =>
    r.close > r.open
      ? minutes >= r.open && minutes < r.close
      : // Overnight range (e.g. 18:00–02:00): open from start until midnight.
        // The after-midnight part counts for the *previous* day and is handled
        // by the caller checking yesterday's ranges too.
        minutes >= r.open
  );
}

function overnightSpill(ranges: DayRanges, minutes: number): boolean {
  // Open because yesterday's overnight range (e.g. 18:00–02:00) spills past midnight.
  return ranges.some((r) => r.close < r.open && minutes < r.close);
}

// Google Places shape: one description string per weekday.
function fromWeekdayDescriptions(descriptions: unknown): Map<number, DayRanges> | null {
  if (!Array.isArray(descriptions) || descriptions.length === 0) return null;
  const byDay = new Map<number, DayRanges>();
  for (const entry of descriptions) {
    if (typeof entry !== "string") continue;
    const colon = entry.indexOf(":");
    if (colon < 0) continue;
    const day = dayNumber(entry.slice(0, colon).trim());
    if (day == null) continue;
    const ranges = parseRanges(entry.slice(colon + 1));
    if (ranges != null) byDay.set(day, ranges);
  }
  return byDay.size > 0 ? byDay : null;
}

// OSM-style string: rules separated by ";", each "Mo-Fr 11:00-22:00" or
// "Sa,So 12:00-23:00". Unknown syntax in a rule makes that rule void.
function fromOsmString(value: string): Map<number, DayRanges> | null {
  const byDay = new Map<number, DayRanges>();
  for (const rule of value.split(";")) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    const m = /^([A-Za-z,\s-]+?)\s+(.+)$/.exec(trimmed);
    if (!m) continue;
    const days: number[] = [];
    for (const part of m[1].split(",")) {
      const span = part.trim().split("-");
      if (span.length === 2) {
        const from = dayNumber(span[0].trim());
        const to = dayNumber(span[1].trim());
        if (from == null || to == null) continue;
        // Weekday spans wrap Monday-first (Mo-Su, Sa-Mo, …).
        for (let d = from; ; d = (d + 1) % 7) {
          days.push(d);
          if (d === to) break;
        }
      } else {
        const d = dayNumber(part.trim());
        if (d != null) days.push(d);
      }
    }
    const ranges = parseRanges(m[2]);
    if (ranges == null || days.length === 0) continue;
    for (const d of days) byDay.set(d, [...(byDay.get(d) ?? []), ...ranges]);
  }
  return byDay.size > 0 ? byDay : null;
}

export function isOpenAt(openingHours: unknown, at: LocalTime): boolean | null {
  if (openingHours == null) return null;

  let byDay: Map<number, DayRanges> | null = null;
  if (typeof openingHours === "string") {
    byDay = fromOsmString(openingHours);
  } else if (typeof openingHours === "object") {
    const obj = openingHours as Record<string, unknown>;
    byDay = fromWeekdayDescriptions(obj.weekdayDescriptions);
  }
  if (!byDay) return null;

  const today = byDay.get(at.day);
  if (today && inRanges(today, at.minutes)) return true;

  const yesterday = byDay.get((at.day + 6) % 7);
  if (yesterday && overnightSpill(yesterday, at.minutes)) return true;

  // Only claim "closed" when we actually know today's hours.
  return today != null ? false : null;
}
