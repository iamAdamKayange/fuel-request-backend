import rateLimit from 'express-rate-limit'
import { env } from '../config/env'

export const limiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW) * 60 * 1000,
  max: parseInt(env.RATE_LIMIT_MAX),
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },
})