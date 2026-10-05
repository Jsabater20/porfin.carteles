ALTER TABLE "StoreSettings"
  ADD COLUMN "googleCalendarEmail" TEXT,
  ADD COLUMN "googleCalendarAccessToken" TEXT,
  ADD COLUMN "googleCalendarRefreshToken" TEXT,
  ADD COLUMN "googleCalendarTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "googleCalendarId" TEXT,
  ADD COLUMN "googleCalendarConnectedAt" TIMESTAMP(3),
  ADD COLUMN "googleCalendarLastSyncedAt" TIMESTAMP(3);
