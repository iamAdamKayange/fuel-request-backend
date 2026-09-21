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
      return res.json(successResponse(result, 'Login successful'))
    } catch (error: any) {
      // Only expected authentication failures should be returned as 401.
      // Do not disguise a Prisma/database failure as invalid credentials: it
      // prevents production logs from identifying the real operational issue.
      const expectedAuthFailure = [
        'Invalid credentials',
        'Account is deactivated',
        'Account is locked',
      ].some(message => error.message?.startsWith(message))

      if (expectedAuthFailure) {
        return res.status(401).json(errorResponse(error.message))
      }

      console.error('[Auth] Login failed unexpectedly', {
        name: error.name,
        code: error.code,
        message: error.message,
        meta: error.meta,
      })
      return res.status(500).json(errorResponse('Unable to complete login. Please try again later.'))
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body
      const result = await authService.refreshToken(refreshToken)
      return res.json(successResponse(result, 'Token refreshed successfully'))
    } catch (error: any) {
      if (error.message === 'Invalid refresh token' || error.message === 'User not found or inactive') {
        return res.status(401).json(errorResponse(error.message))
      }

      console.error('[Auth] Token refresh failed unexpectedly', {
        name: error.name,
        code: error.code,
        message: error.message,
        meta: error.meta,
      })
      return res.status(500).json(errorResponse('Unable to refresh session. Please login again.'))
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
