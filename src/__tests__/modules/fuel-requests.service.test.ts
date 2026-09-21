import { FuelRequestsService } from '../../modules/fuel-requests/fuel-requests.service'

describe('FuelRequestsService', () => {
  let service: FuelRequestsService

  beforeEach(() => {
    service = FuelRequestsService.getInstance()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = FuelRequestsService.getInstance()
      const instance2 = FuelRequestsService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('getFuelRequests - HEAD_OF_DEPARTMENT status assignment', () => {
    it('should set HEAD_OF_DEPARTMENT status exactly once when no status filter provided', async () => {
      // This test validates the fix for the status overwrite bug
      // The status should be set in the final else-if branch (lines 196-198)
      // and not overwritten by a conditional assignment in the role branch
      const mockUserId = 'head-user-id'
      const mockRole = 'HEAD_OF_DEPARTMENT'
      
      // Mock the user lookup to return a department
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({
        id: mockUserId,
        departmentId: 'dept-123'
      })
      
      // Mock the fuelRequest.findMany to capture the where clause
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      expect(mockFindMany).toHaveBeenCalled()
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status).toBe('PENDING_HEAD_APPROVAL')
      
      // Verify department is set
      expect(whereClause.departmentId).toBe('dept-123')
    })

    it('should respect explicit status filter for HEAD_OF_DEPARTMENT', async () => {
      const mockUserId = 'head-user-id'
      const mockRole = 'HEAD_OF_DEPARTMENT'
      const mockFilters = { status: 'FULLY_APPROVED' }
      
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({
        id: mockUserId,
        departmentId: 'dept-123'
      })
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, mockFilters, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      // Status should be the explicit filter, not the default.
      expect(whereClause.status.in).toEqual(['FULLY_APPROVED'])
    })
  })

  describe('getFuelRequests - status isolation', () => {
    it('should not mix approval history into the default procurement list', async () => {
      const mockUserId = 'approver-id'
      const mockRole = 'PROCUREMENT'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.OR).toBeUndefined()
    })

    it('should not mix approval history into the transport pending list', async () => {
      const mockUserId = 'transport-id'
      const mockRole = 'TRANSPORT_OFFICER'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status).toBe('PENDING_TRANSPORT_APPROVAL')
    })

    it('should not mix approval history into the ADA pending list', async () => {
      const mockUserId = 'ada-id'
      const mockRole = 'ADA_DAHRM'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status).toBe('PENDING_DA_APPROVAL')
    })

    it('should keep the head default list within the department and pending stage', async () => {
      const mockUserId = 'head-id'
      const mockRole = 'HEAD_OF_DEPARTMENT'
      
      jest.spyOn(require('../../config/database').prisma.user, 'findUnique').mockResolvedValue({
        id: mockUserId,
        departmentId: 'dept-123'
      })
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.departmentId).toBe('dept-123')
      expect(whereClause.status).toBe('PENDING_HEAD_APPROVAL')
    })

    it('should NOT include approval tracking for DRIVER', async () => {
      const mockUserId = 'driver-id'
      const mockRole = 'DRIVER'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.OR).toBeUndefined()
    })
  })

  describe('getFuelRequests - role-based status filters', () => {
    it('should apply correct status filter for PROCUREMENT', async () => {
      const mockRole = 'PROCUREMENT'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, undefined, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status.in).toContain('FULLY_APPROVED')
      expect(whereClause.status.in).toContain('PENDING_FUEL_ISSUANCE')
      expect(whereClause.status.in).toContain('COMPLETED')
      expect(whereClause.status.in).toContain('CANCELLED')
      expect(whereClause.status.in).not.toContain('ADA_REJECTED')
    })

    it('should apply correct status filter for TRANSPORT_OFFICER', async () => {
      const mockRole = 'TRANSPORT_OFFICER'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, undefined, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status).toBe('PENDING_TRANSPORT_APPROVAL')
    })

    it('should apply correct status filter for ADA_DAHRM', async () => {
      const mockRole = 'ADA_DAHRM'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, undefined, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status).toBe('PENDING_DA_APPROVAL')
    })

    it('should apply correct status filter for DRIVER', async () => {
      const mockRole = 'DRIVER'
      const mockUserId = 'driver-id'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.driverId).toBe(mockUserId)
      expect(whereClause.status.in).toContain('PENDING_HEAD_APPROVAL')
      expect(whereClause.status.in).toContain('HEAD_REJECTED')
      expect(whereClause.status.in).toContain('CANCELLED')
    })
  })

  describe('getFuelRequests - search', () => {
    it('should combine search with the role status scope without an authorization OR', async () => {
      const mockUserId = 'approver-id'
      const mockRole = 'PROCUREMENT'
      const mockFilters = { search: 'test' }
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, mockFilters, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.OR).toBeDefined()
      expect(whereClause.OR.length).toBe(4)
      
      // Verify search conditions are present
      const hasRequestNumberSearch = whereClause.OR.some((condition: any) => 
        condition.requestNumber?.contains === 'test'
      )
      const hasDriverFirstNameSearch = whereClause.OR.some((condition: any) => 
        condition.driver?.firstName?.contains === 'test'
      )
      const hasDriverLastNameSearch = whereClause.OR.some((condition: any) => 
        condition.driver?.lastName?.contains === 'test'
      )
      const hasVehicleSearch = whereClause.OR.some((condition: any) => 
        condition.vehicle?.vehicleNumber?.contains === 'test'
      )
      
      expect(hasRequestNumberSearch).toBe(true)
      expect(hasDriverFirstNameSearch).toBe(true)
      expect(hasDriverLastNameSearch).toBe(true)
      expect(hasVehicleSearch).toBe(true)
      
      expect(whereClause.status.in).toContain('FULLY_APPROVED')
    })
  })
})
