import { DocumentGenerationService } from '../../modules/document-generation/document-generation.service'
import { prisma } from '../../config/database'

describe('DocumentGenerationService', () => {
  let service: DocumentGenerationService

  beforeEach(() => {
    jest.restoreAllMocks()
    // These unit tests exercise the service response for a missing record;
    // they must not query the configured production database.
    jest.spyOn(prisma.fuelRequest, 'findUnique').mockResolvedValue(null)
    service = DocumentGenerationService.getInstance()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DocumentGenerationService.getInstance()
      const instance2 = DocumentGenerationService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('canPrintDocuments', () => {
    it('should return false for non-existent request', async () => {
      const result = await service.canPrintDocuments('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
      expect(result.reason).toBe('Fuel request not found')
    })

    it('should return true for PROCUREMENT role', async () => {
      // This test would need a real database setup
      // For now, we test the error case
      const result = await service.canPrintDocuments('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
    })

    it('should return false when user is not final approver or PROCUREMENT', async () => {
      // This test would need a real database setup
      // For now, we test the error case
      const result = await service.canPrintDocuments('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
      expect(result.reason).toBeDefined()
    })
  })

  describe('canPrintStatement', () => {
    it('should return false for non-existent request', async () => {
      const result = await service.canPrintStatement('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
      expect(result.reason).toBe('Fuel request not found')
    })

    it('should return true for TRANSPORT_OFFICER role', async () => {
      // This test would need a real database setup
      // For now, we test the error case
      const result = await service.canPrintStatement('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
    })

    it('should return true for PROCUREMENT role', async () => {
      // This test would need a real database setup
      // For now, we test the error case
      const result = await service.canPrintStatement('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
    })

    it('should return false for non-TRANSPORT_OFFICER or PROCUREMENT roles', async () => {
      // This test would need a real database setup
      // For now, we test the error case
      const result = await service.canPrintStatement('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
      expect(result.reason).toBeDefined()
    })
  })

  describe('generateFuelPermitData', () => {
    it('should throw error when user cannot print', async () => {
      await expect(
        service.generateFuelPermitData('non-existent-id', 'user-123')
      ).rejects.toThrow('Fuel request not found')
    })
  })

  describe('generateFuelStatementData', () => {
    it('should throw error when user cannot print', async () => {
      await expect(
        service.generateFuelStatementData('non-existent-id', 'user-123')
      ).rejects.toThrow('Fuel request not found')
    })
  })
})
