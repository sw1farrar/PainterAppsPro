-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'Your Painting Company',
    "logoPath" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "defaultLaborRate" DOUBLE PRECISION NOT NULL DEFAULT 55,
    "materialMarkupPct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "taxRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wasteFactorPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "termsAndConditions" TEXT NOT NULL DEFAULT 'Estimate valid for 30 days. 50% deposit required to schedule. Balance due upon completion. Prices subject to change if scope changes.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "estimateNumber" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "optionLabel" TEXT NOT NULL DEFAULT 'Better',
    "wasteFactorPct" DOUBLE PRECISION,
    "materialMarkupPct" DOUBLE PRECISION,
    "laborRate" DOUBLE PRECISION,
    "taxRatePct" DOUBLE PRECISION,
    "notes" TEXT,
    "internalNotes" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateOption" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLineItem" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "optionId" TEXT,
    "description" TEXT NOT NULL,
    "surfaceType" TEXT,
    "measurementType" TEXT NOT NULL DEFAULT 'area',
    "inputAreaSqft" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "unitLabel" TEXT,
    "dimensionsJson" TEXT,
    "coats" INTEGER NOT NULL DEFAULT 2,
    "paintProductId" TEXT,
    "productionRateId" TEXT,
    "gallons" DOUBLE PRECISION,
    "laborHours" DOUBLE PRECISION,
    "materialCost" DOUBLE PRECISION,
    "laborCost" DOUBLE PRECISION,
    "lineTotal" DOUBLE PRECISION,
    "gallonsOverride" DOUBLE PRECISION,
    "laborHoursOverride" DOUBLE PRECISION,
    "materialCostOverride" DOUBLE PRECISION,
    "laborCostOverride" DOUBLE PRECISION,
    "lineTotalOverride" DOUBLE PRECISION,
    "productionRateOverride" DOUBLE PRECISION,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstimateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'Sherwin-Williams',
    "coverageSqftPerGallon" DOUBLE PRECISION NOT NULL DEFAULT 375,
    "pricePerGallon" DOUBLE PRECISION NOT NULL,
    "sheen" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRate" (
    "id" TEXT NOT NULL,
    "surfaceType" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Brush/Roll',
    "measurementType" TEXT NOT NULL DEFAULT 'area',
    "ratePerManHour" DOUBLE PRECISION NOT NULL,
    "defaultCoats" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimatePhoto" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimatePhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateOption" ADD CONSTRAINT "EstimateOption_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "EstimateOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_paintProductId_fkey" FOREIGN KEY ("paintProductId") REFERENCES "PaintProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLineItem" ADD CONSTRAINT "EstimateLineItem_productionRateId_fkey" FOREIGN KEY ("productionRateId") REFERENCES "ProductionRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimatePhoto" ADD CONSTRAINT "EstimatePhoto_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
