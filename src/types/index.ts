import { Request } from 'express'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
    employeeNumber: string
    departmentId?: string
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  error?: string | any
}

export interface PaginationParams {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationParams
}

export type Role = 
  | 'ADMIN'
  | 'DRIVER'
  | 'HEAD_OF_DEPARTMENT'
  | 'TRANSPORT_OFFICER'
  | 'ADA_DAHRM'
  | 'PROCUREMENT'

export type FuelType = 'DIESEL' | 'PETROL'

export type RequestStatus =
  | 'PENDING_HEAD_APPROVAL'
  | 'HEAD_APPROVED'
  | 'HEAD_REJECTED'
  | 'PENDING_TRANSPORT_APPROVAL'
  | 'TRANSPORT_APPROVED'
  | 'TRANSPORT_REJECTED'
  | 'PENDING_DA_APPROVAL'
  | 'ADA_APPROVED'
  | 'ADA_REJECTED'
  | 'PENDING_FUEL_ISSUANCE'
  | 'COMPLETED'
  | 'CANCELLED'

export type AuditAction =
  | 'USER_REGISTERED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  | 'USER_ROLE_CHANGED'
  | 'DRIVER_SUBMITTED_REQUEST'
  | 'HEAD_APPROVED_REQUEST'
  | 'HEAD_REJECTED_REQUEST'
  | 'TRANSPORT_APPROVED_REQUEST'
  | 'TRANSPORT_REJECTED_REQUEST'
  | 'ADA_APPROVED_REQUEST'
  | 'ADA_REJECTED_REQUEST'
  | 'FUEL_ISSUED'
  | 'REQUEST_CANCELLED'

export interface User {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  title?: string | null
  email: string
  phone?: string
  role: Role
  departmentId?: string
  isActive: boolean
  lastLogin?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Department {
  id: string
  name: string
  description?: string
  headUserId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Vehicle {
  id: string
  vehicleNumber: string
  gpsa: string
  fuelType: FuelType
  departmentId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FuelRequest {
  id: string
  requestNumber: string
  driverId: string
  departmentId: string
  vehicleId: string
  fuelType: FuelType
  requestedLitres: number
  approvedLitres?: number
  issuedLitres?: number
  gpsa: string
  purpose: string
  kmFrom: number
  kmTo: number
  kmUsed: number
  lastFuelReceived: number
  requestDate: Date
  status: RequestStatus
  driverSignature: string
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
}

export interface Approval {
  id: string
  requestId: string
  approverId: string
  stage: string
  approved: boolean
  reason?: string
  litresApproved?: number
  logbookNumber?: string
  logbookTo?: string
  designation: string
  signature: string
  approvedAt: Date
}

export interface FuelIssuance {
  id: string
  requestId: string
  issuedBy: string
  fuelType: FuelType
  litresIssued: number
  tokenNumber: string
  designation: string
  signature: string
  issuedAt: Date
}

export interface Notification {
  id: string
  userId: string
  requestId?: string
  title: string
  message: string
  type: string
  isRead: boolean
  readAt?: Date
  createdAt: Date
}

export interface AuditLog {
  id: string
  userId: string
  action: AuditAction
  requestId?: string
  previousStatus?: RequestStatus
  newStatus?: RequestStatus
  description: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}
