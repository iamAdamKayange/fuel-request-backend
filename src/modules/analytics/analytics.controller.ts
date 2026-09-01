import { Request, Response } from 'express'
import { analyticsService } from './analytics.service'

export class AnalyticsController {
  private static instance: AnalyticsController

  static getInstance(): AnalyticsController {
    if (!AnalyticsController.instance) {
      AnalyticsController.instance = new AnalyticsController()
    }
    return AnalyticsController.instance
  }

  /**
   * Get system statistics
   */
  async getSystemStats(_req: Request, res: Response) {
    try {
      const stats = await analyticsService.getSystemStats()
      res.json({
        success: true,
        data: stats,
      })
    } catch (error) {
      console.error('Error fetching system stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch system statistics',
      })
    }
  }

  /**
   * Get fuel consumption by month
   */
  async getFuelConsumptionByMonth(req: Request, res: Response) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined
      const data = await analyticsService.getFuelConsumptionByMonth(year)
      res.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error('Error fetching fuel consumption:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fuel consumption data',
      })
    }
  }

  /**
   * Get requests by department
   */
  async getRequestsByDepartment(_req: Request, res: Response) {
    try {
      const data = await analyticsService.getRequestsByDepartment()
      res.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error('Error fetching department stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch department statistics',
      })
    }
  }

  /**
   * Get requests by status
   */
  async getRequestsByStatus(_req: Request, res: Response) {
    try {
      const data = await analyticsService.getRequestsByStatus()
      res.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error('Error fetching status stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch status statistics',
      })
    }
  }

  /**
   * Get approval statistics by approver
   */
  async getApprovalStatsByApprover(_req: Request, res: Response) {
    try {
      const data = await analyticsService.getApprovalStatsByApprover()
      res.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error('Error fetching approver stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approver statistics',
      })
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20
      const data = await analyticsService.getRecentActivity(limit)
      res.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error('Error fetching recent activity:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent activity',
      })
    }
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(_req: Request, res: Response) {
    try {
      const summary = await analyticsService.getDashboardSummary()
      res.json({
        success: true,
        data: summary,
      })
    } catch (error) {
      console.error('Error fetching dashboard summary:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard summary',
      })
    }
  }
}

export const analyticsController = AnalyticsController.getInstance()
