-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "OrderQuote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "administratorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderQuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,

    CONSTRAINT "OrderQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderQuote_orderId_version_key" ON "OrderQuote"("orderId", "version");

-- CreateIndex
CREATE INDEX "OrderQuote_orderId_createdAt_idx" ON "OrderQuote"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderQuoteItem_quoteId_idx" ON "OrderQuoteItem"("quoteId");

-- AddForeignKey
ALTER TABLE "OrderQuote" ADD CONSTRAINT "OrderQuote_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderQuoteItem" ADD CONSTRAINT "OrderQuoteItem_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "OrderQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
