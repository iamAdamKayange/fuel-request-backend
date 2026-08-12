import express from 'express'
import { authController } from './auth.controller'
import { validate } from '../../middleware/validation'
import { requireAuth } from '../../middleware/auth'
import { loginSchema, refreshTokenSchema, logoutSchema } from './auth.validation'

const router = express.Router()

/**
 * @route POST /api/auth/login
 * @description Login user
 * @access Public
 */
router.post('/login', validate(loginSchema), authController.login)

/**
 * @route POST /api/auth/refresh
 * @description Refresh access token
 * @access Public
 */
router.post('/refresh', validate(refreshTokenSchema), authController.refresh)

/**
 * @route POST /api/auth/logout
 * @description Logout user
 * @access Public
 */
router.post('/logout', validate(logoutSchema), authController.logout)

/**
 * @route GET /api/auth/me
 * @description Get current user
 * @access Private
 */
router.get('/me', requireAuth, authController.getMe)

export default router