# Chakra Lens web image: Vite build -> nginx-unprivileged on :8080, offline-ready.
FROM node:22-alpine AS builder
WORKDIR /app
COPY web/package.json web/package-lock.json ./web/
COPY spec/ ./spec/
COPY models-export/ ./models-export/
COPY models/ ./models/
COPY scripts/build-sw.mjs ./scripts/build-sw.mjs
COPY scripts/copy-models.mjs ./scripts/copy-models.mjs
RUN cd web && npm ci
COPY web/ ./web/
RUN cd web && npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
EXPOSE 8080
