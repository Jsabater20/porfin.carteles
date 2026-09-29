-- CreateEnum
CREATE TYPE "PaymentMovementType" AS ENUM ('CHARGE', 'REFUND');

-- CreateTable
CREATE TABLE "PaymentMovement" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quoteId" TEXT,
    "type" "PaymentMovementType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administratorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMovement_orderId_occurredAt_idx" ON "PaymentMovement"("orderId", "occurredAt");

-- CreateIndex
CREATE INDEX "PaymentMovement_quoteId_idx" ON "PaymentMovement"("quoteId");

-- AddForeignKey
ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMovement" ADD CONSTRAINT "PaymentMovement_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "OrderQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
