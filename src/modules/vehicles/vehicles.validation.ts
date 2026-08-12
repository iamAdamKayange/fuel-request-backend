import { z } from 'zod'

export const createVehicleSchema = z.object({
  body: z.object({
    vehicleNumber: z.string().min(1, 'Vehicle number is required'),
    gpsa: z.string().min(1, 'GPSA is required'),
    fuelType: z.enum(['DIESEL', 'PETROL']),
    departmentId: z.string().uuid('Invalid department ID'),
  }),
})

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid vehicle ID'),
  }),
  body: z.object({
    vehicleNumber: z.string().optional(),
    gpsa: z.string().optional(),
    fuelType: z.enum(['DIESEL', 'PETROL']).optional(),
    departmentId: z.string().uuid('Invalid department ID').optional(),
    isActive: z.boolean().optional(),
  }),
})

export const getVehicleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid vehicle ID'),
  }),
})

export const deleteVehicleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid vehicle ID'),
  }),
})

export const getVehiclesSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    departmentId: z.string().optional(),
    fuelType: z.enum(['DIESEL', 'PETROL']).optional(),
    search: z.string().optional(),
    isActive: z.string().optional().transform(val => val === 'true'),
  }),
})