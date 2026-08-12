import { Request, Response } from 'express'
import { fuelIssuanceService } from './fuel-issuance.service'
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class FuelIssuanceController {
  private static instance: FuelIssuanceController

  static getInstance(): FuelIssuanceController {
    if (!FuelIssuanceController.instance) {
      FuelIssuanceController.instance = new FuelIssuanceController()
    }
    return FuelIssuanceController.instance
  }

  async issueFuel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const result = await fuelIssuanceService.issueFuel(
        requestId,
        req.user!.id,
        req.body
      )
      res.json(successResponse(result, 'Fuel issued successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getFuelIssuanceByRequestId(req: Request, res: Response) {
    try {
      const { requestId } = req.params
      // Fix: Ensure requestId is string
      const id = Array.isArray(requestId) ? requestId[0] : requestId
      const issuance = await fuelIssuanceService.getFuelIssuanceByRequestId(id)
      res.json(successResponse(issuance, 'Fuel issuance details retrieved'))
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message))
    }
  }

  async getFuelIssuances(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const filters = {
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        fuelType: req.query.fuelType as string,
      }

      const result = await fuelIssuanceService.getFuelIssuances(page, limit, filters)
      res.json(paginatedResponse(result.issuances, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const fuelIssuanceController = FuelIssuanceController.getInstance()