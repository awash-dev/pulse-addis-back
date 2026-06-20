-- PostgreSQL database schema generated from the recovered Prisma schema.
-- Requires the pgcrypto extension for UUID generation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE Role AS ENUM ('superAdmin', 'admin', 'merchant', 'deliveryBoy', 'user');
CREATE TYPE ApprovalStatus AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE OrderStatus AS ENUM ('pending', 'assigned', 'active', 'delivered');
CREATE TYPE PrescriptionStatus AS ENUM ('not_required', 'pending', 'approved', 'rejected');

CREATE TABLE "User" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firstname text NOT NULL,
  lastname text NOT NULL,
  username text,
  email text NOT NULL UNIQUE,
  mobile text NOT NULL UNIQUE,
  password text NOT NULL,
  role Role NOT NULL DEFAULT 'user',
  "isActive" boolean NOT NULL DEFAULT true,
  "isBlocked" boolean NOT NULL DEFAULT false,
  "isEmailVerified" boolean NOT NULL DEFAULT false,
  address text,
  "profilePictures" jsonb,
  "emailVerificationOTP" text,
  "emailVerificationExpires" timestamptz,
  "passwordResetOTP" text,
  "passwordResetExpires" timestamptz,
  "refreshToken" text,
  "passwordChangedAt" timestamptz,
  "passwordResetToken" text,
  "googleId" text UNIQUE,
  "facebookId" text UNIQUE,
  provider text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Store" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" text UNIQUE,
  "storeName" text NOT NULL,
  "ownerId" uuid NOT NULL,
  address text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Store_owner_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "Category" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "Subcategory" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "Brand" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "Tag" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "Size" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "Product" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL,
  price double precision NOT NULL,
  "oldPrice" double precision DEFAULT 100.0,
  category text NOT NULL,
  subcategory text NOT NULL,
  brand text NOT NULL,
  quantity integer NOT NULL,
  sold integer NOT NULL DEFAULT 0,
  "postedByUserId" uuid NOT NULL,
  "storeId" uuid NOT NULL,
  status ApprovalStatus NOT NULL DEFAULT 'pending',
  "rejectionReason" jsonb,
  images jsonb,
  strength text,
  "requiresPrescription" boolean NOT NULL DEFAULT false,
  "prescriptionPlans" jsonb,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  discount integer DEFAULT 0,
  "totalRating" double precision NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Product_postedBy_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "Product_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"(id) ON DELETE CASCADE
);

CREATE TABLE "Color" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text
);

CREATE TABLE "ProductColor" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL,
  "colorId" uuid NOT NULL,
  images jsonb,
  CONSTRAINT "ProductColor_product_fkey" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE,
  CONSTRAINT "ProductColor_color_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"(id) ON DELETE CASCADE
);

CREATE TABLE "Review" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating integer NOT NULL,
  comment text NOT NULL,
  "productId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Review_product_fkey" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE,
  CONSTRAINT "Review_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "Order" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "firstName" text NOT NULL,
  "lastName" text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  "postalCode" integer NOT NULL,
  "txRef" text,
  "paymentInfo" jsonb,
  "paidAt" timestamptz DEFAULT now(),
  "totalPrice" double precision NOT NULL,
  "totalPriceAfterDiscount" double precision NOT NULL,
  status OrderStatus NOT NULL DEFAULT 'pending',
  "assignedToId" uuid,
  "prescriptionStatus" PrescriptionStatus NOT NULL DEFAULT 'not_required',
  "prescriptionImages" jsonb,
  month integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Order_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "Order_assignedTo_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE TABLE "OrderItem" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "colorId" uuid,
  quantity integer NOT NULL,
  price double precision NOT NULL,
  size text NOT NULL,
  CONSTRAINT "OrderItem_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE,
  CONSTRAINT "OrderItem_product_fkey" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE
);

