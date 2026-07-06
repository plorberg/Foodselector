import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/errorHandler.js";

export const decisionRoundsRouter = Router();

// Mounted with requireAuth + withWorkspace: group voting on a suggestion.
// One OPEN round per workspace at a time; starting a new one cancels the old.

const roundInclude = {
  restaurant: {
    select: { id: true, name: true, address: true, categories: true, googleMapsLink: true },
  },
  votes: {
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

function serializeRound(
  round: NonNullable<Awaited<ReturnType<typeof findCurrentRound>>>,
  memberCount: number,
  userId: string
) {
  return {
    id: round.id,
    status: round.status,
    createdAt: round.createdAt,
    createdByUserId: round.createdByUserId,
    restaurant: round.restaurant,
    memberCount,
    myVote: round.votes.find((v) => v.userId === userId)?.vote ?? null,
    votes: round.votes.map((v) => ({
      userId: v.userId,
      name: v.user.name ?? v.user.email,
      vote: v.vote,
    })),
  };
}

function findCurrentRound(workspaceId: string) {
  return prisma.decisionRound.findFirst({
    where: { workspaceId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: roundInclude,
  });
}

function memberCount(workspaceId: string) {
  return prisma.membership.count({ where: { workspaceId } });
}

decisionRoundsRouter.get("/decision-rounds/current", async (req, res, next) => {
  try {
    const round = await findCurrentRound(req.workspaceId!);
    if (!round) {
      res.json(null);
      return;
    }
    res.json(serializeRound(round, await memberCount(req.workspaceId!), req.user!.userId));
  } catch (err) {
    next(err);
  }
});

decisionRoundsRouter.post("/decision-rounds", async (req, res, next) => {
  try {
    const { restaurantId } = z.object({ restaurantId: z.string() }).parse(req.body);
    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId, workspaceId: req.workspaceId },
    });
    if (!restaurant) throw new ApiError(404, "restaurant_not_found");

    // Starting a new round supersedes any still-open one.
    await prisma.decisionRound.updateMany({
      where: { workspaceId: req.workspaceId!, status: "OPEN" },
      data: { status: "CANCELLED", closedAt: new Date() },
    });
    const created = await prisma.decisionRound.create({
      data: {
        workspaceId: req.workspaceId!,
        restaurantId,
        createdByUserId: req.user!.userId,
        // The proposer implicitly votes yes.
        votes: { create: { userId: req.user!.userId, vote: true } },
      },
    });
    const round = await prisma.decisionRound.findUnique({
      where: { id: created.id },
      include: roundInclude,
    });
    res
      .status(201)
      .json(serializeRound(round!, await memberCount(req.workspaceId!), req.user!.userId));
  } catch (err) {
    next(err);
  }
});

decisionRoundsRouter.post("/decision-rounds/:id/vote", async (req, res, next) => {
  try {
    const { vote } = z.object({ vote: z.boolean() }).parse(req.body);
    const round = await prisma.decisionRound.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!round || round.status !== "OPEN") throw new ApiError(404, "round_not_found");

    await prisma.decisionVote.upsert({
      where: { roundId_userId: { roundId: round.id, userId: req.user!.userId } },
      update: { vote },
      create: { roundId: round.id, userId: req.user!.userId, vote },
    });

    // Once everyone voted, settle the round: unanimous yes accepts, any no rejects.
    const [votes, members] = await Promise.all([
      prisma.decisionVote.findMany({ where: { roundId: round.id } }),
      memberCount(req.workspaceId!),
    ]);
    if (votes.length >= members) {
      const accepted = votes.every((v) => v.vote);
      await prisma.decisionRound.update({
        where: { id: round.id },
        data: { status: accepted ? "ACCEPTED" : "REJECTED", closedAt: new Date() },
      });
    }

    const updated = await prisma.decisionRound.findUnique({
      where: { id: round.id },
      include: roundInclude,
    });
    res.json(serializeRound(updated!, members, req.user!.userId));
  } catch (err) {
    next(err);
  }
});

decisionRoundsRouter.post("/decision-rounds/:id/close", async (req, res, next) => {
  try {
    const round = await prisma.decisionRound.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!round || round.status !== "OPEN") throw new ApiError(404, "round_not_found");
    if (round.createdByUserId !== req.user!.userId) throw new ApiError(403, "not_round_owner");

    // Manual close by the proposer: majority of cast votes decides.
    const votes = await prisma.decisionVote.findMany({ where: { roundId: round.id } });
    const yes = votes.filter((v) => v.vote).length;
    const accepted = yes > votes.length - yes;
    const updated = await prisma.decisionRound.update({
      where: { id: round.id },
      data: { status: accepted ? "ACCEPTED" : "REJECTED", closedAt: new Date() },
      include: roundInclude,
    });
    res.json(
      serializeRound(updated, await memberCount(req.workspaceId!), req.user!.userId)
    );
  } catch (err) {
    next(err);
  }
});
