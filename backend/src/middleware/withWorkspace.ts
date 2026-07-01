import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      workspaceId?: string;
      membershipRole?: "OWNER" | "MEMBER";
    }
  }
}

// Requires the request to target a workspace (via X-Workspace-Id header) that
// the authenticated user is a member of. Must run after requireAuth.
export async function withWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaceId = req.header("X-Workspace-Id");
    if (!workspaceId) {
      res.status(400).json({ error: "missing_workspace" });
      return;
    }
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user!.userId, workspaceId } },
    });
    if (!membership) {
      res.status(403).json({ error: "not_a_member" });
      return;
    }
    req.workspaceId = workspaceId;
    req.membershipRole = membership.role;
    next();
  } catch (err) {
    next(err);
  }
}
