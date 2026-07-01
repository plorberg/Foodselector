import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fictional example data for local development/demo only — not researched
// facts about real restaurants. Real entries must go through an analyzer
// and user confirmation per the data-quality rules in STEP.md.
const DEMO_WORKSPACE_ID = "00000000-0000-0000-0000-0000000000de";

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    update: {},
    create: { id: DEMO_WORKSPACE_ID, name: "Demo" },
  });
  const workspaceId = workspace.id;

  await prisma.category.createMany({
    data: [
      { name: "Italienisch", workspaceId },
      { name: "Asiatisch", workspaceId },
      { name: "Burger", workspaceId },
    ],
    skipDuplicates: true,
  });

  await prisma.tag.createMany({
    data: [
      { name: "vegetarisch", workspaceId },
      { name: "vegan", workspaceId },
      { name: "lieferung", workspaceId },
      { name: "gemuetlich", workspaceId },
    ],
    skipDuplicates: true,
  });

  await prisma.classification.createMany({
    data: [
      { key: "safe_bet", label: "Sichere Bank" },
      { key: "new_to_try", label: "Neu / ausprobieren" },
      { key: "hidden_gem", label: "Geheimtipp" },
      { key: "cheap", label: "Günstig" },
      { key: "special", label: "Besonders" },
      { key: "quick_simple", label: "Schnell & unkompliziert" },
      { key: "cozy", label: "Gemütlich" },
      { key: "for_groups", label: "Für Gruppen" },
      { key: "for_date", label: "Für Date" },
      { key: "not_today", label: "Heute lieber nicht" },
    ],
    skipDuplicates: true,
  });

  await prisma.decisionProfile.upsert({
    where: { workspaceId_name: { workspaceId, name: "Ausgewogen" } },
    update: {},
    create: {
      workspaceId,
      name: "Ausgewogen",
      description: "Standardprofil ohne starke Gewichtung in eine Richtung.",
      filters: {},
      weights: { rating: 1, distance: 1, novelty: 1 },
      randomFactor: 0.2,
      repeatBlockDays: 14,
      suggestionCount: 3,
      isDefault: true,
    },
  });

  const exampleRestaurants = [
    {
      name: "Beispiel Trattoria (Demo)",
      categories: ["Italienisch"],
      subcategories: ["Pizza", "Pasta"],
      address: "Musterstraße 1, 12345 Musterstadt",
      tags: ["gemuetlich"],
      priceLevel: 2,
      classification: "RECOMMENDATION" as const,
      vegetarianOptions: true,
      veganOptions: false,
      notes: "Demo-Datensatz für die lokale Entwicklung, keine echten Restaurantdaten.",
    },
    {
      name: "Beispiel Sushi Bar (Demo)",
      categories: ["Asiatisch"],
      subcategories: ["Sushi"],
      address: "Beispielweg 2, 12345 Musterstadt",
      tags: ["lieferung"],
      priceLevel: 3,
      classification: "NEW" as const,
      vegetarianOptions: true,
      veganOptions: true,
      notes: "Demo-Datensatz für die lokale Entwicklung, keine echten Restaurantdaten.",
    },
    {
      name: "Beispiel Burger Lounge (Demo)",
      categories: ["Burger"],
      subcategories: ["Burger", "Fast Casual"],
      address: "Testallee 3, 12345 Musterstadt",
      tags: ["lieferung"],
      priceLevel: 1,
      vegetarianOptions: true,
      veganOptions: false,
      notes: "Demo-Datensatz für die lokale Entwicklung, keine echten Restaurantdaten.",
    },
  ];

  for (const restaurant of exampleRestaurants) {
    const fieldStatuses = Object.fromEntries(
      Object.keys(restaurant).map((field) => [field, "CONFIRMED"])
    );
    const confidenceByField = Object.fromEntries(
      Object.keys(restaurant).map((field) => [field, 1])
    );

    const existing = await prisma.restaurant.findFirst({
      where: { name: restaurant.name, workspaceId },
    });
    if (existing) continue;

    await prisma.restaurant.create({
      data: {
        ...restaurant,
        workspaceId,
        fieldStatuses,
        confidenceByField,
        sources: {
          create: {
            type: "OTHER",
            title: "Seed/Demo-Datensatz",
            retrievedAt: new Date(0),
            reliability: "LOW",
          },
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
