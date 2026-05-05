# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# DevNest production image — multi-stage build for any generic Node host
# (Fly.io, Cloud Run, Render, your own VPS). Vercel deployers don't need
# this file; see vercel.json + DEPLOYMENT.md.
#
# Build:  docker build -t devnest .
# Run:    docker run -p 3000:3000 --env-file .env.production devnest
# -----------------------------------------------------------------------------

ARG NODE_VERSION=20.20.2
ARG PNPM_VERSION=9.15.5

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# Corepack ships with Node ≥ 20; use it to pin pnpm.
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env: Next.js needs valid env to import server modules.
# These dummies satisfy `lib/env.ts`'s Zod check; production deploys
# inject real values at runtime via the host's secret manager.
ENV NEXTAUTH_URL=http://localhost:3000 \
    AUTH_SECRET=docker-build-placeholder-secret-32chars-min \
    DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder \
    GITHUB_CLIENT_ID=placeholder \
    GITHUB_CLIENT_SECRET=placeholder \
    GITLAB_CLIENT_ID=placeholder \
    GITLAB_CLIENT_SECRET=placeholder \
    EMAIL_SERVER_HOST=localhost \
    EMAIL_SERVER_PORT=1025 \
    EMAIL_FROM=DevNest <noreply@example.local>

RUN pnpm build

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S devnest && adduser -S -G devnest devnest

# Copy the built Next.js app + its production deps.
COPY --from=builder --chown=devnest:devnest /app/.next ./.next
COPY --from=builder --chown=devnest:devnest /app/public ./public
COPY --from=builder --chown=devnest:devnest /app/node_modules ./node_modules
COPY --from=builder --chown=devnest:devnest /app/package.json ./package.json
COPY --from=builder --chown=devnest:devnest /app/drizzle ./drizzle
COPY --from=builder --chown=devnest:devnest /app/drizzle.config.ts ./drizzle.config.ts

USER devnest
EXPOSE 3000

# Health probe: GET /api/health returns 200/503 per spec.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
