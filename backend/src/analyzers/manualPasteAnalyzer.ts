import type {
  ExtractedFact,
  RestaurantAnalysisInput,
  RestaurantAnalysisResult,
  RestaurantAnalyzer,
} from "./types.js";

// Rule-based extraction so the app keeps working without any paid API.
// Every match is attributed to the matched substring and stays at moderate
// confidence — nothing here is treated as confirmed truth (see STEP.md).

const PHONE_REGEX = /(\+?\d[\d ()/-]{7,}\d)/;
const URL_REGEX =
  /\bhttps?:\/\/[^\s)>"']+|\bwww\.[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s)>"']*)?/i;
// Restricted to non-newline whitespace so a street line never bleeds into
// an adjacent line (e.g. a restaurant name on the line above).
const ADDRESS_REGEX =
  /([A-ZÄÖÜ][\wäöüß.-]+(?:[^\S\r\n][A-ZÄÖÜ][\wäöüß.-]+)*[^\S\r\n]\d+[a-zA-Z]?),?[^\S\r\n]*(\d{4,5})[^\S\r\n]+([A-ZÄÖÜ][\wäöüß-]+)/;

const WEEKDAY_ORDER = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
const WEEKDAYS: Record<string, string> = {
  mo: "Montag",
  montag: "Montag",
  di: "Dienstag",
  dienstag: "Dienstag",
  mi: "Mittwoch",
  mittwoch: "Mittwoch",
  do: "Donnerstag",
  donnerstag: "Donnerstag",
  fr: "Freitag",
  freitag: "Freitag",
  sa: "Samstag",
  samstag: "Samstag",
  so: "Sonntag",
  sonntag: "Sonntag",
};
const OPENING_HOURS_LINE_REGEX =
  /(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)[a-zäöü]*\.?[^\S\r\n]*(?:[-–](mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)[a-zäöü]*\.?)?[^\S\r\n]*[:\-]?[^\S\r\n]*(\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2})/gi;

function expandDayRange(fromDay: string, toDay: string): string[] {
  const fromIndex = WEEKDAY_ORDER.indexOf(fromDay);
  const toIndex = WEEKDAY_ORDER.indexOf(toDay);
  if (fromIndex === -1 || toIndex === -1 || toIndex < fromIndex) return [fromDay];
  return WEEKDAY_ORDER.slice(fromIndex, toIndex + 1);
}

const CUISINE_KEYWORDS: Record<string, string> = {
  italien: "Italienisch",
  pizza: "Italienisch",
  pasta: "Italienisch",
  sushi: "Japanisch",
  japan: "Japanisch",
  ramen: "Japanisch",
  thai: "Thailändisch",
  vietnam: "Vietnamesisch",
  indisch: "Indisch",
  curry: "Indisch",
  burger: "Burger",
  griech: "Griechisch",
  türk: "Türkisch",
  döner: "Türkisch",
  mexikan: "Mexikanisch",
  taco: "Mexikanisch",
  chinesisch: "Chinesisch",
  vegan: "Vegan",
  steak: "Steakhaus",
};

function findFirst(text: string, regex: RegExp): RegExpMatchArray | null {
  return text.match(regex);
}

