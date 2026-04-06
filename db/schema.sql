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
