import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10)
}

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword)
}

export const generateRequestNumber = (): string => {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `FUEL-${year}-${random}`
}

export const generateTokenNumber = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const calculateKmUsed = (kmFrom: number, kmTo: number): number => {
  if (kmTo < kmFrom) {
    throw new Error('Current KM cannot be less than starting KM')
  }
  return kmTo - kmFrom
}

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

export const formatDateTime = (date: Date): string => {
  return date.toISOString()
}

export const sanitizeUser = (user: any) => {
  const { password, ...sanitized } = user
  return sanitized
}

export const generateEmployeeNumber = (): string => {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `EMP-${year}-${random}`
}

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET)
  } catch (error) {
    return null
  }
}