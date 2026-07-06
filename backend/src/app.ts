import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { withWorkspace } from "./middleware/withWorkspace.js";
import { analyzeRouter } from "./routes/analyze.js";
import { authRouter } from "./routes/auth.js";
import { configRouter } from "./routes/config.js";
import { decideRouter } from "./routes/decide.js";
import { decisionRoundsRouter } from "./routes/decisionRounds.js";
import { googleMapsRouter } from "./routes/googleMaps.js";
import { importExportRouter } from "./routes/importExport.js";
import { invitationsRouter } from "./routes/invitations.js";
import { restaurantsRouter } from "./routes/restaurants.js";
import { workspacesRouter } from "./routes/workspaces.js";

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

  // Public auth endpoints.
  app.use("/api/auth", authRouter);

  // Auth-only (not tied to a single workspace): manage workspaces + invitations.
  app.use("/api/workspaces", requireAuth, workspacesRouter);
  app.use("/api/invitations", requireAuth, invitationsRouter);

  // Analyzers touch no workspace data (external APIs only) → auth is enough.
  app.use("/api/parse", requireAuth, googleMapsRouter);
  app.use("/api/analyze", requireAuth, analyzeRouter);

  // Workspace-scoped data (requires login + membership of X-Workspace-Id).
  app.use("/api/restaurants", requireAuth, withWorkspace, restaurantsRouter);
  app.use("/api", requireAuth, withWorkspace, decideRouter);
  app.use("/api", requireAuth, withWorkspace, decisionRoundsRouter);
  app.use("/api", requireAuth, withWorkspace, configRouter);
  app.use("/api", requireAuth, withWorkspace, importExportRouter);

  app.use(errorHandler);

  return app;
}
