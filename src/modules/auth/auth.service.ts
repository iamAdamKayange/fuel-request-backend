import jwt from 'jsonwebtoken'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { comparePassword, sanitizeUser } from '../../utils/helpers'
import { logAudit } from '../../utils/logger'
import { Request } from 'express'
import { isEmailConfigured, sendAccountLockedNotification } from '../../utils/email'
import { isSMSConfigured, sendAccountLockedSMS } from '../../utils/sms'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 15

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

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      throw new Error(`Account is locked. Try again in ${remainingTime} minutes`)
    }

    const isValidPassword = await comparePassword(password, user.password)

    if (!isValidPassword) {
      // Increment failed login attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1
      
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60000)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failedAttempts,
            lockedUntil: lockUntil,
          },
        })

        await logAudit({
          userId: user.id,
          action: 'USER_ACCOUNT_LOCKED' as any,
          description: `Account ${user.email} locked due to too many failed login attempts`,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        })

        // Send email notification if configured
        if (isEmailConfigured()) {
          await sendAccountLockedNotification(
            user.email,
            `${user.firstName} ${user.lastName}`
          )
        }

        // Send SMS notification if configured
        if (isSMSConfigured() && user.phone) {
          await sendAccountLockedSMS(user.phone)
        }

        throw new Error(`Account locked due to too many failed attempts. Try again in ${LOCKOUT_DURATION_MINUTES} minutes`)
      } else {
        // Just increment failed attempts
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: failedAttempts },
        })

        const remainingAttempts = MAX_LOGIN_ATTEMPTS - failedAttempts
        throw new Error(`Invalid credentials. ${remainingAttempts} attempts remaining before account lockout`)
      }
    }

    // Password is valid - reset failed attempts and lock
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
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
      jwt.verify(refreshToken, secret)
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

    // Debug: Log token generation
    console.log('[AuthService] Generating access token:', {
      userId: user.id,
      email: user.email,
      role: user.role,
      expiresIn,
      hasSecret: !!secret,
      secretLength: secret.length,
      env: env.NODE_ENV
    })

    // Fix: Use correct jwt.sign signature
    const token = jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions)
    
    console.log('[AuthService] Access token generated:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + '...'
    })
    
    return token
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