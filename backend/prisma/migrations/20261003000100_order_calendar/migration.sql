CREATE TYPE "OrderSource" AS ENUM ('STOREFRONT', 'MANUAL');

ALTER TABLE "Order"
  ADD COLUMN "scheduledDate" DATE,
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'STOREFRONT';

UPDATE "Order" SET "scheduledDate" = "requestedDate" WHERE "scheduledDate" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "scheduledDate" SET NOT NULL;

CREATE INDEX "Order_scheduledDate_status_idx" ON "Order"("scheduledDate", "status");

-- La opción con tres imágenes quedó integrada en los productos genérico y
-- predeterminado. Se asegura que ambos destinos estén visibles en el catálogo.
UPDATE "Product"
SET "status" = 'PUBLISHED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" IN ('cartel-generico', 'cartel-predeterminado');
