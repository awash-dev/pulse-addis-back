-- =============================================================================
-- B2B Medical Wholesale — Core Schema Migration
-- -----------------------------------------------------------------------------
-- Adds B2B procurement fields/columns/tables ON TOP of the existing consumer
-- pharmacy schema. This migration is strictly ADDITIVE: no existing column,
-- enum, table, or constraint is modified or dropped. All new columns are
-- nullable or carry a safe default so existing rows/queries keep working.
--
-- Idempotent: safe to run multiple times (uses IF NOT EXISTS / DO $$ guards).
-- Applied by `npm run migrate` (scripts/runMigration.js), which tracks applied
-- migrations in the "_Migration" table.
-- =============================================================================

-- ---- Extension (already created by base schema.sql, kept for safety) --------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. NEW ENUMS
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE "CustomerType" AS ENUM (
    'HOSPITAL', 'CLINIC', 'PHARMACY', 'MEDICAL_LABORATORY', 'ICU_CRITICAL_CARE',
    'NGO', 'GOVERNMENT_HEALTH_FACILITY', 'MEDICAL_EQUIPMENT_DEALER', 'DISTRIBUTOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentTerms" AS ENUM ('PREPAID', 'NET_30', 'NET_60', 'NET_90');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "B2bProductCategory" AS ENUM (
    'PHARMACEUTICALS', 'SURGICAL_INSTRUMENTS', 'LABORATORY_REAGENTS',
    'RAPID_DIAGNOSTIC_TESTS', 'ICU_CRITICAL_CARE_EQUIPMENT',
    'DIAGNOSTIC_EQUIPMENT', 'MEDICAL_CONSUMABLES', 'PPE_INFECTION_CONTROL',
    'HOSPITAL_FURNITURE', 'PHARMACY_SUPPLIES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RxClass" AS ENUM ('RX', 'OTC', 'NOT_APPLICABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AvailabilityStatus" AS ENUM (
    'IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK', 'DISCONTINUED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderType" AS ENUM ('STANDARD', 'BULK', 'RFQ', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProcurementStatus" AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING',
    'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RfqStatus" AS ENUM (
    'SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryType" AS ENUM ('FULL', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. USER — B2B CUSTOMER FIELDS
-- =============================================================================
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "institutionName" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customerType" "CustomerType";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessLicenseNumber" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "taxIdentificationNumber" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contactPersonName" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "contactPersonPhone" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creditLimit" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'PREPAID';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" boolean NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationDocuments" jsonb;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "b2bApprovedById" uuid;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "b2bApprovedAt" timestamptz;

-- Unique constraint on license number, only when populated (NULLs allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_businessLicenseNumber_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_businessLicenseNumber_key" UNIQUE ("businessLicenseNumber");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'User' AND constraint_name = 'User_b2bApproved_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_b2bApproved_fkey"
      FOREIGN KEY ("b2bApprovedById") REFERENCES "User"(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "User_customerType_idx" ON "User" ("customerType");
CREATE INDEX IF NOT EXISTS "User_isVerified_idx" ON "User" ("isVerified");

-- =============================================================================
-- 3. PRODUCT — B2B / MEDICAL METADATA
-- =============================================================================
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "genericName" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "brandName" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "registrationNumber" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "regulatoryAuthority" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "rxClass" "RxClass";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "certificates" jsonb;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "certificateExpiryDate" timestamptz;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "countryOfOrigin" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unitOfSale" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minimumOrderQuantity" integer NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "caseQuantity" integer;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "wholesalePrice" numeric(14,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tierPricing" jsonb;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "requestForQuoteEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "taxRate" numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "warehouseLocation" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "batchNumber" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lotNumber" text;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "manufacturingDate" timestamptz;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "expiryDate" timestamptz;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reorderLevel" integer NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "documents" jsonb;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryMetadata" jsonb;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "b2bCategory" "B2bProductCategory";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sourceRfqId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Product_sku_key'
  ) THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_sku_key" UNIQUE ("sku");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product" ("sku");
CREATE INDEX IF NOT EXISTS "Product_barcode_idx" ON "Product" ("barcode");
CREATE INDEX IF NOT EXISTS "Product_expiryDate_idx" ON "Product" ("expiryDate");
CREATE INDEX IF NOT EXISTS "Product_b2bCategory_idx" ON "Product" ("b2bCategory");
CREATE INDEX IF NOT EXISTS "Product_availabilityStatus_idx" ON "Product" ("availabilityStatus");

-- =============================================================================
-- 4. ORDER — PROCUREMENT FIELDS
-- =============================================================================
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "procurementStatus" "ProcurementStatus";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "purchaseOrderNumber" text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "purchaseOrderFileUrl" text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "proformaInvoiceUrl" text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxInvoiceUrl" text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvedById" uuid;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "approvedAt" timestamptz;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "creditPurchase" boolean NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryType" "DeliveryType";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipmentTrackingNumber" text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "b2bNotes" text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sourceRfqId" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Order' AND constraint_name = 'Order_approvedBy_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_approvedBy_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"(id) ON DELETE SET NULL;
  END IF;
END $$;

-- NOTE: The Order -> RequestForQuotation (sourceRfqId) foreign key is added in
-- section 6, after the RequestForQuotation table has been created, to avoid an
-- ordering dependency between the ALTER (here) and the CREATE (section 6).

CREATE INDEX IF NOT EXISTS "Order_orderType_idx" ON "Order" ("orderType");
CREATE INDEX IF NOT EXISTS "Order_procurementStatus_idx" ON "Order" ("procurementStatus");
CREATE INDEX IF NOT EXISTS "Order_userId_b2b_idx" ON "Order" ("userId");

-- =============================================================================
-- 5. ORDERITEM — PROCUREMENT FIELDS
-- =============================================================================
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "unitPrice" numeric(14,2);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "tierPriceApplied" boolean NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "deliveredQuantity" integer NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "batchNumber" text;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "expiryDate" timestamptz;

CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem" ("orderId");

-- =============================================================================
-- 6. NEW TABLE — RequestForQuotation
-- =============================================================================
CREATE TABLE IF NOT EXISTS "RequestForQuotation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  status "RfqStatus" NOT NULL DEFAULT 'SUBMITTED',
  "adminResponse" jsonb,
  "respondedById" uuid,
  "respondedAt" timestamptz,
  "validUntil" timestamptz,
  notes text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "RequestForQuotation_customer_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "RequestForQuotation_respondedBy_fkey"
    FOREIGN KEY ("respondedById") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "RFQ_customerId_idx" ON "RequestForQuotation" ("customerId");
CREATE INDEX IF NOT EXISTS "RFQ_status_idx" ON "RequestForQuotation" (status);

-- Order -> RequestForQuotation link (deferred from section 4 due to table ordering)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'Order' AND constraint_name = 'Order_sourceRfq_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_sourceRfq_fkey"
      FOREIGN KEY ("sourceRfqId") REFERENCES "RequestForQuotation"(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- 7. NEW TABLE — AuditLog
-- =============================================================================
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  "entityType" text NOT NULL,
  "entityId" uuid,
  "performedById" uuid,
  changes jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "AuditLog_performedBy_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AuditLog_entity_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_performedBy_idx" ON "AuditLog" ("performedById");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);

-- =============================================================================
-- 8. NEW TABLE — Address (B2B delivery addresses)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Address" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  label text,
  "recipientName" text,
  phone text,
  line1 text NOT NULL,
  line2 text,
  city text,
  region text,
  country text NOT NULL DEFAULT 'Ethiopia',
  "postalCode" text,
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Address_user_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON "Address" ("userId");

-- =============================================================================
-- 9. NEW TABLE — _Migration (tracks applied migrations for runMigration.js)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "_Migration" (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
