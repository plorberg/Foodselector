import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/errorHandler.js";

export const invitationsRouter = Router();

// Requires auth (mounted with requireAuth). Handles the invitee side.

invitationsRouter.get("/mine", async (req, res, next) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { email: req.user!.email.toLowerCase(), status: "PENDING" },
      include: { workspace: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      invitations.map((i) => ({ id: i.id, workspaceName: i.workspace.name }))
    );
  } catch (err) {
    next(err);
  }
});

invitationsRouter.post("/:id/accept", async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.email.toLowerCase() !== req.user!.email.toLowerCase()
    ) {
      throw new ApiError(404, "invitation_not_found");
    }

    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: req.user!.userId, workspaceId: invitation.workspaceId } },
      update: {},
      create: { userId: req.user!.userId, workspaceId: invitation.workspaceId, role: invitation.role },
    });
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });

    res.json({ workspaceId: invitation.workspaceId });
  } catch (err) {
    next(err);
  }
});
