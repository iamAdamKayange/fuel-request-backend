import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'

import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { limiter } from './middleware/rateLimit'
import { csrfProtection } from './middleware/csrf'
import { sessionTimeout } from './middleware/sessionTimeout'
import { prisma } from './config/database'

// Import routes
import authRoutes from './modules/auth/auth.routes'
import userRoutes from './modules/users/users.routes'
import adminRoutes from './modules/admin/admin.routes'
import departmentRoutes from './modules/departments/departments.routes'
import vehicleRoutes from './modules/vehicles/vehicles.routes'
import fuelRequestRoutes from './modules/fuel-requests/fuel-requests.routes'
import approvalRoutes from './modules/approvals/approvals.routes'
import fuelIssuanceRoutes from './modules/fuel-issuance/fuel-issuance.routes'
import notificationRoutes from './modules/notifications/notifications.routes'
import auditLogRoutes from './modules/audit-logs/audit-logs.routes'
import documentRoutes from './modules/document-generation/document-generation.routes'
import exportRoutes from './modules/exports/exports.routes'
import analyticsRoutes from './modules/analytics/analytics.routes'

const app = express()

const allowedOrigins = new Set(
  env.FRONTEND_URL.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
)

// Add common Vercel preview domains in production
if (env.NODE_ENV === 'production') {
  allowedOrigins.add('https://kibali-cha-kuchukua-mafuta.vercel.app')
  allowedOrigins.add('https://kibali-cha-kuchukua-mafuta-git-main-adam-kayange.vercel.app')
  allowedOrigins.add('https://kibali-cha-kuchukua-mafuta-afvm90jqn-adam-kayange.vercel.app')
  allowedOrigins.add('https://fuel-request-backend-production.up.railway.app')
}

if (env.NODE_ENV === 'development') {
  allowedOrigins.add('http://localhost:3000')
  allowedOrigins.add('http://127.0.0.1:3000')
}

/**
 * Reverse Proxy configuration
 *
 * Railway (and other platforms) sit behind a proxy and send X-Forwarded-For.
 * Trust the first proxy so Express and express-rate-limit
 * can correctly determine the client IP.
 */
app.set('trust proxy', 1)

// Security middleware
app.use(helmet())

// CSRF protection (now lenient for Railway reverse proxy)
app.use(csrfProtection)

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      const normalizedOrigin = origin.replace(/\/+$/, '')

      if (allowedOrigins.has(normalizedOrigin)) {
        callback(null, true)
        return
      }

      // Allow all origins in development for testing
      if (env.NODE_ENV === 'development') {
        console.log(`CORS allowing origin in development: ${origin}`)
        callback(null, true)
        return
      }

      console.error(`CORS blocked origin: ${origin}`)
      callback(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: true,
    optionsSuccessStatus: 204,
  })
)

// Compression
app.use(compression())

// HTTP request logging
app.use(
  morgan(
    env.NODE_ENV === 'development'
      ? 'dev'
      : 'combined'
  )
)

// Body parsers
app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
  })
)

// Rate limiting
app.use(limiter)

// Session timeout management (JWT-based, no express-session required)
app.use(sessionTimeout)

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Kibali cha Kuchukua Mafuta - Fuel Permit Management System API',
    version: '1.4.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      documentation: 'API documentation available at /api routes',
    },
  })
})

// Health check
app.get('/health', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    res.status(200).json({
      status: 'ok',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed',
    })
  }
})

// Detailed health check for monitoring
app.get('/health/detailed', async (_req, res) => {
  try {
    // Check database connection with query
    const dbResult = await prisma.$queryRaw`SELECT NOW() as current_time` as any[]
    
    // Get user count
    const userCount = await prisma.user.count()
    
    // Get request count
    const requestCount = await prisma.fuelRequest.count()
    
    res.status(200).json({
      status: 'ok',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        current_time: dbResult[0]?.current_time,
      },
      metrics: {
        users: userCount,
        requests: requestCount,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        node_version: process.version,
      },
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// API Routes
app.use('/api/auth', authRoutes)

app.use('/api/users', userRoutes)

app.use('/api/admin', adminRoutes)

app.use('/api/departments', departmentRoutes)

app.use('/api/vehicles', vehicleRoutes)

app.use('/api/fuel-requests', fuelRequestRoutes)

app.use('/api/approvals', approvalRoutes)

app.use('/api/fuel-issuance', fuelIssuanceRoutes)

app.use('/api/notifications', notificationRoutes)

app.use('/api/audit-logs', auditLogRoutes)

app.use('/api/documents', documentRoutes)

app.use('/api/exports', exportRoutes)

app.use('/api/analytics', analyticsRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  })
})

// Error handler MUST be last
app.use(errorHandler)

export default app
