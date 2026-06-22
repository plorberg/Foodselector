import type {
  ExtractedFact,
  RestaurantAnalysisInput,
  RestaurantAnalysisResult,
  RestaurantAnalyzer,
  RestaurantSource,
} from "./types.js";

const MODEL = "gpt-4o-mini";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    categories: { type: "array", items: { type: "string" } },
    address: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    website: { type: ["string", "null"] },
    priceLevel: { type: ["integer", "null"] },
    vegetarianOptions: { type: ["boolean", "null"] },
    veganOptions: { type: ["boolean", "null"] },
    signatureDishes: { type: "array", items: { type: "string" } },
    explanation: { type: "string" },
  },
  required: [
    "name",
    "categories",
    "address",
    "city",
    "country",
    "phone",
    "website",
    "priceLevel",
    "vegetarianOptions",
    "veganOptions",
    "signatureDishes",
    "explanation",
  ],
  additionalProperties: false,
} as const;

type OpenAiExtraction = {
  name: string | null;
  categories: string[];
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  website: string | null;
  priceLevel: number | null;
  vegetarianOptions: boolean | null;
  veganOptions: boolean | null;
  signatureDishes: string[];
  explanation: string;
};

const FIELD_CONFIDENCE = 0.7;

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

function buildUserMessage(input: RestaurantAnalysisInput): string {
  const hints = [
    input.restaurantName && `Name (Hinweis): ${input.restaurantName}`,
    input.city && `Stadt (Hinweis): ${input.city}`,
    input.address && `Adresse (Hinweis): ${input.address}`,
    input.websiteUrl && `Website (Hinweis): ${input.websiteUrl}`,
  ].filter(Boolean);

  const sections = [
    hints.length > 0 ? hints.join("\n") : undefined,
    input.pastedText ? `Text:\n${input.pastedText}` : undefined,
    input.sourceUrls?.length ? `Weitere Quellen-URLs:\n${input.sourceUrls.join("\n")}` : undefined,
  ].filter(Boolean);

  return sections.join("\n\n");
}

export class OpenAIAnalyzer implements RestaurantAnalyzer {
  constructor(
    private readonly apiKey: string | undefined = process.env.OPENAI_API_KEY,
    private readonly baseUrl: string = "https://api.openai.com/v1"
  ) {}

  async analyze(input: RestaurantAnalysisInput): Promise<RestaurantAnalysisResult> {
    if (!this.apiKey) {
      return emptyResult([
        "OpenAI-Analyzer ist nicht konfiguriert (kein OPENAI_API_KEY gesetzt). Hinweis: Ein ChatGPT-Plus-Abo ersetzt keinen OpenAI-API-Key — beide sind getrennte Produkte. Dieser Analyzer wird übersprungen.",
      ]);
    }

    const userMessage = buildUserMessage(input);
    if (!userMessage.trim()) {
      return emptyResult([
        "Für den OpenAI-Analyzer wird mindestens ein Eingabetext oder Namens-/Adresshinweis benötigt.",
      ]);
    }

    let extraction: OpenAiExtraction;
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "Du extrahierst strukturierte Restaurant-Fakten ausschließlich aus dem bereitgestellten Text/Hinweisen. Erfinde keine Informationen. Wenn ein Feld nicht im Text vorkommt, setze es auf null bzw. ein leeres Array.",
            },
            { role: "user", content: userMessage },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "restaurant_extraction",
              schema: RESPONSE_SCHEMA,
              strict: true,
            },
          },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        return emptyResult([`OpenAI API antwortete mit Status ${res.status}. ${errorBody}`.trim()]);
      }

      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return emptyResult(["OpenAI API lieferte keine Extraktion zurück."]);
      }
      extraction = JSON.parse(content) as OpenAiExtraction;
    } catch (err) {
      return emptyResult([
        err instanceof Error
          ? `OpenAI API nicht erreichbar oder Antwort ungültig: ${err.message}`
          : "OpenAI API konnte nicht erreicht werden.",
      ]);
    }

    const extractedFacts: ExtractedFact[] = [];
    const suggestedRestaurant: Record<string, unknown> = {};
    const confidenceFields: Record<string, number> = {};

    const addFact = (field: string, value: unknown) => {
      suggestedRestaurant[field] = value;
      confidenceFields[field] = FIELD_CONFIDENCE;
      extractedFacts.push({
        field,
        value,
        sourceType: "openai",
        confidence: FIELD_CONFIDENCE,
        explanation: `Von OpenAI (${MODEL}) aus dem Eingabetext extrahiert.`,
      });
    };

    if (extraction.name) addFact("name", extraction.name);
    if (extraction.categories.length > 0) addFact("categories", extraction.categories);
    if (extraction.address) addFact("address", extraction.address);
    if (extraction.city) addFact("city", extraction.city);
    if (extraction.country) addFact("country", extraction.country);
    if (extraction.phone) addFact("phone", extraction.phone);
    if (extraction.website) addFact("website", extraction.website);
    if (extraction.priceLevel) addFact("priceLevel", extraction.priceLevel);
    if (extraction.vegetarianOptions !== null) addFact("vegetarianOptions", extraction.vegetarianOptions);
    if (extraction.veganOptions !== null) addFact("veganOptions", extraction.veganOptions);
    if (extraction.signatureDishes.length > 0) addFact("signatureDishes", extraction.signatureDishes);

    if (extractedFacts.length === 0) {
      return emptyResult(["OpenAI konnte keine strukturierten Felder aus dem Text extrahieren."]);
    }

    const sources: RestaurantSource[] = [
      {
        type: "other",
        title: `OpenAI-Extraktion (${MODEL})`,
        retrievedAt: new Date().toISOString(),
        reliability: "medium",
      },
    ];

    return {
      suggestedRestaurant,
      sources,
      confidence: { overall: FIELD_CONFIDENCE, fields: confidenceFields },
      reasoning: [extraction.explanation, `${extractedFacts.length} Feld(er) per OpenAI-Extraktion erkannt.`],
      warnings: [
        "KI-Extraktion: Treffer sind Hinweise und müssen vor dem Speichern geprüft werden.",
      ],
      extractedFacts,
    };
  }
}
