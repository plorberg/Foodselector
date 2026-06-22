import type { Restaurant } from "@prisma/client";

export type DecisionMode =
  | "safe"
  | "new"
  | "cheap"
  | "near"
  | "group"
  | "date"
  | "quick"
  | "cozy"
  | "surprise"
  | "balanced";

export type DecisionRequest = {
  mode: DecisionMode;
  repeatBlockDays?: number;
  maxPriceLevel?: number;
  maxDistance?: number;
  requiredTags?: string[];
  preferFavorites?: boolean;
  suggestionCount?: number;
  seed?: number;
};

export type ScoredRestaurant = {
  restaurant: Restaurant;
  score: number;
  reasons: string[];
};

export type DecisionResult = {
  suggestion: ScoredRestaurant | null;
  alternatives: ScoredRestaurant[];
  excludedCount: number;
  mode: DecisionMode;
};

// Per-mode weight profiles. Each weight scales a normalized [0,1] signal.
const MODE_WEIGHTS: Record<DecisionMode, Record<string, number>> = {
  safe: { personalRating: 3, favorite: 2, visited: 1, novelty: 0 },
  new: { novelty: 3, externalRating: 1, personalRating: 0.5 },
  cheap: { cheapness: 3, personalRating: 1 },
  near: { proximity: 3, personalRating: 1 },
  group: { groupSuitable: 3, personalRating: 1 },
  date: { dateSuitable: 3, personalRating: 1, externalRating: 1 },
  quick: { quick: 3, proximity: 1 },
  cozy: { cozy: 3, personalRating: 1 },
  surprise: { random: 3, novelty: 1 },
  balanced: {
    personalRating: 1.5,
    externalRating: 1,
    novelty: 1,
    proximity: 0.5,
    cheapness: 0.5,
    favorite: 0.5,
  },
};

const RANDOM_FACTOR = 0.15;

// Deterministic PRNG so a provided seed produces reproducible suggestions.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

function hasAnyTag(restaurant: Restaurant, candidates: string[]): boolean {
  const tags = restaurant.tags.map((t) => t.toLowerCase());
  const suitability = restaurant.suitability.map((s) => s.toLowerCase());
  const ambience = restaurant.ambience.map((a) => a.toLowerCase());
  const all = [...tags, ...suitability, ...ambience];
  return candidates.some((c) => all.includes(c));
}

type Signals = Record<string, number>;

function computeSignals(restaurant: Restaurant, rng: () => number): Signals {
  const lastVisitDays = daysSince(restaurant.lastVisitedAt);
  return {
    personalRating: restaurant.personalRating != null ? restaurant.personalRating / 5 : 0,
    externalRating: restaurant.externalRating != null ? restaurant.externalRating / 5 : 0,
    favorite: restaurant.favorite ? 1 : 0,
    visited: lastVisitDays != null ? 1 : 0,
    // Higher for never-visited / long-ago-visited restaurants.
    novelty: lastVisitDays == null ? 1 : Math.min(1, lastVisitDays / 60),
    cheapness: restaurant.priceLevel != null ? (5 - restaurant.priceLevel) / 4 : 0.5,
    proximity:
      restaurant.distance != null ? Math.max(0, 1 - restaurant.distance / 10000) : 0.5,
    groupSuitable: hasAnyTag(restaurant, ["gruppe", "für gruppen", "groups"]) ? 1 : 0,
    dateSuitable: hasAnyTag(restaurant, ["date", "für date", "romantisch"]) ? 1 : 0,
    quick: hasAnyTag(restaurant, ["schnell", "quick", "fast", "imbiss"]) ? 1 : 0,
    cozy: hasAnyTag(restaurant, ["gemütlich", "cozy", "gemuetlich"]) ? 1 : 0,
    random: rng(),
  };
}

function scoreRestaurant(
  restaurant: Restaurant,
  mode: DecisionMode,
  rng: () => number
): ScoredRestaurant {
  const weights = MODE_WEIGHTS[mode];
  const signals = computeSignals(restaurant, rng);
  const reasons: string[] = [];
  let score = 0;

  for (const [signal, weight] of Object.entries(weights)) {
    const value = signals[signal] ?? 0;
    const contribution = value * weight;
    score += contribution;
    if (weight > 0 && value > 0.5) {
      reasons.push(`${signal}: ${(value * 100).toFixed(0)}% (Gewicht ${weight})`);
    }
  }

  // Recency penalty: recently visited restaurants are downweighted in all modes.
  const lastVisitDays = daysSince(restaurant.lastVisitedAt);
  if (lastVisitDays != null && lastVisitDays < 30) {
    const penalty = ((30 - lastVisitDays) / 30) * 1.5;
    score -= penalty;
    reasons.push(`kürzlich besucht (vor ${lastVisitDays.toFixed(0)} Tagen): -${penalty.toFixed(2)}`);
  }

  // Small random jitter to avoid always returning the same top pick.
  score += rng() * RANDOM_FACTOR;

  return { restaurant, score, reasons };
}

export function decide(
  restaurants: Restaurant[],
  request: DecisionRequest
): DecisionResult {
  const rng = mulberry32(request.seed ?? Math.floor(Math.random() * 1e9));
  const repeatBlockDays = request.repeatBlockDays ?? 14;

  let excludedCount = 0;
  const eligible = restaurants.filter((r) => {
    // Hard filters (priority 1: blacklist always excludes).
    if (r.blacklisted) {
      excludedCount++;
      return false;
    }
    const lastVisitDays = daysSince(r.lastVisitedAt);
    if (lastVisitDays != null && lastVisitDays < repeatBlockDays) {
      excludedCount++;
      return false;
    }
    if (request.maxPriceLevel != null && r.priceLevel != null && r.priceLevel > request.maxPriceLevel) {
      excludedCount++;
      return false;
    }
    if (request.maxDistance != null && r.distance != null && r.distance > request.maxDistance) {
      excludedCount++;
      return false;
    }
    if (request.requiredTags && request.requiredTags.length > 0) {
      const tags = r.tags.map((t) => t.toLowerCase());
      const ok = request.requiredTags.every((t) => tags.includes(t.toLowerCase()));
      if (!ok) {
        excludedCount++;
        return false;
      }
    }
    return true;
  });

  const scored = eligible
    .map((r) => {
      const result = scoreRestaurant(r, request.mode, rng);
      if (request.preferFavorites && r.favorite) {
        result.score += 1;
        result.reasons.push("Favorit bevorzugt: +1.00");
      }
      return result;
    })
    .sort((a, b) => b.score - a.score);

  const count = request.suggestionCount ?? 3;
  return {
    suggestion: scored[0] ?? null,
    alternatives: scored.slice(1, count),
    excludedCount,
    mode: request.mode,
  };
}