CREATE TABLE "Cart" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  "selectedColor" text NOT NULL,
  "selectedSize" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Cart_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "Cart_product_fkey" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE
);

CREATE TABLE "Activity" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Activity_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "Blog" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL,
  category text NOT NULL,
  subcategory text,
  description text,
  "isPopup" boolean NOT NULL DEFAULT false,
  author text NOT NULL,
  images jsonb,
  "numViews" integer NOT NULL DEFAULT 0,
  "isLiked" boolean NOT NULL DEFAULT false,
  "isDisliked" boolean NOT NULL DEFAULT false,
  likes jsonb,
  dislikes jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "BlogCategory" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "BlogSubCategory" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE "Conversation" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "ConversationUsers" (
  "conversationId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  PRIMARY KEY ("conversationId", "userId"),
  CONSTRAINT "ConversationUsers_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id) ON DELETE CASCADE,
  CONSTRAINT "ConversationUsers_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "Message" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL,
  "senderId" uuid NOT NULL,
  text text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Message_conversation_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id) ON DELETE CASCADE,
  CONSTRAINT "Message_sender_fkey" FOREIGN KEY ("senderId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "Notification" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  message text NOT NULL,
  "read" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Notification_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "Coupon" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  expiry timestamptz NOT NULL,
  discount integer NOT NULL
);

CREATE TABLE "FQA" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL
);

CREATE TABLE "DeliveryAssignment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "orderId" uuid NOT NULL,
  status text NOT NULL DEFAULT 'assigned',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "DeliveryAssignment_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "DeliveryAssignment_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"(id) ON DELETE CASCADE
);

CREATE TABLE "Package" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  price double precision NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "HealthAdvice" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conditionName" text NOT NULL,
  "healthAdvice" text NOT NULL,
  "keySymptoms" jsonb DEFAULT '[]',
  author text DEFAULT 'Pulse Admin',
  image jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Promotion" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image text NOT NULL,
  link text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Report" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Report_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE TABLE "AdHome" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image text NOT NULL,
  link text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "SpecialAd" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image text NOT NULL,
  link text,
  discount integer DEFAULT 0,
  description text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "BannerAd" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image text NOT NULL,
  link text,
  position text DEFAULT 'top',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Wishlist" (
  "userId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  PRIMARY KEY ("userId", "productId"),
  CONSTRAINT "Wishlist_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "Wishlist_product_fkey" FOREIGN KEY ("productId") REFERENCES "Product"(id) ON DELETE CASCADE
);

-- =============================================================================
-- B2B MEDICAL WHOLESALE — ADDITIVE EXTENSION
-- -----------------------------------------------------------------------------
-- The block below mirrors db/migrations/20260101_b2b_core.sql. It is strictly
-- additive: new enums, new nullable/defaulted columns on existing tables, and
-- new tables. No existing column/enum/constraint is altered. Kept here so a
-- fresh install from schema.sql reflects the full current schema. Prefer using
-- `npm run migrate` on an already-initialized database.
-- =============================================================================

CREATE TYPE "CustomerType" AS ENUM (
  'HOSPITAL', 'CLINIC', 'PHARMACY', 'MEDICAL_LABORATORY', 'ICU_CRITICAL_CARE',
  'NGO', 'GOVERNMENT_HEALTH_FACILITY', 'MEDICAL_EQUIPMENT_DEALER', 'DISTRIBUTOR'
);
CREATE TYPE "PaymentTerms" AS ENUM ('PREPAID', 'NET_30', 'NET_60', 'NET_90');
CREATE TYPE "B2bProductCategory" AS ENUM (
  'PHARMACEUTICALS', 'SURGICAL_INSTRUMENTS', 'LABORATORY_REAGENTS',
  'RAPID_DIAGNOSTIC_TESTS', 'ICU_CRITICAL_CARE_EQUIPMENT',
  'DIAGNOSTIC_EQUIPMENT', 'MEDICAL_CONSUMABLES', 'PPE_INFECTION_CONTROL',
  'HOSPITAL_FURNITURE', 'PHARMACY_SUPPLIES'
);
CREATE TYPE "RxClass" AS ENUM ('RX', 'OTC', 'NOT_APPLICABLE');
CREATE TYPE "AvailabilityStatus" AS ENUM (
  'IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK', 'DISCONTINUED'
);
CREATE TYPE "OrderType" AS ENUM ('STANDARD', 'BULK', 'RFQ', 'CREDIT');
CREATE TYPE "ProcurementStatus" AS ENUM (
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING',
  'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
);
CREATE TYPE "RfqStatus" AS ENUM (
  'SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'REJECTED', 'EXPIRED'
);
CREATE TYPE "DeliveryType" AS ENUM ('FULL', 'PARTIAL');

