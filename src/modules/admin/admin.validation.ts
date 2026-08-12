import { z } from 'zod'

export const registerUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    role: z.enum(['DRIVER', 'HEAD_OF_DEPARTMENT', 'TRANSPORT_OFFICER', 'ADA_DAHRM', 'PROCUREMENT']),
    departmentId: z.string().uuid('Invalid department ID'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
})

export const updateUserStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
  body: z.object({
    isActive: z.boolean(),
  }),
})

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
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