import { Response } from 'express'
import { notificationService } from './notifications.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class NotificationsController {
  private static instance: NotificationsController

  static getInstance(): NotificationsController {
    if (!NotificationsController.instance) {
      NotificationsController.instance = new NotificationsController()
    }
    return NotificationsController.instance
  }

  async registerDeviceToken(req: AuthRequest, res: Response) {
    try {
      const { fcmToken, deviceType } = req.body
      const token = await notificationService.registerDeviceToken(
        req.user!.id,
        fcmToken,
        deviceType
      )
      res.json(successResponse(token, 'Device token registered successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async removeDeviceToken(req: AuthRequest, res: Response) {
    try {
      const { fcmToken } = req.body
      await notificationService.removeDeviceToken(req.user!.id, fcmToken)
      res.json(successResponse(null, 'Device token removed successfully'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async getNotifications(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined

      const result = await notificationService.getNotifications(
        req.user!.id,
        page,
        limit,
        isRead
      )
      res.json({
        success: true,
        data: result.notifications,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        unreadCount: result.unreadCount,
      })
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      // Fix: Ensure id is string
      const notificationId = Array.isArray(id) ? id[0] : id
      const notification = await notificationService.markAsRead(req.user!.id, notificationId)
      res.json(successResponse(notification, 'Notification marked as read'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }

  async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      await notificationService.markAllAsRead(req.user!.id)
      res.json(successResponse(null, 'All notifications marked as read'))
    } catch (error: any) {
      res.status(400).json(errorResponse(error.message))
    }
  }
}

export const notificationsController = NotificationsController.getInstance()