import { prisma } from '../../config/database'

// Define AuditAction locally instead of importing from @prisma/client
export enum AuditAction {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  USER_UPDATED = 'USER_UPDATED',
  USER_CHANGED_PASSWORD = 'USER_CHANGED_PASSWORD',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',
  DRIVER_SUBMITTED_REQUEST = 'DRIVER_SUBMITTED_REQUEST',
  HEAD_APPROVED_REQUEST = 'HEAD_APPROVED_REQUEST',
  HEAD_REJECTED_REQUEST = 'HEAD_REJECTED_REQUEST',
  TRANSPORT_APPROVED_REQUEST = 'TRANSPORT_APPROVED_REQUEST',
  TRANSPORT_REJECTED_REQUEST = 'TRANSPORT_REJECTED_REQUEST',
  ADA_APPROVED_REQUEST = 'ADA_APPROVED_REQUEST',
  ADA_REJECTED_REQUEST = 'ADA_REJECTED_REQUEST',
  FUEL_ISSUED = 'FUEL_ISSUED',
  REQUEST_CANCELLED = 'REQUEST_CANCELLED',
}

export class AuditLogsService {
  private static instance: AuditLogsService

  static getInstance(): AuditLogsService {
    if (!AuditLogsService.instance) {
      AuditLogsService.instance = new AuditLogsService()
    }
    return AuditLogsService.instance
  }

  async getAuditLogs(
    page: number = 1,
    limit: number = 10,
    filters?: {
      action?: string
      userId?: string
      requestId?: string
      fromDate?: Date
      toDate?: Date
    }
  ) {
    const skip = (page - 1) * limit
    const where: any = {}

    if (filters?.action) {
      where.action = filters.action
    }

    if (filters?.userId) {
      where.userId = filters.userId
    }

    if (filters?.requestId) {
      where.requestId = filters.requestId
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

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeNumber: true,
              role: true,
            },
          },
          request: {
            select: {
              id: true,
              requestNumber: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ])

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getAuditLogsByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        include: {
          request: {
            select: {
              id: true,
              requestNumber: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where: { userId } }),
    ])

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getAuditLogsByRequest(requestId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { requestId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeNumber: true,
              role: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where: { requestId } }),
    ])

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getAuditLogActions() {
    return Object.values(AuditAction)
  }
}

export const auditLogsService = AuditLogsService.getInstance()