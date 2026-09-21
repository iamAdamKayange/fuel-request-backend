import { prisma } from '../../config/database'
import { logAudit } from '../../utils/logger'
import PDFDocument from 'pdfkit'

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
   * Only the final approver (ADA/DAHRM) or PROCUREMENT role can print documents
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

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (!user) {
      return { canPrint: false, reason: 'User not found' }
    }

    // PROCUREMENT role can print all fully approved documents
    if (user.role === 'PROCUREMENT') {
      return { canPrint: true }
    }

    // Final approver must be set for non-PROCUREMENT users
    if (!request.finalApproverId) {
      return { canPrint: false, reason: 'Final approver information is missing' }
    }

    // Only final approver (ADA/DAHRM) can print (PROCUREMENT role already handled above)
    if (request.finalApproverId !== userId) {
      return { canPrint: false, reason: 'Only the user who completed the final approval (ADA/DAHRM) or PROCUREMENT can print this document' }
    }

    return { canPrint: true }
  }

  /**
   * Check if user is authorized to print Full Statement
   * Only TRANSPORT_OFFICER or PROCUREMENT can print Full Statement
   */
  async canPrintStatement(requestId: string, userId: string): Promise<{ canPrint: boolean; reason?: string }> {
    const request = await prisma.fuelRequest.findUnique({
      where: { id: requestId },
      select: {
        status: true,
      },
    })

    if (!request) {
      return { canPrint: false, reason: 'Fuel request not found' }
    }

    // Can only print if request is fully approved or completed
    if (request.status !== 'FULLY_APPROVED' && request.status !== 'COMPLETED') {
      return { canPrint: false, reason: `Request is not fully approved or completed (current status: ${request.status})` }
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (!user) {
      return { canPrint: false, reason: 'User not found' }
    }

    // Only TRANSPORT_OFFICER or PROCUREMENT can print Full Statement
    if (user.role !== 'TRANSPORT_OFFICER' && user.role !== 'PROCUREMENT') {
      return { canPrint: false, reason: 'Only TRANSPORT_OFFICER or PROCUREMENT can print the Full Statement' }
    }

    return { canPrint: true }
  }

  /**
   * Generate official PDF format Fuel Permit
   */
  async generateFuelPermitPDF(requestId: string, userId: string): Promise<Buffer> {
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

    // Get user info for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, firstName: true, lastName: true },
    })

    // Log the print action
    await logAudit({
      userId,
      action: 'FUEL_PERMIT_PDF_GENERATED' as any,
      requestId,
      description: `Fuel Permit PDF for request ${request.requestNumber} was generated by ${user?.firstName} ${user?.lastName} (${user?.role})`,
    })

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header Section
      doc.fontSize(14).font('Helvetica-Bold').text('JAMHURI YA MUUNGANO WA TANZANIA', { align: 'center' })
      doc.moveDown(0.3)
      doc.fontSize(12).font('Helvetica').text('WIZARA YA HABARI, UTAMADUNI, SANAA NA MICHEZO', { align: 'center' })
      doc.moveDown(0.5)
      
      // Main Title
      doc.fontSize(18).font('Helvetica-Bold').text('KIBALI CHA KUCHUKUA MAFUTA', { align: 'center' })
      doc.moveDown(1)
      
      // Separator line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.moveDown(1)

      // Request Information Section
      doc.fontSize(12).font('Helvetica-Bold').text('TAARIFA YA OMBI', { underline: true })
      doc.moveDown(0.5)
      
      const leftMargin = 50
      const labelWidth = 120
      const startY = doc.y

      doc.fontSize(10).font('Helvetica')
      doc.text('Namba ya Ombi:', leftMargin, startY)
      doc.text(`: ${request.requestNumber}`, leftMargin + labelWidth, startY)
      
      doc.text('Tarehe:', leftMargin, startY + 20)
      const issueDate = request.finalApprovedAt || new Date()
      doc.text(`: ${issueDate.toLocaleDateString('sw-TZ')}`, leftMargin + labelWidth, startY + 20)
      
      doc.moveDown(1)

      // Driver Information Section
      doc.fontSize(12).font('Helvetica-Bold').text('MAELEZO YA MWOMBAJI', { underline: true })
      doc.moveDown(0.5)
      
      const driverStartY = doc.y
      doc.fontSize(10).font('Helvetica')
      doc.text('Jina Kamili:', leftMargin, driverStartY)
      doc.text(`: ${request.driver.firstName} ${request.driver.lastName}`, leftMargin + labelWidth, driverStartY)
      
      doc.text('Namba ya Wafanyikazi:', leftMargin, driverStartY + 20)
      doc.text(`: ${request.driver.employeeNumber || 'N/A'}`, leftMargin + labelWidth, driverStartY + 20)
      
      doc.text('Barua Pepe:', leftMargin, driverStartY + 40)
      doc.text(`: ${request.driver.email || 'N/A'}`, leftMargin + labelWidth, driverStartY + 40)
      
      doc.moveDown(1)

      // Department Information Section
      doc.fontSize(12).font('Helvetica-Bold').text('IDARA', { underline: true })
      doc.moveDown(0.5)
      
      const deptStartY = doc.y
      doc.fontSize(10).font('Helvetica')
      doc.text('Jina la Idara:', leftMargin, deptStartY)
      doc.text(`: ${request.department.name}`, leftMargin + labelWidth, deptStartY)
      
      doc.moveDown(1)

      // Vehicle Information Section
      doc.fontSize(12).font('Helvetica-Bold').text('MAELEZO YA GARI', { underline: true })
      doc.moveDown(0.5)
      
      const vehicleStartY = doc.y
      doc.fontSize(10).font('Helvetica')
      doc.text('Namba ya Gari:', leftMargin, vehicleStartY)
      doc.text(`: ${request.vehicle.vehicleNumber}`, leftMargin + labelWidth, vehicleStartY)
      
      doc.text('GPSA:', leftMargin, vehicleStartY + 20)
      doc.text(`: ${request.vehicle.gpsa || 'N/A'}`, leftMargin + labelWidth, vehicleStartY + 20)
      
      doc.text('Aina ya Mafuta:', leftMargin, vehicleStartY + 40)
      doc.text(`: ${request.vehicle.fuelType || request.fuelType}`, leftMargin + labelWidth, vehicleStartY + 40)
      
      doc.moveDown(1)

      // Fuel Information Section
      doc.fontSize(12).font('Helvetica-Bold').text('MAELEZO YA MAFUTA', { underline: true })
      doc.moveDown(0.5)
      
      const fuelStartY = doc.y
      doc.fontSize(10).font('Helvetica')
      doc.text('Aina ya Mafuta:', leftMargin, fuelStartY)
      doc.text(`: ${request.fuelType}`, leftMargin + labelWidth, fuelStartY)
      
      doc.text('Kiasi Ambacho Kimoombwa:', leftMargin, fuelStartY + 20)
      doc.text(`: ${request.requestedLitres} Litres`, leftMargin + labelWidth, fuelStartY + 20)
      
      doc.text('Kiasi Ambacho Kidhinishwa:', leftMargin, fuelStartY + 40)
      doc.text(`: ${request.approvedLitres || request.requestedLitres} Litres`, leftMargin + labelWidth, fuelStartY + 40)
      
      doc.moveDown(1)

      // Journey Information Section
      doc.fontSize(12).font('Helvetica-Bold').text('Safari', { underline: true })
      doc.moveDown(0.5)
      
      const journeyStartY = doc.y
      doc.fontSize(10).font('Helvetica')
      doc.text('Kwa ajili ya:', leftMargin, journeyStartY)
      doc.text(`: ${request.purpose}`, leftMargin + labelWidth, journeyStartY)
      
      doc.text('Km za Kuanzia:', leftMargin, journeyStartY + 20)
      doc.text(`: ${request.kmFrom}`, leftMargin + labelWidth, journeyStartY + 20)
      
      doc.text('Km za Sasa:', leftMargin, journeyStartY + 40)
      doc.text(`: ${request.kmTo}`, leftMargin + labelWidth, journeyStartY + 40)
      
      doc.text('Km Zilizotumika:', leftMargin, journeyStartY + 60)
      doc.text(`: ${request.kmUsed}`, leftMargin + labelWidth, journeyStartY + 60)
      
      doc.moveDown(1)

      // Approvals Section
      if (request.approvals && request.approvals.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('IDHINI ZILIZOTOLEWA', { underline: true })
        doc.moveDown(0.5)
        
        let approvalY = doc.y
        doc.fontSize(10).font('Helvetica')
        
        request.approvals.forEach((approval, index) => {
          if (approvalY > 700) {
            doc.addPage()
            approvalY = 50
          }
          
          const approverName = `${approval.approver.firstName} ${approval.approver.lastName}`
          const designation = approval.approver.title || approval.stage
          
          doc.text(`Hatua ${index + 1}: ${approval.stage}`, leftMargin, approvalY)
          doc.text(`Idhinishwa na: ${approverName}`, leftMargin, approvalY + 20)
          doc.text(`Cheo: ${designation}`, leftMargin, approvalY + 40)
          
          if (approval.approvedAt) {
            doc.text(`Tarehe: ${new Date(approval.approvedAt).toLocaleDateString('sw-TZ')}`, leftMargin, approvalY + 60)
          }
          
          if (approval.litresApproved) {
            doc.text(`Lita Zilizoidhinishwa: ${approval.litresApproved} Litres`, leftMargin, approvalY + 80)
          }
          
          approvalY += 100
        })
        
        doc.y = approvalY
        doc.moveDown(0.5)
      }

      // Final Approver Section
      if (request.finalApprover) {
        doc.fontSize(12).font('Helvetica-Bold').text('IDHINISHAJI WA MWISHO', { underline: true })
        doc.moveDown(0.5)
        
        const finalApproverY = doc.y
        doc.fontSize(10).font('Helvetica')
        doc.text('Jina:', leftMargin, finalApproverY)
        doc.text(`: ${request.finalApprover.firstName} ${request.finalApprover.lastName}`, leftMargin + labelWidth, finalApproverY)
        
        doc.text('Cheo:', leftMargin, finalApproverY + 20)
        doc.text(`: ${request.finalApprover.title || 'ADA'}`, leftMargin + labelWidth, finalApproverY + 20)
        
        doc.moveDown(1)
      }

      // Signature Section
      doc.moveDown(2)
      const signatureY = doc.y
      
      doc.fontSize(10).font('Helvetica')
      doc.text('Sahihi ya Afisa Mkuu:', leftMargin, signatureY)
      doc.moveTo(leftMargin, signatureY + 15).lineTo(leftMargin + 150, signatureY + 15).stroke()
      doc.text('Tarehe:', leftMargin, signatureY + 25)
      doc.moveTo(leftMargin, signatureY + 35).lineTo(leftMargin + 100, signatureY + 35).stroke()
      
      doc.text('Sahihi ya Mtoaji Mafuta:', leftMargin + 200, signatureY)
      doc.moveTo(leftMargin + 200, signatureY + 15).lineTo(leftMargin + 350, signatureY + 15).stroke()
      doc.text('Tarehe:', leftMargin + 200, signatureY + 25)
      doc.moveTo(leftMargin + 200, signatureY + 35).lineTo(leftMargin + 300, signatureY + 35).stroke()

      // Footer
      doc.moveDown(3)
      doc.fontSize(8).font('Helvetica').text('Hiki ni hatari rasmi ya mfumo wa Kibali cha Kuchukua Mafuta', { align: 'center' })
      doc.text(`Imetengenezwa mnamo: ${new Date().toLocaleString('sw-TZ')}`, { align: 'center' })

      doc.end()
    })
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

    // Get user info for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, firstName: true, lastName: true },
    })

    // Log the print action
    await logAudit({
      userId,
      action: 'FUEL_PERMIT_PRINTED' as any,
      requestId,
      description: `Fuel Permit for request ${request.requestNumber} was printed by ${user?.firstName} ${user?.lastName} (${user?.role})`,
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
    // Check authorization for Full Statement (TRANSPORT_OFFICER or PROCUREMENT only)
    const authResult = await this.canPrintStatement(requestId, userId)
    if (!authResult.canPrint) {
      const error = new Error(authResult.reason || 'You are not authorized to print the Full Statement')
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

    // Get user info for audit log
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, firstName: true, lastName: true },
    })

    // Log the print action
    await logAudit({
      userId,
      action: 'FUEL_STATEMENT_PRINTED' as any,
      requestId,
      description: `Fuel Statement for request ${request.requestNumber} was printed by ${user?.firstName} ${user?.lastName} (${user?.role})`,
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
