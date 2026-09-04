import { Response } from 'express'
import { documentGenerationService } from './document-generation.service'
import { successResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth'

export class DocumentGenerationController {
  private static instance: DocumentGenerationController

  static getInstance(): DocumentGenerationController {
    if (!DocumentGenerationController.instance) {
      DocumentGenerationController.instance = new DocumentGenerationController()
    }
    return DocumentGenerationController.instance
  }

  async generateFuelPermit(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const requestId = Array.isArray(id) ? id[0] : id
      
      const documentData = await documentGenerationService.generateFuelPermitData(
        requestId,
        req.user!.id
      )
      
      return res.json(successResponse(documentData, 'Fuel Permit generated successfully'))
    } catch (error: any) {
      // Handle different error types with appropriate status codes
      if (error.name === 'AUTHORIZATION_ERROR') {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: 'PRINT_PERMISSION_DENIED'
        })
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: 'DOCUMENT_NOT_FOUND'
        })
      }
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'DOCUMENT_GENERATION_ERROR'
      })
    }
  }

  async generateFuelStatement(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const requestId = Array.isArray(id) ? id[0] : id
      
      const documentData = await documentGenerationService.generateFuelStatementData(
        requestId,
        req.user!.id
      )
      
      return res.json(successResponse(documentData, 'Fuel Statement generated successfully'))
    } catch (error: any) {
      // Handle different error types with appropriate status codes
      if (error.name === 'AUTHORIZATION_ERROR') {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: 'PRINT_PERMISSION_DENIED'
        })
      }
      if (error.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: 'DOCUMENT_NOT_FOUND'
        })
      }
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'DOCUMENT_GENERATION_ERROR'
      })
    }
  }

  async checkPrintPermission(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const requestId = Array.isArray(id) ? id[0] : id
      
      // Check both permit and statement permissions
      const canPrintPermit = await documentGenerationService.canPrintDocuments(
        requestId,
        req.user!.id
      )
      
      const canPrintStatement = await documentGenerationService.canPrintStatement(
        requestId,
        req.user!.id
      )
      
      return res.json(successResponse({
        canPrintPermit: canPrintPermit.canPrint,
        canPrintPermitReason: canPrintPermit.reason,
        canPrintStatement: canPrintStatement.canPrint,
        canPrintStatementReason: canPrintStatement.reason,
      }, 'Print permission checked'))
    } catch (error: any) {
      return res.status(400).json(errorResponse(error.message))
    }
  }

  /**
   * Check if user can print statement (standalone endpoint)
   */
  async checkStatementPermission(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const requestId = Array.isArray(id) ? id[0] : id
      
      const result = await documentGenerationService.canPrintStatement(
        requestId,
        req.user!.id
      )
      
      return res.json(successResponse(result, 'Statement permission checked'))
    } catch (error: any) {
      return res.status(400).json(errorResponse(error.message))
    }
  }
}

export const documentGenerationController = DocumentGenerationController.getInstance()
