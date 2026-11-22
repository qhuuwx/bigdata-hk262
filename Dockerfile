# ==============================================================================
# Dockerfile - Multi-Stage Build for React SPA & Nginx Production Server
# ==============================================================================

# Stage 1: Build React Frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --silent
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve Production Assets with Nginx Alpine
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
RUN find . -maxdepth 1 ! -name '.' ! -name '50x.html' -exec rm -rf {} +
COPY --from=builder /app/dist/ ./
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
