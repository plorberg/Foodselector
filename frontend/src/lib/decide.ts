import { api } from "./api";
import type { Restaurant } from "../types/restaurant";

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

export type DecideRequest = {
  mode: DecisionMode;
  repeatBlockDays?: number;
  maxPriceLevel?: number;
  requiredTags?: string[];
  preferFavorites?: boolean;
  suggestionCount?: number;
};

export const decideApi = {
  decide: (req: DecideRequest) => api.post<DecisionResult>("/decide", req),
  respond: (restaurantId: string, mode: string, accepted: boolean) =>
    api.post("/decide/respond", { restaurantId, mode, accepted }),
};
