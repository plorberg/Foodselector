import type {
  ExtractedFact,
  RestaurantAnalysisInput,
  RestaurantAnalysisResult,
  RestaurantAnalyzer,
  RestaurantSource,
} from "./types.js";

const AMENITY_FILTER = "restaurant|cafe|fast_food|bar|pub";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function escapeOverpassString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildQuery(input: RestaurantAnalysisInput): string | undefined {
  if (input.coordinates) {
    const { lat, lng } = input.coordinates;
    return `[out:json][timeout:25];
(
  node["amenity"~"${AMENITY_FILTER}"](around:300,${lat},${lng});
  way["amenity"~"${AMENITY_FILTER}"](around:300,${lat},${lng});
);
out center tags;`;
  }

  if (input.city) {
    const cityEscaped = escapeOverpassString(input.city);
    const nameFilter = input.restaurantName
      ? `["name"~"${escapeRegex(escapeOverpassString(input.restaurantName))}",i]`
      : "";
    return `[out:json][timeout:25];
area["name"="${cityEscaped}"]->.searchArea;
(
  node["amenity"~"${AMENITY_FILTER}"]${nameFilter}(area.searchArea);
  way["amenity"~"${AMENITY_FILTER}"]${nameFilter}(area.searchArea);
);
out center tags;`;
  }

  return undefined;
}

function elementCoordinates(el: OverpassElement): { lat: number; lng: number } | undefined {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return undefined;
}

function pickBestElement(
  elements: OverpassElement[],
  input: RestaurantAnalysisInput
): OverpassElement | undefined {
  const withTags = elements.filter((el) => el.tags?.name);
  if (withTags.length === 0) return undefined;
  if (withTags.length === 1) return withTags[0];

  if (input.coordinates) {
    return withTags
      .map((el) => ({ el, coords: elementCoordinates(el) }))
      .filter((x) => x.coords)
      .sort(
        (a, b) =>
          haversineMeters(input.coordinates!, a.coords!) -
          haversineMeters(input.coordinates!, b.coords!)
      )[0]?.el;
  }

  if (input.restaurantName) {
    const target = input.restaurantName.toLowerCase();
    const exact = withTags.find((el) => el.tags!.name.toLowerCase() === target);
    if (exact) return exact;
  }

  return withTags[0];
}

function buildAddress(tags: Record<string, string>): string | undefined {
  const street = tags["addr:street"];
  const houseNumber = tags["addr:housenumber"];
  if (!street) return undefined;
  return houseNumber ? `${street} ${houseNumber}` : street;
}

export class OsmAnalyzer implements RestaurantAnalyzer {
  constructor(
    private readonly overpassUrl: string = process.env.OVERPASS_API_URL ??
      "https://overpass-api.de/api/interpreter"
  ) {}

  // The public Overpass mirror is free but noticeably flaky under load
  // (transient 406/504 from its front-end load balancer, observed at ~25-50%
  // failure rate in practice). A few retries with backoff absorb that
  // without masking a real, sustained outage. area["name"=...] lookups (the
  // city-name fallback) can also hang far past the in-query timeout on the
  // shared instance, so each attempt gets its own client-side abort timeout.
  private async runQuery(query: string): Promise<OverpassElement[]> {
    const delaysMs = [0, 600];
    let lastError: unknown;
    for (const delayMs of delaysMs) {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        const url = `${this.overpassUrl}?data=${encodeURIComponent(query)}`;
        // overpass-api.de's front-end rejects requests with a missing/generic
        // User-Agent with a bare 406, independent of the query — a descriptive
        // UA is also the API's documented etiquette for identifying clients.
        const res = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": "FoodSelectorApp/0.1" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) {
          lastError = new Error(`Status ${res.status}`);
          continue;
        }
        const data = (await res.json()) as { elements: OverpassElement[] };
        return data.elements ?? [];
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("unknown_error");
  }

