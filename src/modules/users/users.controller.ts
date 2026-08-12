import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth'
import { usersService } from './users.service'
import { successResponse, errorResponse, paginatedResponse } from '../../utils/response'

export class UsersController {
  private static instance: UsersController

  static getInstance(): UsersController {
    if (!UsersController.instance) {
      UsersController.instance = new UsersController()
    }
    return UsersController.instance
  }

  async getUsers(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const filters = {
        role: req.query.role as string,
        departmentId: req.query.departmentId as string,
        search: req.query.search as string,
      }

      const result = await usersService.getUsers(page, limit, filters)
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
      const user = await usersService.getUserById(userId)
      res.json(successResponse(user, 'User details retrieved'))
    } catch (error: any) {
      res.status(404).json(errorResponse(error.message))
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const userId = Array.isArray(id) ? id[0] : id
      const user = await usersService.updateUser(userId, req.body)
      res.json(successResponse(user, 'User updated successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const user = await usersService.updateProfile(req.user!.id, req.body)
      res.json(successResponse(user, 'Profile updated successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body
      await usersService.changePassword(req.user!.id, currentPassword, newPassword)
      res.json(successResponse(null, 'Password changed successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const usersController = UsersController.getInstance()
