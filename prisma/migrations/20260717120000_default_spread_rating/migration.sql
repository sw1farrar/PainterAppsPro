-- Standard company spread rating (sq ft per gallon) used for new products
-- and as the gallon-calculation fallback when a surface has no product.
ALTER TABLE "BusinessSettings"
ADD COLUMN IF NOT EXISTS "defaultCoverageSqftPerGallon" DOUBLE PRECISION NOT NULL DEFAULT 375;
