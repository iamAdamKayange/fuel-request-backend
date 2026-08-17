import app from './app'
import { env } from './config/env'
import { connectDatabase, prisma } from './config/database'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const PORT = Number.parseInt(env.PORT, 10) || 5000

async function startServer() {
  try {
    await runDatabaseMigrations()

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

async function runDatabaseMigrations() {
  if (env.NODE_ENV !== 'production') {
    return
  }

  try {
    console.log('Running database migrations...')

    const prismaBinary = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const schemaPath = path.join(process.cwd(), 'src', 'prisma', 'schema.prisma')

    execFileSync(prismaBinary, ['prisma', 'migrate', 'deploy', '--schema', schemaPath], {
      stdio: 'inherit',
      env: process.env,
    })

    console.log('Database migrations completed')
  } catch (error) {
    console.error('Failed to run database migrations:', error)
    throw error
  }
}

void startServer()
