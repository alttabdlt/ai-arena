# ============================================
# AI Town — Single-service Dockerfile
# Serves frontend + backend from one container
# ============================================

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*

# ---- Stage 1: Build frontend ----
FROM base AS frontend-build
WORKDIR /app/frontend
COPY app/package.json app/package-lock.json* ./
RUN npm ci
COPY app/ ./
RUN npx vite build

# ---- Stage 2: Install backend deps ----
FROM base AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

# ---- Stage 3: Production image ----
FROM base AS production
WORKDIR /app

# Copy backend with deps
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Generate Prisma client
WORKDIR /app/backend
RUN npx prisma generate

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist /app/app/dist

# Copy startup script
COPY scripts/start-production.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create data directory for SQLite persistent volume
RUN mkdir -p /data

WORKDIR /app/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

ENV NODE_ENV=production
ENV FAST_STARTUP=true
ENV SERVE_FRONTEND=true
ENV PORT=4000

CMD ["/app/start.sh"]
