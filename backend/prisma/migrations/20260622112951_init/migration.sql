-- CreateEnum
CREATE TYPE "FieldStatus" AS ENUM ('RECOGNIZED', 'UNCERTAIN', 'CONFLICTING', 'CONFIRMED', 'MODIFIED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEBSITE', 'SEARCH', 'MAPS', 'MENU', 'REVIEW', 'USER_PASTED_TEXT', 'OPENSTREETMAP', 'GOOGLE_PLACES', 'GOOGLE_MAPS_LINK', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceReliability" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categories" TEXT[],
    "subcategories" TEXT[],
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "website" TEXT,
    "googleMapsLink" TEXT,
    "googlePlaceId" TEXT,
    "phone" TEXT,
    "openingHours" JSONB,
    "priceLevel" INTEGER,
    "distance" DOUBLE PRECISION,
    "tags" TEXT[],
    "signatureDishes" TEXT[],
    "vegetarianOptions" BOOLEAN,
    "veganOptions" BOOLEAN,
    "reservationRecommended" BOOLEAN,
    "deliveryAvailable" BOOLEAN,
    "takeawayAvailable" BOOLEAN,
    "ambience" TEXT[],
    "suitability" TEXT[],
    "personalRating" DOUBLE PRECISION,
    "externalRating" DOUBLE PRECISION,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "lastVisitedAt" TIMESTAMP(3),
    "fieldStatuses" JSONB,
    "confidenceByField" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_sources" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "reliability" "SourceReliability" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_facts" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "FieldStatus" NOT NULL DEFAULT 'RECOGNIZED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_visits" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "weights" JSONB NOT NULL,
    "randomFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "repeatBlockDays" INTEGER NOT NULL DEFAULT 14,
    "suggestionCount" INTEGER NOT NULL DEFAULT 3,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classifications" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,

    CONSTRAINT "classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" TEXT NOT NULL,
    "analyzer" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "warnings" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_history" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "decisionProfileId" TEXT,
    "mode" TEXT NOT NULL,
    "reasoning" TEXT[],
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decision_profiles_name_key" ON "decision_profiles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "classifications_key_key" ON "classifications"("key");

-- AddForeignKey
ALTER TABLE "restaurant_sources" ADD CONSTRAINT "restaurant_sources_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_visits" ADD CONSTRAINT "restaurant_visits_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_history" ADD CONSTRAINT "suggestion_history_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_history" ADD CONSTRAINT "suggestion_history_decisionProfileId_fkey" FOREIGN KEY ("decisionProfileId") REFERENCES "decision_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
