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
      
      // With approval tracking, status may be in OR array
      // Check if status is either directly set or in OR conditions
      const hasStatusDirectly = whereClause.status?.in?.includes('PENDING_HEAD_APPROVAL')
      const hasStatusInOr = whereClause.OR?.some((condition: any) => 
        condition.status?.in?.includes('PENDING_HEAD_APPROVAL')
      )
      
      expect(hasStatusDirectly || hasStatusInOr).toBe(true)
      
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
      
      // Status should be the explicit filter, not the default
      expect(whereClause.status).toBe('FULLY_APPROVED')
      expect(whereClause.status.in).toBeUndefined()
    })
  })

  describe('getFuelRequests - approval tracking', () => {
    it('should include approval tracking OR condition for approvers', async () => {
      const mockUserId = 'approver-id'
      const mockRole = 'PROCUREMENT'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      // Should have OR condition for approval tracking
      expect(whereClause.OR).toBeDefined()
      const approvalCondition = whereClause.OR.find((condition: any) => 
        condition.approvals?.some?.approverId === mockUserId
      )
      expect(approvalCondition).toBeDefined()
    })

    it('should include approval tracking for TRANSPORT_OFFICER', async () => {
      const mockUserId = 'transport-id'
      const mockRole = 'TRANSPORT_OFFICER'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.OR).toBeDefined()
      const approvalCondition = whereClause.OR.find((condition: any) => 
        condition.approvals?.some?.approverId === mockUserId
      )
      expect(approvalCondition).toBeDefined()
    })

    it('should include approval tracking for ADA_DAHRM', async () => {
      const mockUserId = 'ada-id'
      const mockRole = 'ADA_DAHRM'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.OR).toBeDefined()
      const approvalCondition = whereClause.OR.find((condition: any) => 
        condition.approvals?.some?.approverId === mockUserId
      )
      expect(approvalCondition).toBeDefined()
    })

    it('should include approval tracking for HEAD_OF_DEPARTMENT', async () => {
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
      
      expect(whereClause.OR).toBeDefined()
      const approvalCondition = whereClause.OR.find((condition: any) => 
        condition.approvals?.some?.approverId === mockUserId
      )
      expect(approvalCondition).toBeDefined()
    })

    it('should NOT include approval tracking for DRIVER', async () => {
      const mockUserId = 'driver-id'
      const mockRole = 'DRIVER'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      // Driver should not have approval tracking OR
      const approvalCondition = whereClause.OR?.find((condition: any) => 
        condition.approvals?.some?.approverId === mockUserId
      )
      expect(approvalCondition).toBeUndefined()
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
    })

    it('should apply correct status filter for TRANSPORT_OFFICER', async () => {
      const mockRole = 'TRANSPORT_OFFICER'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, undefined, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status.in).toContain('PENDING_TRANSPORT_APPROVAL')
      expect(whereClause.status.in).toContain('TRANSPORT_REJECTED')
      expect(whereClause.status.in).toContain('FULLY_APPROVED')
    })

    it('should apply correct status filter for ADA_DAHRM', async () => {
      const mockRole = 'ADA_DAHRM'
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, undefined, undefined, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      expect(whereClause.status.in).toContain('PENDING_DA_APPROVAL')
      expect(whereClause.status.in).toContain('ADA_REJECTED')
      expect(whereClause.status.in).toContain('FULLY_APPROVED')
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

  describe('getFuelRequests - search with approval tracking', () => {
    it('should combine search OR with approval tracking OR using simple spread', async () => {
      const mockUserId = 'approver-id'
      const mockRole = 'PROCUREMENT'
      const mockFilters = { search: 'test' }
      
      const mockFindMany = jest.fn().mockResolvedValue([])
      jest.spyOn(require('../../config/database').prisma.fuelRequest, 'findMany').mockImplementation(mockFindMany)
      
      await service.getFuelRequests(1, 10, mockFilters, mockUserId, mockRole)
      
      const whereClause = mockFindMany.mock.calls[0][0].where
      
      // Should have OR with search conditions and approval condition
      expect(whereClause.OR).toBeDefined()
      expect(whereClause.OR.length).toBeGreaterThan(4) // At least 4 search conditions + approval
      
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
      
      // Verify approval condition is present
      const approvalCondition = whereClause.OR.find((condition: any) => 
        condition.approvals?.some?.approverId === mockUserId
      )
      expect(approvalCondition).toBeDefined()
    })
  })
})
