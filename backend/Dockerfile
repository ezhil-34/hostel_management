# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Base — shared by dev and prod
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
# Prisma's engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl libc6-compat

# ---------------------------------------------------------------------------
# deps — install everything, generate the Prisma client
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# ---------------------------------------------------------------------------
# development — hot reload via nodemon (polling; see nodemon.json for why),
# source bind-mounted by compose
# ---------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# production — prod deps only, runs as a non-root user
# ---------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
