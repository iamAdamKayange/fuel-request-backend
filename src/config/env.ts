import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required').optional(),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  JWT_ACCESS_EXPIRY: z
    .string()
    .default('15m'),

  JWT_REFRESH_EXPIRY: z
    .string()
    .default('7d'),

  CSRF_SECRET: z
    .string()
    .min(32, 'CSRF_SECRET must be at least 32 characters')
    .default('default-csrf-secret-change-in-production'),

  SESSION_TIMEOUT_MINUTES: z
    .string()
    .default('30'),

  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters')
    .default('default-encryption-key-change-in-production'),

  SMS_API_URL: z
    .string()
    .optional(),

  SMS_API_KEY: z
    .string()
    .optional(),

  SMS_SENDER_ID: z
    .string()
    .optional(),

  FIREBASE_PROJECT_ID: z
    .string()
    .optional(),

  FIREBASE_CLIENT_EMAIL: z
    .string()
    .optional(),

  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional(),

  PORT: z
    .string()
    .default('5000'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  FRONTEND_URL: z
    .string()
    .default('http://localhost:3000'),

  RATE_LIMIT_WINDOW: z
    .string()
    .default('15'),

  RATE_LIMIT_MAX: z
    .string()
    .default('100'),

  SMTP_HOST: z
    .string()
    .optional(),

  SMTP_PORT: z
    .string()
    .optional(),

  SMTP_USER: z
    .string()
    .optional(),

  SMTP_PASS: z
    .string()
    .optional(),

  SMTP_FROM: z
    .string()
    .optional(),

  SMTP_SECURE: z
    .string()
    .optional(),

  SMTP_STARTTLS: z
    .string()
    .optional(),

  SMTP_HELO_HOST: z
    .string()
    .optional(),
})

export const env = envSchema.parse(process.env)