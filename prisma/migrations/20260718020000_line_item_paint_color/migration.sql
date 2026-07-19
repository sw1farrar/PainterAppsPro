-- Paint color per surface (name + optional hex for swatch UI)
ALTER TABLE "EstimateLineItem" ADD COLUMN IF NOT EXISTS "colorName" TEXT;
ALTER TABLE "EstimateLineItem" ADD COLUMN IF NOT EXISTS "colorHex" TEXT;
