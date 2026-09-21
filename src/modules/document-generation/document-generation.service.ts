import { prisma } from '../../config/database'
import { logAudit } from '../../utils/logger'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

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

    // The permit remains an official record after fuel issuance. Completion
    // must not remove the final approver's or Procurement's existing access.
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
   * Generate official PDF format Fuel Permit matching reference form
   */
  async generateFuelPermitPDF(requestId: string, userId: string): Promise<Buffer> {
    return this.generateOfficialFuelPDF(requestId, userId, 'FUEL_PERMIT')
  }

  /**
   * Generate the printable statement in the same official PDF layout.  Its
   * authorization remains deliberately different from a Fuel Permit.
   */
  async generateFuelStatementPDF(requestId: string, userId: string): Promise<Buffer> {
    return this.generateOfficialFuelPDF(requestId, userId, 'FUEL_STATEMENT')
  }

  private async generateOfficialFuelPDF(
    requestId: string,
    userId: string,
    documentType: 'FUEL_PERMIT' | 'FUEL_STATEMENT',
  ): Promise<Buffer> {
    // Check authorization
    const authResult = documentType === 'FUEL_PERMIT'
      ? await this.canPrintDocuments(requestId, userId)
      : await this.canPrintStatement(requestId, userId)
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
        fuelIssuance: {
          include: {
            issuer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
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
      action: documentType === 'FUEL_PERMIT' ? 'FUEL_PERMIT_PRINTED' : 'FUEL_STATEMENT_PRINTED',
      requestId,
      description: `${documentType === 'FUEL_PERMIT' ? 'Fuel Permit' : 'Fuel Statement'} PDF for request ${request.requestNumber} was generated by ${user?.firstName} ${user?.lastName} (${user?.role})`,
    })

    return new Promise((resolve, reject) => {
      // The source form is a dense, single-page A4 document.  Fixed coordinates
      // keep the PDF printable and prevent long workflow data from moving a later
      // approval section onto a second page.
      const doc = new PDFDocument({ size: 'A4', margin: 0 })
      const chunks: Buffer[] = []
      const left = 31
      const right = 564

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const value = (input: unknown) => input === null || input === undefined ? '' : String(input)
      const date = (input: Date | null | undefined) => input ? new Date(input).toLocaleDateString('sw-TZ') : ''
      const approval = (stage: string) => request.approvals.find(item => item.stage.toUpperCase().includes(stage))
      const person = (item: typeof request.approvals[number] | undefined) => item
        ? `${item.approver.firstName} ${item.approver.lastName}`
        : ''

      const dotted = (from: number, y: number, to = right) => {
        doc.save().lineWidth(0.35).dash(1, { space: 1.3 }).moveTo(from, y).lineTo(to, y).stroke().undash().restore()
      }
      const text = (content: unknown, x: number, y: number, width = right - x, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.1).text(value(content), x, y, {
          width,
          height: 8,
          lineBreak: false,
          ellipsis: true,
        })
      }
      const field = (label: string, content: unknown, x: number, y: number, valueX: number, end = right) => {
        text(label, x, y, valueX - x - 2)
        text(content, valueX, y, end - valueX)
        dotted(valueX, y + 8, end)
      }
      const section = (title: string, y: number) => text(title, left, y, right - left, true)
      const signature = (label: string, y: number, signedAt: Date | null | undefined) => {
        field(label, '', left, y, 110, 365)
        field('Tarehe', date(signedAt), 376, y, 415)
      }

      doc.fillColor('#000000')

      // Header and emblem follow the official paper form.
      text('JAMHURI YA MUUNGANO WA TANZANIA', 130, 20, 330, true)
      text('WIZARA YA HABARI, UTAMADUNI, SANAA NA MICHEZO', 103, 31, 385, true)
      text('Simu: +255 (026) - 2322129', left, 50, 150, true)
      text('Nukushi: +255 (026) - 2322126', left, 61, 150, true)
      text('Barua pepe: km@michezo.go.tz', left, 72, 150, true)
      text('Tovuti: www.michezo.go.tz', left, 83, 150, true)
      text('Mji wa Serikali - Mtumba,', 418, 50, 140, true)
      text('2 Mtaa wa Michezo,', 418, 61, 140, true)
      text('S.L.P 25,', 418, 72, 140, true)
      text('40481 DODOMA.', 418, 83, 140, true)

      const emblemPath = path.join(process.cwd(), 'public/assets/tanzania-emblem.png')
      if (fs.existsSync(emblemPath)) {
        doc.image(emblemPath, 259, 47, { width: 57, height: 52 })
      }

      const documentTitle = documentType === 'FUEL_PERMIT'
        ? 'KIBALI CHA KUCHUKUA MAFUTA'
        : 'TAARIFA YA MAFUTA'
      text(documentTitle, 190, 108, 220, true)
      doc.moveTo(190, 118).lineTo(407, 118).lineWidth(0.45).stroke()

      const head = approval('HEAD')
      const transport = approval('TRANSPORT')
      const ada = approval('ADA')
      const driverName = `${request.driver.firstName} ${request.driver.lastName}`
      const vehicleNumber = request.vehicle?.vehicleNumber || ''
      const approvedLitres = transport?.litresApproved ?? ada?.litresApproved ?? request.requestedLitres
      const issuerName = request.fuelIssuance?.issuer
        ? `${request.fuelIssuance.issuer.firstName} ${request.fuelIssuance.issuer.lastName}`
        : ''

      section('A.  SEHEMU YA MWOMBAJI/DEREVA', 132)
      field('Jina la Mwombaji/Dereva', driverName, left, 146, 152, 360)
      field('Idara', request.department?.name, 372, 146, 405)
      field('Ninaomba kuidhinishiwa mafuta Diesel/Petrol Lita', `${request.fuelType} / ${request.requestedLitres}`, left, 159, 262, 410)
      field('Kwa gari namba', vehicleNumber, 420, 159, 480)
      field('GPSA', request.gpsa, left, 172, 62, 230)
      field('Kwa ajili ya', request.purpose, 240, 172, 300)
      field('za kuanzia', `${value(request.kmFrom)} Km`, left, 185, 79, 220)
      field('Km za sasa', `${value(request.kmTo)} Km`, 230, 185, 290, 405)
      field('Km zilizotumika', `${value(request.kmUsed)} Km`, 415, 185, 488)
      field('Mara ya mwisho nilipewa lita', request.lastFuelReceived, left, 198, 174, 288)
      field('tarehe', date(request.requestDate), 298, 198, 339)
      signature('Saini ya Mwombaji', 211, request.requestDate)

      section('B.  IDHINI YA MKUU WA IDARA/KITENGO', 231)
      text('Naridhia/Siridhii apatiwe huduma hiyo kama alivyoomba hapo juu kwa sababu', left, 244)
      text(head?.reason, left, 256, right - left)
      dotted(left, 265)
      field('Jina la Mkuu wa Idara/Kitengo', person(head), left, 269, 181)
      field('Cheo', head?.approver.title || head?.designation, left, 282, 58, 286)
      signature('Saini', 295, head?.approvedAt)

      section('C.  IDHINI YA AFISA USAFIRISHAJI', 315)
      field('Apewe/asipewe Lita', approvedLitres, left, 328, 121, 212)
      field('kwa sababu', transport?.reason, 222, 328, 280)
      field('Logbook namba', transport?.logbookNumber, left, 341, 104, 252)
      field('To', transport?.logbookTo, 263, 341, 280)
      field('Cheo', transport?.approver.title || transport?.designation, left, 354, 58, 286)
      signature('Saini', 367, transport?.approvedAt)

      section('D.  ADA/DAHRM', 387)
      field('Naridhia/Siridhii apewe Lita', ada?.litresApproved ?? approvedLitres, left, 400, 164, 280)
      field('kwa ajili ya matumizi ya gari namba', vehicleNumber, 290, 400, 447)
      text(ada?.reason, left, 413, right - left)
      dotted(left, 422)
      field('Cheo', ada?.approver.title || ada?.designation, left, 426, 58, 286)
      signature('Saini', 439, ada?.approvedAt)

      section('E.  SEHEMU YA UNUNUZI NA UGAWI', 459)
      field('Ninawapatia Diesel/Petrol Lita', `${request.fuelType} / ${value(request.fuelIssuance?.litresIssued)}`, left, 472, 174, 315)
      field('Token Number No.', request.fuelIssuance?.tokenNumber, 326, 472, 407)
      field('Jina', issuerName, left, 485, 58, 318)
      field('Cheo', request.fuelIssuance?.designation, 328, 485, 360)
      signature('Saini', 498, request.fuelIssuance?.issuedAt)

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
        fuelIssuance: {
          include: {
            issuer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
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
        issuedBy: `${request.fuelIssuance.issuer.firstName} ${request.fuelIssuance.issuer.lastName}`,
        designation: request.fuelIssuance.designation,
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
