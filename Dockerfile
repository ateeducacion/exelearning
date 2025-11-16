# syntax=docker/dockerfile:1
# eXeLearning NestJS Production Dockerfile
# Optimized for node:24-alpine with dumb-init

ARG NODE_VERSION=24
ARG VERSION=v0.0.0-alpha

################################################################################
# Build stage - Compile TypeScript and prepare dependencies
################################################################################
FROM node:${NODE_VERSION}-alpine AS builder

# Install build dependencies for native modules (if needed)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for dependency installation
# This layer will be cached unless package files change
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev && \
    npm cache clean --force

# Copy source code and configuration files needed for build
COPY tsconfig.json ./
COPY src/ ./src/

# Build the TypeScript application
RUN npm run build

# Prune devDependencies after build
RUN npm prune --omit=dev && \
    npm cache clean --force

################################################################################
# Production stage - Minimal runtime image with dumb-init
################################################################################
FROM node:${NODE_VERSION}-alpine

# Metadata labels following OCI Image Format Specification
LABEL maintainer="INTEF <cedec@educacion.gob.es>"
LABEL org.opencontainers.image.title="eXeLearning"
LABEL org.opencontainers.image.description="eXeLearning NestJS Application - Educational Content Authoring Tool"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="INTEF - Instituto Nacional de Tecnologías Educativas y de Formación del Profesorado"
LABEL org.opencontainers.image.url="https://exelearning.net"
LABEL org.opencontainers.image.source="https://github.com/exelearning/exelearning"
LABEL org.opencontainers.image.documentation="https://exelearning.net/docs"

# Install dumb-init for proper signal handling
# dumb-init acts as PID 1 and forwards signals to child processes
RUN apk add --no-cache dumb-init

# Environment variables for production
ENV NODE_ENV=production \
    VERSION=${VERSION} \
    APP_PORT=8080 \
    NEST_PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy compiled application
COPY --from=builder --chown=node:node /app/dist ./dist

# Copy package files (needed for metadata)
COPY --chown=node:node package*.json ./

# Copy runtime assets (templates, static files, translations)
COPY --chown=node:node views/ ./views/
COPY --chown=node:node public/ ./public/
COPY --chown=node:node translations/ ./translations/

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Use non-root user (node user is built-in to node:alpine)
USER node

# Health check - uses NestJS health endpoint
# Adjust the path based on your actual health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${NEST_PORT}/healthcheck || \
      wget --no-verbose --tries=1 --spider http://localhost:${NEST_PORT}/api/healthcheck || \
      exit 1

# Expose the application port
# Note: NEST_PORT defaults to 3000, but can be overridden via environment
EXPOSE ${NEST_PORT}

# Use dumb-init as the entry point for proper signal handling
# This ensures graceful shutdown when receiving SIGTERM/SIGINT
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the NestJS application
# Uses the compiled output from dist/main.js
CMD ["node", "dist/main.js"]
