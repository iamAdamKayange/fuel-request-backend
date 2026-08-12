import { prisma } from '../../config/database'

export class DepartmentsService {
  private static instance: DepartmentsService

  static getInstance(): DepartmentsService {
    if (!DepartmentsService.instance) {
      DepartmentsService.instance = new DepartmentsService()
    }
    return DepartmentsService.instance
  }

  async createDepartment(data: { name: string; description?: string; headUserId?: string }) {
    if (data.headUserId) {
      const headUser = await prisma.user.findUnique({
        where: { id: data.headUserId },
      })

      if (!headUser) {
        throw new Error('Head user not found')
      }

      if (headUser.role !== 'HEAD_OF_DEPARTMENT') {
        throw new Error('User must have HEAD_OF_DEPARTMENT role')
      }
    }

    const department = await prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        headUserId: data.headUserId,
      },
      include: {
        users: {
          take: 5,
        },
        vehicles: {
          take: 5,
        },
      },
    })

    return department
  }

  async getDepartments() {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            users: true,
            vehicles: true,
            fuelRequests: true,
          },
        },
        users: {
          where: { role: 'HEAD_OF_DEPARTMENT' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })

    return departments
  }

  async getDepartmentById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            department: true,
          },
        },
        vehicles: true,
        fuelRequests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            driver: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!department) {
      throw new Error('Department not found')
    }

    return department
  }

  async updateDepartment(id: string, data: { name?: string; description?: string; headUserId?: string | null }) {
    if (data.headUserId) {
      const headUser = await prisma.user.findUnique({
        where: { id: data.headUserId },
      })

      if (!headUser) {
        throw new Error('Head user not found')
      }

      if (headUser.role !== 'HEAD_OF_DEPARTMENT') {
        throw new Error('User must have HEAD_OF_DEPARTMENT role')
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        headUserId: data.headUserId,
      },
      include: {
        users: {
          take: 5,
        },
        vehicles: {
          take: 5,
        },
      },
    })

    return department
  }

  async deleteDepartment(id: string) {
    // Check if department has users
    const userCount = await prisma.user.count({
      where: { departmentId: id },
    })

    if (userCount > 0) {
      throw new Error('Cannot delete department with active users')
    }

    // Check if department has vehicles
    const vehicleCount = await prisma.vehicle.count({
      where: { departmentId: id },
    })

    if (vehicleCount > 0) {
      throw new Error('Cannot delete department with active vehicles')
    }

    await prisma.department.delete({
      where: { id },
    })

    return { success: true }
  }
}

export const departmentsService = DepartmentsService.getInstance()