-- User: B2B customer fields
ALTER TABLE "User" ADD COLUMN "institutionName" text;
ALTER TABLE "User" ADD COLUMN "customerType" "CustomerType";
ALTER TABLE "User" ADD COLUMN "businessLicenseNumber" text;
ALTER TABLE "User" ADD COLUMN "taxIdentificationNumber" text;
ALTER TABLE "User" ADD COLUMN "contactPersonName" text;
ALTER TABLE "User" ADD COLUMN "contactPersonPhone" text;
ALTER TABLE "User" ADD COLUMN "creditLimit" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "paymentTerms" "PaymentTerms" NOT NULL DEFAULT 'PREPAID';
ALTER TABLE "User" ADD COLUMN "isVerified" boolean NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "verificationDocuments" jsonb;
ALTER TABLE "User" ADD COLUMN "b2bApprovedById" uuid;
ALTER TABLE "User" ADD COLUMN "b2bApprovedAt" timestamptz;
ALTER TABLE "User" ADD CONSTRAINT "User_businessLicenseNumber_key" UNIQUE ("businessLicenseNumber");
ALTER TABLE "User"
  ADD CONSTRAINT "User_b2bApproved_fkey"
  FOREIGN KEY ("b2bApprovedById") REFERENCES "User"(id) ON DELETE SET NULL;
CREATE INDEX "User_customerType_idx" ON "User" ("customerType");
CREATE INDEX "User_isVerified_idx" ON "User" ("isVerified");

-- Product: B2B / medical metadata
ALTER TABLE "Product" ADD COLUMN "genericName" text;
ALTER TABLE "Product" ADD COLUMN "brandName" text;
ALTER TABLE "Product" ADD COLUMN "sku" text;
ALTER TABLE "Product" ADD COLUMN "barcode" text;
ALTER TABLE "Product" ADD COLUMN "registrationNumber" text;
ALTER TABLE "Product" ADD COLUMN "regulatoryAuthority" text;
ALTER TABLE "Product" ADD COLUMN "rxClass" "RxClass";
ALTER TABLE "Product" ADD COLUMN "certificates" jsonb;
ALTER TABLE "Product" ADD COLUMN "certificateExpiryDate" timestamptz;
ALTER TABLE "Product" ADD COLUMN "countryOfOrigin" text;
ALTER TABLE "Product" ADD COLUMN "unitOfSale" text;
ALTER TABLE "Product" ADD COLUMN "minimumOrderQuantity" integer NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN "caseQuantity" integer;
ALTER TABLE "Product" ADD COLUMN "wholesalePrice" numeric(14,2);
ALTER TABLE "Product" ADD COLUMN "tierPricing" jsonb;
ALTER TABLE "Product" ADD COLUMN "requestForQuoteEnabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "taxRate" numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "warehouseLocation" text;
ALTER TABLE "Product" ADD COLUMN "batchNumber" text;
ALTER TABLE "Product" ADD COLUMN "lotNumber" text;
ALTER TABLE "Product" ADD COLUMN "manufacturingDate" timestamptz;
ALTER TABLE "Product" ADD COLUMN "expiryDate" timestamptz;
ALTER TABLE "Product" ADD COLUMN "reorderLevel" integer NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'IN_STOCK';
ALTER TABLE "Product" ADD COLUMN "documents" jsonb;
ALTER TABLE "Product" ADD COLUMN "categoryMetadata" jsonb;
ALTER TABLE "Product" ADD COLUMN "b2bCategory" "B2bProductCategory";
ALTER TABLE "Product" ADD COLUMN "sourceRfqId" uuid;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sku_key" UNIQUE ("sku");
CREATE INDEX "Product_sku_idx" ON "Product" ("sku");
CREATE INDEX "Product_barcode_idx" ON "Product" ("barcode");
CREATE INDEX "Product_expiryDate_idx" ON "Product" ("expiryDate");
CREATE INDEX "Product_b2bCategory_idx" ON "Product" ("b2bCategory");
CREATE INDEX "Product_availabilityStatus_idx" ON "Product" ("availabilityStatus");

