-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GENERIC', 'PREDEFINED', 'CUSTOM', 'COMBO');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('HIDDEN', 'PUBLISHED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'QUOTE');

-- CreateEnum
CREATE TYPE "PersonalizationType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SELECT', 'NUMBER');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Career" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'HIDDEN',
    "measurements" TEXT NOT NULL DEFAULT '',
    "materials" TEXT NOT NULL DEFAULT '',
    "includes" TEXT NOT NULL DEFAULT '',
    "leadTime" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "ProductCareer" (
    "productId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,

    CONSTRAINT "ProductCareer_pkey" PRIMARY KEY ("productId","careerId")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingMode" "PricingMode" NOT NULL,
    "priceCents" INTEGER,
    "attributes" JSONB NOT NULL,
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationField" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "PersonalizationType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "componentKey" TEXT,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,

    CONSTRAINT "PersonalizationField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "additionalCents" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PersonalizationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboComponent" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "referenceProductId" TEXT,

    CONSTRAINT "ComboComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Career_name_key" ON "Career"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Career_slug_key" ON "Career"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_type_idx" ON "Product"("status", "type");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

-- CreateIndex
CREATE INDEX "ProductCareer_careerId_idx" ON "ProductCareer"("careerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_key_key" ON "ProductVariant"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizationField_productId_key_key" ON "PersonalizationField"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizationOption_fieldId_key_key" ON "PersonalizationOption"("fieldId", "key");

-- CreateIndex
CREATE INDEX "ComboComponent_referenceProductId_idx" ON "ComboComponent"("referenceProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboComponent_comboId_key_key" ON "ComboComponent"("comboId", "key");

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCareer" ADD CONSTRAINT "ProductCareer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCareer" ADD CONSTRAINT "ProductCareer_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationField" ADD CONSTRAINT "PersonalizationField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationOption" ADD CONSTRAINT "PersonalizationOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "PersonalizationField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboComponent" ADD CONSTRAINT "ComboComponent_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboComponent" ADD CONSTRAINT "ComboComponent_referenceProductId_fkey" FOREIGN KEY ("referenceProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reglas monetarias de catálogo, también al nivel de PostgreSQL.
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_pricing_check" CHECK (
  ("pricingMode" = 'FIXED' AND "priceCents" IS NOT NULL AND "priceCents" BETWEEN 0 AND 1000000000)
  OR ("pricingMode" = 'QUOTE' AND "priceCents" IS NULL)
);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_photoCount_check" CHECK ("photoCount" BETWEEN 0 AND 10);
ALTER TABLE "PersonalizationOption" ADD CONSTRAINT "PersonalizationOption_additionalCents_check" CHECK ("additionalCents" BETWEEN 0 AND 1000000000);
ALTER TABLE "ComboComponent" ADD CONSTRAINT "ComboComponent_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100);
ALTER TABLE "ComboComponent" ADD CONSTRAINT "ComboComponent_not_self_check" CHECK ("referenceProductId" IS NULL OR "referenceProductId" <> "comboId");