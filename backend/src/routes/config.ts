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
};

// All config is scoped to the active workspace (req.workspaceId via withWorkspace).

configRouter.get("/config", async (req, res, next) => {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { workspaceId_key: { workspaceId: req.workspaceId!, key: SETTINGS_KEY } },
    });
    res.json(row?.value ?? DEFAULT_CONFIG);
  } catch (err) {
    next(err);
  }
});

configRouter.put("/config", async (req, res, next) => {
  try {
    const value = req.body ?? {};
    const row = await prisma.appSetting.upsert({
      where: { workspaceId_key: { workspaceId: req.workspaceId!, key: SETTINGS_KEY } },
      update: { value },
      create: { workspaceId: req.workspaceId!, key: SETTINGS_KEY, value },
    });
    res.json(row.value);
  } catch (err) {
    next(err);
  }
});

// --- Categories ---

const nameSchema = z.object({ name: z.string().min(1) });

configRouter.get("/categories", async (req, res, next) => {
  try {
    res.json(
      await prisma.category.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { name: "asc" },
      })
    );
  } catch (err) {
    next(err);
  }
});

configRouter.post("/categories", async (req, res, next) => {
  try {
    const { name } = nameSchema.parse(req.body);
    const category = await prisma.category.create({
      data: { name, workspaceId: req.workspaceId! },
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

configRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    const deleted = await prisma.category.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (deleted.count === 0) throw new ApiError(404, "category_not_found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// --- Tags ---

configRouter.get("/tags", async (req, res, next) => {
  try {
    res.json(
      await prisma.tag.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { name: "asc" },
      })
    );
  } catch (err) {
    next(err);
  }
});

configRouter.post("/tags", async (req, res, next) => {
  try {
    const { name } = nameSchema.parse(req.body);
    const tag = await prisma.tag.create({ data: { name, workspaceId: req.workspaceId! } });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

configRouter.delete("/tags/:id", async (req, res, next) => {
  try {
    const deleted = await prisma.tag.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (deleted.count === 0) throw new ApiError(404, "tag_not_found");
    res.status(204).send();
  } catch (err) {
    next(err);
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

configRouter.get("/decision-profiles", async (req, res, next) => {
  try {
    res.json(
      await prisma.decisionProfile.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { name: "asc" },
      })
    );
  } catch (err) {
    next(err);
  }
});

configRouter.post("/decision-profiles", async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await prisma.decisionProfile.create({
      data: { ...data, workspaceId: req.workspaceId! } as Prisma.DecisionProfileUncheckedCreateInput,
    });
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

configRouter.put("/decision-profiles/:id", async (req, res, next) => {
  try {
    const data = profileSchema.partial().parse(req.body);
    const updated = await prisma.decisionProfile.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data: data as Prisma.DecisionProfileUpdateManyMutationInput,
    });
    if (updated.count === 0) throw new ApiError(404, "profile_not_found");
    const profile = await prisma.decisionProfile.findUnique({ where: { id: req.params.id } });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

configRouter.delete("/decision-profiles/:id", async (req, res, next) => {
  try {
    const deleted = await prisma.decisionProfile.deleteMany({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (deleted.count === 0) throw new ApiError(404, "profile_not_found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
