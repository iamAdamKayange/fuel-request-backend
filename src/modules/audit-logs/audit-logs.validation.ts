import { z } from 'zod'

export const getAuditLogsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(Number),
    limit: z.string().optional().transform(Number),
    action: z.string().optional(),
    userId: z.string().optional(),
    requestId: z.string().optional(),
    fromDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
    toDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  }),
})