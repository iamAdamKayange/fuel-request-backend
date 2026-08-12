import { prisma } from '../../config/database'

export class VehiclesService {
  private static instance: VehiclesService

  static getInstance(): VehiclesService {
    if (!VehiclesService.instance) {
      VehiclesService.instance = new VehiclesService()
    }
    return VehiclesService.instance
  }

  async createVehicle(data: {
    vehicleNumber: string
    gpsa: string
    fuelType: string
    departmentId: string
  }) {
    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { vehicleNumber: data.vehicleNumber },
    })

    if (existingVehicle) {
      throw new Error('Vehicle with this number already exists')
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
    })

    if (!department) {
      throw new Error('Department not found')
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleNumber: data.vehicleNumber,
        gpsa: data.gpsa,
        fuelType: data.fuelType as any,
        departmentId: data.departmentId,
        isActive: true,
      },
      include: {
        department: true,
      },
    })

    return vehicle
  }

  async getVehicles(page: number = 1, limit: number = 10, filters?: any) {
    const skip = (page - 1) * limit
    const where: any = {}

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId
    }

    if (filters?.fuelType) {
      where.fuelType = filters.fuelType
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters?.search) {
      where.OR = [
        { vehicleNumber: { contains: filters.search, mode: 'insensitive' } },
        { gpsa: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          department: true,
          _count: {
            select: {
              fuelRequests: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.count({ where }),
    ])

    return {
      vehicles,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getVehicleById(id: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        department: true,
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

    if (!vehicle) {
      throw new Error('Vehicle not found')
    }

    return vehicle
  }

  async updateVehicle(id: string, data: {
    vehicleNumber?: string
    gpsa?: string
    fuelType?: string
    departmentId?: string
    isActive?: boolean
  }) {
    if (data.vehicleNumber) {
      const existingVehicle = await prisma.vehicle.findFirst({
        where: {
          vehicleNumber: data.vehicleNumber,
          id: { not: id },
        },
      })

      if (existingVehicle) {
        throw new Error('Vehicle with this number already exists')
      }
    }

    if (data.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId },
      })

      if (!department) {
        throw new Error('Department not found')
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        vehicleNumber: data.vehicleNumber,
        gpsa: data.gpsa,
        fuelType: data.fuelType as any,
        departmentId: data.departmentId,
        isActive: data.isActive,
      },
      include: {
        department: true,
      },
    })

    return vehicle
  }

  async deleteVehicle(id: string) {
    // Check if vehicle has fuel requests
    const requestCount = await prisma.fuelRequest.count({
      where: { vehicleId: id },
    })

    if (requestCount > 0) {
      throw new Error('Cannot delete vehicle with associated fuel requests')
    }

    await prisma.vehicle.delete({
      where: { id },
    })

    return { success: true }
  }
}

export const vehiclesService = VehiclesService.getInstance()