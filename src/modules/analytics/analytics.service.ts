import { prisma } from '../../config/database'

export class AnalyticsService {
  private static instance: AnalyticsService

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  /**
   * Get overall system statistics
   */
  async getSystemStats() {
    const [
      totalUsers,
      activeUsers,
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      completedRequests,
      totalFuelIssued,
      totalDepartments,
      totalVehicles,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.fuelRequest.count(),
      prisma.fuelRequest.count({
        where: {
          status: {
            in: ['PENDING_HEAD_APPROVAL', 'PENDING_TRANSPORT_APPROVAL', 'PENDING_DA_APPROVAL', 'FULLY_APPROVED', 'PENDING_FUEL_ISSUANCE'],
          },
        },
      }),
      prisma.fuelRequest.count({
        where: {
          status: {
            in: ['HEAD_APPROVED', 'TRANSPORT_APPROVED', 'ADA_APPROVED', 'FULLY_APPROVED'],
          },
        },
      }),
      prisma.fuelRequest.count({
        where: {
          status: {
            in: ['HEAD_REJECTED', 'TRANSPORT_REJECTED', 'ADA_REJECTED'],
          },
        },
      }),
      prisma.fuelRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.fuelRequest.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { issuedLitres: true },
      }),
      prisma.department.count(),
      prisma.vehicle.count({ where: { isActive: true } }),
    ])

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        completed: completedRequests,
        approvalRate: totalRequests > 0 ? ((approvedRequests / totalRequests) * 100).toFixed(1) : 0,
      },
      fuel: {
        totalIssued: totalFuelIssued._sum.issuedLitres || 0,
      },
      system: {
        departments: totalDepartments,
        vehicles: totalVehicles,
      },
    }
  }

  /**
   * Get fuel consumption by month
   */
  async getFuelConsumptionByMonth(year?: number) {
    const currentYear = year || new Date().getFullYear()

    const startDate = new Date(currentYear, 0, 1)
    const endDate = new Date(currentYear, 11, 31, 23, 59, 59)

    const completedRequests = await prisma.fuelRequest.findMany({
      where: {
        status: 'COMPLETED',
        requestDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        requestDate: true,
        issuedLitres: true,
        fuelType: true,
      },
    })

    // Group by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(currentYear, i).toLocaleString('default', { month: 'short' }),
      diesel: 0,
      petrol: 0,
      total: 0,
    }))

    completedRequests.forEach((request) => {
      const month = request.requestDate.getMonth()
      const litres = request.issuedLitres || 0

      if (request.fuelType === 'DIESEL') {
        monthlyData[month].diesel += litres
      } else if (request.fuelType === 'PETROL') {
        monthlyData[month].petrol += litres
      }

      monthlyData[month].total += litres
    })

    return monthlyData
  }

  /**
   * Get requests by department
   */
  async getRequestsByDepartment() {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            fuelRequests: true,
          },
        },
        fuelRequests: {
          where: {
            status: 'COMPLETED',
          },
          select: {
            issuedLitres: true,
          },
        },
      },
    })

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      totalRequests: dept._count.fuelRequests,
      completedRequests: dept.fuelRequests.length,
      totalFuelIssued: dept.fuelRequests.reduce((sum, req) => sum + (req.issuedLitres || 0), 0),
    }))
  }

  /**
   * Get requests by status
   */
  async getRequestsByStatus() {
    const statuses = [
      'PENDING_HEAD_APPROVAL',
      'HEAD_APPROVED',
      'HEAD_REJECTED',
      'PENDING_TRANSPORT_APPROVAL',
      'TRANSPORT_APPROVED',
      'TRANSPORT_REJECTED',
      'PENDING_DA_APPROVAL',
      'ADA_APPROVED',
      'ADA_REJECTED',
      'FULLY_APPROVED',
      'PENDING_FUEL_ISSUANCE',
      'COMPLETED',
      'CANCELLED',
    ]

    const counts = await Promise.all(
      statuses.map((status) =>
        prisma.fuelRequest.count({
          where: { status: status as any },
        })
      )
    )

    return statuses.map((status, index) => ({
      status,
      count: counts[index],
    }))
  }

  /**
   * Get approval statistics by approver
   */
  async getApprovalStatsByApprover() {
    const approvals = await prisma.approval.groupBy({
      by: ['approverId', 'stage', 'approved'],
      _count: {
        id: true,
      },
    })

    const approverIds = [...new Set(approvals.map((a) => a.approverId))]

    const approvers = await prisma.user.findMany({
      where: {
        id: { in: approverIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    })

    const approverMap = new Map(approvers.map((a) => [a.id, a]))

    const stats = approverIds.map((approverId) => {
      const approver = approverMap.get(approverId)
      const approverApprovals = approvals.filter((a) => a.approverId === approverId)

      const total = approverApprovals.reduce((sum, a) => sum + a._count.id, 0)
      const approved = approverApprovals
        .filter((a) => a.approved)
        .reduce((sum, a) => sum + a._count.id, 0)
      const rejected = approverApprovals
        .filter((a) => !a.approved)
        .reduce((sum, a) => sum + a._count.id, 0)

      return {
        approverId,
        approverName: approver ? `${approver.firstName} ${approver.lastName}` : 'Unknown',
        approverEmail: approver?.email || 'Unknown',
        approverRole: approver?.role || 'Unknown',
        totalApprovals: total,
        approved,
        rejected,
        approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : 0,
      }
    })

    return stats.sort((a, b) => b.totalApprovals - a.totalApprovals)
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 20) {
    const recentLogs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description,
      timestamp: log.createdAt,
      user: log.user
        ? {
            name: `${log.user.firstName} ${log.user.lastName}`,
            email: log.user.email,
            role: log.user.role,
          }
        : null,
      }))
  }

  /**
   * Get dashboard summary for admin
   */
  async getDashboardSummary() {
    const [systemStats, monthlyConsumption, departmentStats, statusStats, recentActivity] =
      await Promise.all([
        this.getSystemStats(),
        this.getFuelConsumptionByMonth(),
        this.getRequestsByDepartment(),
        this.getRequestsByStatus(),
        this.getRecentActivity(10),
      ])

    return {
      systemStats,
      monthlyConsumption,
      departmentStats,
      statusStats,
      recentActivity,
    }
  }
}

export const analyticsService = AnalyticsService.getInstance()
