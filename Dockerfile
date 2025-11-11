# Multi-stage build for PEL Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/common/package*.json ./packages/common/
COPY packages/pel/package*.json ./packages/pel/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/common ./packages/common
COPY packages/pel ./packages/pel
COPY tsconfig.json ./

# Build packages
RUN npm run build:common
RUN npm run build:pel

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY packages/common/package*.json ./packages/common/
COPY packages/pel/package*.json ./packages/pel/

RUN npm ci --production --workspace=@openade/common --workspace=@openade/pel

# Copy built files
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/pel/dist ./packages/pel/dist

# Copy example PEL server
COPY examples/pel ./examples/pel

# Create data directory
RUN mkdir -p /app/data

# Expose ports (PEL server + Audit server)
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start PEL server
CMD ["node", "examples/pel/src/index.js"]

