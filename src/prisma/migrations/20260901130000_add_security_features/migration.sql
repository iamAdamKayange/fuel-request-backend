-- Add security columns to User model
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

-- Add index for lockedUntil for faster queries
CREATE INDEX IF NOT EXISTS "User_lockedUntil_idx" ON "User"("lockedUntil");
