-- CreateEnum
CREATE TYPE "ContentPageKey" AS ENUM ('home', 'about', 'contact', 'faq');

-- CreateTable
CREATE TABLE "ContentPage" (
    "page" "ContentPageKey" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "sections" JSONB NOT NULL DEFAULT '[]',
    "faqItems" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("page")
);

-- CreateTable
CREATE TABLE "FeaturedProduct" (
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "FeaturedProduct_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "storeName" TEXT NOT NULL DEFAULT 'Por fin!',
    "description" TEXT NOT NULL DEFAULT '',
    "whatsappNumber" TEXT,
    "contactEmail" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "pickupAddress" TEXT NOT NULL DEFAULT '',
    "deliveryMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliveryNotes" TEXT NOT NULL DEFAULT '',
    "leadTimeText" TEXT NOT NULL DEFAULT '',
    "businessHours" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedProduct_position_key" ON "FeaturedProduct"("position");

-- AddForeignKey
ALTER TABLE "FeaturedProduct" ADD CONSTRAINT "FeaturedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_singleton" CHECK ("id" = 1);
ALTER TABLE "FeaturedProduct" ADD CONSTRAINT "FeaturedProduct_position_nonnegative" CHECK ("position" >= 0);
