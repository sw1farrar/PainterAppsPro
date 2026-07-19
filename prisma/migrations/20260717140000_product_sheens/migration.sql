-- Available sheens per paint product
CREATE TABLE IF NOT EXISTS "PaintProductSheen" (
    "id" TEXT NOT NULL,
    "paintProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaintProductSheen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaintProductSheen_paintProductId_idx"
ON "PaintProductSheen"("paintProductId");

CREATE UNIQUE INDEX IF NOT EXISTS "PaintProductSheen_paintProductId_name_key"
ON "PaintProductSheen"("paintProductId", "name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaintProductSheen_paintProductId_fkey'
  ) THEN
    ALTER TABLE "PaintProductSheen"
    ADD CONSTRAINT "PaintProductSheen_paintProductId_fkey"
    FOREIGN KEY ("paintProductId") REFERENCES "PaintProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill from legacy single sheen column
INSERT INTO "PaintProductSheen" ("id", "paintProductId", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text)::text,
  p."id",
  TRIM(p."sheen"),
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PaintProduct" p
WHERE p."sheen" IS NOT NULL
  AND TRIM(p."sheen") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "PaintProductSheen" s
    WHERE s."paintProductId" = p."id" AND s."name" = TRIM(p."sheen")
  );

-- App role used by DATABASE_URL (Supabase custom role)
GRANT ALL ON TABLE "PaintProductSheen" TO painterapps_pro;
GRANT ALL ON TABLE "PaintProductSheen" TO service_role;
