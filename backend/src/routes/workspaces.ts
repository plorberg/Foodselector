import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUserWorkspaces } from "../lib/workspace.js";
import { ApiError } from "../middleware/errorHandler.js";

export const workspacesRouter = Router();

// All routes here require auth (mounted with requireAuth), but are not scoped to
// a single workspace — they manage the set of workspaces + memberships.

async function requireOwner(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) throw new ApiError(403, "not_a_member");
  if (membership.role !== "OWNER") throw new ApiError(403, "owner_required");
}

workspacesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getUserWorkspaces(req.user!.userId));
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post("/", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const ws = await prisma.workspace.create({ data: { name } });
    await prisma.membership.create({
      data: { userId: req.user!.userId, workspaceId: ws.id, role: "OWNER" },
    });
    res.status(201).json({ id: ws.id, name: ws.name, role: "OWNER" });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.get("/:id/members", async (req, res, next) => {
  try {
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user!.userId, workspaceId: req.params.id } },
    });
    if (!membership) throw new ApiError(403, "not_a_member");

    const [members, invitations] = await Promise.all([
      prisma.membership.findMany({
        where: { workspaceId: req.params.id },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invitation.findMany({
        where: { workspaceId: req.params.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    res.json({
      members: members.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
      })),
      pendingInvitations: invitations.map((i) => ({ id: i.id, email: i.email })),
    });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.post("/:id/invitations", async (req, res, next) => {
  try {
    await requireOwner(req.user!.userId, req.params.id);
    const { email } = z
      .object({ email: z.string().email().transform((e) => e.toLowerCase()) })
      .parse(req.body);

    // If they're already a member, nothing to do.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: { userId_workspaceId: { userId: existingUser.id, workspaceId: req.params.id } },
      });
      if (existingMembership) throw new ApiError(409, "already_member");
    }

    // Idempotent: reuse an existing pending invitation for the same email.
    const existing = await prisma.invitation.findFirst({
      where: { workspaceId: req.params.id, email, status: "PENDING" },
    });
    const invitation =
      existing ??
      (await prisma.invitation.create({
        data: { workspaceId: req.params.id, email, invitedByUserId: req.user!.userId },
      }));

    res.status(201).json({ id: invitation.id, email: invitation.email });
  } catch (err) {
    next(err);
  }
});

workspacesRouter.delete("/:id/invitations/:invitationId", async (req, res, next) => {
  try {
    await requireOwner(req.user!.userId, req.params.id);
    await prisma.invitation.updateMany({
      where: { id: req.params.invitationId, workspaceId: req.params.id },
      data: { status: "REVOKED" },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

workspacesRouter.delete("/:id/members/:userId", async (req, res, next) => {
  try {
    await requireOwner(req.user!.userId, req.params.id);
    if (req.params.userId === req.user!.userId) throw new ApiError(400, "cannot_remove_self");
    await prisma.membership.deleteMany({
      where: { userId: req.params.userId, workspaceId: req.params.id, role: "MEMBER" },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
