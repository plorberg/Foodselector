import type { RestaurantData } from "../types/restaurant.js";

export type RestaurantAnalyzer = {
  analyze(input: RestaurantAnalysisInput): Promise<RestaurantAnalysisResult>;
};

export type RestaurantAnalysisInput = {
  restaurantName?: string;
  city?: string;
  address?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  pastedText?: string;
  sourceUrls?: string[];
  // Not part of the original spec literal, but required to implement the
  // documented flow (9.4): a Google-Maps-Link-derived coordinate is passed
  // into the OSM/Overpass analyzer as a location anchor when no Google
  // Places API key is configured. See STEP.md "Assumptions".
  coordinates?: { lat: number; lng: number };
};

export type RestaurantAnalysisResult = {
  suggestedRestaurant: Partial<RestaurantData>;
  sources: RestaurantSource[];
  confidence: {
    overall: number;
    fields: Record<string, number>;
  };
  reasoning: string[];
  warnings: string[];
  extractedFacts: ExtractedFact[];
};

export type RestaurantSourceType =
  | "website"
  | "search"
  | "maps"
  | "menu"
  | "review"
  | "user_pasted_text"
  | "openstreetmap"
  | "google_places"
  | "google_maps_link"
  | "other";

export type RestaurantSource = {
  type: RestaurantSourceType;
  url?: string;
  title?: string;
  retrievedAt: string;
  reliability: "low" | "medium" | "high";
};

export type ExtractedFact = {
  field: string;
  value: unknown;
  sourceType: string;
  sourceUrl?: string;
  confidence: number;
  explanation: string;
};
