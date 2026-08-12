import express from 'express'
import { notificationsController } from './notifications.controller'
import { requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validation'
import {
  registerDeviceTokenSchema,
  markNotificationReadSchema,
  getNotificationsSchema,
} from './notifications.validation'

const router = express.Router()

// All notification routes require authentication
router.use(requireAuth)

/**
 * @route POST /api/notifications/device-token
 * @description Register FCM device token
 * @access Private
 */
router.post(
  '/device-token',
  validate(registerDeviceTokenSchema),
  notificationsController.registerDeviceToken
)

/**
 * @route DELETE /api/notifications/device-token
 * @description Remove FCM device token
 * @access Private
 */
router.delete(
  '/device-token',
  notificationsController.removeDeviceToken
)

/**
 * @route GET /api/notifications
 * @description Get user notifications
 * @access Private
 */
router.get(
  '/',
  validate(getNotificationsSchema),
  notificationsController.getNotifications
)

/**
 * @route PATCH /api/notifications/:id/read
 * @description Mark notification as read
 * @access Private
 */
router.patch(
  '/:id/read',
  validate(markNotificationReadSchema),
  notificationsController.markAsRead
)

/**
 * @route PATCH /api/notifications/read-all
 * @description Mark all notifications as read
 * @access Private
 */
router.patch(
  '/read-all',
  notificationsController.markAllAsRead
)

export default router