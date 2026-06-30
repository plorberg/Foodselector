import { Router } from "express";
import { z } from "zod";
import { GooglePlacesAnalyzer } from "../analyzers/googlePlacesAnalyzer.js";

export const analyzeRouter = Router();

const analysisInputSchema = z.object({
  restaurantName: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  websiteUrl: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  pastedText: z.string().optional(),
  sourceUrls: z.array(z.string()).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

const googlePlacesAnalyzer = new GooglePlacesAnalyzer();

analyzeRouter.post("/google-places", async (req, res, next) => {
  try {
    const input = analysisInputSchema.parse(req.body);
    const result = await googlePlacesAnalyzer.analyze(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
