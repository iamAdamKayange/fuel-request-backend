import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { prisma } from '../config/database'
import { errorResponse } from '../utils/response'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    employeeNumber: string
    departmentId?: string
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Auth] No Bearer token in Authorization header')
      res.status(401).json(errorResponse('Authentication required'))
      return
    }

    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      console.log('[Auth] Empty token after Bearer prefix')
      res.status(401).json(errorResponse('Authentication required'))
      return
    }

    // Debug: Log token presence without exposing it
    console.log('[Auth] Token received:', {
      hasToken: !!token,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 10) + '...'
    })

    // Ensure secret is string
    const secret = env.JWT_ACCESS_SECRET?.toString()
    if (!secret) {
      console.error('[Auth] JWT_ACCESS_SECRET is not defined')
      res.status(500).json(errorResponse('Server configuration error'))
      return
    }

    console.log('[Auth] JWT_SECRET configured:', {
      hasSecret: !!secret,
      secretLength: secret.length,
      env: env.NODE_ENV
    })

    // Verify token
    let decoded: any
    try {
      decoded = jwt.verify(token, secret)
      console.log('[Auth] Token verified successfully:', {
        userId: decoded.id,
        email: decoded.email,
        role: decoded.role
      })
    } catch (jwtError: any) {
      console.log('[Auth] Token verification failed:', {
        errorName: jwtError.name,
        errorMessage: jwtError.message
      })
      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json(errorResponse('Invalid token'))
        return
      }
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json(errorResponse('Token expired'))
        return
      }
      throw jwtError
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        employeeNumber: true,
        departmentId: true,
        isActive: true,
      },
    })

    if (!user) {
      res.status(401).json(errorResponse('User not found'))
      return
    }

    if (!user.isActive) {
      res.status(403).json(errorResponse('Account is deactivated'))
      return
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeNumber: user.employeeNumber,
      departmentId: user.departmentId || undefined,
    }

    next()
  } catch (error: any) {
    console.error('Auth middleware error:', error)
    res.status(500).json(errorResponse('Authentication error'))
  }
}

// Optional: Middleware for optional auth (user may or may not be authenticated)
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const secret = env.JWT_ACCESS_SECRET?.toString()
      
      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as any
          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              email: true,
              role: true,
              employeeNumber: true,
              departmentId: true,
              isActive: true,
            },
          })
          
          if (user && user.isActive) {
            req.user = {
              id: user.id,
              email: user.email,
              role: user.role,
              employeeNumber: user.employeeNumber,
              departmentId: user.departmentId || undefined,
            }
          }
        } catch (error) {
          // Ignore token errors for optional auth
        }
      }
    }
    next()
  } catch (error) {
    next()
  }
}