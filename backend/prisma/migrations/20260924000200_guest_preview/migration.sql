-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPreview" (
    "id" TEXT NOT NULL,
    "guestSessionId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotentRequest" (
    "guestSessionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "previewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotentRequest_pkey" PRIMARY KEY ("guestSessionId","scope","key")
);

-- CreateTable
CREATE TABLE "GuestRateLimit" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");

-- CreateIndex
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OrderPreview_guestSessionId_expiresAt_idx" ON "OrderPreview"("guestSessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "OrderPreview_expiresAt_idx" ON "OrderPreview"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotentRequest_previewId_key" ON "IdempotentRequest"("previewId");

-- CreateIndex
CREATE INDEX "GuestRateLimit_expiresAt_idx" ON "GuestRateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "OrderPreview" ADD CONSTRAINT "OrderPreview_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotentRequest" ADD CONSTRAINT "IdempotentRequest_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotentRequest" ADD CONSTRAINT "IdempotentRequest_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "OrderPreview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
