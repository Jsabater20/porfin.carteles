-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "administratorId" TEXT NOT NULL,
    "cloudName" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cleanupAfter" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cleanedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "cleanupAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    "cover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_publicId_key" ON "MediaUpload"("publicId");

-- CreateIndex
CREATE INDEX "MediaUpload_administratorId_createdAt_idx" ON "MediaUpload"("administratorId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaUpload_productId_expiresAt_idx" ON "MediaUpload"("productId", "expiresAt");

-- CreateIndex
CREATE INDEX "MediaUpload_cloudName_cleanedAt_cleanupAfter_idx" ON "MediaUpload"("cloudName", "cleanedAt", "cleanupAfter");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_uploadId_key" ON "ProductImage"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_assetId_key" ON "ProductImage"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "ProductImage"("publicId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "MediaUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una única portada por producto, también ante escrituras fuera de la API.
CREATE UNIQUE INDEX "ProductImage_one_cover" ON "ProductImage"("productId") WHERE "cover" = true;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_valid_file" CHECK (
  "format" IN ('jpg', 'png', 'webp') AND "bytes" BETWEEN 1 AND 5242880
  AND "width" > 0 AND "height" > 0 AND "width"::bigint * "height"::bigint <= 40000000
  AND "position" >= 0 AND length("altText") <= 240
);