  async analyze(input: RestaurantAnalysisInput): Promise<RestaurantAnalysisResult> {
    const warnings: string[] = [];
    const query = buildQuery(input);

    if (!query) {
      return {
        suggestedRestaurant: {},
        sources: [],
        confidence: { overall: 0, fields: {} },
        reasoning: [],
        warnings: [
          "Für die OSM/Overpass-Suche werden Koordinaten oder zumindest eine Stadt benötigt.",
        ],
        extractedFacts: [],
      };
    }

    let elements: OverpassElement[];
    try {
      elements = await this.runQuery(query);
    } catch (err) {
      warnings.push(
        err instanceof Error
          ? `Overpass-API nicht erreichbar: ${err.message}`
          : "Overpass-API konnte nicht erreicht werden (Netzwerkfehler oder Timeout)."
      );
      return {
        suggestedRestaurant: {},
        sources: [],
        confidence: { overall: 0, fields: {} },
        reasoning: [],
        warnings,
        extractedFacts: [],
      };
    }

    const best = pickBestElement(elements, input);
    if (!best || !best.tags) {
      warnings.push("Kein passendes Restaurant in OpenStreetMap gefunden.");
      return {
        suggestedRestaurant: {},
        sources: [],
        confidence: { overall: 0, fields: {} },
        reasoning: [`${elements.length} Treffer in der Umgebung, keiner passend benannt.`],
        warnings,
        extractedFacts: [],
      };
    }

    const tags = best.tags;
    const osmId = `${best.type}/${best.id}`;
    const coords = elementCoordinates(best);
    const extractedFacts: ExtractedFact[] = [];
    const suggestedRestaurant: Record<string, unknown> = {};
    const confidenceFields: Record<string, number> = {};

    const addFact = (field: string, value: unknown, confidence: number, explanation: string) => {
      suggestedRestaurant[field] = value;
      confidenceFields[field] = confidence;
      extractedFacts.push({
        field,
        value,
        sourceType: "openstreetmap",
        confidence,
        explanation,
      });
    };

    addFact("name", tags.name, 0.8, `OSM-Tag "name" = "${tags.name}" (Objekt ${osmId}).`);

    const address = buildAddress(tags);
    if (address) addFact("address", address, 0.75, `Abgeleitet aus addr:street/addr:housenumber (${osmId}).`);
    if (tags["addr:city"]) addFact("city", tags["addr:city"], 0.75, `OSM-Tag "addr:city" (${osmId}).`);
    if (tags["addr:postcode"]) {
      addFact("district", tags["addr:postcode"], 0.4, `OSM-Tag "addr:postcode" als Hinweis (${osmId}).`);
    }

    if (coords) {
      addFact("latitude", coords.lat, 0.85, `Koordinate aus OSM-Objekt ${osmId}.`);
      addFact("longitude", coords.lng, 0.85, `Koordinate aus OSM-Objekt ${osmId}.`);
    }

    if (tags.cuisine) {
      const categories = tags.cuisine.split(";").map((c) => c.trim()).filter(Boolean);
      addFact("categories", categories, 0.65, `OSM-Tag "cuisine" = "${tags.cuisine}".`);
    }

    if (tags.website || tags["contact:website"]) {
      const website = tags.website ?? tags["contact:website"];
      addFact("website", website, 0.75, `OSM-Tag "website"/"contact:website" (${osmId}).`);
    }

    if (tags.phone || tags["contact:phone"]) {
      const phone = tags.phone ?? tags["contact:phone"];
      addFact("phone", phone, 0.75, `OSM-Tag "phone"/"contact:phone" (${osmId}).`);
    }

    if (tags.opening_hours) {
      addFact(
        "openingHours",
        { raw: tags.opening_hours },
        0.6,
        `OSM-Tag "opening_hours" = "${tags.opening_hours}" (OSM-Syntax, nicht nach Wochentag aufgeschlüsselt).`
      );
    }

    if (tags["diet:vegetarian"] === "yes") {
      addFact("vegetarianOptions", true, 0.7, 'OSM-Tag "diet:vegetarian" = "yes".');
    }
    if (tags["diet:vegan"] === "yes") {
      addFact("veganOptions", true, 0.7, 'OSM-Tag "diet:vegan" = "yes".');
    }
    if (tags.delivery === "yes") {
      addFact("deliveryAvailable", true, 0.7, 'OSM-Tag "delivery" = "yes".');
    }
    if (tags.takeaway === "yes") {
      addFact("takeawayAvailable", true, 0.7, 'OSM-Tag "takeaway" = "yes".');
    }

    const sources: RestaurantSource[] = [
      {
        type: "openstreetmap",
        url: `https://www.openstreetmap.org/${osmId}`,
        title: `OpenStreetMap ${osmId}`,
        retrievedAt: new Date().toISOString(),
        reliability: "medium",
      },
    ];

    const overall =
      extractedFacts.reduce((sum, f) => sum + f.confidence, 0) / extractedFacts.length;

    return {
      suggestedRestaurant,
      sources,
      confidence: { overall, fields: confidenceFields },
      reasoning: [
        `Bestes Ergebnis aus ${elements.length} Overpass-Treffer(n) ausgewählt: ${osmId}.`,
      ],
      warnings,
      extractedFacts,
    };
  }
}
