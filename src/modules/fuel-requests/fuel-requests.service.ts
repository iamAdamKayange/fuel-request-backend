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
      if (!filters?.status) {
        where.status = 'PENDING_HEAD_APPROVAL'
      }
    } else if (role === 'PROCUREMENT') {
      where.status = { in: ['FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE'] }
    }

    if (filters?.status) {
      where.status = filters.status
    } else if (role === 'TRANSPORT_OFFICER') {
      where.status = 'PENDING_TRANSPORT_APPROVAL'
    } else if (role === 'ADA_DAHRM') {
      where.status = 'PENDING_DA_APPROVAL'
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
      where.OR = [
        { requestNumber: { contains: filters.search, mode: 'insensitive' } },
        { driver: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { driver: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { vehicle: { vehicleNumber: { contains: filters.search, mode: 'insensitive' } } },
      ]
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
              stage: true,
              approved: true,
              approvedAt: true,
              approver: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: { approvedAt: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fuelRequest.count({ where }),
    ])

    return {
      requests,
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
        throw new Error('You can only view requests from your department')
      }
    }

    const allowedStatusByRole: Record<string, string[]> = {
      TRANSPORT_OFFICER: [
        'PENDING_TRANSPORT_APPROVAL',
        'TRANSPORT_APPROVED',
        'TRANSPORT_REJECTED',
        'PENDING_DA_APPROVAL',
        'ADA_APPROVED',
        'ADA_REJECTED',
        'FULLY_APPROVED',
        'PENDING_FUEL_ISSUANCE',
        'COMPLETED',
        'CANCELLED',
      ],
      ADA_DAHRM: [
        'PENDING_DA_APPROVAL',
        'ADA_APPROVED',
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

    if (role && allowedStatusByRole[role] && !allowedStatusByRole[role].includes(request.status)) {
      throw new Error('This request is not assigned to your workflow stage')
    }

    return request
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
}

export const fuelRequestsService = FuelRequestsService.getInstance()
