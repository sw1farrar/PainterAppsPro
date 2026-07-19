-- Blank wall openings: deduct paint area only (no trim / no paint surface)
ALTER TABLE "EstimateRoom" ADD COLUMN IF NOT EXISTS "openingCount" INTEGER NOT NULL DEFAULT 0;
