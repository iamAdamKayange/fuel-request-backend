import { Request, Response } from 'express'
import { vehiclesService } from './vehicles.service'
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class VehiclesController {
  private static instance: VehiclesController

  static getInstance(): VehiclesController {
    if (!VehiclesController.instance) {
      VehiclesController.instance = new VehiclesController()
    }
    return VehiclesController.instance
  }

  async createVehicle(req: AuthRequest, res: Response) {
    try {
      const vehicle = await vehiclesService.createVehicle(req.body)
      res.status(201).json(successResponse(vehicle, 'Vehicle created successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getVehicles(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const filters = {
        departmentId: req.query.departmentId as string,
        fuelType: req.query.fuelType as string,
        search: req.query.search as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      }

      const result = await vehiclesService.getVehicles(page, limit, filters)
      res.json(paginatedResponse(result.vehicles, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getVehicleById(req: Request, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const vehicleId = Array.isArray(id) ? id[0] : id
      const vehicle = await vehiclesService.getVehicleById(vehicleId)
      res.json(successResponse(vehicle, 'Vehicle details retrieved'))
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message))
    }
  }

  async updateVehicle(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const vehicleId = Array.isArray(id) ? id[0] : id
      const vehicle = await vehiclesService.updateVehicle(vehicleId, req.body)
      res.json(successResponse(vehicle, 'Vehicle updated successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async deleteVehicle(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const vehicleId = Array.isArray(id) ? id[0] : id
      await vehiclesService.deleteVehicle(vehicleId)
      res.json(successResponse(null, 'Vehicle deleted successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const vehiclesController = VehiclesController.getInstance()