import jwt from 'jsonwebtoken'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { comparePassword, sanitizeUser } from '../../utils/helpers'
import { logAudit } from '../../utils/logger'
import { Request } from 'express'

export class AuthService {
  private static instance: AuthService

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async login(email: string, password: string, req: Request) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: true,
      },
    })

    if (!user) {
      throw new Error('Invalid credentials')
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated')
    }

    const isValidPassword = await comparePassword(password, user.password)

    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const accessToken = this.generateAccessToken(user)
    const refreshToken = await this.generateRefreshToken(user.id)

    // Log login - Fix: Use string for action
    await logAudit({
      userId: user.id,
      action: 'USER_LOGGED_IN',
      description: `User ${user.email} logged in`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })

    return {
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    }
  }

  async refreshToken(refreshToken: string) {
    // Verify refresh token
    const secret = env.JWT_REFRESH_SECRET?.toString()
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined')
    }

    try {
    } catch (error) {
      throw new Error('Invalid refresh token')
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    })

    if (!storedToken) {
      throw new Error('Invalid refresh token')
    }

    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
    })

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive')
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    })

    const newAccessToken = this.generateAccessToken(user)
    const newRefreshToken = await this.generateRefreshToken(user.id)

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }
  }

  async logout(refreshToken: string) {
    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken },
    })

    if (storedToken) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      })
    }

    return { success: true }
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return sanitizeUser(user)
  }

  private generateAccessToken(user: any): string {
    // Ensure we have valid secrets
    const secret = env.JWT_ACCESS_SECRET?.toString()
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not defined in environment variables')
    }

    const expiresIn = env.JWT_ACCESS_EXPIRY?.toString() || '15m'

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeNumber: user.employeeNumber,
      departmentId: user.departmentId,
    }

    // Fix: Use correct jwt.sign signature
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const secret = env.JWT_REFRESH_SECRET?.toString()
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables')
    }

    const expiresIn = env.JWT_REFRESH_EXPIRY?.toString() || '7d'

    // Fix: Use correct jwt.sign signature
    const token = jwt.sign(
      { userId },
      secret,
      { expiresIn } as jwt.SignOptions
    )

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    })

    return token
  }
}

export const authService = AuthService.getInstance()