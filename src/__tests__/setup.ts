/// <reference types="@types/jest" />

// Test setup file
import { prisma } from '../config/database'

beforeAll(async () => {
  // Setup test database connection if needed
  // For now, we'll use the existing database
})

afterAll(async () => {
  // Cleanup after all tests
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Cleanup before each test if needed
})

afterEach(async () => {
  // Cleanup after each test if needed
})