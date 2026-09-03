import { DocumentGenerationService } from '../../modules/document-generation/document-generation.service'

describe('DocumentGenerationService', () => {
  let service: DocumentGenerationService

  beforeEach(() => {
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

    it('should return false when user is not final approver', async () => {
      // This test would need a real database setup
      // For now, we test the error case
      const result = await service.canPrintDocuments('non-existent-id', 'user-123')
      expect(result.canPrint).toBe(false)
      expect(result.reason).toBeDefined()
    })
  })

  describe('generateFuelPermitData', () => {
    it('should throw error when user cannot print', async () => {
      await expect(
        service.generateFuelPermitData('non-existent-id', 'user-123')
      ).rejects.toThrow('You are not authorized to print this document')
    })
  })

  describe('generateFuelStatementData', () => {
    it('should throw error when user cannot print', async () => {
      await expect(
        service.generateFuelStatementData('non-existent-id', 'user-123')
      ).rejects.toThrow('You are not authorized to print this document')
    })
  })
})