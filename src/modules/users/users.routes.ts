import express from 'express'
import { usersController } from './users.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import {
  getUsersSchema,
  getUserSchema,
  updateUserSchema,
  changePasswordSchema,
} from './users.validation'

const router = express.Router()

/**
 * @route GET /api/users
 * @description Get all users
 * @access Private - ADMIN only
 */
router.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate(getUsersSchema),
  usersController.getUsers
)

/**
 * @route GET /api/users/:id
 * @description Get user by ID
 * @access Private - ADMIN or Self
 */
router.get(
  '/:id',
  requireAuth,
  validate(getUserSchema),
  usersController.getUserById
)

/**
 * @route PUT /api/users/:id
 * @description Update user
 * @access Private - ADMIN
 */
router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(updateUserSchema),
  usersController.updateUser
)

/**
 * @route POST /api/users/change-password
 * @description Change password
 * @access Private
 */
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  usersController.changePassword
)

export default router