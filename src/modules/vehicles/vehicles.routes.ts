import express from 'express'
import { vehiclesController } from './vehicles.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import {
  createVehicleSchema,
  updateVehicleSchema,
  getVehicleSchema,
  deleteVehicleSchema,
  getVehiclesSchema,
} from './vehicles.validation'

const router = express.Router()

/**
 * @route POST /api/vehicles
 * @description Create a new vehicle
 * @access Private - ADMIN only
 */
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate(createVehicleSchema),
  vehiclesController.createVehicle
)

/**
 * @route GET /api/vehicles
 * @description Get all vehicles
 * @access Private - All authenticated users
 */
router.get(
  '/',
  requireAuth,
  validate(getVehiclesSchema),
  vehiclesController.getVehicles
)

/**
 * @route GET /api/vehicles/:id
 * @description Get vehicle by ID
 * @access Private - All authenticated users
 */
router.get(
  '/:id',
  requireAuth,
  validate(getVehicleSchema),
  vehiclesController.getVehicleById
)

/**
 * @route PUT /api/vehicles/:id
 * @description Update vehicle
 * @access Private - ADMIN only
 */
router.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(updateVehicleSchema),
  vehiclesController.updateVehicle
)

/**
 * @route DELETE /api/vehicles/:id
 * @description Delete vehicle
 * @access Private - ADMIN only
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(deleteVehicleSchema),
  vehiclesController.deleteVehicle
)

export default router