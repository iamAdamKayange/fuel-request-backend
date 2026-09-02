import { Request, Response, NextFunction } from 'express'
import tokens from 'csrf'

// Create CSRF token generator
const csrf = new tokens()

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Generate CSRF token for GET requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    const secret = csrf.secretSync()
    const token = csrf.create(secret)
    res.setHeader('X-CSRF-Token', token)
    res.setHeader('X-CSRF-Secret', secret)
    return next()
  }

  // Validate CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Allow requests without body (Railway health checks, etc.)
    if (!req.body) {
      return next()
    }

    const token = req.headers['x-csrf-token'] as string || (req.body && req.body._csrf as string)
    const secret = req.headers['x-csrf-secret'] as string || (req.body && req.body._csrfSecret as string)
    
    // Allow requests without CSRF token for health checks and public endpoints
    if (!token || !secret) {
      return next()
    }

    if (!csrf.verify(secret, token)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token'
      })
    }
    
    next()
  } else {
    next()
  }
}

export const generateCSRFToken = () => {
  const secret = csrf.secretSync()
  const token = csrf.create(secret)
  return { secret, token }
}

export const verifyCSRFToken = (secret: string, token: string) => {
  return csrf.verify(secret, token)
}