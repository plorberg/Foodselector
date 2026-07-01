import { Router } from "express";
import { z } from "zod";
import { signToken, verifyGoogleCredential } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { ensureUserWorkspace, getUserWorkspaces } from "../lib/workspace.js";
import { ApiError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

const devLoginEnabled =
  process.env.APP_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";

async function loginResponse(userId: string, email: string) {
  await ensureUserWorkspace(userId, email);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  const workspaces = await getUserWorkspaces(userId);
  return { token: signToken({ userId, email }), user, workspaces };
}

const googleSchema = z.object({ credential: z.string().min(1) });

authRouter.post("/google", async (req, res, next) => {
  try {
    const { credential } = googleSchema.parse(req.body);
    const identity = await verifyGoogleCredential(credential);
    if (!identity) throw new ApiError(401, "invalid_google_token");

    let user = await prisma.user.findUnique({ where: { googleId: identity.googleId } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
      user = byEmail
        ? await prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId: identity.googleId, name: byEmail.name ?? identity.name },
          })
        : await prisma.user.create({
            data: { googleId: identity.googleId, email: identity.email, name: identity.name },
          });
    }

    res.json(await loginResponse(user.id, user.email));
  } catch (err) {
    next(err);
  }
});

// Dev-only login for local testing (real Google sign-in can't run headless).
// Strictly gated: never active in production.
const devSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().optional(),
});

authRouter.post("/dev-login", async (req, res, next) => {
  try {
    if (!devLoginEnabled) throw new ApiError(404, "not_found");
    const { email, name } = devSchema.parse(req.body);
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name },
    });
    res.json(await loginResponse(user.id, user.email));
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new ApiError(404, "user_not_found");
    const workspaces = await getUserWorkspaces(user.id);
    res.json({ user, workspaces });
  } catch (err) {
    next(err);
  }
});
