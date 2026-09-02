import { prisma } from '../../config/database'
import { logAudit } from '../../utils/logger'
import { notificationService } from '../notifications/notifications.service'
import { isEmailConfigured, sendFuelRequestNotification, sendApprovalNotification } from '../../utils/email'
import { isSMSConfigured, sendFuelRequestSMS, sendApprovalSMS } from '../../utils/sms'

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
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { approvedAt: 'asc' },
        },
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
      // Notify Transport Officer (NEXT APPROVER - ACTION_REQUIRED)
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
          title: 'Fuel Request Pending Transport Approval',
          message: `Request ${request.requestNumber} from ${request.driver.firstName} ${request.driver.lastName} requires your approval.`,
          type: 'ACTION_REQUIRED',
        })

        // Send email to Transport Officer if configured
        if (isEmailConfigured()) {
          const requesterName = `${request.driver.firstName} ${request.driver.lastName}`
          await sendApprovalNotification(
            officer.email,
            `${officer.firstName} ${officer.lastName}`,
            request.requestNumber,
            requesterName,
            'Transport Officer'
          )
        }

        // Send SMS to Transport Officer if configured
        if (isSMSConfigured() && officer.phone) {
          const requesterName = `${request.driver.firstName} ${request.driver.lastName}`
          await sendApprovalSMS(
            officer.phone,
            request.requestNumber,
            requesterName,
            'Transport Officer'
          )
        }
      }

      // Send STATUS_UPDATE to Head (current approver)
      await notificationService.sendNotification({
        userId: approverId,
        requestId,
        title: 'Request Approved - Sent to Transport',
        message: `You approved request ${request.requestNumber}. It has been sent to Transport Officer for review.`,
        type: 'STATUS_UPDATE',
      })
    } else {
      // Notify Driver (applicant) with rejection - STATUS_UPDATE
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Rejected',
        message: `Your request ${request.requestNumber} has been rejected by Head of Department. Reason: ${data.reason}`,
        type: 'STATUS_UPDATE',
      })

      // Send email to driver if configured
      if (isEmailConfigured()) {
        await sendFuelRequestNotification(
          request.driver.email,
          `${request.driver.firstName} ${request.driver.lastName}`,
          request.requestNumber,
          'HEAD_REJECTED',
          `rejected by Head of Department. Reason: ${data.reason}`
        )
      }

      // Send SMS to driver if configured
      if (isSMSConfigured() && request.driver.phone) {
        await sendFuelRequestSMS(
          request.driver.phone,
          request.requestNumber,
          'HEAD_REJECTED',
          `rejected by Head of Department. Reason: ${data.reason}`
        )
      }

      // Notify previous approvers (Transport and ADA if they had approved earlier)
      const previousApprovers = request.approvals?.filter((a: any) => a.approved && a.stage !== 'HEAD') || []
      for (const prevApproval of previousApprovers) {
        await notificationService.sendNotification({
          userId: prevApproval.approverId,
          requestId,
          title: 'Request Rejected by Head',
          message: `Request ${request.requestNumber} that you previously approved has been rejected by Head of Department. Reason: ${data.reason}`,
          type: 'STATUS_UPDATE',
        })
      }
    }

    await notificationService.sendToAdmins({
      requestId,
      title: data.approved ? 'Head Approved Request' : 'Head Rejected Request',
      message: `Request ${request.requestNumber} for ${request.department.name} was ${data.approved ? 'approved' : 'rejected'} by ${approver.email}`,
      type: 'ADMIN_REQUEST_UPDATE',
    })

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
        department: true,
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { approvedAt: 'asc' },
        },
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
        department: true,
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
      // Notify ADA (NEXT APPROVER - ACTION_REQUIRED)
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
          title: 'Fuel Request Pending ADA Approval',
          message: `Request ${request.requestNumber} from ${request.driver.firstName} ${request.driver.lastName} requires your final approval.`,
          type: 'ACTION_REQUIRED',
        })

        // Send email to ADA if configured
        if (isEmailConfigured()) {
          const requesterName = `${request.driver.firstName} ${request.driver.lastName}`
          await sendApprovalNotification(
            officer.email,
            `${officer.firstName} ${officer.lastName}`,
            request.requestNumber,
            requesterName,
            'ADA/DAHRM (Final Approver)'
          )
        }

        // Send SMS to ADA if configured
        if (isSMSConfigured() && officer.phone) {
          const requesterName = `${request.driver.firstName} ${request.driver.lastName}`
          await sendApprovalSMS(
            officer.phone,
            request.requestNumber,
            requesterName,
            'ADA/DAHRM (Final Approver)'
          )
        }
      }

      // Send STATUS_UPDATE to Transport Officer (current approver)
      await notificationService.sendNotification({
        userId: approverId,
        requestId,
        title: 'Request Approved - Sent to ADA',
        message: `You approved request ${request.requestNumber}. It has been sent to ADA for final approval.`,
        type: 'STATUS_UPDATE',
      })
    } else {
      // Notify Driver (applicant) with rejection - STATUS_UPDATE
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Rejected',
        message: `Your request ${request.requestNumber} has been rejected by Transport Officer. Reason: ${data.reason}`,
        type: 'STATUS_UPDATE',
      })

      // Send email to driver if configured
      if (isEmailConfigured()) {
        await sendFuelRequestNotification(
          request.driver.email,
          `${request.driver.firstName} ${request.driver.lastName}`,
          request.requestNumber,
          'TRANSPORT_REJECTED',
          `rejected by Transport Officer. Reason: ${data.reason}`
        )
      }

      // Send SMS to driver if configured
      if (isSMSConfigured() && request.driver.phone) {
        await sendFuelRequestSMS(
          request.driver.phone,
          request.requestNumber,
          'TRANSPORT_REJECTED',
          `rejected by Transport Officer. Reason: ${data.reason}`
        )
      }

      // Notify previous approvers (Head and ADA if they had approved earlier)
      const previousApprovers = request.approvals?.filter((a: any) => a.approved && a.stage !== 'TRANSPORT') || []
      for (const prevApproval of previousApprovers) {
        await notificationService.sendNotification({
          userId: prevApproval.approverId,
          requestId,
          title: 'Request Rejected by Transport',
          message: `Request ${request.requestNumber} that you previously approved has been rejected by Transport Officer. Reason: ${data.reason}`,
          type: 'STATUS_UPDATE',
        })
      }
    }

    await notificationService.sendToAdmins({
      requestId,
      title: data.approved ? 'Transport Approved Request' : 'Transport Rejected Request',
      message: `Request ${request.requestNumber} for ${request.department.name} was ${data.approved ? 'approved' : 'rejected'} by ${approver.email}`,
      type: 'ADMIN_REQUEST_UPDATE',
    })

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
        department: true,
        approvals: {
          include: {
            approver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { approvedAt: 'asc' },
        },
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Check status
    if (request.status !== 'PENDING_DA_APPROVAL') {
      throw new Error('Request is not ready for ADA approval')
    }

    // Check if approver is ADA
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

    const newStatus = data.approved ? 'FULLY_APPROVED' : 'ADA_REJECTED'

    const updateData: any = {
      status: newStatus as any,
      rejectionReason: data.approved ? undefined : data.reason,
    }

    if (data.approved && data.litresApproved) {
      updateData.approvedLitres = data.litresApproved
    }

    // Set final approver info when fully approved
    if (data.approved) {
      updateData.finalApproverId = approverId
      updateData.finalApprovedAt = new Date()
    }

    const updatedRequest = await prisma.fuelRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        driver: true,
        department: true,
      },
    })

    // Log audit
    await logAudit({
      userId: approverId,
      action: data.approved ? 'FINAL_APPROVAL_COMPLETED' : 'ADA_REJECTED_REQUEST' as any,
      requestId,
      previousStatus: request.status,
      newStatus: newStatus as any,
      description: `ADA ${approver.email} ${data.approved ? 'completed final approval' : 'rejected'} request ${request.requestNumber}`,
    })

    // Send notifications
    if (data.approved) {
      // FINAL APPROVAL - Notify Driver (applicant) that request is FULLY_APPROVED - STATUS_UPDATE
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Fully Approved',
        message: `Your request ${request.requestNumber} has been fully approved by ${approver.firstName} ${approver.lastName} (ADA/DAHRM). You can now collect the approved documents from the final approver.`,
        type: 'STATUS_UPDATE',
      })

      // Send email to driver if configured
      if (isEmailConfigured()) {
        await sendFuelRequestNotification(
          request.driver.email,
          `${request.driver.firstName} ${request.driver.lastName}`,
          request.requestNumber,
          'FULLY_APPROVED',
          `fully approved by ${approver.firstName} ${approver.lastName} (ADA/DAHRM). Ready for document collection.`
        )
      }

      // Send SMS to driver if configured
      if (isSMSConfigured() && request.driver.phone) {
        await sendFuelRequestSMS(
          request.driver.phone,
          request.requestNumber,
          'FULLY_APPROVED',
          `fully approved by ${approver.firstName} ${approver.lastName} (ADA/DAHRM). Ready for document collection.`
        )
      }

      // Send STATUS_UPDATE to ADA (final approver) confirming approval
      await notificationService.sendNotification({
        userId: approverId,
        requestId,
        title: 'Final Approval Completed',
        message: `You have completed final approval for request ${request.requestNumber}. The request is now FULLY_APPROVED and documents are ready for printing.`,
        type: 'STATUS_UPDATE',
      })
    } else {
      // Notify Driver (applicant) with rejection - STATUS_UPDATE
      await notificationService.sendNotification({
        userId: request.driverId,
        requestId,
        title: 'Fuel Request Rejected',
        message: `Your request ${request.requestNumber} has been rejected by ${approver.firstName} ${approver.lastName} (ADA/DAHRM). Reason: ${data.reason}`,
        type: 'STATUS_UPDATE',
      })

      // Send email to driver if configured
      if (isEmailConfigured()) {
        await sendFuelRequestNotification(
          request.driver.email,
          `${request.driver.firstName} ${request.driver.lastName}`,
          request.requestNumber,
          'ADA_REJECTED',
          `rejected by ${approver.firstName} ${approver.lastName} (ADA/DAHRM). Reason: ${data.reason}`
        )
      }

      // Send SMS to driver if configured
      if (isSMSConfigured() && request.driver.phone) {
        await sendFuelRequestSMS(
          request.driver.phone,
          request.requestNumber,
          'ADA_REJECTED',
          `rejected by ${approver.firstName} ${approver.lastName} (ADA/DRHM). Reason: ${data.reason}`
        )
      }

      // Notify previous approvers (Head and Transport if they had approved earlier)
      const previousApprovers = request.approvals?.filter((a: any) => a.approved && a.stage !== 'ADA') || []
      for (const prevApproval of previousApprovers) {
        await notificationService.sendNotification({
          userId: prevApproval.approverId,
          requestId,
          title: 'Request Rejected by ADA',
          message: `Request ${request.requestNumber} that you previously approved has been rejected by ADA/DAHRM. Reason: ${data.reason}`,
          type: 'STATUS_UPDATE',
        })
      }

      // Send STATUS_UPDATE to ADA (current approver) confirming rejection
      await notificationService.sendNotification({
        userId: approverId,
        requestId,
        title: 'Request Rejected',
        message: `You have rejected request ${request.requestNumber}. The applicant has been notified.`,
        type: 'STATUS_UPDATE',
      })
    }

    await notificationService.sendToAdmins({
      requestId,
      title: data.approved ? 'Final Approval Completed' : 'ADA Rejected Request',
      message: `Request ${request.requestNumber} for ${request.department.name} was ${data.approved ? 'fully approved' : 'rejected'} by ${approver.email}`,
      type: 'ADMIN_REQUEST_UPDATE',
    })

    return {
      approval,
      request: updatedRequest,
    }
  }
}

export const approvalsService = ApprovalsService.getInstance()
