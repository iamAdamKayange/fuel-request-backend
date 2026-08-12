import { prisma } from '../../config/database'
import { hashPassword, comparePassword, sanitizeUser } from '../../utils/helpers'
import { logAudit } from '../../utils/logger'

export class UsersService {
  private static instance: UsersService

  static getInstance(): UsersService {
    if (!UsersService.instance) {
      UsersService.instance = new UsersService()
    }
    return UsersService.instance
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
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return sanitizeUser(user)
  }

  async updateUser(id: string, data: any) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        departmentId: data.departmentId,
        isActive: data.isActive,
      },
      include: {
        department: true,
      },
    })

    // Log update
    await logAudit({
      userId: id,
      action: 'USER_UPDATED' as any,
      description: `User ${user.email} was updated`,
    })

    return sanitizeUser(user)
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    const isValid = await comparePassword(currentPassword, user.password)

    if (!isValid) {
      throw new Error('Current password is incorrect')
    }

    const hashedPassword = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    await logAudit({
      userId,
      action: 'USER_CHANGED_PASSWORD' as any,
      description: `User ${user.email} changed password`,
    })

    return { success: true }
  }
}

export const usersService = UsersService.getInstance()