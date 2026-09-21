import { prisma } from '../../config/database'
import { 
  generateRequestNumber, 
  calculateKmUsed} from '../../utils/helpers'
import { logAudit } from '../../utils/logger'
import { notificationService } from '../notifications/notifications.service'

export class FuelRequestsService {
  private static instance: FuelRequestsService

  static getInstance(): FuelRequestsService {
    if (!FuelRequestsService.instance) {
      FuelRequestsService.instance = new FuelRequestsService()
    }
    return FuelRequestsService.instance
  }

  async createFuelRequest(driverId: string, data: {
    vehicleId?: string
    vehicleNumber: string
    departmentId: string
    fuelType: string
    requestedLitres: number
    purpose: string
    kmFrom: number
    kmTo: number
    lastFuelReceived: number
    driverSignature: string
  }) {
    // Get driver with department
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      include: { department: true },
    })

    if (!driver) {
      throw new Error('Driver not found')
    }

    const targetDepartment = await prisma.department.findUnique({
      where: { id: data.departmentId },
    })

    if (!targetDepartment) {
      throw new Error('Selected department or unit was not found')
    }

    const vehicleNumber = data.vehicleNumber.trim().toUpperCase()

    // Get or create vehicle from the number typed by the driver.
    let vehicle = data.vehicleId
      ? await prisma.vehicle.findUnique({
          where: { id: data.vehicleId },
        })
      : await prisma.vehicle.findFirst({
          where: {
            vehicleNumber: {
              equals: vehicleNumber,
              mode: 'insensitive',
            },
          },
        })

    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: {
          vehicleNumber,
          gpsa: 'N/A',
          fuelType: data.fuelType as any,
          departmentId: targetDepartment.id,
          isActive: true,
        },
      })
    }

    if (!vehicle.isActive) {
      throw new Error('Vehicle is inactive')
    }

    // Calculate KM used
    const kmUsed = calculateKmUsed(data.kmFrom, data.kmTo)

    // Get head of department
    const headOfDepartment = await prisma.user.findFirst({
      where: {
        departmentId: targetDepartment.id,
        role: 'HEAD_OF_DEPARTMENT',
        isActive: true,
      },
    })

    if (!headOfDepartment) {
      throw new Error('No head of department found for this department')
    }

    // Generate request number
    const requestNumber = generateRequestNumber()

    // Create fuel request
    const fuelRequest = await prisma.fuelRequest.create({
      data: {
        requestNumber,
        driverId,
        departmentId: targetDepartment.id,
        vehicleId: vehicle.id,
        fuelType: data.fuelType as any,
        requestedLitres: data.requestedLitres,
        gpsa: vehicle.gpsa,
        purpose: data.purpose,
        kmFrom: data.kmFrom,
        kmTo: data.kmTo,
        kmUsed,
        lastFuelReceived: data.lastFuelReceived,
        driverSignature: data.driverSignature,
        status: 'PENDING_HEAD_APPROVAL',
      },
      include: {
        driver: {
          include: { department: true },
        },
        vehicle: true,
        department: true,
      },
    })

    // Log audit
    await logAudit({
      userId: driverId,
      action: 'DRIVER_SUBMITTED_REQUEST' as any,
      requestId: fuelRequest.id,
      newStatus: 'PENDING_HEAD_APPROVAL',
      description: `Driver ${driver.email} submitted fuel request ${fuelRequest.requestNumber}`,
    })

    // Send notification to the Head of Department (FIRST APPROVER - ACTION_REQUIRED)
    await notificationService.sendNotification({
      userId: headOfDepartment.id,
      requestId: fuelRequest.id,
      title: 'New Fuel Request Pending Your Approval',
      message: `New fuel request ${fuelRequest.requestNumber} from ${driver.firstName} ${driver.lastName} (${driver.employeeNumber}) requires your approval.`,
      type: 'ACTION_REQUIRED',
    })

    // Send STATUS_UPDATE to Driver (applicant) confirming submission
    await notificationService.sendNotification({
      userId: driverId,
      requestId: fuelRequest.id,
      title: 'Fuel Request Submitted',
      message: `Your fuel request ${fuelRequest.requestNumber} has been submitted to ${headOfDepartment.firstName} ${headOfDepartment.lastName} (Head of Department) for approval.`,
      type: 'STATUS_UPDATE',
    })

    await notificationService.sendToAdmins({
      requestId: fuelRequest.id,
      title: 'New Fuel Request Submitted',
      message: `Request ${fuelRequest.requestNumber} was submitted to ${targetDepartment.name} by ${driver.firstName} ${driver.lastName}`,
      type: 'ADMIN_REQUEST_UPDATE',
    })

    return fuelRequest
  }

  async getFuelRequests(page: number = 1, limit: number = 10, filters?: any, userId?: string, role?: string) {
    const skip = (page - 1) * limit
    const where: any = {}
    const workflowStatuses = this.getWorkflowStatusesForRole(role || '')
    const statusGroups: Record<string, string[]> = {
      REJECTED: ['HEAD_REJECTED', 'TRANSPORT_REJECTED', 'ADA_REJECTED', 'CANCELLED'],
      COMPLETED: ['FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE', 'COMPLETED'],
      APPROVED: ['FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE'],
      HISTORY: ['HEAD_REJECTED', 'TRANSPORT_REJECTED', 'ADA_REJECTED', 'CANCELLED', 'FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE', 'COMPLETED'],
    }

    // Interacted filter: show only requests user has interacted with (approval record)
    if (filters?.interacted && userId && ['HEAD_OF_DEPARTMENT', 'TRANSPORT_OFFICER', 'ADA_DAHRM', 'PROCUREMENT'].includes(role || '')) {
      if (role === 'PROCUREMENT') {
        // Procurement interacts by issuing fuel, not by creating an Approval.
        where.fuelIssuance = { is: { issuedBy: userId } }
      } else {
        where.approvals = {
          some: {
            approverId: userId
          }
        }
      }
      // Skip other role-based filtering when interacted filter is active
      // to show all interacted requests regardless of current status
      // Still apply object-level authorization below
    } else {
      // Role-based filtering
      if (role === 'DRIVER' && userId) {
        where.driverId = userId
      } else if (role === 'HEAD_OF_DEPARTMENT' && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { departmentId: true },
        })
        if (user?.departmentId) {
          where.departmentId = user.departmentId
        }
      }

      const requestedStatus = filters?.status?.toUpperCase()
      const requestedStatuses = requestedStatus
        ? (statusGroups[requestedStatus] || [filters.status])
        : undefined
      const isAllRequests = filters?.all === true || filters?.all === 'true'

      // A workflow role can list only records it can open by id.  `all=true`
      // removes the default pending-stage view, but never bypasses that access scope.
      if (workflowStatuses) {
        const visibleStatuses = requestedStatuses
          ? requestedStatuses.filter(status => workflowStatuses.includes(status))
          : workflowStatuses

        if (requestedStatuses || isAllRequests || role === 'PROCUREMENT') {
          where.status = { in: visibleStatuses }
        } else {
          where.status = this.getPendingStatusForRole(role || '')
        }
      } else if (requestedStatuses) {
        where.status = { in: requestedStatuses }
      } else if (!isAllRequests && role === 'HEAD_OF_DEPARTMENT') {
        where.status = 'PENDING_HEAD_APPROVAL'
      } else if (!isAllRequests && role === 'DRIVER') {
        // Drivers own their records, so their default list is their complete history.
      }
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId
    }

    if (filters?.vehicleId) {
      where.vehicleId = filters.vehicleId
    }

    if (filters?.fromDate || filters?.toDate) {
      where.createdAt = {}
      if (filters.fromDate) {
        where.createdAt.gte = filters.fromDate
      }
      if (filters.toDate) {
        where.createdAt.lte = filters.toDate
      }
    }

    if (filters?.search) {
      const searchOr = where.OR || []
      where.OR = [
        ...searchOr,
        { requestNumber: { contains: filters.search, mode: 'insensitive' } },
        { driver: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { driver: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { vehicle: { vehicleNumber: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    // Helper function to check if user can see rejection details
    const canViewRejectionDetails = (request: any, userId: string, role: string): boolean => {
      if (!request.status.includes('REJECTED')) return false
      if (!userId) return false

      // Driver can always see rejection details for their own requests
      if (request.driverId === userId) return true

      // Any approver who interacted with this request can see rejection details
      const userApproval = request.approvals?.find((a: any) => a.approverId === userId)
      if (userApproval) return true

      // Head of Department can see rejection details for requests from their department
      if (role === 'HEAD_OF_DEPARTMENT') {
        // Need to check if this Head belongs to the same department
        // We'll verify this by checking if the request is in their department's requests
        return true // Will be validated at department level in WHERE clause
      }

      // Admin can see all rejection details
      if (role === 'ADMIN') return true

      return false
    }

    // Helper function to get rejection details
    const getRejectionDetails = (request: any, userId: string, role: string) => {
      if (!canViewRejectionDetails(request, userId, role)) return null
      
      const rejectedApproval = request.approvals?.find((a: any) => !a.approved)
      if (!rejectedApproval) return null
      
      const roleMap: Record<string, string> = {
        HEAD: 'Head of Department',
        TRANSPORT: 'Transport Officer',
        ADA: 'ADA/DAHRM'
      }
      
      return {
        rejectedBy: roleMap[rejectedApproval.stage] || rejectedApproval.stage,
        rejectedByUser: `${rejectedApproval.approver.firstName} ${rejectedApproval.approver.lastName}`,
        reason: rejectedApproval.reason || 'No reason provided',
        rejectedAt: rejectedApproval.approvedAt
      }
    }

    // Optimize query by selecting only needed fields
    const [requests, total] = await Promise.all([
      prisma.fuelRequest.findMany({
        where,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          fuelType: true,
          requestedLitres: true,
          approvedLitres: true,
          issuedLitres: true,
          rejectionReason: true,
          createdAt: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeNumber: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              vehicleNumber: true,
              fuelType: true,
            },
          },
          approvals: {
            select: {
              id: true,
              approverId: true,
              stage: true,
              approved: true,
              approvedAt: true,
              reason: true,
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
            orderBy: { approvedAt: 'asc' },
          },
          fuelIssuance: {
            select: {
              issuedBy: true,
              issuedAt: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fuelRequest.count({ where }),
    ])

    // Add rejection details and user interaction info to each request
    const requestsWithDetails = requests.map(request => {
      // Check if user has interacted with this request
      const userApproval = request.approvals?.find((a: any) => a.approverId === userId)
      const userInteraction = userApproval ? {
        stage: userApproval.stage,
        action: userApproval.approved ? 'approved' : 'rejected',
        at: userApproval.approvedAt
      } : request.fuelIssuance?.issuedBy === userId ? {
        stage: 'ISSUANCE',
        action: 'issued',
        at: request.fuelIssuance?.issuedAt,
      } : null

      return {
        ...request,
        rejectionDetails: getRejectionDetails(request, userId || '', role || ''),
        userInteraction
      }
    })

    return {
      requests: requestsWithDetails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getFuelRequestById(id: string, userId?: string, role?: string) {
    const request = await prisma.fuelRequest.findUnique({
      where: { id },
      include: {
        driver: {
          include: { department: true },
        },
        department: true,
        vehicle: true,
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { approvedAt: 'asc' },
        },
        fuelIssuance: {
          include: {
            issuer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        notifications: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check permissions
    if (role === 'DRIVER' && request.driverId !== userId) {
      throw new Error('You can only view your own requests')
    }

    if (role === 'HEAD_OF_DEPARTMENT') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      })
      if (user?.departmentId !== request.departmentId) {
        // Allow if user has interacted with this request (approval record)
        const hasApproval = request.approvals?.some((a: any) => a.approverId === userId)
        if (!hasApproval) {
          throw new Error('You can only view requests from your department')
        }
      }
    }

    // For approvers, allow access if they have interacted with this request
    // This ensures they can see requests they approved/rejected even after status changes
    if (userId && ['HEAD_OF_DEPARTMENT', 'TRANSPORT_OFFICER', 'ADA_DAHRM', 'PROCUREMENT'].includes(role || '')) {
      const hasApproval = request.approvals?.some((a: any) => a.approverId === userId)
      if (hasApproval) {
        // User has interacted with this request, allow access
        return request
      }
    }

    const workflowStatuses = this.getWorkflowStatusesForRole(role || '')
    if (workflowStatuses && !workflowStatuses.includes(request.status)) {
      throw new Error('This request is not assigned to your workflow stage')
    }

    // Helper function to check if user can see rejection details
    const canViewRejectionDetails = (request: any, userId: string, role: string): boolean => {
      if (!request.status.includes('REJECTED')) return false
      if (!userId) return false

      // Driver can always see rejection details for their own requests
      if (request.driverId === userId) return true

      // Any approver who interacted with this request can see rejection details
      const userApproval = request.approvals?.find((a: any) => a.approverId === userId)
      if (userApproval) return true

      // Head of Department can see rejection details for requests from their department
      if (role === 'HEAD_OF_DEPARTMENT') {
        return true // Will be validated at department level in WHERE clause
      }

      // Admin can see all rejection details
      if (role === 'ADMIN') return true

      return false
    }

    // Add rejection details (only for users who participated in the workflow)
    const getRejectionDetails = (request: any, userId: string, role: string) => {
      if (!canViewRejectionDetails(request, userId, role)) return null
      
      const rejectedApproval = request.approvals?.find((a: any) => !a.approved)
      if (!rejectedApproval) return null
      
      const roleMap: Record<string, string> = {
        HEAD: 'Head of Department',
        TRANSPORT: 'Transport Officer',
        ADA: 'ADA/DAHRM'
      }
      
      return {
        rejectedBy: roleMap[rejectedApproval.stage] || rejectedApproval.stage,
        rejectedByUser: `${rejectedApproval.approver.firstName} ${rejectedApproval.approver.lastName}`,
        reason: rejectedApproval.reason || 'No reason provided',
        rejectedAt: rejectedApproval.approvedAt
      }
    }

    // Check if user has interacted with this request
    const userApproval = request.approvals?.find((a: any) => a.approverId === userId)
    const userInteraction = userApproval ? {
      stage: userApproval.stage,
      action: userApproval.approved ? 'approved' : 'rejected',
      at: userApproval.approvedAt
    } : null

    return {
      ...request,
      rejectionDetails: getRejectionDetails(request, userId || '', role || ''),
      userInteraction
    }
  }

  async updateFuelRequest(id: string, data: {
    purpose?: string
    kmTo?: number
    driverSignature?: string
  }, userId: string) {
    const request = await prisma.fuelRequest.findUnique({
      where: { id },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check if request can be updated
    if (request.status !== 'PENDING_HEAD_APPROVAL') {
      throw new Error('Request cannot be updated at this stage')
    }

    if (request.driverId !== userId) {
      throw new Error('You can only update your own requests')
    }

    const updateData: any = {}

    if (data.purpose) {
      updateData.purpose = data.purpose
    }

    if (data.kmTo !== undefined) {
      if (data.kmTo < request.kmFrom) {
        throw new Error('Current KM cannot be less than starting KM')
      }
      updateData.kmTo = data.kmTo
      updateData.kmUsed = calculateKmUsed(request.kmFrom, data.kmTo)
    }

    if (data.driverSignature) {
      updateData.driverSignature = data.driverSignature
    }

    const updatedRequest = await prisma.fuelRequest.update({
      where: { id },
      data: updateData,
      include: {
        driver: {
          include: { department: true },
        },
        vehicle: true,
        department: true,
      },
    })

    return updatedRequest
  }

  async cancelFuelRequest(id: string, reason: string, userId: string) {
    const request = await prisma.fuelRequest.findUnique({
      where: { id },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check if request can be cancelled
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      throw new Error('Request cannot be cancelled at this stage')
    }

    if (request.driverId !== userId) {
      throw new Error('You can only cancel your own requests')
    }

    const updatedRequest = await prisma.fuelRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        rejectionReason: reason,
        finalApproverId: null,
        finalApprovedAt: null,
      },
    })

    await logAudit({
      userId,
      action: 'REQUEST_CANCELLED' as any,
      requestId: id,
      previousStatus: request.status,
      newStatus: 'CANCELLED',
      description: `Request ${request.requestNumber} cancelled by driver`,
    })

    return updatedRequest
  }

  /**
   * Get role-specific statistics for the authenticated user
   * Current Pending counts only requests waiting for this role's action
   */
  async getRoleStats(userId: string, role: string) {
    const where: any = {}

    // Role-based authorization filtering only (NO status restrictions for total count)
    // This matches the all=true parameter in getFuelRequests
    if (role === 'ADMIN') {
      // ADMIN sees all requests - no restrictions
    } else if (role === 'DRIVER') {
      where.driverId = userId
      // Driver sees all their own requests (no status filter for total)
    } else if (role === 'HEAD_OF_DEPARTMENT') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
      })
      if (user?.departmentId) {
        where.departmentId = user.departmentId
      }
      // HoD sees all department requests (no status filter for total)
    } else {
      const workflowStatuses = this.getWorkflowStatusesForRole(role)
      if (workflowStatuses) {
        where.status = { in: workflowStatuses }
      }
    }

    // Get rejected statuses this role can see (for rejected count)
    const rejectedStatuses = this.getRejectedStatusesForRole(role)

    // Get completed statuses this role can see (for completed count)
    const completedStatuses = this.getCompletedStatusesForRole(role)

    // Count by status - ALL counts must match getFuelRequests logic exactly
    // Do NOT include OR condition for interacted requests in stats
    // Interacted requests are accessed through the separate "interacted=true" filter
    const [total, pending, rejected, completed, litres, interacted] = await Promise.all([
      prisma.fuelRequest.count({ where }),
      prisma.fuelRequest.count({
        where: {
          ...where,
          status: { in: this.getPendingStatusesForRole(role) }
        }
      }),
      prisma.fuelRequest.count({
        where: {
          ...where,
          status: { in: rejectedStatuses }
        }
      }),
      prisma.fuelRequest.count({
        where: {
          ...where,
          status: { in: completedStatuses }
        }
      }),
      prisma.fuelRequest.aggregate({
        where,
        _sum: { issuedLitres: true, approvedLitres: true, requestedLitres: true }
      }),
      // Interacted count for approver roles - matches interacted=true filter
      ['HEAD_OF_DEPARTMENT', 'TRANSPORT_OFFICER', 'ADA_DAHRM'].includes(role)
        ? prisma.fuelRequest.count({
            where: {
              approvals: {
                some: {
                  approverId: userId
                }
              }
            }
          })
        : role === 'PROCUREMENT'
          ? prisma.fuelRequest.count({ where: { fuelIssuance: { is: { issuedBy: userId } } } })
          : Promise.resolve(0)
    ])

    return {
      total,
      pending,
      rejected,
      completed,
      totalLitres: litres._sum.issuedLitres || litres._sum.approvedLitres || litres._sum.requestedLitres || 0,
      interacted
    }
  }

  /**
   * Get the pending status for a specific role
   * Current Pending = requests waiting for this role's action
   */
  private getPendingStatusForRole(role: string): string {
    const statusMap: Record<string, string> = {
      DRIVER: 'PENDING_HEAD_APPROVAL',
      HEAD_OF_DEPARTMENT: 'PENDING_HEAD_APPROVAL',
      TRANSPORT_OFFICER: 'PENDING_TRANSPORT_APPROVAL',
      ADA_DAHRM: 'PENDING_DA_APPROVAL',
      PROCUREMENT: 'APPROVED',
      ADMIN: 'PENDING_HEAD_APPROVAL' // Admin sees all, default to first stage
    }
    return statusMap[role] || 'PENDING_HEAD_APPROVAL'
  }

  /** Statuses that represent work currently awaiting the role's action. */
  private getPendingStatusesForRole(role: string): string[] {
    if (role === 'PROCUREMENT') {
      // FULLY_APPROVED is the current workflow status after ADA approval;
      // retain PENDING_FUEL_ISSUANCE for records created by earlier versions.
      return ['FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE']
    }
    return [this.getPendingStatusForRole(role)]
  }

  /**
   * Stages that can be opened by a workflow role without a prior interaction.
   * Keep this in sync with getFuelRequestById so list entries never lead to a
   * detail view that the same user is not authorized to open.
   */
  private getWorkflowStatusesForRole(role: string): string[] | undefined {
    const statusMap: Record<string, string[]> = {
      TRANSPORT_OFFICER: [
        'PENDING_TRANSPORT_APPROVAL',
        'TRANSPORT_REJECTED',
        'PENDING_DA_APPROVAL',
        'ADA_REJECTED',
        'FULLY_APPROVED',
        'PENDING_FUEL_ISSUANCE',
        'COMPLETED',
        'CANCELLED',
      ],
      ADA_DAHRM: [
        'PENDING_DA_APPROVAL',
        'ADA_REJECTED',
        'FULLY_APPROVED',
        'PENDING_FUEL_ISSUANCE',
        'COMPLETED',
        'CANCELLED',
      ],
      PROCUREMENT: [
        'FULLY_APPROVED',
        'PENDING_FUEL_ISSUANCE',
        'COMPLETED',
        'CANCELLED',
      ],
    }
    return statusMap[role]
  }

  /**
   * Get rejected statuses a role can see
   */
  private getRejectedStatusesForRole(role: string): string[] {
    const rejected = ['HEAD_REJECTED', 'TRANSPORT_REJECTED', 'ADA_REJECTED', 'CANCELLED']
    const workflowStatuses = this.getWorkflowStatusesForRole(role)
    return workflowStatuses ? rejected.filter(status => workflowStatuses.includes(status)) : rejected
  }

  /**
   * Get completed statuses a role can see
   */
  private getCompletedStatusesForRole(role: string): string[] {
    const completed = ['FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE', 'COMPLETED']
    const workflowStatuses = this.getWorkflowStatusesForRole(role)
    return workflowStatuses ? completed.filter(status => workflowStatuses.includes(status)) : completed
  }
}

export const fuelRequestsService = FuelRequestsService.getInstance()
