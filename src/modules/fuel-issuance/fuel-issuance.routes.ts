import express from 'express'
import { fuelIssuanceController } from './fuel-issuance.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import { issueFuelSchema } from './fuel-issuance.validation'

const router = express.Router()

/**
 * @route POST /api/fuel-issuance/:id
 * @description Issue fuel for a request
 * @access Private - PROCUREMENT only
 */
router.post(
  '/:id',
  requireAuth,
  requireRole('PROCUREMENT'),
  validate(issueFuelSchema),
  fuelIssuanceController.issueFuel
)

/**
 * @route GET /api/fuel-issuance/request/:requestId
 * @description Get fuel issuance by request ID
 * @access Private - All authenticated users
 */
router.get(
  '/request/:requestId',
  requireAuth,
  fuelIssuanceController.getFuelIssuanceByRequestId
)

/**
 * @route GET /api/fuel-issuance
 * @description Get all fuel issuances
 * @access Private - ADMIN and PROCUREMENT
 */
router.get(
  '/',
  requireAuth,
  requireRole(['ADMIN', 'PROCUREMENT']),
  fuelIssuanceController.getFuelIssuances
)

export default router