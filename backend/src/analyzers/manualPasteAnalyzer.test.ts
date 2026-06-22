import assert from "node:assert/strict";
import { test } from "node:test";
import { ManualPasteAnalyzer } from "./manualPasteAnalyzer.js";

const analyzer = new ManualPasteAnalyzer();

function fieldValue(facts: { field: string; value: unknown }[], field: string) {
  return facts.find((f) => f.field === field)?.value;
}

test("extracts phone, www-url, address and city from pasted text", async () => {
  const result = await analyzer.analyze({
    pastedText:
      "Pizzeria Roma\nMusterstraße 12, 10115 Berlin\nTel: 030 1234567\nwww.example-roma.de",
  });
  assert.equal(fieldValue(result.extractedFacts, "phone"), "030 1234567");
  assert.equal(fieldValue(result.extractedFacts, "website"), "www.example-roma.de");
  assert.equal(fieldValue(result.extractedFacts, "address"), "Musterstraße 12");
  assert.equal(fieldValue(result.extractedFacts, "city"), "Berlin");
});

test("expands weekday ranges in opening hours (Mo-Fr)", async () => {
  const result = await analyzer.analyze({ pastedText: "Mo-Fr: 11:00-22:00" });
  const hours = fieldValue(result.extractedFacts, "openingHours") as Record<string, string>;
  assert.equal(hours.Montag, "11:00-22:00");
  assert.equal(hours.Freitag, "11:00-22:00");
  assert.equal(hours.Mittwoch, "11:00-22:00");
  assert.ok(!hours.Samstag);
});

test("address does not bleed across newlines into the name above it", async () => {
  const result = await analyzer.analyze({
    pastedText: "Restaurant Name Here\nMusterstraße 12, 10115 Berlin",
  });
  assert.equal(fieldValue(result.extractedFacts, "address"), "Musterstraße 12");
});

test("detects dietary and service keywords", async () => {
  const result = await analyzer.analyze({
    pastedText: "Wir bieten vegetarische und vegane Gerichte sowie Lieferung an.",
  });
  assert.equal(fieldValue(result.extractedFacts, "vegetarianOptions"), true);
  assert.equal(fieldValue(result.extractedFacts, "veganOptions"), true);
  assert.equal(fieldValue(result.extractedFacts, "deliveryAvailable"), true);
});

test("returns a warning for empty input", async () => {
  const result = await analyzer.analyze({ pastedText: "" });
  assert.equal(result.extractedFacts.length, 0);
  assert.ok(result.warnings.length > 0);
});
