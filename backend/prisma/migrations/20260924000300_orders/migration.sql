-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT,
    "reference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "requestedDate" DATE NOT NULL,
    "deliveryMethod" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "knownSubtotalCents" INTEGER NOT NULL,
    "pendingQuoteCount" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "whatsappUrl" TEXT,
    "whatsappMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "variantSnapshot" JSONB,
    "customizationSnapshot" JSONB NOT NULL,
    "componentsSnapshot" JSONB,
    "pricingMode" "PricingMode" NOT NULL,
    "unitPriceCents" INTEGER,
    "quantity" INTEGER NOT NULL,
    "subtotalCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRequest" (
    "guestSessionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRequest_pkey" PRIMARY KEY ("guestSessionId","scope","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE INDEX "Order_guestSessionId_createdAt_idx" ON "Order"("guestSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRequest_orderId_key" ON "OrderRequest"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestSessionId_fkey"
    FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequest" ADD CONSTRAINT "OrderRequest_guestSessionId_fkey"
    FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRequest" ADD CONSTRAINT "OrderRequest_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
