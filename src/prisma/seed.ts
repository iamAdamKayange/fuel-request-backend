import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../config/env'
import { hashPassword } from '../utils/helpers'

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting seed...')

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: 'Habari' },
      update: {},
      create: { name: 'Habari', description: 'Department of Information' },
    }),
    prisma.department.upsert({
      where: { name: 'Utamaduni' },
      update: {},
      create: { name: 'Utamaduni', description: 'Department of Culture' },
    }),
    prisma.department.upsert({
      where: { name: 'Sanaa' },
      update: {},
      create: { name: 'Sanaa', description: 'Department of Arts' },
    }),
    prisma.department.upsert({
      where: { name: 'Michezo' },
      update: {},
      create: { name: 'Michezo', description: 'Department of Sports' },
    }),
    prisma.department.upsert({
      where: { name: 'Usafirishaji' },
      update: {},
      create: { name: 'Usafirishaji', description: 'Department of Transport' },
    }),
  ])

  console.log(`✅ Created ${departments.length} departments`)

  // Create admin user
  const adminPassword = await hashPassword('Admin@123')
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wizara.go.tz' },
    update: {},
    create: {
      employeeNumber: 'ADMIN-001',
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@wizara.go.tz',
      password: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  })

  console.log(`✅ Admin created: ${admin.email}`)

  // Create requested manual admin user
  const adamPassword = await hashPassword('adam123')
  const adamAdmin = await prisma.user.upsert({
    where: { email: 'adamkayange223@gmail.com' },
    update: {
      firstName: 'Adam',
      lastName: 'Kayange',
      password: adamPassword,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      employeeNumber: 'ADMIN-ADAM-001',
      firstName: 'Adam',
      lastName: 'Kayange',
      email: 'adamkayange223@gmail.com',
      password: adamPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  })

  console.log(`Requested admin created/updated: ${adamAdmin.email}`)

  // Create head of department for each department
  for (const dept of departments) {
    const headPassword = await hashPassword('Head@123')
    const head = await prisma.user.upsert({
      where: { email: `head.${dept.name.toLowerCase()}@wizara.go.tz` },
      update: {},
      create: {
        employeeNumber: `HOD-${dept.name.substring(0, 3).toUpperCase()}-001`,
        firstName: 'Head',
        lastName: dept.name,
        email: `head.${dept.name.toLowerCase()}@wizara.go.tz`,
        password: headPassword,
        role: Role.HEAD_OF_DEPARTMENT,
        departmentId: dept.id,
        isActive: true,
      },
    })

    // Update department with head user
    await prisma.department.update({
      where: { id: dept.id },
      data: { headUserId: head.id },
    })

    console.log(`✅ Head of ${dept.name} created: ${head.email}`)
  }

  // Create other users
  const otherUsers = [
    {
      email: 'driver@wizara.go.tz',
      firstName: 'Driver',
      lastName: 'User',
      role: Role.DRIVER,
      departmentId: departments.find(d => d.name === 'Usafirishaji')?.id,
    },
    {
      email: 'transport@wizara.go.tz',
      firstName: 'Transport',
      lastName: 'Officer',
      role: Role.TRANSPORT_OFFICER,
      departmentId: departments.find(d => d.name === 'Usafirishaji')?.id,
    },
    {
      email: 'ada.dahrm@wizara.go.tz',
      firstName: 'ADA',
      lastName: 'DAHRM',
      role: Role.ADA_DAHRM,
      departmentId: departments.find(d => d.name === 'Habari')?.id,
    },
    {
      email: 'procurement@wizara.go.tz',
      firstName: 'Procurement',
      lastName: 'Officer',
      role: Role.PROCUREMENT,
      departmentId: departments.find(d => d.name === 'Habari')?.id,
    },
  ]

  for (const userData of otherUsers) {
    const password = await hashPassword('User@123')
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        employeeNumber: `${userData.role}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password,
        role: userData.role as Role,
        departmentId: userData.departmentId,
        isActive: true,
      },
    })
    console.log(`✅ ${userData.role} created: ${userData.email}`)
  }

  console.log('🎉 Seed completed successfully!')
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
