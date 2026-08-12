import { prisma } from '../../config/database'
import { logAudit } from '../../utils/logger'
import { notificationService } from '../notifications/notifications.service'

export class FuelIssuanceService {
  private static instance: FuelIssuanceService

  static getInstance(): FuelIssuanceService {
    if (!FuelIssuanceService.instance) {
      FuelIssuanceService.instance = new FuelIssuanceService()
    }
    return FuelIssuanceService.instance
  }

  async issueFuel(
    requestId: string,
    issuerId: string,
    data: {
      fuelType: string
      litresIssued: number
      tokenNumber: string
      designation: string
      signature: string
    }
  ) {
    // Get request
    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: true,
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check status
    if (request.status !== 'PENDING_FUEL_ISSUANCE') {
      throw new Error('Request is not ready for fuel issuance')
    }

    // Check if issuer is procurement
    const issuer = await prisma.user.findUnique({
      where: { id: issuerId },
    })

    if (!issuer || issuer.role !== 'PROCUREMENT') {
      throw new Error('You are not authorized to perform this action')
    }

    // Validate issued litres
    const maxLitres = request.approvedLitres || request.requestedLitres
    if (data.litresIssued > maxLitres) {
      throw new Error(`Issued litres cannot exceed ${maxLitres} litres`)
    }

    if (data.litresIssued <= 0) {
      throw new Error('Issued litres must be greater than 0')
    }

    // Check if token number is unique
    const existingIssuance = await prisma.fuelIssuance.findUnique({
      where: { tokenNumber: data.tokenNumber },
    })

    if (existingIssuance) {
      throw new Error('Token number already used')
    }

    // Create fuel issuance
    const fuelIssuance = await prisma.fuelIssuance.create({
      data: {
        requestId,
        issuedBy: issuerId,
        fuelType: data.fuelType as any,
        litresIssued: data.litresIssued,
        tokenNumber: data.tokenNumber,
        designation: data.designation,
        signature: data.signature,
      },
    })

    // Update request
    const updatedRequest = await prisma.fuelRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        issuedLitres: data.litresIssued,
      },
      include: {
        driver: true,
      },
    })

    // Log audit
    await logAudit({
      userId: issuerId,
      action: 'FUEL_ISSUED' as any,
      requestId,
      previousStatus: request.status,
      newStatus: 'COMPLETED',
      description: `Fuel issued for request ${request.requestNumber} by ${issuer.email}`,
    })

    // Notify Driver
    await notificationService.sendNotification({
      userId: request.driverId,
      requestId,
      title: 'Fuel Request Completed',
      message: `Your request ${request.requestNumber} has been completed. ${data.litresIssued} litres of ${data.fuelType} issued. Token: ${data.tokenNumber}`,
      type: 'REQUEST_COMPLETED',
    })

    return {
      fuelIssuance,
      request: updatedRequest,
    }
  }

  async getFuelIssuanceByRequestId(requestId: string) {
    const issuance = await prisma.fuelIssuance.findUnique({
      where: { requestId },
      include: {
        request: true,
        issuer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!issuance) {
      throw new Error('Fuel issuance not found')
    }

    return issuance
  }

  async getFuelIssuances(page: number = 1, limit: number = 10, filters?: any) {
    const skip = (page - 1) * limit
    const where: any = {}

    if (filters?.fromDate) {
      where.issuedAt = { gte: filters.fromDate }
    }

    if (filters?.toDate) {
      where.issuedAt = { ...where.issuedAt, lte: filters.toDate }
    }

    if (filters?.fuelType) {
      where.fuelType = filters.fuelType
    }

    const [issuances, total] = await Promise.all([
      prisma.fuelIssuance.findMany({
        where,
        include: {
          request: {
            include: {
              driver: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  employeeNumber: true,
                },
              },
              department: true,
            },
          },
          issuer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.fuelIssuance.count({ where }),
    ])

    return {
      issuances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }
}

export const fuelIssuanceService = FuelIssuanceService.getInstance()
