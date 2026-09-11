import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { env } from '../config/env'

// General API limiter - for most endpoints (including read operations)
// Increased to support legitimate concurrent access
export const limiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW) * 60 * 1000,
  max: parseInt(env.RATE_LIMIT_MAX),
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, fallback to IP
    if ((req as any).user?.id) {
      return (req as any).user.id
    }
    return ipKeyGenerator(req)
  },
})

// Strict limiter for sensitive operations (auth, password reset, etc.)
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Always use IP for sensitive operations to prevent account enumeration
    return ipKeyGenerator(req)
  },
})

// Lenient limiter for read-only operations (GET requests)
// Much higher limit to support concurrent viewing
export const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 200, // 200 requests per minute (supports heavy concurrent access)
  message: {
    success: false,
    message: 'Too many read requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, fallback to IP
    if ((req as any).user?.id) {
      return (req as any).user.id
    }
    return ipKeyGenerator(req)
  },
  skip: (req) => {
    // Skip rate limiting for authenticated users if the limit is very high
    // This prevents false positives for legitimate concurrent access
    return (req as any).user?.id !== undefined
  },
})

// Auth-specific limiter for login endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Always use IP for auth to prevent credential stuffing
    return ipKeyGenerator(req)
  },
})