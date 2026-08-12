import { Response } from 'express'
import { auditLogsService } from './audit-logs.service'
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class AuditLogsController {
  private static instance: AuditLogsController

  static getInstance(): AuditLogsController {
    if (!AuditLogsController.instance) {
      AuditLogsController.instance = new AuditLogsController()
    }
    return AuditLogsController.instance
  }

  async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const filters = {
        action: req.query.action as string,
        userId: req.query.userId as string,
        requestId: req.query.requestId as string,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      }

      const result = await auditLogsService.getAuditLogs(page, limit, filters)
      res.json(paginatedResponse(result.logs, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getAuditLogsByUser(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params
      // Fix: Ensure userId is string
      const id = Array.isArray(userId) ? userId[0] : userId
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10

      const result = await auditLogsService.getAuditLogsByUser(id, page, limit)
      res.json(paginatedResponse(result.logs, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getAuditLogsByRequest(req: AuthRequest, res: Response) {
    try {
      const { requestId } = req.params
      // Fix: Ensure requestId is string
      const id = Array.isArray(requestId) ? requestId[0] : requestId
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10

      const result = await auditLogsService.getAuditLogsByRequest(id, page, limit)
      res.json(paginatedResponse(result.logs, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getAuditLogActions(_req: AuthRequest, res: Response) {
    try {
      const actions = await auditLogsService.getAuditLogActions()
      res.json(successResponse(actions, 'Audit log actions retrieved'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const auditLogsController = AuditLogsController.getInstance()