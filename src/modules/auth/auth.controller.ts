import { Request, Response } from 'express'
import { authService } from './auth.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class AuthController {
  private static instance: AuthController

  static getInstance(): AuthController {
    if (!AuthController.instance) {
      AuthController.instance = new AuthController()
    }
    return AuthController.instance
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body
      const result = await authService.login(email, password, req)
      
      // Debug: Log login response
      console.log('[AuthController] Login successful:', {
        hasAccessToken: !!result.accessToken,
        accessTokenLength: result.accessToken?.length,
        accessTokenPrefix: result.accessToken?.substring(0, 10) + '...',
        hasRefreshToken: !!result.refreshToken,
        userRole: result.user?.role,
        userId: result.user?.id
      })
      
      res.json(successResponse(result, 'Login successful'))
    } catch (error: any) {
      console.log('[AuthController] Login failed:', {
        error: error.message
      })
      res.status(401).json(errorResponse(error.message))
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body
      const result = await authService.refreshToken(refreshToken)
      res.json(successResponse(result, 'Token refreshed successfully'))
    } catch (error: any) {
      res.status(401).json(errorResponse(error.message))
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body
      await authService.logout(refreshToken)
      res.json(successResponse(null, 'Logout successful'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getMe(req: AuthRequest, res: Response) {
    try {
      const user = await authService.getMe(req.user!.id)
      res.json(successResponse(user, 'User details retrieved'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const authController = AuthController.getInstance()