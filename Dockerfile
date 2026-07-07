# ── Build stage ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f bun.lockb ]; then bun install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generar cliente Prisma
RUN npx prisma generate
# Build Next.js (sin DB, standalone ya está en next.config.ts)
ARG DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# ── Production stage ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar Prisma schema para migraciones
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]