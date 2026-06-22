import { Router } from "express";
import { z } from "zod";
import { parseGoogleMapsLink } from "../analyzers/googleMapsParser.js";

export const googleMapsRouter = Router();

const parseSchema = z.object({ url: z.string().min(1) });

googleMapsRouter.post("/google-maps-link", async (req, res, next) => {
  try {
    const { url } = parseSchema.parse(req.body);
    const result = await parseGoogleMapsLink(url);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
