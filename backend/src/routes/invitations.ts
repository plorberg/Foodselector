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

// An invitation whose token was used stays visible/acceptable for users who
// already belong to the workspace — login auto-accepts invitations matching
// the user's email, and the invite link they clicked must not then dead-end
// in "invitation invalid".
async function isMember(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  return Boolean(membership);
}

// Invite-link flow: look up an invitation by its token (for the landing page)…
invitationsRouter.get("/by-token/:token", async (req, res, next) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
      include: { workspace: { select: { name: true } } },
    });
    if (!invitation || invitation.status === "REVOKED") {
      throw new ApiError(404, "invitation_not_found");
    }
    const alreadyMember = await isMember(req.user!.userId, invitation.workspaceId);
    if (invitation.status === "ACCEPTED" && !alreadyMember) {
      throw new ApiError(404, "invitation_not_found");
    }
    res.json({
      workspaceName: invitation.workspace.name,
      email: invitation.email,
      alreadyMember,
    });
  } catch (err) {
    next(err);
  }
});

// …and accept it. The link is shared deliberately by the owner, so any
// logged-in account holding the token may join (the invitee's Google address
// doesn't have to match the address the invitation was sent to).
invitationsRouter.post("/accept-by-token", async (req, res, next) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.status === "REVOKED") {
      throw new ApiError(404, "invitation_not_found");
    }
    if (invitation.status === "ACCEPTED") {
      // Idempotent for users who already joined (e.g. auto-accept on login).
      if (!(await isMember(req.user!.userId, invitation.workspaceId))) {
        throw new ApiError(404, "invitation_not_found");
      }
      res.json({ workspaceId: invitation.workspaceId });
      return;
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
