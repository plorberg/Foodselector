-- CreateEnum
CREATE TYPE "RestaurantClassification" AS ENUM ('NEW', 'RECOMMENDATION');

-- AlterTable: consolidate location into address, add classification
ALTER TABLE "restaurants" DROP COLUMN "city";
ALTER TABLE "restaurants" DROP COLUMN "country";
ALTER TABLE "restaurants" ADD COLUMN "classification" "RestaurantClassification";
