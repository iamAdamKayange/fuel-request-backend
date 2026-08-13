import { Response } from 'express'
import { adminService } from './admin.service'
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class AdminController {
  private static instance: AdminController

  static getInstance(): AdminController {
    if (!AdminController.instance) {
      AdminController.instance = new AdminController()
    }
    return AdminController.instance
  }

  async registerUser(req: AuthRequest, res: Response) {
    try {
      const result = await adminService.registerUser(req.body)
      res.status(201).json(successResponse(result, 'User registered successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getUsers(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const filters = {
        role: req.query.role as string,
        departmentId: req.query.departmentId as string,
        search: req.query.search as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      }

      const result = await adminService.getUsers(page, limit, filters)
      res.json(paginatedResponse(result.users, result.total, result.page, result.limit))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const userId = Array.isArray(id) ? id[0] : id
      const user = await adminService.getUserById(userId)
      res.json(successResponse(user, 'User details retrieved'))
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message))
    }
  }

  async updateUserStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const userId = Array.isArray(id) ? id[0] : id
      const { isActive } = req.body
      const user = await adminService.updateUserStatus(userId, isActive)
      res.json(successResponse(user, `User ${isActive ? 'activated' : 'deactivated'} successfully`))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const userId = Array.isArray(id) ? id[0] : id
      const user = await adminService.updateUser(userId, req.body)
      res.json(successResponse(user, 'User updated successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const userId = Array.isArray(id) ? id[0] : id
      const result = await adminService.deleteUser(userId)
      res.json(successResponse(result, result.deleted ? 'User deleted successfully' : 'User has history and was deactivated instead'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async resetPassword(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const userId = Array.isArray(id) ? id[0] : id
      const result = await adminService.resetPassword(userId)
      res.json(successResponse(result, 'Password reset successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getSystemStats(_req: AuthRequest, res: Response) {
    try {
      const stats = await adminService.getSystemStats()
      res.json(successResponse(stats, 'System statistics retrieved'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const adminController = AdminController.getInstance()
