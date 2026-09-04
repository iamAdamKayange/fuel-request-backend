import express from 'express'
import { documentGenerationController } from './document-generation.controller'
import { requireAuth } from '../../middleware/auth'

const router = express.Router()

/**
 * @route GET /api/documents/:id/permit
 * @description Generate Fuel Permit document
 * @access Private - Only final approver (ADA/DAHRM) or PROCUREMENT
 */
router.get(
  '/:id/permit',
  requireAuth,
  documentGenerationController.generateFuelPermit
)

/**
 * @route GET /api/documents/:id/statement
 * @description Generate Fuel Statement document
 * @access Private - Only final approver (ADA/DAHRM) or PROCUREMENT
 */
router.get(
  '/:id/statement',
  requireAuth,
  documentGenerationController.generateFuelStatement
)

/**
 * @route GET /api/documents/:id/can-print
 * @description Check if user can print documents
 * @access Private
 */
router.get(
  '/:id/can-print',
  requireAuth,
  documentGenerationController.checkPrintPermission
)

export default router
