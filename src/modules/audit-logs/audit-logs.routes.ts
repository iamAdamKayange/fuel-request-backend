import express from 'express'
import { auditLogsController } from './audit-logs.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import { getAuditLogsSchema } from './audit-logs.validation'

const router = express.Router()

// All audit log routes require authentication and ADMIN role
router.use(requireAuth, requireRole('ADMIN'))

/**
 * @route GET /api/audit-logs
 * @description Get all audit logs with filters
 * @access Private - ADMIN only
 */
router.get(
  '/',
  validate(getAuditLogsSchema),
  auditLogsController.getAuditLogs
)

/**
 * @route GET /api/audit-logs/user/:userId
 * @description Get audit logs by user
 * @access Private - ADMIN only
 */
router.get(
  '/user/:userId',
  auditLogsController.getAuditLogsByUser
)

/**
 * @route GET /api/audit-logs/request/:requestId
 * @description Get audit logs by request
 * @access Private - ADMIN only
 */
router.get(
  '/request/:requestId',
  auditLogsController.getAuditLogsByRequest
)

/**
 * @route GET /api/audit-logs/actions
 * @description Get all available audit log actions
 * @access Private - ADMIN only
 */
router.get(
  '/actions',
  auditLogsController.getAuditLogActions
)

export default router