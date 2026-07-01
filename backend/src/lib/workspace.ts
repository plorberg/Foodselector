import { prisma } from "./prisma.js";

// Turns any pending invitations for this email into memberships.
async function acceptPendingInvitations(userId: string, email: string) {
  const pending = await prisma.invitation.findMany({
    where: { email: email.toLowerCase(), status: "PENDING" },
  });
  for (const inv of pending) {
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId, workspaceId: inv.workspaceId } },
      update: {},
      create: { userId, workspaceId: inv.workspaceId, role: inv.role },
    });
    await prisma.invitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED" } });
  }
}

// Ensures a freshly-logged-in user has at least one workspace:
// 1. accept any pending invitations,
// 2. otherwise claim the unclaimed "Standard" workspace (legacy data) as owner,
// 3. otherwise create a personal workspace.
export async function ensureUserWorkspace(userId: string, email: string): Promise<void> {
  await acceptPendingInvitations(userId, email);

  const count = await prisma.membership.count({ where: { userId } });
  if (count > 0) return;

  const unclaimed = await prisma.workspace.findFirst({
    where: { memberships: { none: {} } },
    orderBy: { createdAt: "asc" },
  });
  if (unclaimed) {
    await prisma.membership.create({
      data: { userId, workspaceId: unclaimed.id, role: "OWNER" },
    });
    return;
  }

  const ws = await prisma.workspace.create({ data: { name: "Meine Restaurants" } });
  await prisma.membership.create({ data: { userId, workspaceId: ws.id, role: "OWNER" } });
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role,
  }));
}
