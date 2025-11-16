ARG NODE_VERSION=20
ARG VERSION=v0.0.0-alpha

# Build stage
FROM node:${NODE_VERSION}-alpine AS builder

LABEL maintainer="INTEF <cedec@educacion.gob.es>"
LABEL org.opencontainers.image.title="eXeLearning"
LABEL org.opencontainers.image.description="eXeLearning Docker Image"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:${NODE_VERSION}-alpine

ENV NODE_ENV=production \
    VERSION=${VERSION} \
    APP_PORT=8080

WORKDIR /app

# Copy built application and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

HEALTHCHECK --interval=1m --timeout=15s --start-period=1m --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${APP_PORT}/health || exit 1

EXPOSE ${APP_PORT}

CMD ["node", "dist/main.js"]