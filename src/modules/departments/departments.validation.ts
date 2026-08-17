import { z } from 'zod'

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Department name is required'),
    description: z.string().optional(),
    headUserId: z.string().min(1, 'Invalid user ID').optional(),
  }),
})

export const updateDepartmentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid department ID'),
  }),
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    headUserId: z.string().min(1, 'Invalid user ID').optional().nullable(),
  }),
})

export const getDepartmentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid department ID'),
  }),
})

export const deleteDepartmentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invalid department ID'),
  }),
})
