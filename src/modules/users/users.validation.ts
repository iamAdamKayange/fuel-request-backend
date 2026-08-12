import { z } from 'zod'

export const getUsersSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    role: z.string().optional(),
    departmentId: z.string().optional(),
    search: z.string().optional(),
  }),
})

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    departmentId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  }),
})

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
})