import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),

  DIRECT_URL: z
    .string()
    .min(1, 'DIRECT_URL is required'),

  // JWT
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

  // Firebase
  FIREBASE_PROJECT_ID: z
    .string()
    .trim()
    .optional(),

  FIREBASE_CLIENT_EMAIL: z
    .string()
    .trim()
    .optional(),

  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional(),

  // Server
  PORT: z
    .string()
    .default('5000'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  FRONTEND_URL: z
    .string()
    .default('http://localhost:3000'),

  // Rate limiting
  RATE_LIMIT_WINDOW: z
    .string()
    .default('15'),

  RATE_LIMIT_MAX: z
    .string()
    .default('100'),

  // SMTP
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