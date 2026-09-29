CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');
CREATE TYPE "AccessTokenPurpose" AS ENUM ('PASSWORD_RESET');

CREATE TABLE "Administrator" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Administrator_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Administrator_email_key" ON "Administrator"("email");

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "administratorId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_administratorId_revokedAt_idx" ON "AdminSession"("administratorId", "revokedAt");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_administratorId_fkey" FOREIGN KEY ("administratorId") REFERENCES "Administrator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccessToken" (
  "id" TEXT NOT NULL,
  "administratorId" TEXT NOT NULL,
  "purpose" "AccessTokenPurpose" NOT NULL DEFAULT 'PASSWORD_RESET',
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessToken_tokenHash_key" ON "AccessToken"("tokenHash");
CREATE INDEX "AccessToken_administratorId_usedAt_idx" ON "AccessToken"("administratorId", "usedAt");
CREATE INDEX "AccessToken_expiresAt_idx" ON "AccessToken"("expiresAt");
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_administratorId_fkey" FOREIGN KEY ("administratorId") REFERENCES "Administrator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuthRateLimit" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");
