-- Per-surface default paint product + sheen (company settings)
ALTER TABLE "BusinessSettings" ADD COLUMN IF NOT EXISTS "defaultProductsJson" TEXT;
