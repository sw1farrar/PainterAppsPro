-- Quote-level mapping of placeholders (Wall color 1) → actual colors
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "colorAssignmentsJson" TEXT;