export class ManualPasteAnalyzer implements RestaurantAnalyzer {
  async analyze(input: RestaurantAnalysisInput): Promise<RestaurantAnalysisResult> {
    const text = input.pastedText ?? "";
    const warnings: string[] = [];
    const extractedFacts: ExtractedFact[] = [];
    const suggestedRestaurant: Record<string, unknown> = {};
    const confidenceFields: Record<string, number> = {};

    if (!text.trim()) {
      warnings.push("Kein Text zum Analysieren übergeben.");
      return {
        suggestedRestaurant: {},
        sources: [],
        confidence: { overall: 0, fields: {} },
        reasoning: ["Kein Eingabetext vorhanden."],
        warnings,
        extractedFacts: [],
      };
    }

    const addFact = (
      field: string,
      value: unknown,
      confidence: number,
      explanation: string
    ) => {
      suggestedRestaurant[field] = value;
      confidenceFields[field] = confidence;
      extractedFacts.push({
        field,
        value,
        sourceType: "user_pasted_text",
        confidence,
        explanation,
      });
    };

    const phoneMatch = findFirst(text, PHONE_REGEX);
    if (phoneMatch) {
      addFact("phone", phoneMatch[1].trim(), 0.6, `Telefonnummer-Muster gefunden: "${phoneMatch[1].trim()}".`);
    }

    const urlMatch = findFirst(text, URL_REGEX);
    if (urlMatch) {
      addFact("website", urlMatch[0], 0.6, `URL im Text gefunden: "${urlMatch[0]}".`);
    }

    const addressMatch = findFirst(text, ADDRESS_REGEX);
    if (addressMatch) {
      addFact("address", addressMatch[1], 0.5, `Adressmuster gefunden: "${addressMatch[0]}".`);
      addFact("city", addressMatch[3], 0.5, `Stadt aus Adressmuster abgeleitet: "${addressMatch[0]}".`);
    }

    const openingHoursMatches = [...text.matchAll(OPENING_HOURS_LINE_REGEX)];
    if (openingHoursMatches.length > 0) {
      const openingHours: Record<string, string> = {};
      for (const m of openingHoursMatches) {
        const fromDay = WEEKDAYS[m[1].toLowerCase()];
        const toDay = m[2] ? WEEKDAYS[m[2].toLowerCase()] : undefined;
        const hours = m[3].replace(/\s+/g, "");
        if (!fromDay) continue;
        const days = toDay ? expandDayRange(fromDay, toDay) : [fromDay];
        for (const day of days) openingHours[day] = hours;
      }
      if (Object.keys(openingHours).length > 0) {
        addFact(
          "openingHours",
          openingHours,
          0.55,
          `Öffnungszeiten-Zeilen im Text erkannt (${Object.keys(openingHours).length} Tag(e)).`
        );
      }
    }

    const lowerText = text.toLowerCase();
    const matchedCategories = new Set<string>();
    for (const [keyword, category] of Object.entries(CUISINE_KEYWORDS)) {
      if (lowerText.includes(keyword)) matchedCategories.add(category);
    }
    if (matchedCategories.size > 0) {
      addFact(
        "categories",
        [...matchedCategories],
        0.5,
        `Küchen-Schlüsselwörter im Text gefunden: ${[...matchedCategories].join(", ")}.`
      );
    }

    if (/\bvegetarisch/i.test(text)) {
      addFact("vegetarianOptions", true, 0.6, 'Schlüsselwort "vegetarisch" im Text gefunden.');
    }
    if (/\bvegan/i.test(text)) {
      addFact("veganOptions", true, 0.6, 'Schlüsselwort "vegan" im Text gefunden.');
    }
    if (/\b(lieferung|liefert|delivery|lieferservice)\b/i.test(text)) {
      addFact("deliveryAvailable", true, 0.55, "Hinweis auf Lieferservice im Text gefunden.");
    }
    if (/\b(abholung|takeaway|to go|zum mitnehmen)\b/i.test(text)) {
      addFact("takeawayAvailable", true, 0.55, "Hinweis auf Abholung/Takeaway im Text gefunden.");
    }
    if (/\breservierung/i.test(text)) {
      addFact(
        "reservationRecommended",
        true,
        0.5,
        'Schlüsselwort "Reservierung" im Text gefunden.'
      );
    }

    if (!input.restaurantName) {
      const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
      if (firstLine && firstLine.length <= 60 && !firstLine.endsWith(".")) {
        addFact("name", firstLine, 0.3, `Erste Zeile des Textes als möglicher Name übernommen: "${firstLine}".`);
        warnings.push(
          `Restaurantname wurde nur aus der ersten Textzeile geraten ("${firstLine}") und sollte unbedingt geprüft werden.`
        );
      }
    }

    if (extractedFacts.length === 0) {
      warnings.push("Es konnten keine strukturierten Felder aus dem Text erkannt werden.");
    }

    const overall =
      extractedFacts.length > 0
        ? extractedFacts.reduce((sum, f) => sum + f.confidence, 0) / extractedFacts.length
        : 0;

    return {
      suggestedRestaurant,
      sources: [
        {
          type: "user_pasted_text",
          title: "Manuell eingefügter Text",
          retrievedAt: new Date().toISOString(),
          reliability: "low",
        },
      ],
      confidence: { overall, fields: confidenceFields },
      reasoning: [
        `${extractedFacts.length} Feld(er) per regelbasierter Texterkennung extrahiert.`,
        "Regelbasierte Erkennung ohne KI-API – Treffer sind Hinweise, keine bestätigten Fakten.",
      ],
      warnings,
      extractedFacts,
    };
  }
}
