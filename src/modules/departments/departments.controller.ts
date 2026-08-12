import { Request, Response } from 'express'
import { departmentsService } from './departments.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class DepartmentsController {
  private static instance: DepartmentsController

  static getInstance(): DepartmentsController {
    if (!DepartmentsController.instance) {
      DepartmentsController.instance = new DepartmentsController()
    }
    return DepartmentsController.instance
  }

  async createDepartment(req: AuthRequest, res: Response) {
    try {
      const department = await departmentsService.createDepartment(req.body)
      res.status(201).json(successResponse(department, 'Department created successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getDepartments(_req: Request, res: Response) {
    try {
      const departments = await departmentsService.getDepartments()
      res.json(successResponse(departments, 'Departments retrieved successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getDepartmentById(req: Request, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const departmentId = Array.isArray(id) ? id[0] : id
      const department = await departmentsService.getDepartmentById(departmentId)
      res.json(successResponse(department, 'Department details retrieved'))
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message))
    }
  }

  async updateDepartment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const departmentId = Array.isArray(id) ? id[0] : id
      const department = await departmentsService.updateDepartment(departmentId, req.body)
      res.json(successResponse(department, 'Department updated successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async deleteDepartment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const departmentId = Array.isArray(id) ? id[0] : id
      await departmentsService.deleteDepartment(departmentId)
      res.json(successResponse(null, 'Department deleted successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const departmentsController = DepartmentsController.getInstance()