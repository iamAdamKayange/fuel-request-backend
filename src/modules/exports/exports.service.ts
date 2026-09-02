import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'
import { prisma } from '../../config/database'

export class ExportsService {
  private static instance: ExportsService

  static getInstance(): ExportsService {
    if (!ExportsService.instance) {
      ExportsService.instance = new ExportsService()
    }
    return ExportsService.instance
  }

  /**
   * Generate PDF report for fuel requests
   */
  async generateFuelRequestsPDF(filters?: any): Promise<Buffer> {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId
    }

    if (filters?.startDate && filters?.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      }
    }

    const requests = await prisma.fuelRequest.findMany({
      where,
      include: {
        driver: {
          include: {
            department: true,
          },
        },
        vehicle: true,
        approvals: {
          include: {
            approver: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Fuel Requests Report', { align: 'center' })
      doc.moveDown()
      
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
      doc.moveDown()

      if (filters?.startDate && filters?.endDate) {
        doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, { align: 'center' })
        doc.moveDown()
      }

      doc.moveTo(50, 120).lineTo(545, 120).stroke()

      // Table header
      const yPosition = 130
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Request #', 50, yPosition)
      doc.text('Driver', 100, yPosition)
      doc.text('Department', 200, yPosition)
      doc.text('Vehicle', 300, yPosition)
      doc.text('Quantity (L)', 400, yPosition)
      doc.text('Status', 480, yPosition)

      doc.moveTo(50, yPosition + 15).lineTo(545, yPosition + 15).stroke()

      // Table rows
      let currentY = yPosition + 25
      doc.fontSize(8).font('Helvetica')

      requests.forEach((request) => {
        const driverName = `${request.driver.firstName} ${request.driver.lastName}`
        const departmentName = request.driver.department?.name || 'N/A'
        const vehiclePlate = request.vehicle?.vehicleNumber || 'N/A'
        const quantity = request.approvedLitres || request.requestedLitres

        doc.text(request.requestNumber, 50, currentY)
        doc.text(driverName.substring(0, 20), 100, currentY)
        doc.text(departmentName.substring(0, 18), 200, currentY)
        doc.text(vehiclePlate, 300, currentY)
        doc.text(quantity.toString(), 400, currentY)
        doc.text(request.status, 480, currentY)

        currentY += 15

        // New page if needed
        if (currentY > 750) {
          doc.addPage()
          currentY = 50
        }
      })

      doc.end()
    })
  }

  /**
   * Generate Excel report for fuel requests
   */
  async generateFuelRequestsExcel(filters?: any): Promise<Buffer> {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId
    }

    if (filters?.startDate && filters?.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      }
    }

    const requests = await prisma.fuelRequest.findMany({
      where,
      include: {
        driver: {
          include: {
            department: true,
          },
        },
        vehicle: true,
        approvals: {
          include: {
            approver: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Fuel Requests')

    // Set columns
    worksheet.columns = [
      { header: 'Request #', key: 'requestNumber', width: 20 },
      { header: 'Driver Name', key: 'driverName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Vehicle #', key: 'vehicleNumber', width: 15 },
      { header: 'Fuel Type', key: 'fuelType', width: 12 },
      { header: 'Requested (L)', key: 'requestedLitres', width: 15 },
      { header: 'Approved (L)', key: 'approvedLitres', width: 15 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Request Date', key: 'requestDate', width: 20 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // Add data
    requests.forEach((request) => {
      const driverName = `${request.driver.firstName} ${request.driver.lastName}`
      const departmentName = request.driver.department?.name || 'N/A'
      const vehicleNumber = request.vehicle?.vehicleNumber || 'N/A'

      worksheet.addRow({
        requestNumber: request.requestNumber,
        driverName,
        department: departmentName,
        vehicleNumber,
        fuelType: request.fuelType,
        requestedLitres: request.requestedLitres,
        approvedLitres: request.approvedLitres || 0,
        status: request.status,
        requestDate: request.requestDate.toLocaleString(),
      })
    })

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      if (column.header) {
        column.width = Math.max(
          column.width || 10,
          column.header.length + 5
        )
      }
    })

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
  }

  /**
   * Generate PDF report for audit logs
   */
  async generateAuditLogsPDF(filters?: any): Promise<Buffer> {
    const where: any = {}

    if (filters?.userId) {
      where.userId = filters.userId
    }

    if (filters?.action) {
      where.action = filters.action
    }

    if (filters?.startDate && filters?.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('Audit Logs Report', { align: 'center' })
      doc.moveDown()
      
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
      doc.moveDown()

      if (filters?.startDate && filters?.endDate) {
        doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, { align: 'center' })
        doc.moveDown()
      }

      doc.moveTo(50, 120).lineTo(545, 120).stroke()

      // Table header
      const yPosition = 130
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Date', 50, yPosition)
      doc.text('User', 100, yPosition)
      doc.text('Action', 200, yPosition)
      doc.text('Description', 300, yPosition)

      doc.moveTo(50, yPosition + 15).lineTo(545, yPosition + 15).stroke()

      // Table rows
      let currentY = yPosition + 25
      doc.fontSize(8).font('Helvetica')

      logs.forEach((log) => {
        const userName = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'
        const description = log.description.substring(0, 40)

        doc.text(log.createdAt.toLocaleString(), 50, currentY)
        doc.text(userName.substring(0, 15), 100, currentY)
        doc.text(log.action, 200, currentY)
        doc.text(description, 300, currentY)

        currentY += 15

        // New page if needed
        if (currentY > 750) {
          doc.addPage()
          currentY = 50
        }
      })

      doc.end()
    })
  }

  /**
   * Generate Excel report for audit logs
   */
  async generateAuditLogsExcel(filters?: any): Promise<Buffer> {
    const where: any = {}

    if (filters?.userId) {
      where.userId = filters.userId
    }

    if (filters?.action) {
      where.action = filters.action
    }

    if (filters?.startDate && filters?.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Audit Logs')

    // Set columns
    worksheet.columns = [
      { header: 'Date', key: 'createdAt', width: 25 },
      { header: 'User', key: 'userName', width: 25 },
      { header: 'Action', key: 'action', width: 20 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'IP Address', key: 'ipAddress', width: 18 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true, size: 12 }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }

    // Add data
    logs.forEach((log) => {
      const userName = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'

      worksheet.addRow({
        createdAt: log.createdAt.toLocaleString(),
        userName,
        action: log.action,
        description: log.description,
        ipAddress: log.ipAddress || 'N/A',
      })
    })

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>
  }
}

export const exportsService = ExportsService.getInstance()
