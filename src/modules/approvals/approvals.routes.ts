import express from 'express'
import { approvalsController } from './approvals.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'
import { validate } from '../../middleware/validation'
import {
  headApprovalSchema,
  transportApprovalSchema,
  adaApprovalSchema,
} from './approvals.validation'

const router = express.Router()

/**
 * @route POST /api/approvals/:id/head
 * @description Head of Department approval
 * @access Private - HEAD_OF_DEPARTMENT only
 */
router.post(
  '/:id/head',
  requireAuth,
  requireRole('HEAD_OF_DEPARTMENT'),
  validate(headApprovalSchema),
  approvalsController.headApproval
)

/**
 * @route POST /api/approvals/:id/transport
 * @description Transport Officer approval
 * @access Private - TRANSPORT_OFFICER only
 */
router.post(
  '/:id/transport',
  requireAuth,
  requireRole('TRANSPORT_OFFICER'),
  validate(transportApprovalSchema),
  approvalsController.transportApproval
)

/**
 * @route POST /api/approvals/:id/ada
 * @description ADA/DAHRM approval
 * @access Private - ADA_DAHRM only
 */
router.post(
  '/:id/ada',
  requireAuth,
  requireRole('ADA_DAHRM'),
  validate(adaApprovalSchema),
  approvalsController.adaApproval
)

export default router