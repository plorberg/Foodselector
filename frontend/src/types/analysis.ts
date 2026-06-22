export type ExtractedFact = {
  field: string;
  value: unknown;
  sourceType: string;
  sourceUrl?: string;
  confidence: number;
  explanation: string;
};

export type RestaurantSource = {
  type: string;
  url?: string;
  title?: string;
  retrievedAt: string;
  reliability: "low" | "medium" | "high";
};

export type AnalysisResult = {
  suggestedRestaurant: Record<string, unknown>;
  sources: RestaurantSource[];
  confidence: { overall: number; fields: Record<string, number> };
  reasoning: string[];
  warnings: string[];
  extractedFacts: ExtractedFact[];
};

export type GoogleMapsParseResult = {
  originalUrl: string;
  normalizedUrl?: string;
  placeName?: string;
  placeId?: string;
  coordinates?: { lat: number; lng: number };
  query?: string;
  addressHint?: string;
  sourceType:
    | "google_maps_share"
    | "google_maps_place"
    | "google_maps_search"
    | "google_maps_shortlink"
    | "unknown";
  warnings: string[];
};

export type AnalysisInput = {
  restaurantName?: string;
  city?: string;
  address?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  pastedText?: string;
  coordinates?: { lat: number; lng: number };
};
