import { z } from 'zod'

export const createFuelRequestSchema = z.object({
  body: z.object({
    vehicleId: z.string().min(1, 'Vehicle ID is required'),
    fuelType: z.enum(['DIESEL', 'PETROL']),
    requestedLitres: z.number().positive('Litres must be positive'),
    purpose: z.string().min(1, 'Purpose is required'),
    kmFrom: z.number().nonnegative('Starting KM must be non-negative'),
    kmTo: z.number().nonnegative('Current KM must be non-negative'),
    lastFuelReceived: z.number().nonnegative('Last fuel received must be non-negative'),
    driverSignature: z.string().min(1, 'Signature is required'),
  }).refine((data) => data.kmTo >= data.kmFrom, {
    message: 'Current KM cannot be less than starting KM',
    path: ['kmTo'],
  }),
})

export const getFuelRequestsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    status: z.string().optional(),
    departmentId: z.string().optional(),
    vehicleId: z.string().optional(),
    search: z.string().optional(),
    fromDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    toDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  }),
})

export const getFuelRequestSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
})

export const updateFuelRequestSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    purpose: z.string().optional(),
    kmTo: z.number().optional(),
    driverSignature: z.string().optional(),
  }),
})

export const cancelFuelRequestSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    reason: z.string().min(1, 'Cancellation reason is required'),
  }),
})
