import express from 'express'
import { fuelRequestsController } from './fuel-requests.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import {
  createFuelRequestSchema,
  getFuelRequestsSchema,
  getFuelRequestSchema,
  updateFuelRequestSchema,
  cancelFuelRequestSchema,
} from './fuel-requests.validation'

const router = express.Router()

/**
 * @route POST /api/fuel-requests
 * @description Create a new fuel request
 * @access Private - DRIVER only
 */
router.post(
  '/',
  requireAuth,
  requireRole('DRIVER'),
  validate(createFuelRequestSchema),
  fuelRequestsController.createFuelRequest
)

/**
 * @route GET /api/fuel-requests
 * @description Get all fuel requests with filters
 * @access Private - All authenticated users (filtered by role)
 */
router.get(
  '/',
  requireAuth,
  validate(getFuelRequestsSchema),
  fuelRequestsController.getFuelRequests
)

/**
 * @route GET /api/fuel-requests/:id
 * @description Get fuel request by ID
 * @access Private - All authenticated users (filtered by role)
 */
router.get(
  '/:id',
  requireAuth,
  validate(getFuelRequestSchema),
  fuelRequestsController.getFuelRequestById
)

/**
 * @route PUT /api/fuel-requests/:id
 * @description Update fuel request
 * @access Private - DRIVER only (before approval)
 */
router.put(
  '/:id',
  requireAuth,
  requireRole('DRIVER'),
  validate(updateFuelRequestSchema),
  fuelRequestsController.updateFuelRequest
)

/**
 * @route POST /api/fuel-requests/:id/cancel
 * @description Cancel fuel request
 * @access Private - DRIVER only
 */
router.post(
  '/:id/cancel',
  requireAuth,
  requireRole('DRIVER'),
  validate(cancelFuelRequestSchema),
  fuelRequestsController.cancelFuelRequest
)

export default router