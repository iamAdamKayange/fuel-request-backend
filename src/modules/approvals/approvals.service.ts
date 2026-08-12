import { prisma } from '../../config/database'
import { logAudit } from '../../utils/logger'
import { notificationService } from '../notifications/notifications.service'

export class ApprovalsService {
  private static instance: ApprovalsService

  static getInstance(): ApprovalsService {
    if (!ApprovalsService.instance) {
      ApprovalsService.instance = new ApprovalsService()
    }
    return ApprovalsService.instance
  }

  async headApproval(
    requestId: string,
    approverId: string,
    data: {
      approved: boolean
      reason?: string
      designation: string
      signature: string
    }
  ) {
    // Get request
    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: true,
        department: true,
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check status
    if (request.status !== 'PENDING_HEAD_APPROVAL') {
      throw new Error('Request is not pending head approval')
    }

    // Check if approver is head of department
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
    })

    if (!approver || approver.role !== 'HEAD_OF_DEPARTMENT') {
      throw new Error('You are not authorized to perform this action')
    }

    if (approver.departmentId !== request.departmentId) {
      throw new Error('You can only approve requests from your department')
    }

    // Create approval record
    const approval = await prisma.approval.create({
      data: {
        requestId,
        approverId,
        stage: 'HEAD',
        approved: data.approved,
        reason: data.reason,
        designation: data.designation,
        signature: data.signature || approver.email,
      },
    })

    const newStatus = data.approved ? 'PENDING_TRANSPORT_APPROVAL' : 'HEAD_REJECTED'

    const updatedRequest = await prisma.fuelRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus as any,
        rejectionReason: data.approved ? undefined : data.reason,
      },
      include: {
        driver: true,
        department: true,
      },
    })

    // Log audit
    await logAudit({
      userId: approverId,
      action: data.approved ? 'HEAD_APPROVED_REQUEST' : 'HEAD_REJECTED_REQUEST' as any,
      requestId,
      previousStatus: request.status,
      newStatus: newStatus as any,
      description: `Head ${approver.email} ${data.approved ? 'approved' : 'rejected'} request ${request.requestNumber}`,
    })

    // Send notifications
    if (data.approved) {
      // Notify Transport Officer
      const transportOfficers = await prisma.user.findMany({
        where: {
          role: 'TRANSPORT_OFFICER',
          isActive: true,
        },
      })

      for (const officer of transportOfficers) {
        await notificationService.sendNotification({
          userId: officer.id,
          requestId,
          title: 'Fuel Request Approved by Head',
          message: `Request ${request.requestNumber} has been approved by Head of Department and requires your review`,
          type: 'REQUEST_APPROVED',
        })
      }
    } else {
      // Notify Driver
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Rejected',
        message: `Your request ${request.requestNumber} has been rejected by Head of Department. Reason: ${data.reason}`,
        type: 'REQUEST_REJECTED',
      })
    }

    return {
      approval,
      request: updatedRequest,
    }
  }

  async transportApproval(
    requestId: string,
    approverId: string,
    data: {
      approved: boolean
      litresApproved?: number
      reason?: string
      logbookNumber?: string
      logbookTo?: string
      designation: string
      signature: string
    }
  ) {
    // Get request
    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: true,
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check status
    if (request.status !== 'PENDING_TRANSPORT_APPROVAL') {
      throw new Error('Request is not ready for transport approval')
    }

    // Check if approver is transport officer
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
    })

    if (!approver || approver.role !== 'TRANSPORT_OFFICER') {
      throw new Error('You are not authorized to perform this action')
    }

    // Validate approved litres
    if (data.approved && data.litresApproved) {
      if (data.litresApproved > request.requestedLitres) {
        throw new Error('Approved litres cannot exceed requested litres')
      }
      if (data.litresApproved <= 0) {
        throw new Error('Approved litres must be greater than 0')
      }
    }

    // Create approval record
    const approval = await prisma.approval.create({
      data: {
        requestId,
        approverId,
        stage: 'TRANSPORT',
        approved: data.approved,
        reason: data.reason,
        litresApproved: data.litresApproved,
        logbookNumber: data.logbookNumber,
        logbookTo: data.logbookTo,
        designation: data.designation,
        signature: data.signature || approver.email,
      },
    })

    const newStatus = data.approved ? 'PENDING_DA_APPROVAL' : 'TRANSPORT_REJECTED'

    const updateData: any = {
      status: newStatus as any,
      rejectionReason: data.approved ? undefined : data.reason,
    }

    if (data.approved && data.litresApproved) {
      updateData.approvedLitres = data.litresApproved
    }

    const updatedRequest = await prisma.fuelRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        driver: true,
      },
    })

    // Log audit
    await logAudit({
      userId: approverId,
      action: data.approved ? 'TRANSPORT_APPROVED_REQUEST' : 'TRANSPORT_REJECTED_REQUEST' as any,
      requestId,
      previousStatus: request.status,
      newStatus: newStatus as any,
      description: `Transport Officer ${approver.email} ${data.approved ? 'approved' : 'rejected'} request ${request.requestNumber}`,
    })

    // Send notifications
    if (data.approved) {
      // Notify ADA/DAHRM
      const adaOfficers = await prisma.user.findMany({
        where: {
          role: 'ADA_DAHRM',
          isActive: true,
        },
      })

      for (const officer of adaOfficers) {
        await notificationService.sendNotification({
          userId: officer.id,
          requestId,
          title: 'Fuel Request Approved by Transport',
          message: `Request ${request.requestNumber} has been approved by Transport Officer and requires your review`,
          type: 'REQUEST_APPROVED',
        })
      }
    } else {
      // Notify Driver
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Rejected',
        message: `Your request ${request.requestNumber} has been rejected by Transport Officer. Reason: ${data.reason}`,
        type: 'REQUEST_REJECTED',
      })
    }

    return {
      approval,
      request: updatedRequest,
    }
  }

  async adaApproval(
    requestId: string,
    approverId: string,
    data: {
      approved: boolean
      litresApproved?: number
      reason?: string
      designation: string
      signature: string
    }
  ) {
    // Get request
    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: true,
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check status
    if (request.status !== 'PENDING_DA_APPROVAL') {
      throw new Error('Request is not ready for ADA approval')
    }

    // Check if approver is ADA/DAHRM
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
    })

    if (!approver || approver.role !== 'ADA_DAHRM') {
      throw new Error('You are not authorized to perform this action')
    }

    // Validate approved litres
    const maxApproved = request.approvedLitres || request.requestedLitres
    if (data.approved && data.litresApproved) {
      if (data.litresApproved > maxApproved) {
        throw new Error(`Approved litres cannot exceed ${maxApproved} litres`)
      }
      if (data.litresApproved <= 0) {
        throw new Error('Approved litres must be greater than 0')
      }
    }

    // Create approval record
    const approval = await prisma.approval.create({
      data: {
        requestId,
        approverId,
        stage: 'ADA',
        approved: data.approved,
        reason: data.reason,
        litresApproved: data.litresApproved,
        designation: data.designation,
        signature: data.signature || approver.email,
      },
    })

    const newStatus = data.approved ? 'PENDING_FUEL_ISSUANCE' : 'ADA_REJECTED'

    const updateData: any = {
      status: newStatus as any,
      rejectionReason: data.approved ? undefined : data.reason,
    }

    if (data.approved && data.litresApproved) {
      updateData.approvedLitres = data.litresApproved
    }

    const updatedRequest = await prisma.fuelRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        driver: true,
      },
    })

    // Log audit
    await logAudit({
      userId: approverId,
      action: data.approved ? 'ADA_APPROVED_REQUEST' : 'ADA_REJECTED_REQUEST' as any,
      requestId,
      previousStatus: request.status,
      newStatus: newStatus as any,
      description: `ADA/DAHRM ${approver.email} ${data.approved ? 'approved' : 'rejected'} request ${request.requestNumber}`,
    })

    // Send notifications
    if (data.approved) {
      // Notify Procurement
      const procurementOfficers = await prisma.user.findMany({
        where: {
          role: 'PROCUREMENT',
          isActive: true,
        },
      })

      for (const officer of procurementOfficers) {
        await notificationService.sendNotification({
          userId: officer.id,
          requestId,
          title: 'Fuel Request Approved by ADA',
          message: `Request ${request.requestNumber} has been approved by ADA/DAHRM and is ready for fuel issuance`,
          type: 'REQUEST_APPROVED',
        })
      }
    } else {
      // Notify Driver
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Rejected',
        message: `Your request ${request.requestNumber} has been rejected by ADA/DAHRM. Reason: ${data.reason}`,
        type: 'REQUEST_REJECTED',
      })
    }

    return {
      approval,
      request: updatedRequest,
    }
  }
}

export const approvalsService = ApprovalsService.getInstance()
