# GeoAgri AI — Node.js backend (Fastify + Prisma)
# Build context: repository root
FROM node:18-alpine AS build

# Prisma engines require OpenSSL on Alpine (musl)
RUN apk add --no-cache openssl

WORKDIR /app

# Install workspace dependencies first (better layer caching)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN npm ci --workspace @geoagri/shared --workspace @geoagri/backend --include-workspace-root

# Build shared package, generate Prisma client, compile backend
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY prisma prisma
COPY backend backend
RUN npm run build -w @geoagri/shared \
 && npm run db:generate -w @geoagri/backend \
 && npm run build -w @geoagri/backend

# ---------- Runtime ----------
FROM node:18-alpine

# Prisma engines require OpenSSL on Alpine (musl)
RUN apk add --no-cache openssl

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/prisma prisma
COPY docker/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /app/database/uploads /app/database/reports /app/database/ndvi

EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
