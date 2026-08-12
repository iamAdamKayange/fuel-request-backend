import app from './app'
import { env } from './config/env'
import { connectDatabase, prisma } from './config/database'

const PORT = Number.parseInt(env.PORT, 10) || 5000

async function startServer() {
  await connectDatabase()

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`Environment: ${env.NODE_ENV}`)
  })

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`)
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
