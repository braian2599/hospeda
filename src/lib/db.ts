import { PrismaClient } from '@prisma/client'
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'

// Force .env values to override system env vars
// In sandbox environments, system DATABASE_URL may point to SQLite
// This ensures the Neon PostgreSQL URL from .env is always used
dotenvConfig({ path: resolve(process.cwd(), '.env'), override: true })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
