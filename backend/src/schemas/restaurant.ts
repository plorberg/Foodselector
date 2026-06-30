import { z } from "zod";

export const restaurantInputSchema = z.object({
  name: z.string().min(1),
  categories: z.array(z.string()).optional(),
  subcategories: z.array(z.string()).optional(),
  address: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  website: z.string().optional().nullable(),
  googleMapsLink: z.string().optional().nullable(),
  googlePlaceId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  openingHours: z.unknown().optional(),
  priceLevel: z.number().int().min(1).max(4).optional().nullable(),
  distance: z.number().optional().nullable(),
  tags: z.array(z.string()).optional(),
  signatureDishes: z.array(z.string()).optional(),
  vegetarianOptions: z.boolean().optional().nullable(),
  veganOptions: z.boolean().optional().nullable(),
  reservationRecommended: z.boolean().optional().nullable(),
  deliveryAvailable: z.boolean().optional().nullable(),
  takeawayAvailable: z.boolean().optional().nullable(),
  ambience: z.array(z.string()).optional(),
  suitability: z.array(z.string()).optional(),
  personalRating: z.number().min(0).max(5).optional().nullable(),
  externalRating: z.number().min(0).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
  classification: z.enum(["NEW", "RECOMMENDATION"]).optional().nullable(),
  favorite: z.boolean().optional(),
  blacklisted: z.boolean().optional(),
  lastVisitedAt: z.coerce.date().optional().nullable(),
  fieldStatuses: z.unknown().optional(),
  confidenceByField: z.unknown().optional(),
});

export const restaurantUpdateSchema = restaurantInputSchema.partial();

export const restaurantQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  classification: z.enum(["NEW", "RECOMMENDATION"]).optional(),
  favorite: z.coerce.boolean().optional(),
  blacklisted: z.coerce.boolean().optional(),
});

export const visitSchema = z.object({
  visitedAt: z.coerce.date().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});
