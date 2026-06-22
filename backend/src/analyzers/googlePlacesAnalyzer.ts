import type {
  ExtractedFact,
  RestaurantAnalysisInput,
  RestaurantAnalysisResult,
  RestaurantAnalyzer,
  RestaurantSource,
} from "./types.js";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.regularOpeningHours",
  "places.rating",
  "places.priceLevel",
  "places.types",
].join(",");

const GENERIC_TYPES = new Set(["point_of_interest", "establishment", "food"]);

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  rating?: number;
  priceLevel?: string;
  types?: string[];
};

function emptyResult(warnings: string[]): RestaurantAnalysisResult {
  return {
    suggestedRestaurant: {},
    sources: [],
    confidence: { overall: 0, fields: {} },
    reasoning: [],
    warnings,
    extractedFacts: [],
  };
}

export class GooglePlacesAnalyzer implements RestaurantAnalyzer {
  constructor(
    private readonly apiKey: string | undefined = process.env.GOOGLE_PLACES_API_KEY,
    private readonly baseUrl: string = "https://places.googleapis.com/v1"
  ) {}

  async analyze(input: RestaurantAnalysisInput): Promise<RestaurantAnalysisResult> {
    if (!this.apiKey) {
      return emptyResult([
        "Google Places API ist nicht konfiguriert (kein GOOGLE_PLACES_API_KEY gesetzt). Dieser Analyzer wird übersprungen.",
      ]);
    }

    const queryParts = [input.restaurantName, input.address, input.city].filter(Boolean);
    if (queryParts.length === 0) {
      return emptyResult([
        "Für die Google-Places-Suche wird mindestens ein Restaurantname, eine Adresse oder eine Stadt benötigt.",
      ]);
    }

    const body: Record<string, unknown> = { textQuery: queryParts.join(", ") };
    if (input.coordinates) {
      body.locationBias = {
        circle: {
          center: { latitude: input.coordinates.lat, longitude: input.coordinates.lng },
          radius: 1000,
        },
      };
    }

    let place: GooglePlace | undefined;
    try {
      const res = await fetch(`${this.baseUrl}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        return emptyResult([`Google Places API antwortete mit Status ${res.status}. ${errorBody}`.trim()]);
      }

      const data = (await res.json()) as { places?: GooglePlace[] };
      place = data.places?.[0];
    } catch (err) {
      return emptyResult([
        err instanceof Error
          ? `Google Places API nicht erreichbar: ${err.message}`
          : "Google Places API konnte nicht erreicht werden.",
      ]);
    }

    if (!place) {
      return emptyResult(["Kein passendes Ergebnis von der Google Places API gefunden."]);
    }

    const extractedFacts: ExtractedFact[] = [];
    const suggestedRestaurant: Record<string, unknown> = {};
    const confidenceFields: Record<string, number> = {};

    const addFact = (field: string, value: unknown, confidence: number, explanation: string) => {
      suggestedRestaurant[field] = value;
      confidenceFields[field] = confidence;
      extractedFacts.push({ field, value, sourceType: "google_places", confidence, explanation });
    };

    if (place.displayName?.text) {
      addFact("name", place.displayName.text, 0.9, "Google Places displayName.");
    }
    addFact("googlePlaceId", place.id, 0.95, "Google Places place ID (offizielle Kennung).");

    if (place.formattedAddress) {
      addFact("address", place.formattedAddress, 0.9, "Google Places formattedAddress.");
    }
    if (place.location) {
      addFact("latitude", place.location.latitude, 0.9, "Google Places location.latitude.");
      addFact("longitude", place.location.longitude, 0.9, "Google Places location.longitude.");
    }
    if (place.websiteUri) {
      addFact("website", place.websiteUri, 0.9, "Google Places websiteUri.");
    }
    if (place.internationalPhoneNumber) {
      addFact("phone", place.internationalPhoneNumber, 0.9, "Google Places internationalPhoneNumber.");
    }
    if (place.regularOpeningHours?.weekdayDescriptions?.length) {
      addFact(
        "openingHours",
        { weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions },
        0.85,
        "Google Places regularOpeningHours.weekdayDescriptions."
      );
    }
    if (typeof place.rating === "number") {
      addFact("externalRating", place.rating, 0.85, "Google Places rating.");
    }
    if (place.priceLevel && PRICE_LEVEL_MAP[place.priceLevel]) {
      addFact(
        "priceLevel",
        PRICE_LEVEL_MAP[place.priceLevel],
        0.7,
        `Google Places priceLevel "${place.priceLevel}" auf 1-4 abgebildet.`
      );
    }
    const categories = (place.types ?? []).filter((t) => !GENERIC_TYPES.has(t));
    if (categories.length > 0) {
      addFact("categories", categories, 0.75, `Google Places types: ${categories.join(", ")}.`);
    }

    const sources: RestaurantSource[] = [
      {
        type: "google_places",
        title: `Google Places (${place.id})`,
        retrievedAt: new Date().toISOString(),
        reliability: "high",
      },
    ];

    const overall =
      extractedFacts.reduce((sum, f) => sum + f.confidence, 0) / extractedFacts.length;

    return {
      suggestedRestaurant,
      sources,
      confidence: { overall, fields: confidenceFields },
      reasoning: [`Treffer über Google Places Text Search: ${place.displayName?.text ?? place.id}.`],
      warnings: [],
      extractedFacts,
    };
  }
}
