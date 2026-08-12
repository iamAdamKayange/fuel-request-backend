import express from 'express'
import { adminController } from './admin.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import {
  registerUserSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
  adminUsersSchema,
} from './admin.validation'

const router = express.Router()

// All admin routes require authentication and ADMIN role
router.use(requireAuth, requireRole('ADMIN'))

/**
 * @route POST /api/admin/users
 * @description Register a new user
 * @access Private - ADMIN only
 */
router.post('/users', validate(registerUserSchema), adminController.registerUser)

/**
 * @route GET /api/admin/users
 * @description Get all users with filters
 * @access Private - ADMIN only
 */
router.get('/users', validate(adminUsersSchema), adminController.getUsers)

/**
 * @route GET /api/admin/users/:id
 * @description Get user by ID with details
 * @access Private - ADMIN only
 */
router.get('/users/:id', adminController.getUserById)

/**
 * @route PATCH /api/admin/users/:id/status
 * @description Activate/deactivate user
 * @access Private - ADMIN only
 */
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus)

/**
 * @route POST /api/admin/users/:id/reset-password
 * @description Reset user password
 * @access Private - ADMIN only
 */
router.post('/users/:id/reset-password', validate(resetPasswordSchema), adminController.resetPassword)

/**
 * @route GET /api/admin/stats
 * @description Get system statistics
 * @access Private - ADMIN only
 */
router.get('/stats', adminController.getSystemStats)

export default router