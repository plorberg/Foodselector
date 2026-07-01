-- Multi-tenancy: workspaces, memberships, invitations; Google auth; per-workspace scoping.

-- Enums
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- New tables
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- Standard workspace holds all pre-existing data (claimed by the first login).
INSERT INTO "workspaces" ("id", "name") VALUES ('00000000-0000-0000-0000-000000000001', 'Standard');

-- Users: drop password, add Google id
ALTER TABLE "users" DROP COLUMN "passwordHash";
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- Add workspaceId (nullable), backfill to Standard, then enforce NOT NULL
ALTER TABLE "restaurants" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "categories" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "tags" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "decision_profiles" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "workspaceId" TEXT;

UPDATE "restaurants" SET "workspaceId" = '00000000-0000-0000-0000-000000000001';
UPDATE "categories" SET "workspaceId" = '00000000-0000-0000-0000-000000000001';
UPDATE "tags" SET "workspaceId" = '00000000-0000-0000-0000-000000000001';
UPDATE "decision_profiles" SET "workspaceId" = '00000000-0000-0000-0000-000000000001';
UPDATE "app_settings" SET "workspaceId" = '00000000-0000-0000-0000-000000000001';

ALTER TABLE "restaurants" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "tags" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "decision_profiles" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "app_settings" ALTER COLUMN "workspaceId" SET NOT NULL;

-- app_settings: composite PK (workspaceId, key)
ALTER TABLE "app_settings" DROP CONSTRAINT "app_settings_pkey";
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("workspaceId", "key");

-- Drop old global unique indexes
DROP INDEX "categories_name_key";
DROP INDEX "decision_profiles_name_key";
DROP INDEX "restaurants_googlePlaceId_key";
DROP INDEX "tags_name_key";

-- New indexes
CREATE UNIQUE INDEX "memberships_userId_workspaceId_key" ON "memberships"("userId", "workspaceId");
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");
CREATE UNIQUE INDEX "categories_workspaceId_name_key" ON "categories"("workspaceId", "name");
CREATE UNIQUE INDEX "decision_profiles_workspaceId_name_key" ON "decision_profiles"("workspaceId", "name");
CREATE UNIQUE INDEX "restaurants_workspaceId_googlePlaceId_key" ON "restaurants"("workspaceId", "googlePlaceId");
CREATE UNIQUE INDEX "tags_workspaceId_name_key" ON "tags"("workspaceId", "name");

-- Foreign keys
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_profiles" ADD CONSTRAINT "decision_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
