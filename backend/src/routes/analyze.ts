import { Router } from "express";
import { z } from "zod";
import { GooglePlacesAnalyzer } from "../analyzers/googlePlacesAnalyzer.js";
import { ManualPasteAnalyzer } from "../analyzers/manualPasteAnalyzer.js";
import { OpenAIAnalyzer } from "../analyzers/openaiAnalyzer.js";
import { OsmAnalyzer } from "../analyzers/osmAnalyzer.js";

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

const manualPasteAnalyzer = new ManualPasteAnalyzer();
const osmAnalyzer = new OsmAnalyzer();
const googlePlacesAnalyzer = new GooglePlacesAnalyzer();
const openaiAnalyzer = new OpenAIAnalyzer();

analyzeRouter.post("/manual", async (req, res, next) => {
  try {
    const input = analysisInputSchema.parse(req.body);
    const result = await manualPasteAnalyzer.analyze(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

analyzeRouter.post("/osm", async (req, res, next) => {
  try {
    const input = analysisInputSchema.parse(req.body);
    const result = await osmAnalyzer.analyze(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

analyzeRouter.post("/google-places", async (req, res, next) => {
  try {
    const input = analysisInputSchema.parse(req.body);
    const result = await googlePlacesAnalyzer.analyze(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

analyzeRouter.post("/openai", async (req, res, next) => {
  try {
    const input = analysisInputSchema.parse(req.body);
    const result = await openaiAnalyzer.analyze(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
