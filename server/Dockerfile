# ── Build Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma/schema.prisma ./prisma/

# Install all dependencies including devDependencies to run Prisma generation
RUN npm ci

COPY . .
RUN npx prisma generate

# ── Runner Stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Run as a non-privileged system user for security compliance
RUN addgroup -S admateine && adduser -S admateine -G admateine

COPY --from=builder --chown=admateine:admateine /app/node_modules ./node_modules
COPY --from=builder --chown=admateine:admateine /app/src          ./src
COPY --from=builder --chown=admateine:admateine /app/prisma       ./prisma
COPY --from=builder --chown=admateine:admateine /app/package*.json ./

USER admateine

ENV NODE_ENV=production
EXPOSE 5000

# Endpoint health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(res => res.status === 200 ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
