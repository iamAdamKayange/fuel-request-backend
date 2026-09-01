-- Add performance indexes for FuelRequest
CREATE INDEX IF NOT EXISTS "FuelRequest_createdAt_idx" ON "FuelRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "FuelRequest_driverId_status_idx" ON "FuelRequest"("driverId", "status");
CREATE INDEX IF NOT EXISTS "FuelRequest_departmentId_status_idx" ON "FuelRequest"("departmentId", "status");
CREATE INDEX IF NOT EXISTS "FuelRequest_fuelType_idx" ON "FuelRequest"("fuelType");

-- Add performance indexes for Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
