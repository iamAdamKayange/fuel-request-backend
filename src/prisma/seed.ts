import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { env } from '../config/env'
import { hashPassword } from '../utils/helpers'
import { DEFAULT_ORGANIZATION_UNITS } from '../utils/organization'

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function slugifyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function main() {
  console.log('🌱 Starting seed...')

  // Create departments and units
  const departments = await Promise.all(
    DEFAULT_ORGANIZATION_UNITS.map((unit) =>
      prisma.department.upsert({
        where: { name: unit.name },
        update: { description: unit.description },
        create: unit,
      })
    )
  )

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
      title: 'Msimamizi wa Mfumo',
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
      title: 'Msimamizi',
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
  for (const [index, dept] of departments.entries()) {
    const headPassword = await hashPassword('Head@123')
    const departmentSlug = slugifyName(dept.name)
    const head = await prisma.user.upsert({
      where: { email: `head.${departmentSlug}@wizara.go.tz` },
      update: {},
      create: {
        employeeNumber: `HOD-${String(index + 1).padStart(3, '0')}`,
        firstName: 'Head',
        lastName: dept.name,
        title: dept.description === 'Kitengo' ? 'Mkurugenzi wa Kitengo' : 'Mkuu wa Idara',
        email: `head.${departmentSlug}@wizara.go.tz`,
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
      title: 'Dereva',
      role: Role.DRIVER,
      departmentId: departments.find(d => d.name === 'IDARA YA UTAWALA NA RASLIMALI WATU')?.id,
    },
    {
      email: 'transport@wizara.go.tz',
      firstName: 'Transport',
      lastName: 'Officer',
      title: 'Afisa Usafirishaji',
      role: Role.TRANSPORT_OFFICER,
      departmentId: departments.find(d => d.name === 'IDARA YA UTAWALA NA RASLIMALI WATU')?.id,
    },
    {
      email: 'ada.dahrm@wizara.go.tz',
      firstName: 'ADA',
      lastName: 'ADA',
      title: 'ADA',
      role: Role.ADA_DAHRM,
      departmentId: departments.find(d => d.name === 'IDARA YA HABARI')?.id,
    },
    {
      email: 'procurement@wizara.go.tz',
      firstName: 'Procurement',
      lastName: 'Officer',
      title: 'Ununuzi na Ugavi',
      role: Role.PROCUREMENT,
      departmentId: departments.find(d => d.name === 'KITENGO CHA UGAVI NA MANUNUZI')?.id,
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
        title: userData.title,
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
