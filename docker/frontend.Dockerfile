# GeoAgri AI — React frontend (Vite build served by nginx)
# Build context: repository root
FROM node:18-alpine AS build

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
RUN npm ci --workspace @geoagri/shared --workspace @geoagri/frontend --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY frontend frontend
RUN npm run build -w @geoagri/shared \
 && npm run build -w @geoagri/frontend

# ---------- Runtime ----------
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
