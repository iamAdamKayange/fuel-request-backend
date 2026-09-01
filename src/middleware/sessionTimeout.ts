import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export const sessionTimeout = (req: Request, res: Response, next: NextFunction) => {
  // Skip for login and refresh token endpoints
  if (req.path === '/api/auth/login' || req.path === '/api/auth/refresh') {
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next()
  }

  const token = authHeader.substring(7)
  
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as any
    
    // Check if the token was issued more than SESSION_TIMEOUT_MINUTES ago
    const sessionTimeoutMinutes = parseInt(env.SESSION_TIMEOUT_MINUTES)
    const tokenIssuedAt = decoded.iat ? decoded.iat * 1000 : 0
    const currentTime = Date.now()
    const sessionAgeMinutes = (currentTime - tokenIssuedAt) / (1000 * 60)
    
    if (sessionAgeMinutes > sessionTimeoutMinutes) {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please login again.'
      })
    }
    
    next()
  } catch (error) {
    // If token is invalid, let the auth middleware handle it
    next()
  }
}