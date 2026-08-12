import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { errorResponse } from '../utils/response'

export const requireRole = (roles: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(errorResponse('Authentication required'))
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles]
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(
        errorResponse('Access denied. Insufficient permissions')
      )
    }

    return next()
  }
}

export const isAdmin = requireRole('ADMIN')
export const isDriver = requireRole('DRIVER')
export const isHeadOfDepartment = requireRole('HEAD_OF_DEPARTMENT')
export const isTransportOfficer = requireRole('TRANSPORT_OFFICER')
export const isAdaDahrm = requireRole('ADA_DAHRM')
export const isProcurement = requireRole('PROCUREMENT')
