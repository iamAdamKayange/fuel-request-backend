import { FuelRequestsService } from '../../modules/fuel-requests/fuel-requests.service'

describe('FuelRequestsService - Object-Level Authorization', () => {
  let service: FuelRequestsService

  beforeEach(() => {
    service = FuelRequestsService.getInstance()
  })

  describe('getFuelRequestById - Record Access Control', () => {
    const mockDriverId = 'driver-123'
    const mockHeadId = 'head-456'
    const mockTransportId = 'transport-789'
    const mockAdaId = 'ada-012'
    const mockProcurementId = 'procurement-345'
    const mockAdminId = 'admin-678'
    const mockOtherUserId = 'other-999'
    const mockRequestId = 'request-abc'

    const mockRequest = {
      id: mockRequestId,
      driverId: mockDriverId,
      departmentId: 'dept-123',
      status: 'FULLY_APPROVED',
      driver: { id: mockDriverId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      department: { id: 'dept-123', name: 'Finance' },
      vehicle: { id: 'vehicle-1', vehicleNumber: 'T-1234' },
      approvals: [
        { approverId: mockHeadId, stage: 'HEAD', approved: true },
        { approverId: mockTransportId, stage: 'TRANSPORT', approved: true },
        { approverId: mockAdaId, stage: 'ADA', approved: true },
      ],
      fuelIssuance: null,
      notifications: [],
    }

    it('should allow DRIVER to view their own request', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({ departmentId: 'dept-123' } as any)

      const result = await service.getFuelRequestById(mockRequestId, mockDriverId, 'DRIVER')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })

    it('should deny DRIVER access to another driver request', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)

      await expect(
        service.getFuelRequestById(mockRequestId, mockOtherUserId, 'DRIVER')
      ).rejects.toThrow('You can only view your own requests')
    })

    it('should allow HEAD_OF_DEPARTMENT to view department request', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({ departmentId: 'dept-123' } as any)

      const result = await service.getFuelRequestById(mockRequestId, mockHeadId, 'HEAD_OF_DEPARTMENT')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })

    it('should allow HEAD_OF_DEPARTMENT to view request they interacted with (approval record)', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({ departmentId: 'other-dept' } as any)

      const result = await service.getFuelRequestById(mockRequestId, mockHeadId, 'HEAD_OF_DEPARTMENT')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })

    it('should deny HEAD_OF_DEPARTMENT access to request from different department without interaction', async () => {
      const requestWithoutApproval = { ...mockRequest, approvals: [] }
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(requestWithoutApproval as any)
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({ departmentId: 'other-dept' } as any)

      await expect(
        service.getFuelRequestById(mockRequestId, mockHeadId, 'HEAD_OF_DEPARTMENT')
      ).rejects.toThrow('You can only view requests from your department')
    })

    it('should allow TRANSPORT_OFFICER to view request they interacted with', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)

      const result = await service.getFuelRequestById(mockRequestId, mockTransportId, 'TRANSPORT_OFFICER')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })

    it('should allow ADA_DAHRM to view request they interacted with', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)

      const result = await service.getFuelRequestById(mockRequestId, mockAdaId, 'ADA_DAHRM')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })

    it('should allow PROCUREMENT to view request they interacted with', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)

      const result = await service.getFuelRequestById(mockRequestId, mockProcurementId, 'PROCUREMENT')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })

    it('should enforce status-based access control', async () => {
      const pendingRequest = { ...mockRequest, status: 'PENDING_HEAD_APPROVAL' }
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(pendingRequest as any)

      // PROCUREMENT should not see pending head approval requests
      await expect(
        service.getFuelRequestById(mockRequestId, mockProcurementId, 'PROCUREMENT')
      ).rejects.toThrow('This request is not assigned to your workflow stage')
    })

    it('should allow ADMIN to view any request', async () => {
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findUnique').mockResolvedValue(mockRequest as any)

      const result = await service.getFuelRequestById(mockRequestId, mockAdminId, 'ADMIN')
      expect(result).toBeDefined()
      expect(result.id).toBe(mockRequestId)
    })
  })

  describe('getFuelRequests - List Access Control', () => {
    it('should filter requests by role in WHERE clause', async () => {
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({ departmentId: 'dept-123' } as any)

      await service.getFuelRequests(1, 10, undefined, 'user-123', 'DRIVER')

      expect(mockFindMany).toHaveBeenCalled()
      const whereClause = mockFindMany.mock.calls[0][0].where
      expect(whereClause.driverId).toBe('user-123')
    })

    it('should keep the head list constrained to its department and pending stage', async () => {
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)

      await service.getFuelRequests(1, 10, undefined, 'head-456', 'HEAD_OF_DEPARTMENT')

      expect(mockFindMany).toHaveBeenCalled()
      const whereClause = mockFindMany.mock.calls[0][0].where
      expect(whereClause.departmentId).toBe('dept-123')
      expect(whereClause.status).toBe('PENDING_HEAD_APPROVAL')
      expect(whereClause.OR).toBeUndefined()
    })
  })
})
