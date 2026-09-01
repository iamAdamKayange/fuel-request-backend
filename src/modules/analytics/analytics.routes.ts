import { Router } from 'express'
import { analyticsController } from './analytics.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'

const router = Router()

// All analytics routes require authentication
router.use(requireAuth)

// Admin only can access analytics
router.use(requireRole(['ADMIN']))

// System statistics
router.get('/system-stats', analyticsController.getSystemStats.bind(analyticsController))

// Fuel consumption
router.get('/fuel-consumption', analyticsController.getFuelConsumptionByMonth.bind(analyticsController))

// Department statistics
router.get('/departments', analyticsController.getRequestsByDepartment.bind(analyticsController))

// Status statistics
router.get('/status', analyticsController.getRequestsByStatus.bind(analyticsController))

// Approver statistics
router.get('/approvers', analyticsController.getApprovalStatsByApprover.bind(analyticsController))

// Recent activity
router.get('/recent-activity', analyticsController.getRecentActivity.bind(analyticsController))

// Dashboard summary (combined endpoint)
router.get('/dashboard', analyticsController.getDashboardSummary.bind(analyticsController))

export default router
