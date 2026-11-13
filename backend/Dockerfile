# ===================================================
# Stage 1: Build stage
# ===================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies for nest build)
RUN npm ci

# Copy source code and config
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --production

# ===================================================
# Stage 2: Production runner
# ===================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install curl/wget for container healthchecks
RUN apk add --no-cache wget

# Create non-root system user and group for security
RUN addgroup -S pidetelo && adduser -S pidetelo -G pidetelo

# Copy production node_modules from builder
COPY --from=builder --chown=pidetelo:pidetelo /app/node_modules ./node_modules
# Copy compiled application code
COPY --from=builder --chown=pidetelo:pidetelo /app/dist ./dist
# Copy package manifest
COPY --from=builder --chown=pidetelo:pidetelo /app/package*.json ./

# Create persistent storage directories for WhatsApp and uploads
RUN mkdir -p /app/data /app/uploads && chown -R pidetelo:pidetelo /app/data /app/uploads

# Switch to non-root user
USER pidetelo

# Expose NestJS default port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/docs || exit 1

# Start production server
CMD ["node", "dist/main.js"]
