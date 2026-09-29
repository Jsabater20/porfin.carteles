-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "knownSubtotalCents" SET DATA TYPE DECIMAL(16,0),
ALTER COLUMN "shippingCents" SET DATA TYPE DECIMAL(16,0);

-- AlterTable
ALTER TABLE "OrderQuote" ALTER COLUMN "totalCents" SET DATA TYPE DECIMAL(16,0);

-- AlterTable
ALTER TABLE "OrderQuoteItem" ALTER COLUMN "unitPriceCents" SET DATA TYPE DECIMAL(16,0),
ALTER COLUMN "subtotalCents" SET DATA TYPE DECIMAL(16,0);

-- AlterTable
ALTER TABLE "PaymentMovement" ADD COLUMN     "idempotencyKey" UUID,
ADD COLUMN     "requestHash" TEXT;
UPDATE "PaymentMovement" SET "idempotencyKey" = gen_random_uuid(), "requestHash" = 'legacy:' || "id";
ALTER TABLE "PaymentMovement" ALTER COLUMN "idempotencyKey" SET NOT NULL, ALTER COLUMN "requestHash" SET NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "unitPriceCents" SET DATA TYPE DECIMAL(16,0),
ALTER COLUMN "subtotalCents" SET DATA TYPE DECIMAL(16,0);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMovement_idempotencyKey_key" ON "PaymentMovement"("idempotencyKey");


-- Centavos exactos dentro del rango entero seguro del contrato JSON.
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_valid" CHECK ("knownSubtotalCents" BETWEEN 0 AND 9007199254740991 AND ("shippingCents" IS NULL OR "shippingCents" BETWEEN 0 AND 9007199254740991));
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_money_valid" CHECK ("quantity" > 0 AND (("pricingMode" = 'QUOTE' AND "unitPriceCents" IS NULL AND "subtotalCents" IS NULL) OR ("pricingMode" = 'FIXED' AND "unitPriceCents" IS NOT NULL AND "subtotalCents" IS NOT NULL AND "unitPriceCents" BETWEEN 0 AND 9007199254740991 AND "subtotalCents" = "unitPriceCents" * "quantity" AND "subtotalCents" <= 9007199254740991)));
ALTER TABLE "OrderQuote" ADD CONSTRAINT "OrderQuote_total_valid" CHECK ("totalCents" BETWEEN 0 AND 9007199254740991);
ALTER TABLE "OrderQuoteItem" ADD CONSTRAINT "OrderQuoteItem_money_valid" CHECK ("quantity" > 0 AND "unitPriceCents" >= 0 AND "subtotalCents" = "unitPriceCents" * "quantity" AND "subtotalCents" <= 9007199254740991);
ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_amount_positive" CHECK ("amountCents" > 0);
-- Corrige referencias a sesiones usadas como actor por la implementación anterior.
UPDATE "OrderQuote" q SET "administratorId" = s."administratorId" FROM "AdminSession" s WHERE q."administratorId" = s."id";
UPDATE "PaymentMovement" p SET "administratorId" = s."administratorId" FROM "AdminSession" s WHERE p."administratorId" = s."id";
UPDATE "OrderEvent" e SET "details" = jsonb_set(e."details", '{administratorId}', to_jsonb(s."administratorId")) FROM "AdminSession" s WHERE e."details"->>'administratorId' = s."id";
