import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGoogleMapsLink } from "./googleMapsParser.js";

test("parses a /maps/place/ link with name, coords and place id", async () => {
  const result = await parseGoogleMapsLink(
    "https://www.google.com/maps/place/Pizzeria+Roma/@52.520008,13.404954,17z/data=!4m6!3m5!1s0x47a851f4275f0123:0x456789abcdef0123!8m2!3d52.5!4d13.4"
  );
  assert.equal(result.sourceType, "google_maps_place");
  assert.equal(result.placeName, "Pizzeria Roma");
  assert.deepEqual(result.coordinates, { lat: 52.520008, lng: 13.404954 });
  assert.equal(result.placeId, "0x47a851f4275f0123:0x456789abcdef0123");
});

test("parses a /maps/search/ link with query", async () => {
  const result = await parseGoogleMapsLink(
    "https://www.google.com/maps/search/?api=1&query=Pizzeria+Roma+Berlin"
  );
  assert.equal(result.sourceType, "google_maps_search");
  assert.equal(result.query, "Pizzeria Roma Berlin");
});

test("parses a coordinates-only maps link", async () => {
  const result = await parseGoogleMapsLink("https://www.google.com/maps?q=52.520008,13.404954");
  assert.deepEqual(result.coordinates, { lat: 52.520008, lng: 13.404954 });
});

test("flags a generic google search link with a warning", async () => {
  const result = await parseGoogleMapsLink("https://www.google.com/search?q=Pizzeria+Roma");
  assert.equal(result.sourceType, "google_maps_search");
  assert.ok(result.warnings.some((w) => w.includes("allgemeiner Google-Suchlink")));
});

test("rejects an invalid URL", async () => {
  const result = await parseGoogleMapsLink("not-a-url");
  assert.equal(result.sourceType, "unknown");
  assert.ok(result.warnings.some((w) => w.includes("ungültig")));
});

test("rejects a non-google domain", async () => {
  const result = await parseGoogleMapsLink("https://example.com/maps/place/Foo");
  assert.equal(result.sourceType, "unknown");
  assert.ok(result.warnings.some((w) => w.includes("nicht von einer Google-Domain")));
});

test("always appends the unconfirmed-data warning for recognized links", async () => {
  const result = await parseGoogleMapsLink(
    "https://www.google.com/maps/place/Foo/@52.5,13.4,17z"
  );
  assert.ok(result.warnings.some((w) => w.includes("erst nach Bestätigung")));
});
