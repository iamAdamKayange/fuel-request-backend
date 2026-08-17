-- Add nullable title column to support role titles entered during admin registration.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "title" TEXT;
