import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/errorHandler.js";

export const configRouter = Router();

const SETTINGS_KEY = "app_config";

const DEFAULT_CONFIG = {
  defaultRepeatBlockDays: 14,
  defaultRandomFactor: 0.15,
  defaultSuggestionCount: 3,
  enabledAnalyzers: {
    manual: true,
    osm: true,
    googlePlaces: false,
    openai: false,
  },
};

// --- App settings (key/value) ---

configRouter.get("/config", async (_req, res, next) => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    res.json(row?.value ?? DEFAULT_CONFIG);
  } catch (err) {
    next(err);
  }
});

configRouter.put("/config", async (req, res, next) => {
  try {
    const value = req.body ?? {};
    const row = await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value },
      create: { key: SETTINGS_KEY, value },
    });
    res.json(row.value);
  } catch (err) {
    next(err);
  }
});

// --- Categories ---

const nameSchema = z.object({ name: z.string().min(1) });

configRouter.get("/categories", async (_req, res, next) => {
  try {
    res.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
  } catch (err) {
    next(err);
  }
});

configRouter.post("/categories", async (req, res, next) => {
  try {
    const { name } = nameSchema.parse(req.body);
    const category = await prisma.category.create({ data: { name } });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

configRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    next(new ApiError(404, "category_not_found"));
  }
});

// --- Tags ---

configRouter.get("/tags", async (_req, res, next) => {
  try {
    res.json(await prisma.tag.findMany({ orderBy: { name: "asc" } }));
  } catch (err) {
    next(err);
  }
});

configRouter.post("/tags", async (req, res, next) => {
  try {
    const { name } = nameSchema.parse(req.body);
    const tag = await prisma.tag.create({ data: { name } });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

configRouter.delete("/tags/:id", async (req, res, next) => {
  try {
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    next(new ApiError(404, "tag_not_found"));
  }
});

// --- Decision profiles ---

const profileSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).default({}),
  weights: z.record(z.string(), z.number()).default({}),
  randomFactor: z.number().min(0).max(1).default(0.2),
  repeatBlockDays: z.number().int().min(0).default(14),
  suggestionCount: z.number().int().min(1).max(10).default(3),
  isDefault: z.boolean().default(false),
});

configRouter.get("/decision-profiles", async (_req, res, next) => {
  try {
    res.json(await prisma.decisionProfile.findMany({ orderBy: { name: "asc" } }));
  } catch (err) {
    next(err);
  }
});

configRouter.post("/decision-profiles", async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await prisma.decisionProfile.create({
      data: data as Prisma.DecisionProfileCreateInput,
    });
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

configRouter.put("/decision-profiles/:id", async (req, res, next) => {
  try {
    const data = profileSchema.partial().parse(req.body);
    const profile = await prisma.decisionProfile
      .update({
        where: { id: req.params.id },
        data: data as Prisma.DecisionProfileUpdateInput,
      })
      .catch(() => null);
    if (!profile) throw new ApiError(404, "profile_not_found");
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

configRouter.delete("/decision-profiles/:id", async (req, res, next) => {
  try {
    await prisma.decisionProfile.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    next(new ApiError(404, "profile_not_found"));
  }
});
