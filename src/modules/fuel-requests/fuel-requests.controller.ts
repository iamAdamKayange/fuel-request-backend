import { Response } from 'express'
import { fuelRequestsService } from './fuel-requests.service'
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class FuelRequestsController {
  private static instance: FuelRequestsController

  static getInstance(): FuelRequestsController {
    if (!FuelRequestsController.instance) {
      FuelRequestsController.instance = new FuelRequestsController()
    }
    return FuelRequestsController.instance
  }

  async createFuelRequest(req: AuthRequest, res: Response) {
    try {
      const request = await fuelRequestsService.createFuelRequest(req.user!.id, req.body)
      res.status(201).json(successResponse(request, 'Fuel request submitted successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getFuelRequests(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const filters = {
        status: req.query.status as string,
        departmentId: req.query.departmentId as string,
        vehicleId: req.query.vehicleId as string,
        search: req.query.search as string,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      }

      const result = await fuelRequestsService.getFuelRequests(
        page,
        limit,
        filters,
        req.user!.id,
        req.user!.role
      )
      res.json(paginatedResponse(result.requests, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getFuelRequestById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const request = await fuelRequestsService.getFuelRequestById(
        requestId,
        req.user!.id,
        req.user!.role
      )
      res.json(successResponse(request, 'Fuel request details retrieved'))
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message))
    }
  }

  async updateFuelRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const request = await fuelRequestsService.updateFuelRequest(
        requestId,
        req.body,
        req.user!.id
      )
      res.json(successResponse(request, 'Fuel request updated successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async cancelFuelRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const requestId = Array.isArray(id) ? id[0] : id
      const { reason } = req.body
      const request = await fuelRequestsService.cancelFuelRequest(
        requestId,
        reason,
        req.user!.id
      )
      res.json(successResponse(request, 'Fuel request cancelled successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const fuelRequestsController = FuelRequestsController.getInstance()