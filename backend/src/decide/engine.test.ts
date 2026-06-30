import assert from "node:assert/strict";
import { test } from "node:test";
import type { Restaurant } from "@prisma/client";
import { decide } from "./engine.js";

function makeRestaurant(overrides: Partial<Restaurant>): Restaurant {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: overrides.name ?? "Test",
    categories: [],
    subcategories: [],
    address: null,
    district: null,
    latitude: null,
    longitude: null,
    website: null,
    googleMapsLink: null,
    googlePlaceId: null,
    phone: null,
    openingHours: null,
    priceLevel: null,
    distance: null,
    tags: [],
    signatureDishes: [],
    vegetarianOptions: null,
    veganOptions: null,
    reservationRecommended: null,
    deliveryAvailable: null,
    takeawayAvailable: null,
    ambience: [],
    suitability: [],
    personalRating: null,
    externalRating: null,
    notes: null,
    classification: null,
    favorite: false,
    blacklisted: false,
    lastVisitedAt: null,
    fieldStatuses: null,
    confidenceByField: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Restaurant;
}

test("blacklisted restaurants are always excluded", () => {
  const restaurants = [
    makeRestaurant({ id: "a", name: "Good", personalRating: 5 }),
    makeRestaurant({ id: "b", name: "Blacklisted", personalRating: 5, blacklisted: true }),
  ];
  const result = decide(restaurants, { mode: "balanced", seed: 1 });
  assert.equal(result.suggestion?.restaurant.id, "a");
  assert.equal(result.excludedCount, 1);
});

test("recently visited restaurants are blocked by repeatBlockDays", () => {
  const recent = new Date();
  recent.setDate(recent.getDate() - 3);
  const restaurants = [
    makeRestaurant({ id: "a", name: "Recent", personalRating: 5, lastVisitedAt: recent }),
    makeRestaurant({ id: "b", name: "Old", personalRating: 3 }),
  ];
  const result = decide(restaurants, { mode: "balanced", repeatBlockDays: 14, seed: 1 });
  assert.equal(result.suggestion?.restaurant.id, "b");
  assert.equal(result.excludedCount, 1);
});

test("balanced mode favors high personal rating", () => {
  const restaurants = [
    makeRestaurant({ id: "low", personalRating: 1 }),
    makeRestaurant({ id: "high", personalRating: 5 }),
  ];
  const result = decide(restaurants, { mode: "balanced", seed: 42 });
  assert.equal(result.suggestion?.restaurant.id, "high");
});

test("classification filter only considers matching restaurants", () => {
  const restaurants = [
    makeRestaurant({ id: "neu", classification: "NEW", personalRating: 1 }),
    makeRestaurant({ id: "empf", classification: "RECOMMENDATION", personalRating: 5 }),
  ];
  const result = decide(restaurants, { mode: "balanced", classification: "NEW", seed: 7 });
  assert.equal(result.suggestion?.restaurant.id, "neu");
  assert.equal(result.excludedCount, 1);
});

test("cheap mode favors lower price level", () => {
  const restaurants = [
    makeRestaurant({ id: "expensive", priceLevel: 4 }),
    makeRestaurant({ id: "cheap", priceLevel: 1 }),
  ];
  const result = decide(restaurants, { mode: "cheap", seed: 3 });
  assert.equal(result.suggestion?.restaurant.id, "cheap");
});

test("same seed produces deterministic result", () => {
  const restaurants = [
    makeRestaurant({ id: "a", personalRating: 3 }),
    makeRestaurant({ id: "b", personalRating: 3 }),
    makeRestaurant({ id: "c", personalRating: 3 }),
  ];
  const r1 = decide(restaurants, { mode: "balanced", seed: 99 });
  const r2 = decide(restaurants, { mode: "balanced", seed: 99 });
  assert.equal(r1.suggestion?.restaurant.id, r2.suggestion?.restaurant.id);
});

test("maxPriceLevel hard filter excludes pricier restaurants", () => {
  const restaurants = [
    makeRestaurant({ id: "ok", priceLevel: 2, personalRating: 3 }),
    makeRestaurant({ id: "toopricey", priceLevel: 4, personalRating: 5 }),
  ];
  const result = decide(restaurants, { mode: "balanced", maxPriceLevel: 2, seed: 1 });
  assert.equal(result.suggestion?.restaurant.id, "ok");
  assert.equal(result.excludedCount, 1);
});

test("returns null suggestion when all excluded", () => {
  const restaurants = [makeRestaurant({ id: "a", blacklisted: true })];
  const result = decide(restaurants, { mode: "balanced", seed: 1 });
  assert.equal(result.suggestion, null);
  assert.equal(result.excludedCount, 1);
});
