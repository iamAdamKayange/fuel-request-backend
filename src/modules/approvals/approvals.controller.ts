import { Response } from 'express'
import { approvalsService } from './approvals.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class ApprovalsController {
  private static instance: ApprovalsController

  static getInstance(): ApprovalsController {
    if (!ApprovalsController.instance) {
      ApprovalsController.instance = new ApprovalsController()
    }
    return ApprovalsController.instance
  }

  async headApproval(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const result = await approvalsService.headApproval(
        requestId,
        req.user!.id,
        req.body
      )
      res.json(successResponse(result, 'Head approval processed successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async transportApproval(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const result = await approvalsService.transportApproval(
        requestId,
        req.user!.id,
        req.body
      )
      res.json(successResponse(result, 'Transport approval processed successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async adaApproval(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const result = await approvalsService.adaApproval(
        requestId,
        req.user!.id,
        req.body
      )
      res.json(successResponse(result, 'ADA approval processed successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const approvalsController = ApprovalsController.getInstance()