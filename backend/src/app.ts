import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { analyzeRouter } from "./routes/analyze.js";
import { configRouter } from "./routes/config.js";
import { decideRouter } from "./routes/decide.js";
import { googleMapsRouter } from "./routes/googleMaps.js";
import { importExportRouter } from "./routes/importExport.js";
import { restaurantsRouter } from "./routes/restaurants.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/restaurants", restaurantsRouter);
  app.use("/api/parse", googleMapsRouter);
  app.use("/api/analyze", analyzeRouter);
  app.use("/api", decideRouter);
  app.use("/api", configRouter);
  app.use("/api", importExportRouter);

  app.use(errorHandler);

  return app;
}
