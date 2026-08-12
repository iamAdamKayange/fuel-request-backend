import { Request, Response, NextFunction } from 'express'
import { errorResponse } from '../utils/response'
import { env } from '../config/env'

// Prisma error codes
const PRISMA_ERRORS = {
  UNIQUE_CONSTRAINT: 'P2002',
  RECORD_NOT_FOUND: 'P2025',
  FOREIGN_KEY: 'P2003',
  INVALID_RELATION: 'P2014',
  REQUIRED_FIELD: 'P2011',
} as const

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error:', err)

  // Handle Prisma errors by code
  if (err.code) {
    switch (err.code) {
      case PRISMA_ERRORS.UNIQUE_CONSTRAINT:
        const field = err.meta?.target?.[0] || 'Field'
        return res.status(409).json(
          errorResponse(`${field} already exists. Please use a different value.`)
        )
      
      case PRISMA_ERRORS.RECORD_NOT_FOUND:
        return res.status(404).json(
          errorResponse('The requested record was not found')
        )
      
      case PRISMA_ERRORS.FOREIGN_KEY:
        return res.status(400).json(
          errorResponse('Related record does not exist')
        )
      
      case PRISMA_ERRORS.INVALID_RELATION:
        return res.status(400).json(
          errorResponse('Invalid relationship between records')
        )
      
      case PRISMA_ERRORS.REQUIRED_FIELD:
        return res.status(400).json(
          errorResponse('Required field is missing')
        )
    }
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const errors = err.errors.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return res.status(400).json(
      errorResponse('Validation failed', errors)
    )
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(errorResponse('Invalid authentication token'))
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(errorResponse('Authentication token has expired'))
  }

  // Handle custom application errors
  if (err.status && err.message) {
    return res.status(err.status).json(errorResponse(err.message))
  }

  // Default error response
  const status = err.status || 500
  const message = err.message || 'An unexpected error occurred'

  // Don't expose internal errors in production
  if (env.NODE_ENV === 'production' && status === 500) {
    return res.status(500).json(errorResponse('Internal server error'))
  }

  return res.status(status).json(errorResponse(message))
}