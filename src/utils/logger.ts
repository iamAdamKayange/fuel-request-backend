import { env } from '../config/env'

const isDevelopment = env.NODE_ENV === 'development'

export const logger = {
  info: (...args: any[]) => {
    if (isDevelopment) console.log('📘', ...args)
  },
  error: (...args: any[]) => {
    console.error('❌', ...args)
  },
  warn: (...args: any[]) => {
    if (isDevelopment) console.warn('⚠️', ...args)
  },
  debug: (...args: any[]) => {
    if (isDevelopment) console.debug('🔍', ...args)
  },
  success: (...args: any[]) => {
    console.log('✅', ...args)
  },
}

export const logAudit = async (data: {
  userId: string
  action: string
  requestId?: string
  previousStatus?: string
  newStatus?: string
  description: string
  ipAddress?: string
  userAgent?: string
}) => {
  const { prisma } = await import('../config/database')
  
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action as any,
        requestId: data.requestId,
        previousStatus: data.previousStatus as any,
        newStatus: data.newStatus as any,
        description: data.description,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}