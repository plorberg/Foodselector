import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/errorHandler.js";
import {
  restaurantInputSchema,
  restaurantQuerySchema,
  restaurantUpdateSchema,
  visitSchema,
} from "../schemas/restaurant.js";

export const restaurantsRouter = Router();

restaurantsRouter.get("/", async (req, res, next) => {
  try {
    const query = restaurantQuerySchema.parse(req.query);

    const restaurants = await prisma.restaurant.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { address: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(query.category ? { categories: { has: query.category } } : {}),
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(query.classification ? { classification: query.classification } : {}),
        ...(query.favorite !== undefined ? { favorite: query.favorite } : {}),
        ...(query.blacklisted !== undefined ? { blacklisted: query.blacklisted } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(restaurants);
  } catch (err) {
    next(err);
  }
});

restaurantsRouter.get("/:id", async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      include: { sources: true, extractedFacts: true, visits: true },
    });
    if (!restaurant) throw new ApiError(404, "restaurant_not_found");
    res.json(restaurant);
  } catch (err) {
    next(err);
  }
});

restaurantsRouter.post("/", async (req, res, next) => {
  try {
    const data = restaurantInputSchema.parse(req.body);
    const restaurant = await prisma.restaurant.create({
      data: data as Prisma.RestaurantCreateInput,
    });
    res.status(201).json(restaurant);
  } catch (err) {
    next(err);
  }
});

restaurantsRouter.put("/:id", async (req, res, next) => {
  try {
    const data = restaurantUpdateSchema.parse(req.body);
    const restaurant = await prisma.restaurant
      .update({
        where: { id: req.params.id },
        data: data as Prisma.RestaurantUpdateInput,
      })
      .catch(() => null);
    if (!restaurant) throw new ApiError(404, "restaurant_not_found");
    res.json(restaurant);
  } catch (err) {
    next(err);
  }
});

restaurantsRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.restaurant.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(new ApiError(404, "restaurant_not_found"));
  }
});

restaurantsRouter.post("/:id/visit", async (req, res, next) => {
  try {
    const data = visitSchema.parse(req.body);
    const visitedAt = data.visitedAt ?? new Date();

    const visit = await prisma.restaurantVisit.create({
      data: {
        restaurantId: req.params.id,
        visitedAt,
        rating: data.rating,
        notes: data.notes,
      },
    });

    await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { lastVisitedAt: visitedAt },
    });

    res.status(201).json(visit);
  } catch (err) {
    next(err);
  }
});

restaurantsRouter.post("/:id/favorite", async (req, res, next) => {
  try {
    const favorite = Boolean(req.body?.favorite ?? true);
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { favorite },
    });
    res.json(restaurant);
  } catch (err) {
    next(new ApiError(404, "restaurant_not_found"));
  }
});

restaurantsRouter.post("/:id/blacklist", async (req, res, next) => {
  try {
    const blacklisted = Boolean(req.body?.blacklisted ?? true);
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: { blacklisted },
    });
    res.json(restaurant);
  } catch (err) {
    next(new ApiError(404, "restaurant_not_found"));
  }
});
