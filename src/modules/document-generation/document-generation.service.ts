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
   * Generate official PDF format Fuel Permit matching reference form
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
      // Keep the PDF download audit entry within the database enum.
      action: 'FUEL_PERMIT_PRINTED',
      requestId,
      description: `Fuel Permit PDF for request ${request.requestNumber} was generated by ${user?.firstName} ${user?.lastName} (${user?.role})`,
    })

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const leftMargin = 40
      const rightMargin = 550

      // ============================================================
      // HEADER SECTION WITH EMBLEM
      // ============================================================
      
      // Add emblem logo
      const emblemPath = path.join(process.cwd(), 'public/assets/tanzania-emblem.png')
      if (fs.existsSync(emblemPath)) {
        doc.image(emblemPath, 245, 40, { width: 50, height: 50 })
      }
      
      doc.fontSize(11).font('Helvetica-Bold').text('JAMHURI YA MUUNGANO WA TANZANIA', { align: 'center' })
      doc.moveDown(0.2)
      doc.fontSize(10).font('Helvetica-Bold').text('WIZARA YA HABARI, UTAMADUNI, SANAA NA MICHEZO', { align: 'center' })
      doc.moveDown(0.3)
      
      // Ministry Contact Info
      doc.fontSize(8).font('Helvetica')
      doc.text('Simu: +255 (026) - 2322129  |  Nukushi: +255 (026) - 2322126', { align: 'center' })
      doc.text('Barua pepe: km@michezo.go.tz  |  Tovuti: www.michezo.go.tz', { align: 'center' })
      doc.text('Mji wa Serikali - Mtumba, 2 Mtaa wa Michezo, S.L.P 25, 40481 DODOMA', { align: 'center' })
      doc.moveDown(0.5)
      
      // Main Title
      doc.fontSize(16).font('Helvetica-Bold').text('KIBALI CHA KUCHUKUA MAFUTA', { align: 'center' })
      doc.moveDown(0.5)
      
      // Double line separator
      doc.moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).stroke()
      doc.moveDown(0.2)
      doc.moveTo(leftMargin, doc.y).lineTo(rightMargin, doc.y).stroke()
      doc.moveDown(0.8)

      // ============================================================
      // SECTION A: SEHEMU YA MWOMBAJI/DEREVA
      // ============================================================
      doc.fontSize(11).font('Helvetica-Bold').text('A. SEHEMU YA MWOMBAJI/DEREVA', { underline: true })
      doc.moveDown(0.4)
      
      doc.fontSize(9).font('Helvetica')
      const sectionAY = doc.y
      
      // Jina la Mwombaji/Dereva
      doc.text('Jina la Mwombaji/Dereva:', leftMargin, sectionAY)
      const driverName = `${request.driver.firstName} ${request.driver.lastName}`
      doc.text(driverName, leftMargin + 140, sectionAY)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(driverName), sectionAY + 8).lineTo(rightMargin, sectionAY + 8).stroke()
      
      // Idara
      doc.text('Idara:', leftMargin, sectionAY + 20)
      doc.text(request.department.name, leftMargin + 140, sectionAY + 20)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(request.department.name), sectionAY + 28).lineTo(rightMargin, sectionAY + 28).stroke()
      
      // Ninaomba kuidhinishiwa mafuta Diesel/Petrol Lita
      doc.text('Ninaomba kuidhinishiwa mafuta Diesel/Petrol Lita:', leftMargin, sectionAY + 40)
      const fuelInfo = `${request.fuelType} - ${request.requestedLitres}`
      doc.text(fuelInfo, leftMargin + 180, sectionAY + 40)
      doc.moveTo(leftMargin + 180 + doc.widthOfString(fuelInfo), sectionAY + 48).lineTo(rightMargin, sectionAY + 48).stroke()
      
      // Kwa gari namba
      doc.text('Kwa gari namba:', leftMargin, sectionAY + 60)
      doc.text(request.vehicle.vehicleNumber, leftMargin + 140, sectionAY + 60)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(request.vehicle.vehicleNumber), sectionAY + 68).lineTo(rightMargin, sectionAY + 68).stroke()
      
      // GPSA
      doc.text('GPSA:', leftMargin, sectionAY + 80)
      const gpsaValue = request.gpsa || ''
      doc.text(gpsaValue, leftMargin + 140, sectionAY + 80)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(gpsaValue), sectionAY + 88).lineTo(rightMargin, sectionAY + 88).stroke()
      
      // Kwa ajili ya
      doc.text('Kwa ajili ya:', leftMargin, sectionAY + 100)
      doc.text(request.purpose, leftMargin + 140, sectionAY + 100)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(request.purpose), sectionAY + 108).lineTo(rightMargin, sectionAY + 108).stroke()
      
      // za kuanzia Km
      doc.text('za kuanzia:', leftMargin, sectionAY + 120)
      doc.text(`${request.kmFrom} Km`, leftMargin + 140, sectionAY + 120)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(`${request.kmFrom} Km`), sectionAY + 128).lineTo(rightMargin, sectionAY + 128).stroke()
      
      // Km za sasa
      doc.text('Km za sasa:', leftMargin, sectionAY + 140)
      doc.text(`${request.kmTo} Km`, leftMargin + 140, sectionAY + 140)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(`${request.kmTo} Km`), sectionAY + 148).lineTo(rightMargin, sectionAY + 148).stroke()
      
      // zilizotumika
      doc.text('zilizotumika:', leftMargin, sectionAY + 160)
      doc.text(`${request.kmUsed}`, leftMargin + 140, sectionAY + 160)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(`${request.kmUsed}`), sectionAY + 168).lineTo(rightMargin, sectionAY + 168).stroke()
      
      // Mara ya mwisho nilipewa lita
      doc.text('Mara ya mwisho nilipewa lita:', leftMargin, sectionAY + 180)
      doc.text(`${request.lastFuelReceived}`, leftMargin + 140, sectionAY + 180)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(`${request.lastFuelReceived}`), sectionAY + 188).lineTo(rightMargin, sectionAY + 188).stroke()
      
      // tarehe
      doc.text('tarehe:', leftMargin, sectionAY + 200)
      const lastFuelDate = request.requestDate.toLocaleDateString('sw-TZ')
      doc.text(lastFuelDate, leftMargin + 140, sectionAY + 200)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(lastFuelDate), sectionAY + 208).lineTo(rightMargin, sectionAY + 208).stroke()
      
      // Saini ya Mwombaji
      doc.text('Saini ya Mwombaji:', leftMargin, sectionAY + 220)
      doc.moveTo(leftMargin + 140, sectionAY + 228).lineTo(leftMargin + 300, sectionAY + 228).stroke()
      
      // Tarehe (signature date)
      doc.text('Tarehe:', leftMargin, sectionAY + 240)
      doc.moveTo(leftMargin + 140, sectionAY + 248).lineTo(leftMargin + 250, sectionAY + 248).stroke()
      
      doc.moveDown(1)

      // ============================================================
      // SECTION B: IDHINI YA MKUU WA IDARA/KITENGO
      // ============================================================
      doc.fontSize(11).font('Helvetica-Bold').text('B. IDHINI YA MKUU WA IDARA/KITENGO', { underline: true })
      doc.moveDown(0.4)
      
      doc.fontSize(9).font('Helvetica')
      const sectionBY = doc.y
      
      // Get Head of Department approval
      const headApproval = request.approvals.find(a => a.stage.toLowerCase().includes('head'))
      
      // Naridhia/Siridhii apatiwe huduma hiyo kama alivyoomba hapo juu kwa sababu
      doc.text('Naridhia/Siridhii apatiwe huduma hiyo kama alivyoomba hapo juu kwa sababu:', leftMargin, sectionBY)
      const headReason = headApproval?.reason || ''
      doc.text(headReason, leftMargin, sectionBY + 12)
      doc.moveTo(leftMargin + doc.widthOfString(headReason), sectionBY + 20).lineTo(rightMargin, sectionBY + 20).stroke()
      
      // Jina la Mkuu wa Idara/Kitengo
      doc.text('Jina la Mkuu wa Idara/Kitengo:', leftMargin, sectionBY + 32)
      const headName = headApproval ? `${headApproval.approver.firstName} ${headApproval.approver.lastName}` : ''
      doc.text(headName, leftMargin + 180, sectionBY + 32)
      doc.moveTo(leftMargin + 180 + doc.widthOfString(headName), sectionBY + 40).lineTo(rightMargin, sectionBY + 40).stroke()
      
      // Cheo
      doc.text('Cheo:', leftMargin, sectionBY + 52)
      const headTitle = headApproval?.approver.title || headApproval?.designation || ''
      doc.text(headTitle, leftMargin + 140, sectionBY + 52)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(headTitle), sectionBY + 60).lineTo(rightMargin, sectionBY + 60).stroke()
      
      // Saini
      doc.text('Saini:', leftMargin, sectionBY + 72)
      doc.moveTo(leftMargin + 140, sectionBY + 80).lineTo(leftMargin + 300, sectionBY + 80).stroke()
      
      // Tarehe
      doc.text('Tarehe:', leftMargin, sectionBY + 92)
      const headDate = headApproval?.approvedAt ? new Date(headApproval.approvedAt).toLocaleDateString('sw-TZ') : ''
      doc.text(headDate, leftMargin + 140, sectionBY + 92)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(headDate), sectionBY + 100).lineTo(leftMargin + 250, sectionBY + 100).stroke()
      
      doc.moveDown(1)

      // ============================================================
      // SECTION C: IDHINI YA AFISA USAFIRISHAJI
      // ============================================================
      doc.fontSize(11).font('Helvetica-Bold').text('C. IDHINI YA AFISA USAFIRISHAJI', { underline: true })
      doc.moveDown(0.4)
      
      doc.fontSize(9).font('Helvetica')
      const sectionCY = doc.y
      
      // Get Transport Officer approval
      const transportApproval = request.approvals.find(a => a.stage.toLowerCase().includes('transport'))
      
      // Apewe/asipewe Lita
      doc.text('Apewe/asipewe Lita:', leftMargin, sectionCY)
      const transportLitres = transportApproval?.litresApproved
      const transportLitresText = transportLitres !== undefined && transportLitres !== null ? `${transportLitres}` : ''
      doc.text(transportLitresText, leftMargin + 140, sectionCY)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(transportLitresText), sectionCY + 8).lineTo(rightMargin, sectionCY + 8).stroke()
      
      // kwa sababu
      doc.text('kwa sababu:', leftMargin, sectionCY + 20)
      const transportReason = transportApproval?.reason || ''
      doc.text(transportReason, leftMargin, sectionCY + 32)
      doc.moveTo(leftMargin + doc.widthOfString(transportReason), sectionCY + 40).lineTo(rightMargin, sectionCY + 40).stroke()
      
      // Logbook namba
      doc.text('Logbook namba:', leftMargin, sectionCY + 52)
      const logbookNum = transportApproval?.logbookNumber || ''
      doc.text(logbookNum, leftMargin + 140, sectionCY + 52)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(logbookNum), sectionCY + 60).lineTo(rightMargin, sectionCY + 60).stroke()
      
      // To
      doc.text('To:', leftMargin, sectionCY + 72)
      const logbookTo = transportApproval?.logbookTo || ''
      doc.text(logbookTo, leftMargin + 140, sectionCY + 72)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(logbookTo), sectionCY + 80).lineTo(rightMargin, sectionCY + 80).stroke()
      
      // Cheo
      doc.text('Cheo:', leftMargin, sectionCY + 92)
      const transportTitle = transportApproval?.approver.title || transportApproval?.designation || ''
      doc.text(transportTitle, leftMargin + 140, sectionCY + 92)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(transportTitle), sectionCY + 100).lineTo(rightMargin, sectionCY + 100).stroke()
      
      // Saini
      doc.text('Saini:', leftMargin, sectionCY + 112)
      doc.moveTo(leftMargin + 140, sectionCY + 120).lineTo(leftMargin + 300, sectionCY + 120).stroke()
      
      // Tarehe
      doc.text('Tarehe:', leftMargin, sectionCY + 132)
      const transportDate = transportApproval?.approvedAt ? new Date(transportApproval.approvedAt).toLocaleDateString('sw-TZ') : ''
      doc.text(transportDate, leftMargin + 140, sectionCY + 132)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(transportDate), sectionCY + 140).lineTo(leftMargin + 250, sectionCY + 140).stroke()
      
      doc.moveDown(1)

      // ============================================================
      // SECTION D: ADA/DAHRM
      // ============================================================
      doc.fontSize(11).font('Helvetica-Bold').text('D. ADA/DAHRM', { underline: true })
      doc.moveDown(0.4)
      
      doc.fontSize(9).font('Helvetica')
      const sectionDY = doc.y
      
      // Get ADA approval
      const adaApproval = request.approvals.find(a => a.stage.toLowerCase().includes('ada'))
      
      // Naridhia/Siridhii
      doc.text('Naridhia/Siridhii:', leftMargin, sectionDY)
      const adaDecision = adaApproval?.approved !== undefined && adaApproval?.approved !== null 
        ? (adaApproval.approved ? 'Naridhia' : 'Siridhii') 
        : ''
      doc.text(adaDecision, leftMargin + 140, sectionDY)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(adaDecision), sectionDY + 8).lineTo(rightMargin, sectionDY + 8).stroke()
      
      // kwa sababu
      doc.text('kwa sababu:', leftMargin, sectionDY + 20)
      const adaReason = adaApproval?.reason || ''
      doc.text(adaReason, leftMargin, sectionDY + 32)
      doc.moveTo(leftMargin + doc.widthOfString(adaReason), sectionDY + 40).lineTo(rightMargin, sectionDY + 40).stroke()
      
      // Jina
      doc.text('Jina:', leftMargin, sectionDY + 52)
      const adaName = adaApproval ? `${adaApproval.approver.firstName} ${adaApproval.approver.lastName}` : ''
      doc.text(adaName, leftMargin + 140, sectionDY + 52)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(adaName), sectionDY + 60).lineTo(rightMargin, sectionDY + 60).stroke()
      
      // Cheo
      doc.text('Cheo:', leftMargin, sectionDY + 72)
      const adaTitle = adaApproval?.approver.title || adaApproval?.designation || ''
      doc.text(adaTitle, leftMargin + 140, sectionDY + 72)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(adaTitle), sectionDY + 80).lineTo(rightMargin, sectionDY + 80).stroke()
      
      // Saini
      doc.text('Saini:', leftMargin, sectionDY + 92)
      doc.moveTo(leftMargin + 140, sectionDY + 100).lineTo(leftMargin + 300, sectionDY + 100).stroke()
      
      // Tarehe
      doc.text('Tarehe:', leftMargin, sectionDY + 112)
      const adaDate = adaApproval?.approvedAt ? new Date(adaApproval.approvedAt).toLocaleDateString('sw-TZ') : ''
      doc.text(adaDate, leftMargin + 140, sectionDY + 112)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(adaDate), sectionDY + 120).lineTo(leftMargin + 250, sectionDY + 120).stroke()
      
      doc.moveDown(1)

      // ============================================================
      // SECTION E: SEHEMU YA UNUNUZI NA UGAVI
      // ============================================================
      doc.fontSize(11).font('Helvetica-Bold').text('E. SEHEMU YA UNUNUZI NA UGAVI', { underline: true })
      doc.moveDown(0.4)
      
      doc.fontSize(9).font('Helvetica')
      const sectionEY = doc.y
      
      // Token Number (if available from fuel issuance)
      doc.text('Token Number:', leftMargin, sectionEY)
      const tokenNum = request.fuelIssuance?.tokenNumber || ''
      doc.text(tokenNum, leftMargin + 140, sectionEY)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(tokenNum), sectionEY + 8).lineTo(rightMargin, sectionEY + 8).stroke()
      
      // Lita zilizotolewa
      doc.text('Lita zilizotolewa:', leftMargin, sectionEY + 20)
      const issuedLitres = request.fuelIssuance?.litresIssued
      const issuedLitresText = issuedLitres !== undefined && issuedLitres !== null ? `${issuedLitres}` : ''
      doc.text(issuedLitresText, leftMargin + 140, sectionEY + 20)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(issuedLitresText), sectionEY + 28).lineTo(rightMargin, sectionEY + 28).stroke()
      
      // Jina la Mtoaji
      doc.text('Jina la Mtoaji:', leftMargin, sectionEY + 40)
      const issuerName = request.fuelIssuance?.issuer?.firstName && request.fuelIssuance.issuer?.lastName 
        ? `${request.fuelIssuance.issuer.firstName} ${request.fuelIssuance.issuer.lastName}` 
        : ''
      doc.text(issuerName, leftMargin + 140, sectionEY + 40)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(issuerName), sectionEY + 48).lineTo(rightMargin, sectionEY + 48).stroke()
      
      // Cheo
      doc.text('Cheo:', leftMargin, sectionEY + 60)
      const issuerTitle = request.fuelIssuance?.designation || ''
      doc.text(issuerTitle, leftMargin + 140, sectionEY + 60)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(issuerTitle), sectionEY + 68).lineTo(rightMargin, sectionEY + 68).stroke()
      
      // Saini
      doc.text('Saini:', leftMargin, sectionEY + 80)
      doc.moveTo(leftMargin + 140, sectionEY + 88).lineTo(leftMargin + 300, sectionEY + 88).stroke()
      
      // Tarehe
      doc.text('Tarehe:', leftMargin, sectionEY + 100)
      const issueDate = request.fuelIssuance?.issuedAt ? new Date(request.fuelIssuance.issuedAt).toLocaleDateString('sw-TZ') : ''
      doc.text(issueDate, leftMargin + 140, sectionEY + 100)
      doc.moveTo(leftMargin + 140 + doc.widthOfString(issueDate), sectionEY + 108).lineTo(leftMargin + 250, sectionEY + 108).stroke()
      
      doc.moveDown(1.5)

      // ============================================================
      // FOOTER
      // ============================================================
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
