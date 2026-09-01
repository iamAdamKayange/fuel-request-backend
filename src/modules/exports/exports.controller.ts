import { Request, Response } from 'express'
import { exportsService } from './exports.service'

export class ExportsController {
  private static instance: ExportsController

  static getInstance(): ExportsController {
    if (!ExportsController.instance) {
      ExportsController.instance = new ExportsController()
    }
    return ExportsController.instance
  }

  /**
   * Export fuel requests as PDF
   */
  async exportFuelRequestsPDF(req: Request, res: Response) {
    try {
      const filters = req.query

      const pdfBuffer = await exportsService.generateFuelRequestsPDF(filters)

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=fuel-requests-${Date.now()}.pdf`
      )
      res.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating PDF:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
      })
    }
  }

  /**
   * Export fuel requests as Excel
   */
  async exportFuelRequestsExcel(req: Request, res: Response) {
    try {
      const filters = req.query

      const excelBuffer = await exportsService.generateFuelRequestsExcel(filters)

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=fuel-requests-${Date.now()}.xlsx`
      )
      res.send(excelBuffer)
    } catch (error) {
      console.error('Error generating Excel:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate Excel report',
      })
    }
  }

  /**
   * Export audit logs as PDF
   */
  async exportAuditLogsPDF(req: Request, res: Response) {
    try {
      const filters = req.query

      const pdfBuffer = await exportsService.generateAuditLogsPDF(filters)

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=audit-logs-${Date.now()}.pdf`
      )
      res.send(pdfBuffer)
    } catch (error) {
      console.error('Error generating PDF:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
      })
    }
  }

  /**
   * Export audit logs as Excel
   */
  async exportAuditLogsExcel(req: Request, res: Response) {
    try {
      const filters = req.query

      const excelBuffer = await exportsService.generateAuditLogsExcel(filters)

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=audit-logs-${Date.now()}.xlsx`
      )
      res.send(excelBuffer)
    } catch (error) {
      console.error('Error generating Excel:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to generate Excel report',
      })
    }
  }
}

export const exportsController = ExportsController.getInstance()
