import { z } from 'zod'

export const registerUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    title: z.string().min(1, 'Title is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    role: z.enum(['DRIVER', 'HEAD_OF_DEPARTMENT', 'TRANSPORT_OFFICER', 'ADA_DAHRM', 'PROCUREMENT']),
    departmentId: z.string().min(1, 'Department is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
})

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid user ID'),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
})

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid user ID'),
  }),
})

export const updateAdminUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid user ID'),
  }),
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional().nullable(),
    role: z.enum(['ADMIN', 'DRIVER', 'HEAD_OF_DEPARTMENT', 'TRANSPORT_OFFICER', 'ADA_DAHRM', 'PROCUREMENT']).optional(),
    departmentId: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  }),
})

export const deleteAdminUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid user ID'),
  }),
})

export const adminUsersSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    role: z.string().optional(),
    departmentId: z.string().optional(),
    search: z.string().optional(),
    isActive: z.string().optional().transform(val => val === 'true'),
  }),
})
