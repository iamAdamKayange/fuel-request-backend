import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'

import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { limiter } from './middleware/rateLimit'

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

const app = express()

// ============================================================
// TRUST PROXY
// ============================================================
// Render runs the application behind a reverse proxy.
// This allows Express to correctly process X-Forwarded-For
// and allows express-rate-limit to identify client IPs correctly.
app.set('trust proxy', 1)

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(helmet())

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
)

// ============================================================
// GENERAL MIDDLEWARE
// ============================================================

app.use(compression())

app.use(
  morgan(
    env.NODE_ENV === 'development'
      ? 'dev'
      : 'combined'
  )
)

app.use(express.json())

app.use(
  express.urlencoded({
    extended: true,
  })
)

// ============================================================
// RATE LIMITER
// ============================================================

app.use(limiter)

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// ============================================================
// API ROUTES
// ============================================================

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

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  })
})

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
// MUST remain the last middleware.

app.use(errorHandler)

export default app