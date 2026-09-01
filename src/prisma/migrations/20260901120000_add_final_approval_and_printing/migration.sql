-- Add FULLY_APPROVED status to RequestStatus enum
ALTER TYPE "RequestStatus" ADD VALUE 'FULLY_APPROVED' BEFORE 'PENDING_FUEL_ISSUANCE';

-- Add final approver tracking columns to FuelRequest
ALTER TABLE "FuelRequest" ADD COLUMN IF NOT EXISTS "finalApproverId" TEXT;
ALTER TABLE "FuelRequest" ADD COLUMN IF NOT EXISTS "finalApprovedAt" TIMESTAMP(3);

-- Add foreign key constraint for final approver
ALTER TABLE "FuelRequest" ADD CONSTRAINT "FuelRequest_finalApproverId_fkey" 
FOREIGN KEY ("finalApproverId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for final approver
CREATE INDEX IF NOT EXISTS "FuelRequest_finalApproverId_idx" ON "FuelRequest"("finalApproverId");

-- Add new audit actions for printing workflow
ALTER TYPE "AuditAction" ADD VALUE 'FINAL_APPROVAL_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'FUEL_PERMIT_PRINTED';
ALTER TYPE "AuditAction" ADD VALUE 'FUEL_STATEMENT_PRINTED';
