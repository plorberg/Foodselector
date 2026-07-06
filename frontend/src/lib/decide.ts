import { api } from "./api";
import type { Restaurant } from "../types/restaurant";

export type DecisionMode = "balanced" | "cheap" | "surprise";

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
  classification?: "NEW" | "RECOMMENDATION";
  repeatBlockDays?: number;
  maxPriceLevel?: number;
  requiredTags?: string[];
  preferFavorites?: boolean;
  suggestionCount?: number;
  openNow?: boolean;
  now?: { day: number; minutes: number };
};

// The user's current local time, for the server-side "jetzt geöffnet" filter.
export function localNow(): { day: number; minutes: number } {
  const d = new Date();
  return { day: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes() };
}

export const decideApi = {
  decide: (req: DecideRequest) => api.post<DecisionResult>("/decide", req),
  respond: (restaurantId: string, mode: string, accepted: boolean) =>
    api.post("/decide/respond", { restaurantId, mode, accepted }),
};

export type DecisionProfile = {
  id: string;
  name: string;
  description: string | null;
  filters: Partial<DecideRequest>;
  repeatBlockDays: number;
  suggestionCount: number;
  isDefault: boolean;
};

export const decisionProfilesApi = {
  list: () => api.get<DecisionProfile[]>("/decision-profiles"),
  create: (profile: { name: string; filters: Partial<DecideRequest>; repeatBlockDays?: number }) =>
    api.post<DecisionProfile>("/decision-profiles", profile),
  remove: (id: string) => api.delete<void>(`/decision-profiles/${id}`),
};

export type DecisionRound = {
  id: string;
  status: "OPEN" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  createdByUserId: string;
  restaurant: {
    id: string;
    name: string;
    address: string | null;
    categories: string[];
    googleMapsLink: string | null;
  };
  memberCount: number;
  myVote: boolean | null;
  votes: { userId: string; name: string; vote: boolean }[];
};

export const decisionRoundsApi = {
  current: () => api.get<DecisionRound | null>("/decision-rounds/current"),
  start: (restaurantId: string) => api.post<DecisionRound>("/decision-rounds", { restaurantId }),
  vote: (id: string, vote: boolean) =>
    api.post<DecisionRound>(`/decision-rounds/${id}/vote`, { vote }),
  close: (id: string) => api.post<DecisionRound>(`/decision-rounds/${id}/close`),
};
