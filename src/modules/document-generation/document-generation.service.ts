import { prisma } from '../../config/database'
import { logAudit } from '../../utils/logger'

export class DocumentGenerationService {
  private static instance: DocumentGenerationService

  static getInstance(): DocumentGenerationService {
    if (!DocumentGenerationService.instance) {
      DocumentGenerationService.instance = new DocumentGenerationService()
    }
    return DocumentGenerationService.instance
  }

  /**
   * Check if user is authorized to print documents
   * Only the final approver can print documents
   */
  async canPrintDocuments(requestId: string, userId: string): Promise<{ canPrint: boolean; reason?: string }> {
    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      select: {
        status: true,
        finalApproverId: true,
      },
    })

    if (!request) {
      return { canPrint: false, reason: 'Fuel request not found' }
    }

    // Can only print if request is fully approved
    if (request.status !== 'FULLY_APPROVED') {
      return { canPrint: false, reason: `Request is not fully approved (current status: ${request.status})` }
    }

    // Final approver must be set
    if (!request.finalApproverId) {
      return { canPrint: false, reason: 'Final approver information is missing' }
    }

    // Only final approver can print
    if (request.finalApproverId !== userId) {
      return { canPrint: false, reason: 'Only the user who completed the final approval can print this document' }
    }

    return { canPrint: true }
  }

  /**
   * Generate Fuel Permit document data
   */
  async generateFuelPermitData(requestId: string, userId: string) {
    // Check authorization
    const authResult = await this.canPrintDocuments(requestId, userId)
    if (!authResult.canPrint) {
      const error = new Error(authResult.reason || 'You are not authorized to print this document')
      error.name = 'AUTHORIZATION_ERROR'
      throw error
    }

    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            email: true,
            phone: true,
          },
        },
        department: true,
        vehicle: true,
        finalApprover: {
          select: {
            firstName: true,
            lastName: true,
            title: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                firstName: true,
                lastName: true,
                title: true,
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

    // Log the print action
    await logAudit({
      userId,
      action: 'FUEL_PERMIT_PRINTED' as any,
      requestId,
      description: `Fuel Permit for request ${request.requestNumber} was printed by ${userId}`,
    })

    return {
      documentType: 'FUEL_PERMIT',
      requestNumber: request.requestNumber,
      issuedDate: request.finalApprovedAt?.toISOString() || new Date().toISOString(),
      
      // Driver information
      driver: {
        name: `${request.driver.firstName} ${request.driver.lastName}`,
        employeeNumber: request.driver.employeeNumber,
        email: request.driver.email,
        phone: request.driver.phone,
      },
      
      // Department information
      department: {
        name: request.department.name,
      },
      
      // Vehicle information
      vehicle: {
        number: request.vehicle.vehicleNumber,
        gpsa: request.vehicle.gpsa,
        fuelType: request.vehicle.fuelType,
      },
      
      // Fuel details
      fuel: {
        type: request.fuelType,
        requestedLitres: request.requestedLitres,
        approvedLitres: request.approvedLitres || request.requestedLitres,
      },
      
      // Journey details
      journey: {
        purpose: request.purpose,
        kmFrom: request.kmFrom,
        kmTo: request.kmTo,
        kmUsed: request.kmUsed,
        lastFuelReceived: request.lastFuelReceived,
      },
      
      // Approval chain
      approvals: request.approvals.map(approval => ({
        stage: approval.stage,
        approver: `${approval.approver.firstName} ${approval.approver.lastName}`,
        designation: approval.approver.title || approval.stage,
        approvedAt: approval.approvedAt.toISOString(),
        litresApproved: approval.litresApproved,
        signature: approval.signature,
      })),
      
      // Final approver
      finalApprover: request.finalApprover ? {
        name: `${request.finalApprover.firstName} ${request.finalApprover.lastName}`,
        designation: request.finalApprover.title || 'ADA',
      } : null,
    }
  }

  /**
   * Generate Fuel Statement document data
   */
  async generateFuelStatementData(requestId: string, userId: string) {
    // Check authorization
    const authResult = await this.canPrintDocuments(requestId, userId)
    if (!authResult.canPrint) {
      const error = new Error(authResult.reason || 'You are not authorized to print this document')
      error.name = 'AUTHORIZATION_ERROR'
      throw error
    }

    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      include: {
        driver: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            email: true,
          },
        },
        department: true,
        vehicle: true,
        finalApprover: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        fuelIssuance: true,
      },
    })

    if (!request) {
      throw new Error('Fuel request not found')
    }

    // Log the print action
    await logAudit({
      userId,
      action: 'FUEL_STATEMENT_PRINTED' as any,
      requestId,
      description: `Fuel Statement for request ${request.requestNumber} was printed by ${userId}`,
    })

    return {
      documentType: 'FUEL_STATEMENT',
      requestNumber: request.requestNumber,
      generatedDate: new Date().toISOString(),
      
      // Driver information
      driver: {
        name: `${request.driver.firstName} ${request.driver.lastName}`,
        employeeNumber: request.driver.employeeNumber,
        email: request.driver.email,
      },
      
      // Department information
      department: {
        name: request.department.name,
      },
      
      // Vehicle information
      vehicle: {
        number: request.vehicle.vehicleNumber,
        gpsa: request.vehicle.gpsa,
        fuelType: request.vehicle.fuelType,
      },
      
      // Fuel request details
      request: {
        fuelType: request.fuelType,
        requestedLitres: request.requestedLitres,
        approvedLitres: request.approvedLitres || request.requestedLitres,
        issuedLitres: request.issuedLitres,
        purpose: request.purpose,
        requestDate: request.requestDate.toISOString(),
        finalApprovedAt: request.finalApprovedAt?.toISOString(),
      },
      
      // Journey details
      journey: {
        kmFrom: request.kmFrom,
        kmTo: request.kmTo,
        kmUsed: request.kmUsed,
        lastFuelReceived: request.lastFuelReceived,
      },
      
      // Fuel issuance info (if available)
      issuance: request.fuelIssuance ? {
        litresIssued: request.fuelIssuance.litresIssued,
        tokenNumber: request.fuelIssuance.tokenNumber,
        issuedAt: request.fuelIssuance.issuedAt.toISOString(),
      } : null,
      
      // Final approver
      finalApprover: request.finalApprover ? {
        name: `${request.finalApprover.firstName} ${request.finalApprover.lastName}`,
      } : null,
      
      // Status
      status: request.status,
    }
  }
}

export const documentGenerationService = DocumentGenerationService.getInstance()
