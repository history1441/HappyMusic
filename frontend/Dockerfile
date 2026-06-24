# Stage 1: Build frontend(Vite 产物,依赖 common 共享代码)
FROM node:20-alpine AS builder
WORKDIR /app

# 先复制 common 依赖清单并安装(common 被 frontend 通过 @common 别名引用)
COPY common/package.json common/package-lock.json* ./common/
RUN cd common && npm install --no-audit --no-fund

# 复制 frontend 依赖清单并安装
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund

# 复制源码(common 必须在 frontend 能访问的路径)
COPY common/ ./common/
COPY frontend/ ./frontend/

# 构建 frontend
RUN cd frontend && npm run build


# Stage 2: nginx 提供静态文件服务
FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
