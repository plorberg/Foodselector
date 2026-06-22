import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { analyzeRouter } from "./routes/analyze.js";
import { configRouter } from "./routes/config.js";
import { decideRouter } from "./routes/decide.js";
import { googleMapsRouter } from "./routes/googleMaps.js";
import { importExportRouter } from "./routes/importExport.js";
import { restaurantsRouter } from "./routes/restaurants.js";

// Allowed origins from CORS_ORIGIN (comma-separated), normalized so a stray
// trailing slash doesn't cause a mismatch with the browser-supplied origin
// (which never has one).
function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function createApp() {
  const app = express();

  const allowList = allowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no Origin header) and any configured origin.
        if (!origin || allowList.includes(origin.replace(/\/+$/, ""))) {
          callback(null, true);
        } else {
          callback(new Error(`origin_not_allowed: ${origin}`));
        }
      },
    })
  );
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