-- Order: procurement fields
ALTER TABLE "Order" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Order" ADD COLUMN "procurementStatus" "ProcurementStatus";
ALTER TABLE "Order" ADD COLUMN "purchaseOrderNumber" text;
ALTER TABLE "Order" ADD COLUMN "purchaseOrderFileUrl" text;
ALTER TABLE "Order" ADD COLUMN "proformaInvoiceUrl" text;
ALTER TABLE "Order" ADD COLUMN "taxInvoiceUrl" text;
ALTER TABLE "Order" ADD COLUMN "approvedById" uuid;
ALTER TABLE "Order" ADD COLUMN "approvedAt" timestamptz;
ALTER TABLE "Order" ADD COLUMN "creditPurchase" boolean NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "deliveryType" "DeliveryType";
ALTER TABLE "Order" ADD COLUMN "shipmentTrackingNumber" text;
ALTER TABLE "Order" ADD COLUMN "b2bNotes" text;
ALTER TABLE "Order" ADD COLUMN "sourceRfqId" uuid;
ALTER TABLE "Order" ADD COLUMN "paymentStatus"  text NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Order" ADD COLUMN "paymentMethod"  text;
ALTER TABLE "Order" ADD COLUMN "chapaPaymentId" text;
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_approvedBy_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"(id) ON DELETE SET NULL;
CREATE INDEX "Order_orderType_idx" ON "Order" ("orderType");
CREATE INDEX "Order_procurementStatus_idx" ON "Order" ("procurementStatus");
CREATE INDEX "Order_userId_b2b_idx" ON "Order" ("userId");

-- OrderItem: procurement fields
ALTER TABLE "OrderItem" ADD COLUMN "unitPrice" numeric(14,2);
ALTER TABLE "OrderItem" ADD COLUMN "tierPriceApplied" boolean NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "deliveredQuantity" integer NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN "batchNumber" text;
ALTER TABLE "OrderItem" ADD COLUMN "expiryDate" timestamptz;
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem" ("productId");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem" ("orderId");

-- New table: RequestForQuotation
CREATE TABLE "RequestForQuotation" (
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
CREATE INDEX "RFQ_customerId_idx" ON "RequestForQuotation" ("customerId");
CREATE INDEX "RFQ_status_idx" ON "RequestForQuotation" (status);
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_sourceRfq_fkey"
  FOREIGN KEY ("sourceRfqId") REFERENCES "RequestForQuotation"(id) ON DELETE SET NULL;

-- New table: AuditLog
CREATE TABLE "AuditLog" (
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
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog" ("entityType", "entityId");
CREATE INDEX "AuditLog_performedBy_idx" ON "AuditLog" ("performedById");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt" DESC);

-- New table: Address (B2B delivery addresses)
CREATE TABLE "Address" (
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
CREATE INDEX "Address_userId_idx" ON "Address" ("userId");

-- New table: _Migration (tracks applied migrations)
CREATE TABLE "_Migration" (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
