import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { restaurantInputSchema } from "../schemas/restaurant.js";

export const importExportRouter = Router();

// Exports restaurants (with sources/facts/visits), categories, tags and
// decision profiles as a single JSON document.
importExportRouter.get("/export", async (_req, res, next) => {
  try {
    const [restaurants, categories, tags, decisionProfiles] = await Promise.all([
      prisma.restaurant.findMany({
        include: { sources: true, extractedFacts: true, visits: true },
      }),
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.decisionProfile.findMany(),
    ]);

    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      restaurants,
      categories,
      tags,
      decisionProfiles,
    });
  } catch (err) {
    next(err);
  }
});

const importSchema = z.object({
  restaurants: z.array(restaurantInputSchema.passthrough()).optional(),
  categories: z.array(z.object({ name: z.string() })).optional(),
  tags: z.array(z.object({ name: z.string() })).optional(),
  mode: z.enum(["merge", "replace"]).default("merge"),
});

// Imports a previously exported document. In "replace" mode existing
// restaurants are deleted first. Nested relation fields from an export are
// stripped — only confirmed scalar/array fields are written back.
importExportRouter.post("/import", async (req, res, next) => {
  try {
    const data = importSchema.parse(req.body);

    if (data.mode === "replace") {
      await prisma.restaurant.deleteMany();
    }

    let importedRestaurants = 0;
    for (const raw of data.restaurants ?? []) {
      const {
        id: _id,
        sources: _sources,
        extractedFacts: _facts,
        visits: _visits,
        createdAt: _c,
        updatedAt: _u,
        ...fields
      } = raw as Record<string, unknown>;
      await prisma.restaurant.create({ data: fields as never });
      importedRestaurants++;
    }

    if (data.categories?.length) {
      await prisma.category.createMany({
        data: data.categories.map((c) => ({ name: c.name })),
        skipDuplicates: true,
      });
    }
    if (data.tags?.length) {
      await prisma.tag.createMany({
        data: data.tags.map((t) => ({ name: t.name })),
        skipDuplicates: true,
      });
    }

    res.json({ importedRestaurants, mode: data.mode });
  } catch (err) {
    next(err);
  }
});
