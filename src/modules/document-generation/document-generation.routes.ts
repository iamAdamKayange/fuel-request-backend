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
 * @access Private - Only TRANSPORT_OFFICER or PROCUREMENT
 */
router.get(
  '/:id/statement',
  requireAuth,
  documentGenerationController.generateFuelStatement
)

/**
 * @route GET /api/documents/:id/can-print
 * @description Check if user can print documents (returns both permit and statement permissions)
 * @access Private
 */
router.get(
  '/:id/can-print',
  requireAuth,
  documentGenerationController.checkPrintPermission
)

/**
 * @route GET /api/documents/:id/can-print-statement
 * @description Check if user can print Full Statement
 * @access Private
 */
router.get(
  '/:id/can-print-statement',
  requireAuth,
  documentGenerationController.checkStatementPermission
)

export default router
