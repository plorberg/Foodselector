-- CreateEnum
CREATE TYPE "DecisionRoundStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "decision_rounds" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "DecisionRoundStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "decision_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_votes" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_votes_roundId_userId_key" ON "decision_votes"("roundId", "userId");

-- AddForeignKey
ALTER TABLE "decision_rounds" ADD CONSTRAINT "decision_rounds_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_rounds" ADD CONSTRAINT "decision_rounds_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "decision_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_votes" ADD CONSTRAINT "decision_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
