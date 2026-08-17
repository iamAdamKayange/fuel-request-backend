import { prisma } from '../../config/database'
import { hashPassword, generateEmployeeNumber, sanitizeUser } from '../../utils/helpers'
import { logAudit } from '../../utils/logger'

export class AdminService {
  private static instance: AdminService

  static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService()
    }
    return AdminService.instance
  }

  async registerUser(data: {
    firstName: string
    lastName: string
    title: string
    email: string
    phone?: string
    role: string
    departmentId: string
    password: string
  }) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw new Error('User with this email already exists')
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
    })

    if (!department) {
      throw new Error('Department not found')
    }

    const hashedPassword = await hashPassword(data.password)
    const employeeNumber = generateEmployeeNumber()

    const user = await prisma.user.create({
      data: {
        employeeNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        title: data.title,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: data.role as any,
        departmentId: data.departmentId,
        isActive: true,
      },
      include: {
        department: true,
      },
    })

    // Log registration
    await logAudit({
      userId: user.id,
      action: 'USER_REGISTERED' as any,
      description: `User ${user.email} registered as ${user.role}`,
    })

    return sanitizeUser(user)
  }

  async getUsers(page: number = 1, limit: number = 10, filters?: any) {
    const skip = (page - 1) * limit
    const where: any = {}

    if (filters?.role) {
      where.role = filters.role
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeNumber: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          department: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ])

    return {
      users: users.map(sanitizeUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        fuelRequests: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        notifications: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return sanitizeUser(user)
  }

  async updateUserStatus(id: string, isActive: boolean) {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      include: {
        department: true,
      },
    })

    await logAudit({
      userId: id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED' as any,
      description: `User ${user.email} ${isActive ? 'activated' : 'deactivated'}`,
    })

    return sanitizeUser(user)
  }

  async updateUser(id: string, data: any) {
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id },
        },
      })

      if (existingUser) {
        throw new Error('Email is already in use')
      }
    }

    const updateData: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      title: data.title,
      email: data.email,
      phone: data.phone,
      role: data.role as any,
      departmentId: data.departmentId,
      isActive: data.isActive,
    }

    if (data.password) {
      updateData.password = await hashPassword(data.password)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { department: true },
    })

    await logAudit({
      userId: id,
      action: 'USER_UPDATED' as any,
      description: `Admin updated user ${user.email}`,
    })

    return sanitizeUser(user)
  }

  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            fuelRequests: true,
            approvals: true,
            fuelIssuances: true,
            auditLogs: true,
          },
        },
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const hasHistory = user._count.fuelRequests > 0 || user._count.approvals > 0 || user._count.fuelIssuances > 0 || user._count.auditLogs > 0

    if (hasHistory) {
      const deactivatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: { department: true },
      })

      return { deleted: false, deactivated: true, user: sanitizeUser(deactivatedUser) }
    }

    await prisma.refreshToken.deleteMany({ where: { userId: id } })
    await prisma.deviceToken.deleteMany({ where: { userId: id } })
    await prisma.notification.deleteMany({ where: { userId: id } })
    await prisma.user.delete({ where: { id } })

    return { deleted: true, deactivated: false }
  }

  async resetPassword(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const newPassword = 'User@123'
    const hashedPassword = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    await logAudit({
      userId: id,
      action: 'USER_PASSWORD_RESET' as any,
      description: `Password reset for user ${user.email}`,
    })

    return { success: true, temporaryPassword: newPassword }
  }

  async getSystemStats() {
    const [
      totalUsers,
      activeUsers,
      totalRequests,
      pendingRequests,
      completedRequests,
      totalFuelIssued,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.fuelRequest.count(),
      prisma.fuelRequest.count({
        where: {
          status: {
            in: ['PENDING_HEAD_APPROVAL', 'PENDING_TRANSPORT_APPROVAL', 'PENDING_DA_APPROVAL', 'PENDING_FUEL_ISSUANCE'],
          },
        },
      }),
      prisma.fuelRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.fuelRequest.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { issuedLitres: true },
      }),
    ])

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        completed: completedRequests,
      },
      fuel: {
        totalIssued: totalFuelIssued._sum.issuedLitres || 0,
      },
    }
  }
}

export const adminService = AdminService.getInstance()
