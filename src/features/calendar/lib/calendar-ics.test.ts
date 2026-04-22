import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarEvent,
  buildCalendarIcs,
  escapeCalendarText,
  foldCalendarLine,
  formatCalendarPragueDateTime,
  formatCalendarUtcDateTime,
} from "./calendar-ics";

test("escapeCalendarText escapes delimiters and new lines", () => {
  assert.equal(
    escapeCalendarText("Laminace, obočí; Jana\nPoznámka"),
    "Laminace\\, obočí\\; Jana\\nPoznámka",
  );
});

test("foldCalendarLine folds UTF-8 content with continuation prefix", () => {
  const folded = foldCalendarLine(`SUMMARY:${"Žluťoučký kůň ".repeat(8)}`);

  assert.match(folded, /\r\n /);
});

test("calendar date formatting keeps UTC and Europe/Prague outputs explicit", () => {
  const value = new Date("2026-03-30T08:15:00.000Z");

  assert.equal(formatCalendarUtcDateTime(value), "20260330T081500Z");
  assert.equal(formatCalendarPragueDateTime(value), "20260330T101500");
});

test("buildCalendarEvent outputs a Prague-tz VEVENT", () => {
  const event = buildCalendarEvent({
    uid: "booking-1@example.com",
    summary: "Laminace obočí – Jana Nováková",
    description: "Klientka: Jana Nováková\nTelefon: +420 777 000 000",
    location: "PP Studio, Sadová 2, Zlín",
    status: "CONFIRMED",
    startsAt: new Date("2026-04-22T08:00:00.000Z"),
    endsAt: new Date("2026-04-22T09:00:00.000Z"),
    dtStamp: new Date("2026-04-20T07:00:00.000Z"),
    lastModified: new Date("2026-04-21T10:30:00.000Z"),
    sequence: 123,
  });

  assert.match(event, /BEGIN:VEVENT/);
  assert.match(event, /DTSTART;TZID=Europe\/Prague:20260422T100000/);
  assert.match(event, /DTEND;TZID=Europe\/Prague:20260422T110000/);
  assert.match(event, /DESCRIPTION:Klientka: Jana Nováková\\nTelefon: \+420 777 000 000/);
  assert.match(event, /STATUS:CONFIRMED/);
  assert.match(event, /END:VEVENT/);
});

test("buildCalendarIcs wraps events in VCALENDAR", () => {
  const ics = buildCalendarIcs({
    productId: "-//PP Studio//Test//CS",
    name: "PP Studio test",
    description: "Test feed",
    events: [],
  });

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /METHOD:PUBLISH/);
  assert.match(ics, /BEGIN:VTIMEZONE/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
