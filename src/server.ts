import app from './app'
import { env } from './config/env'
import { connectDatabase, prisma } from './config/database'

const PORT = Number.parseInt(env.PORT, 10) || 5000

async function startServer() {
  try {
    // Connect to database before starting HTTP server
    await connectDatabase()

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`Environment: ${env.NODE_ENV}`)
    })

    const shutdown = async (signal: string) => {
      console.log(
        `${signal} received, shutting down gracefully...`
      )

      server.close(async () => {
        try {
          await prisma.$disconnect()
          console.log('Database connection closed')
          process.exit(0)
        } catch (error) {
          console.error(
            'Error while disconnecting database:',
            error
          )
          process.exit(1)
        }
      })
    }

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM')
    })

    process.on('SIGINT', () => {
      void shutdown('SIGINT')
    })
  } catch (error) {
    console.error('Failed to start server:', error)

    try {
      await prisma.$disconnect()
    } catch {
      // Ignore disconnect error during startup failure
    }

    process.exit(1)
  }
}

void startServer()