import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(1, "Name required"),
  // Allow blank email in forms; reject only non-empty invalid addresses
  email: z.union([z.literal(""), z.string().email()]).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
});

export const jobSchema = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1, "Title required"),
  status: z.enum(["draft", "estimating", "scheduled", "in_progress", "completed"]),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
});

export const businessSettingsSchema = z.object({
  companyName: z.string().min(1),
  logoPath: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  defaultLaborRate: z.coerce.number().min(0),
  materialMarkupPct: z.coerce.number().min(0),
  taxRatePct: z.coerce.number().min(0),
  wasteFactorPct: z.coerce.number().min(0),
  defaultPrepPct: z.coerce.number().min(0).optional(),
  defaultProfitTargetPct: z.coerce.number().min(0).optional(),
  defaultCoverageSqftPerGallon: z.coerce.number().positive().optional(),
  doorDeductionSqft: z.coerce.number().min(0).optional(),
  windowDeductionSqft: z.coerce.number().min(0).optional(),
  /** JSON map: surfaceType → { productId, sheen } */
  defaultProductsJson: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
});

export const paintProductSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  coverageSqftPerGallon: z.coerce.number().positive(),
  pricePerGallon: z.coerce.number().min(0),
  sheen: z.string().optional().nullable(),
  sheens: z.array(z.string().min(1)).optional(),
  category: z
    .enum([
      "interior",
      "exterior",
      "both",
      "interior_primer",
      "exterior_primer",
      "both_primer",
    ])
    .optional(),
  defaultSurfaceType: z.string().optional().nullable(),
  features: z.string().optional().nullable(),
  canImageUrl: z
    .union([z.literal(""), z.string().url()])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const productionRateSchema = z.object({
  surfaceType: z.string().min(1),
  method: z.string().min(1),
  measurementType: z.enum(["area", "unit"]),
  ratePerManHour: z.coerce.number().positive(),
  firstCoatRate: z.coerce.number().positive().optional().nullable(),
  additionalCoatRate: z.coerce.number().positive().optional().nullable(),
  effective2CoatRate: z.coerce.number().positive().optional().nullable(),
  defaultCoats: z.coerce.number().int().min(1),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type BusinessSettingsInput = z.infer<typeof businessSettingsSchema>;
