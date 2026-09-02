import { prisma } from '../../config/database'
import { hashPassword, comparePassword, sanitizeUser } from '../../utils/helpers'
import { logAudit } from '../../utils/logger'
import { validatePasswordComplexity, isCommonPassword } from '../../utils/password'
import { encrypt, decrypt } from '../../utils/encryption'

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
      users: users.map(user => {
        const sanitized = sanitizeUser(user)
        if (user.phone) {
          const decryptedPhone = decrypt(user.phone)
          sanitized.phone = decryptedPhone || 'N/A'
        }
        return sanitized
      }),
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

    const sanitizedUser = sanitizeUser(user)
    if (user.phone) {
      const decryptedPhone = decrypt(user.phone)
      sanitizedUser.phone = decryptedPhone || 'N/A'
    }

    return sanitizedUser
  }

  async updateUser(id: string, data: any) {
    const updateData: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      departmentId: data.departmentId,
      isActive: data.isActive,
    }

    // Encrypt phone number if provided
    if (data.phone) {
      updateData.phone = encrypt(data.phone)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
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

    // Decrypt phone for response
    const sanitizedUser = sanitizeUser(user)
    if (user.phone) {
      const decryptedPhone = decrypt(user.phone)
      sanitizedUser.phone = decryptedPhone || 'N/A'
    }

    return sanitizedUser
  }

  async updateProfile(userId: string, data: any) {
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: userId },
        },
      })

      if (existingUser) {
        throw new Error('Email is already in use')
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      },
      include: {
        department: true,
      },
    })

    await logAudit({
      userId,
      action: 'USER_UPDATED' as any,
      description: `User ${user.email} updated their profile`,
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

    // Validate new password complexity
    const passwordValidation = validatePasswordComplexity(newPassword)
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`)
    }

    // Check for common passwords
    if (isCommonPassword(newPassword)) {
      throw new Error('Password is too common. Please choose a stronger password.')
    }

    const hashedPassword = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    })

    await logAudit({
      userId,
      action: 'USER_PASSWORD_CHANGED' as any,
      description: `User ${user.email} changed password`,
    })

    return { success: true }
  }
}

export const usersService = UsersService.getInstance()
