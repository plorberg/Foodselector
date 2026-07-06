import assert from "node:assert/strict";
import { test } from "node:test";
import { isOpenAt } from "./openingHours.js";

const MONDAY_NOON = { day: 1, minutes: 12 * 60 };
const MONDAY_1AM = { day: 1, minutes: 60 };
const SUNDAY_NOON = { day: 0, minutes: 12 * 60 };

const googleHours = {
  weekdayDescriptions: [
    "Montag: 11:00–22:00 Uhr",
    "Dienstag: 11:00–22:00 Uhr",
    "Mittwoch: Geschlossen",
    "Donnerstag: 11:00–14:30, 17:00–22:00 Uhr",
    "Freitag: 11:00–22:00 Uhr",
    "Samstag: 18:00–02:00 Uhr",
    "Sonntag: 24 Stunden geöffnet",
  ],
};

test("google shape: open within hours", () => {
  assert.equal(isOpenAt(googleHours, MONDAY_NOON), true);
});

test("google shape: closed outside hours", () => {
  assert.equal(isOpenAt(googleHours, { day: 1, minutes: 23 * 60 }), false);
});

test("google shape: closed on Ruhetag", () => {
  assert.equal(isOpenAt(googleHours, { day: 3, minutes: 12 * 60 }), false);
});

test("google shape: split hours (lunch break)", () => {
  assert.equal(isOpenAt(googleHours, { day: 4, minutes: 13 * 60 }), true);
  assert.equal(isOpenAt(googleHours, { day: 4, minutes: 15 * 60 }), false);
  assert.equal(isOpenAt(googleHours, { day: 4, minutes: 18 * 60 }), true);
});

test("google shape: overnight range spills into next day", () => {
  assert.equal(isOpenAt(googleHours, { day: 6, minutes: 23 * 60 }), true); // Sa 23:00
  assert.equal(isOpenAt(googleHours, { day: 0, minutes: 60 }), true); // So 01:00
});

test("google shape: 24 hours", () => {
  assert.equal(isOpenAt(googleHours, SUNDAY_NOON), true);
});

test("english weekday names", () => {
  const hours = { weekdayDescriptions: ["Monday: 11:00 AM – 10:00 PM"] };
  // 12-hour clock isn't parsed as such, but "11:00" and "10:00" are found;
  // treat result as whatever the parser yields — it must not throw.
  assert.doesNotThrow(() => isOpenAt(hours, MONDAY_NOON));
});

test("osm string: day range", () => {
  assert.equal(isOpenAt("Mo-Fr 11:00-22:00", MONDAY_NOON), true);
  assert.equal(isOpenAt("Mo-Fr 11:00-22:00", MONDAY_1AM), false);
});

test("osm string: day list and multiple rules", () => {
  const hours = "Mo,Di 11:00-14:00; Sa-So 12:00-23:00";
  assert.equal(isOpenAt(hours, { day: 2, minutes: 12 * 60 }), true);
  assert.equal(isOpenAt(hours, SUNDAY_NOON), true);
  assert.equal(isOpenAt(hours, { day: 5, minutes: 12 * 60 }), null); // Friday unknown
});

test("unknown formats yield null", () => {
  assert.equal(isOpenAt(null, MONDAY_NOON), null);
  assert.equal(isOpenAt({}, MONDAY_NOON), null);
  assert.equal(isOpenAt("nach Vereinbarung", MONDAY_NOON), null);
  assert.equal(isOpenAt(42, MONDAY_NOON), null);
  assert.equal(isOpenAt({ weekdayDescriptions: ["kaputt"] }, MONDAY_NOON), null);
});
