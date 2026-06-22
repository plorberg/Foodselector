export type GoogleMapsSourceType =
  | "google_maps_share"
  | "google_maps_place"
  | "google_maps_search"
  | "google_maps_shortlink"
  | "unknown";

export type GoogleMapsParseResult = {
  originalUrl: string;
  normalizedUrl?: string;
  placeName?: string;
  placeId?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  query?: string;
  addressHint?: string;
  sourceType: GoogleMapsSourceType;
  warnings: string[];
};

const SHORTLINK_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

function isShortlink(url: URL): boolean {
  if (url.hostname === "goo.gl") return url.pathname.startsWith("/maps");
  return SHORTLINK_HOSTS.has(url.hostname);
}

// Resolves the HTTP redirect chain of a Google Maps shortlink to its
// canonical maps.google.com URL. Only the redirect `Location` headers are
// inspected — the destination page's HTML is never fetched or parsed, so
// this does not constitute scraping Google Maps.
async function resolveRedirect(url: string, maxHops = 5): Promise<string> {
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(current, { method: "GET", redirect: "manual" });
    const location = res.headers.get("location");
    if (!location) return current;
    current = new URL(location, current).toString();
  }
  return current;
}

function extractPlaceName(pathname: string): string | undefined {
  const match = pathname.match(/\/maps\/place\/([^/]+)/);
  if (!match) return undefined;
  return decodeURIComponent(match[1].replace(/\+/g, " "));
}

function extractCoordinates(input: string): { lat: number; lng: number } | undefined {
  const atMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };

  const qMatch = input.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };

  return undefined;
}

function extractPlaceId(url: URL, raw: string): string | undefined {
  const queryPlaceId = url.searchParams.get("query_place_id");
  if (queryPlaceId) return queryPlaceId;

  const cidMatch = raw.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (cidMatch) return cidMatch[1];

  return undefined;
}

export async function parseGoogleMapsLink(inputUrl: string): Promise<GoogleMapsParseResult> {
  const originalUrl = inputUrl.trim();
  const warnings: string[] = [];

  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return {
      originalUrl,
      sourceType: "unknown",
      warnings: ["Die eingegebene URL ist ungültig."],
    };
  }

  let workingUrl = parsed;
  let wasShortlink = false;

  if (isShortlink(parsed)) {
    wasShortlink = true;
    try {
      const resolved = await resolveRedirect(originalUrl);
      workingUrl = new URL(resolved);
    } catch {
      warnings.push(
        "Der Kurzlink konnte nicht aufgelöst werden. Bitte vollständigen Maps-Link einfügen."
      );
      return { originalUrl, sourceType: "google_maps_shortlink", warnings };
    }
  }

  const raw = workingUrl.toString();
  const isGoogleHost = /(^|\.)google\.[a-z.]+$/.test(workingUrl.hostname);

  if (!isGoogleHost) {
    warnings.push("Die URL stammt nicht von einer Google-Domain.");
    return { originalUrl, sourceType: "unknown", warnings };
  }

  const coordinates = extractCoordinates(raw);
  const placeId = extractPlaceId(workingUrl, raw);

  let sourceType: GoogleMapsSourceType = "unknown";
  let placeName: string | undefined;
  let query: string | undefined;

  if (workingUrl.pathname.startsWith("/maps/place/")) {
    sourceType = wasShortlink ? "google_maps_share" : "google_maps_place";
    placeName = extractPlaceName(workingUrl.pathname);
  } else if (workingUrl.pathname.startsWith("/maps/search/")) {
    sourceType = "google_maps_search";
    query =
      workingUrl.searchParams.get("query") ??
      decodeURIComponent(workingUrl.pathname.replace("/maps/search/", "").replace(/\+/g, " "));
  } else if (workingUrl.pathname === "/maps" || workingUrl.pathname === "/maps/") {
    const q = workingUrl.searchParams.get("q");
    if (q && coordinates) {
      sourceType = wasShortlink ? "google_maps_share" : "google_maps_place";
    } else if (q) {
      sourceType = "google_maps_search";
      query = q;
    }
  } else if (workingUrl.pathname === "/search") {
    const q = workingUrl.searchParams.get("q");
    if (q) {
      sourceType = "google_maps_search";
      query = q;
      warnings.push(
        "Dies ist ein allgemeiner Google-Suchlink, kein direkter Google-Maps-Link."
      );
    }
  }

  if (sourceType === "unknown") {
    warnings.push("Der Linktyp konnte nicht erkannt werden.");
  }

  warnings.push(
    "Aus dem Google-Maps-Link extrahierte Daten sind Hinweise und gelten erst nach Bestätigung durch eine weitere Quelle (Website, OSM, Google Places oder manuelle Prüfung) als gesichert."
  );

  return {
    originalUrl,
    normalizedUrl: raw,
    placeName,
    placeId,
    coordinates,
    query,
    sourceType,
    warnings,
  };
}
