# Dockerfile for AI Ops Assistant Frontend (React/Vite + Nginx)
# 多階段構建優化版本 - 支援環境變數注入和效能優化

# =============================================================================
# 階段一：建置階段 (Builder)
# =============================================================================
FROM node:20-alpine AS builder

# 設定工作目錄
WORKDIR /app

# 複製 package 檔案並安裝依賴
COPY package*.json ./
RUN npm install

# 複製原始碼
COPY . .

# 設定建置時環境變數
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_ENVIRONMENT=production

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENVIRONMENT=$VITE_ENVIRONMENT

# 執行建置
RUN npm run build

# 驗證建置結果
RUN ls -la /app/dist && \
    test -f /app/dist/index.html || (echo "Build failed: index.html not found" && exit 1)

# =============================================================================
# 階段二：生產階段 (Production)
# =============================================================================
FROM nginx:1.27-alpine AS production

# 建立非 root 用戶以提升安全性
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# 安裝必要的運行時工具
RUN apk add --no-cache curl

# 從建置階段複製打包好的靜態檔案
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製自定義 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 建立 Nginx 運行所需的目錄並設定權限
RUN mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appuser /var/cache/nginx && \
    chown -R appuser:appuser /var/log/nginx && \
    chown appuser:appuser /var/run/nginx.pid && \
    chmod 755 /var/cache/nginx

# 建立健康檢查腳本
RUN echo '#!/bin/sh\ncurl -f http://localhost:80/ || exit 1' > /usr/local/bin/health-check.sh && \
    chmod +x /usr/local/bin/health-check.sh

# 設定環境變數
ENV NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024

# 暴露端口
EXPOSE 80

# 健康檢查配置
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/health-check.sh"]

# 使用非 root 用戶執行 (注意：Nginx 需要特殊配置才能以非 root 用戶運行)
# 暫時保持 root 用戶執行，但限制權限
USER root

# 定義容器啟動指令
CMD ["nginx", "-g", "daemon off;"]