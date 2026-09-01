import { z } from 'zod'

// No specific validation needed for GET requests with params
// The ID validation is handled by the routing layer

export const documentIdSchema = z.object({
  id: z.string().min(1, 'Request ID is required'),
})

export type DocumentIdInput = z.infer<typeof documentIdSchema>
