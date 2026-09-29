CREATE TABLE "application_metadata" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_metadata_pkey" PRIMARY KEY ("key")
);
