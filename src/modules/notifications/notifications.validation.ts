import { z } from 'zod'

export const registerDeviceTokenSchema = z.object({
  body: z.object({
    fcmToken: z.string().min(1, 'FCM token is required'),
    deviceType: z.string().optional(),
  }),
})

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid notification ID'),
  }),
})

export const deleteNotificationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid notification ID'),
  }),
})

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    isRead: z.string().optional().transform(val => val === 'true'),
  }),
})
