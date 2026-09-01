import { Router } from 'express'
import { exportsController } from './exports.controller'
import { requireAuth } from '../../middleware/auth'
import { requireRole } from '../../middleware/role'

const router = Router()

// All export routes require authentication
router.use(requireAuth)

// Admin only can export
router.use(requireRole(['ADMIN']))

// Fuel requests exports
router.get('/fuel-requests/pdf', exportsController.exportFuelRequestsPDF.bind(exportsController))
router.get('/fuel-requests/excel', exportsController.exportFuelRequestsExcel.bind(exportsController))

// Audit logs exports
router.get('/audit-logs/pdf', exportsController.exportAuditLogsPDF.bind(exportsController))
router.get('/audit-logs/excel', exportsController.exportAuditLogsExcel.bind(exportsController))

export default router
