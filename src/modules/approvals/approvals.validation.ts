import { z } from 'zod'

export const headApprovalSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
    designation: z.string().min(1, 'Designation is required'),
    signature: z.string().optional(),
  }).refine((data) => {
    if (!data.approved && !data.reason) {
      return false
    }
    return true
  }, {
    message: 'Reason is required when rejecting',
    path: ['reason'],
  }),
})

export const transportApprovalSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    approved: z.boolean(),
    litresApproved: z.number().positive('Litres must be positive').optional(),
    reason: z.string().optional(),
    logbookNumber: z.string().optional(),
    logbookTo: z.string().optional(),
    designation: z.string().min(1, 'Designation is required'),
    signature: z.string().optional(),
  }).refine((data) => {
    if (data.approved && !data.litresApproved) {
      return false
    }
    return true
  }, {
    message: 'Litres approved is required when approving',
    path: ['litresApproved'],
  }).refine((data) => {
    if (data.approved && !data.logbookNumber) {
      return false
    }
    return true
  }, {
    message: 'Logbook number is required when approving',
    path: ['logbookNumber'],
  }).refine((data) => {
    if (data.approved && !data.logbookTo) {
      return false
    }
    return true
  }, {
    message: 'Logbook To is required when approving',
    path: ['logbookTo'],
  }).refine((data) => {
    if (!data.approved && !data.reason) {
      return false
    }
    return true
  }, {
    message: 'Reason is required when rejecting',
    path: ['reason'],
  }),
})

export const adaApprovalSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Request ID is required'),
  }),
  body: z.object({
    approved: z.boolean(),
    litresApproved: z.number().positive('Litres must be positive').optional(),
    reason: z.string().optional(),
    designation: z.string().min(1, 'Designation is required'),
    signature: z.string().optional(),
  }).refine((data) => {
    if (data.approved && !data.litresApproved) {
      return false
    }
    return true
  }, {
    message: 'Litres approved is required when approving',
    path: ['litresApproved'],
  }).refine((data) => {
    if (!data.approved && !data.reason) {
      return false
    }
    return true
  }, {
    message: 'Reason is required when rejecting',
    path: ['reason'],
  }),
})
