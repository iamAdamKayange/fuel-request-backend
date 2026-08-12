import { z } from 'zod'

export const issueFuelSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    fuelType: z.enum(['DIESEL', 'PETROL']),
    litresIssued: z.number().positive('Litres must be positive'),
    tokenNumber: z.string().min(1, 'Token number is required'),
    designation: z.string().min(1, 'Designation is required'),
    signature: z.string().min(1, 'Signature is required'),
  }),
})
