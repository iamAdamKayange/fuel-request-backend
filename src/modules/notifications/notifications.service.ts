import { prisma } from '../../config/database'
import { fcm } from '../../config/firebase'
import { logger } from '../../utils/logger'

export class NotificationService {
  private static instance: NotificationService

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  async sendNotification(data: {
    userId: string
    requestId?: string
    title: string
    message: string
    type: string
  }) {
    // Save notification to database
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        requestId: data.requestId,
        title: data.title,
        message: data.message,
        type: data.type,
      },
    })

    // Send push notification via FCM
    try {
      const deviceTokens = await prisma.deviceToken.findMany({
        where: {
          userId: data.userId,
          isActive: true,
        },
      })

      if (deviceTokens.length > 0) {
        const tokens = deviceTokens.map((dt: { fcmToken: any }) => dt.fcmToken)

        const message = {
          notification: {
            title: data.title,
            body: data.message,
          },
          data: {
            type: data.type,
            notificationId: notification.id,
            requestId: data.requestId || '',
          },
          tokens,
        }

        const response = await fcm.sendEachForMulticast(message as any)

        // Handle failed tokens
        if (response.failureCount > 0) {
          // Fix: Add explicit type for index parameter
          const failedResults = response.responses
            .map((res: any, index: number) => ({ res, index }))
            .filter(({ res }: { res: any }) => !res.success)

          for (const { index } of failedResults) {
            const token = tokens[index]
            if (token) {
              // Deactivate invalid tokens
              await prisma.deviceToken.updateMany({
                where: { fcmToken: token },
                data: { isActive: false },
              })
            }
          }
        }

        logger.info(`Notification sent to ${deviceTokens.length} devices for user ${data.userId}`)
      }
    } catch (error) {
      logger.error('Failed to send push notification:', error)
    }

    return notification
  }

  async registerDeviceToken(userId: string, fcmToken: string, deviceType?: string) {
    // Check if token exists
    const existingToken = await prisma.deviceToken.findUnique({
      where: { fcmToken },
    })

    if (existingToken) {
      // Update existing token
      return prisma.deviceToken.update({
        where: { id: existingToken.id },
        data: {
          userId,
          deviceType,
          isActive: true,
          updatedAt: new Date(),
        },
      })
    }

    // Create new token
    return prisma.deviceToken.create({
      data: {
        userId,
        fcmToken,
        deviceType,
        isActive: true,
      },
    })
  }

  async removeDeviceToken(userId: string, fcmToken: string) {
    const token = await prisma.deviceToken.findUnique({
      where: { fcmToken },
    })

    if (!token) {
      throw new Error('Device token not found')
    }

    if (token.userId !== userId) {
      throw new Error('You can only remove your own device tokens')
    }

    await prisma.deviceToken.delete({
      where: { id: token.id },
    })

    return { success: true }
  }

  async getNotifications(userId: string, page: number = 1, limit: number = 10, isRead?: boolean) {
    const skip = (page - 1) * limit
    const where: any = { userId }

    if (isRead !== undefined) {
      where.isRead = isRead
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          request: {
            select: {
              requestNumber: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ])

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount: await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      throw new Error('Notification not found')
    }

    if (notification.userId !== userId) {
      throw new Error('You can only mark your own notifications as read')
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return { success: true }
  }
}

export const notificationService = NotificationService.getInstance()