import express from 'express'
import { departmentsController } from './departments.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  getDepartmentSchema,
  deleteDepartmentSchema,
} from './departments.validation'

const router = express.Router()

/**
 * @route POST /api/departments
 * @description Create a new department
 * @access Private - ADMIN only
 */
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate(createDepartmentSchema),
  departmentsController.createDepartment
)

/**
 * @route GET /api/departments
 * @description Get all departments
 * @access Private - All authenticated users
 */
router.get('/', requireAuth, departmentsController.getDepartments)

/**
 * @route GET /api/departments/:id
 * @description Get department by ID
 * @access Private - All authenticated users
 */
router.get(
  '/:id',
  requireAuth,
  validate(getDepartmentSchema),
  departmentsController.getDepartmentById
)

/**
 * @route PUT /api/departments/:id
 * @description Update department
 * @access Private - ADMIN only
 */
router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(updateDepartmentSchema),
  departmentsController.updateDepartment
)

/**
 * @route DELETE /api/departments/:id
 * @description Delete department
 * @access Private - ADMIN only
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(deleteDepartmentSchema),
  departmentsController.deleteDepartment
)

export default router