import { Router } from "express";
import { z } from "zod";
import { decide, type DecisionMode } from "../decide/engine.js";
import { prisma } from "../lib/prisma.js";

export const decideRouter = Router();

const MODES: [DecisionMode, ...DecisionMode[]] = ["balanced", "cheap", "surprise"];

const decideSchema = z.object({
  mode: z.enum(MODES).default("balanced"),
  classification: z.enum(["NEW", "RECOMMENDATION"]).optional(),
  repeatBlockDays: z.number().int().min(0).optional(),
  maxPriceLevel: z.number().int().min(1).max(4).optional(),
  maxDistance: z.number().optional(),
  requiredTags: z.array(z.string()).optional(),
  preferFavorites: z.boolean().optional(),
  suggestionCount: z.number().int().min(1).max(10).optional(),
  seed: z.number().optional(),
});

decideRouter.post("/decide", async (req, res, next) => {
  try {
    const request = decideSchema.parse(req.body);
    const restaurants = await prisma.restaurant.findMany({
      where: { workspaceId: req.workspaceId },
    });
    const result = decide(restaurants, request);

    if (result.suggestion) {
      await prisma.suggestionHistory.create({
        data: {
          restaurantId: result.suggestion.restaurant.id,
          mode: request.mode,
          reasoning: result.suggestion.reasons,
        },
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

const respondSchema = z.object({
  restaurantId: z.string(),
  mode: z.string(),
  accepted: z.boolean(),
});

decideRouter.post("/decide/respond", async (req, res, next) => {
  try {
    const { restaurantId, mode, accepted } = respondSchema.parse(req.body);
    const record = await prisma.suggestionHistory.create({
      data: { restaurantId, mode, reasoning: [], accepted },
    });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});
