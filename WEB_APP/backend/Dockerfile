# Dockerfile for AI Ops Assistant Backend (Python/FastAPI)
# 多階段構建優化版本 - 支援企業級配置管理和健康檢查

# =============================================================================
# 階段一：依賴安裝階段
# =============================================================================
FROM python:3.11-slim AS dependencies

# 安裝系統依賴和編譯工具
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 設定工作目錄
WORKDIR /app

# 複製並安裝 Python 依賴
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# =============================================================================
# 階段二：生產運行階段
# =============================================================================
FROM python:3.11-slim AS production

# 建立非 root 用戶以提升安全性
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 安裝必要的運行時依賴
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 設定工作目錄
WORKDIR /app

# 從依賴階段複製已安裝的 Python 套件
COPY --from=dependencies /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# 建立必要的目錄結構
RUN mkdir -p /app/logs /app/config /app/templates /app/core /app/models /app/routers && \
    chown -R appuser:appuser /app

# 複製應用程式代碼
COPY --chown=appuser:appuser . .

# 設定環境變數
ENV PYTHONPATH="/app" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# 建立健康檢查腳本
RUN echo '#!/bin/bash\ncurl -f http://localhost:8000/health || exit 1' > /app/health-check.sh && \
    chmod +x /app/health-check.sh && \
    chown appuser:appuser /app/health-check.sh

# 切換到非 root 用戶
USER appuser

# 暴露後端服務端口
EXPOSE 8000

# 健康檢查配置
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/app/health-check.sh"]

# 定義容器啟動指令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]