-- AlterTable BusinessSettings
ALTER TABLE "BusinessSettings" ALTER COLUMN "wasteFactorPct" SET DEFAULT 12;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "defaultPrepPct" DOUBLE PRECISION NOT NULL DEFAULT 30;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "defaultProfitTargetPct" DOUBLE PRECISION NOT NULL DEFAULT 35;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "doorDeductionSqft" DOUBLE PRECISION NOT NULL DEFAULT 20;
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "windowDeductionSqft" DOUBLE PRECISION NOT NULL DEFAULT 15;

UPDATE "BusinessSettings" SET "wasteFactorPct" = 12 WHERE "wasteFactorPct" = 10;

-- AlterTable Estimate
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "prepPct" DOUBLE PRECISION;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "discountPct" DOUBLE PRECISION;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "profitTargetPct" DOUBLE PRECISION;

-- AlterTable PaintProduct
ALTER TABLE "PaintProduct" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "PaintProduct" ADD COLUMN IF NOT EXISTS "defaultSurfaceType" TEXT;

-- AlterTable ProductionRate
ALTER TABLE "ProductionRate" ADD COLUMN IF NOT EXISTS "firstCoatRate" DOUBLE PRECISION;
ALTER TABLE "ProductionRate" ADD COLUMN IF NOT EXISTS "additionalCoatRate" DOUBLE PRECISION;
ALTER TABLE "ProductionRate" ADD COLUMN IF NOT EXISTS "effective2CoatRate" DOUBLE PRECISION;

-- CreateTable EstimateRoom
CREATE TABLE IF NOT EXISTS "EstimateRoom" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "optionId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'interior',
    "lengthFt" DOUBLE PRECISION,
    "widthFt" DOUBLE PRECISION,
    "heightFt" DOUBLE PRECISION,
    "doorCount" INTEGER NOT NULL DEFAULT 0,
    "windowCount" INTEGER NOT NULL DEFAULT 0,
    "inputAreaSqft" DOUBLE PRECISION,
    "inputLinearFt" DOUBLE PRECISION,
    "condition" TEXT NOT NULL DEFAULT 'medium',
    "prepPct" DOUBLE PRECISION,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateRoom_pkey" PRIMARY KEY ("id")
);

-- AlterTable EstimateLineItem
ALTER TABLE "EstimateLineItem" ADD COLUMN IF NOT EXISTS "roomId" TEXT;
ALTER TABLE "EstimateLineItem" ADD COLUMN IF NOT EXISTS "method" TEXT;
ALTER TABLE "EstimateLineItem" ADD COLUMN IF NOT EXISTS "conditionMultiplier" DOUBLE PRECISION;
ALTER TABLE "EstimateLineItem" ADD COLUMN IF NOT EXISTS "prepHours" DOUBLE PRECISION;

-- CreateTable EstimateExtra
CREATE TABLE IF NOT EXISTS "EstimateExtra" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountType" TEXT NOT NULL DEFAULT 'fixed',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateExtra_pkey" PRIMARY KEY ("id")
);

-- Migrate orphan line items into synthetic rooms (one room per estimate+option group)
INSERT INTO "EstimateRoom" ("id", "estimateId", "optionId", "name", "kind", "condition", "sortOrder", "createdAt", "updatedAt")
SELECT
  'migroom_' || e."id" || '_' || COALESCE(e."optionId", 'none'),
  e."estimateId",
  e."optionId",
  'Imported surfaces',
  'interior',
  'medium',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "estimateId", "optionId" FROM "EstimateLineItem" WHERE "roomId" IS NULL
) e;

UPDATE "EstimateLineItem" li
SET "roomId" = 'migroom_' || li."estimateId" || '_' || COALESCE(li."optionId", 'none')
WHERE li."roomId" IS NULL;

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "EstimateRoom" ADD CONSTRAINT "EstimateRoom_estimateId_fkey"
    FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstimateRoom" ADD CONSTRAINT "EstimateRoom_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "EstimateOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "EstimateRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EstimateExtra" ADD CONSTRAINT "EstimateExtra_estimateId_fkey"
    FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "EstimateRoom_estimateId_idx" ON "EstimateRoom"("estimateId");
CREATE INDEX IF NOT EXISTS "EstimateRoom_optionId_idx" ON "EstimateRoom"("optionId");
CREATE INDEX IF NOT EXISTS "EstimateLineItem_roomId_idx" ON "EstimateLineItem"("roomId");
CREATE INDEX IF NOT EXISTS "EstimateExtra_estimateId_idx" ON "EstimateExtra"("estimateId");

-- App role used by DATABASE_URL pooler connection
GRANT ALL ON TABLE "EstimateRoom" TO painterapps_pro;
GRANT ALL ON TABLE "EstimateExtra" TO painterapps_pro;
