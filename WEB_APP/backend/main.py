#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 網路維運助理 - 主應用程式

網路設備管理與 AI 分析的 Web API 服務
- 提供設備指令執行接口
- 支援 AI 智能故障診斷
- 管理設備連線與監控
- 處理網路流量分析

Created: 2025-08-22
Author: Claude Code Assistant
"""

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# 設定專案路徑
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# 載入環境變數
from dotenv import load_dotenv


# 智能環境變數載入
def _load_env():
    """載入環境變數設定
    
    自動偵測 Docker 或本地環境並載入相關配置
    """
    is_docker = os.path.exists("/.dockerenv") or os.getenv("PYTHONPATH") == "/app"

    if is_docker:
        print("🐳 Docker 環境 - 使用容器環境變數")
        return True
    else:
        print("💻 本地環境 - 搜尋 .env 檔案")
        env_paths = [
            project_root / ".env",
            Path(__file__).parent.parent / ".env",
        ]

        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(env_path)
                print(f"✅ 載入環境變數: {env_path}")
                return True

        print("❌ 未找到 .env 檔案")
        return False


# 載入環境變數
env_loaded = _load_env()

import uvicorn

# FastAPI 相關匯入
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from clickhouse.routes import router as clickhouse_router

# 匯入路由模組
from unified_routes import admin_router, health_router, router

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# 應用程式資訊
APP_VERSION = "3.0.0"


# =============================================================================
# 應用程式生命週期管理
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理
    
    啟動時初始化服務，關閉時清理資源
    """
    # 啟動階段
    try:
        logger.info("開始啟動 AI 網路維運助理 API")

        # 初始化基本服務
        from ai.service import get_ai_service
        from settings import get_settings
        from task_manager import get_task_manager

        # 設定全域物件
        app.state.settings = get_settings()
        app.state.task_manager = get_task_manager()
        app.state.ai_service = get_ai_service()

        logger.info(f"環境變數載入: {'成功' if env_loaded else '失敗'}")
        logger.info(f"AI 提供者: {app.state.settings.AI_PROVIDER}")
        logger.info(f"Gemini 配置: {app.state.settings.get_gemini_configured()}")
        logger.info(f"Claude 配置: {app.state.settings.get_claude_configured()}")
        logger.info("所有服務初始化完成")

        yield  # 開始處理請求

    except Exception as e:
        logger.error(f"啟動失敗: {e}", exc_info=True)
        raise

    # 關閉階段
    try:
        logger.info("開始關閉應用程式")
        # 執行標準關閉流程
        logger.info("應用程式已安全關閉")

    except Exception as e:
        logger.error(f"關閉失敗: {e}", exc_info=True)


# =============================================================================
# FastAPI 應用程式初始化
# =============================================================================

app = FastAPI(
    title="AI 網路維運助理 API",
    description="網路設備指令執行與 AI 智能分析",
    version=APP_VERSION,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# =============================================================================
# 中間件配置
# =============================================================================


# CORS 配置
def get_cors_origins():
    """設定 CORS 允許的來源
    
    支援本地開發和 Docker 環境的跨域存取
    """
    origins = [
        # 容器間通信
        "http://frontend",
        "http://ai_ops_frontend",
        # 本地開發
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:80",
        "http://127.0.0.1:80",
    ]

    # 從環境變數添加外部 IP
    external_ip = os.getenv("EXTERNAL_IP")
    if external_ip:
        origins.append(f"http://{external_ip}")
        origins.append(f"https://{external_ip}")

    # 從環境變數添加內部 IP
    internal_ip = os.getenv("INTERNAL_IP")
    if internal_ip:
        origins.append(f"http://{internal_ip}")

    # 從環境變數添加其他允許的來源
    cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS")
    if cors_origins_env:
        additional_origins = cors_origins_env.split(",")
        origins.extend([origin.strip() for origin in additional_origins])

    return origins


allowed_origins = get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# GZip 壓縮
app.add_middleware(GZipMiddleware, minimum_size=1000)


# 監控中間件
@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    """請求監控中間件
    
    記錄請求處理時間與狀態
    """
    import time
    import uuid

    # 生成請求 ID
    request_id = f"req_{str(uuid.uuid4())[:8]}"
    start_time = time.time()

    # 健檢路徑使用 DEBUG 級別記錄，減少日誌噪音
    if request.url.path == "/health":
        logger.debug(f"[{request_id}] 健檢請求: {request.method} {request.url.path}")
    else:
        logger.info(f"[{request_id}] 請求開始: {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        process_time = time.time() - start_time

        # 添加響应头
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.6f}"

        # 健檢路徑使用 DEBUG 級別記錄
        if request.url.path == "/health":
            logger.debug(
                f"[{request_id}] 健檢完成: {response.status_code} ({process_time:.3f}s)"
            )
        else:
            logger.info(
                f"[{request_id}] 請求完成: {response.status_code} ({process_time:.3f}s)"
            )
        return response

    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"[{request_id}] 請求錯誤: {type(e).__name__} ({process_time:.3f}s)",
            exc_info=True,
        )
        raise


logger.info(f"中間件配置完成 - CORS 來源: {len(allowed_origins)} 個")

# =============================================================================
# 註冊路由
# =============================================================================

app.include_router(health_router)  # 健康檢查路由 (無前綴)
app.include_router(router)  # 主要 API 路由 (/api)
app.include_router(admin_router)  # 管理路由 (/api/admin)
app.include_router(clickhouse_router)  # ClickHouse 流量分析路由 (/api/flows)
logger.info("路由註冊完成")

# =============================================================================
# 路由除錯
# =============================================================================


def print_routes():
    """列印所有 API 路由
    
    開發模式下顯示可用的 API 端點
    """
    from fastapi.routing import APIRoute

    print("=" * 80)
    print("             API 路由列表             ")
    print("=" * 80)
    route_count = 0
    for route in app.routes:
        if isinstance(route, APIRoute):
            methods = ",".join(route.methods)
            print(f"{methods:<10} {route.path:<50} -> {route.name}")
            route_count += 1
    print("=" * 80)
    print(f"總計 {route_count} 個路由")
    print("=" * 80)


# 只在開發環境或除錯模式下顯示路由
if os.getenv("DEBUG", "false").lower() == "true" or env_loaded:
    print_routes()

# =============================================================================
# 主程式進入點
# =============================================================================

if __name__ == "__main__":
    logger.info("啟動 AI 網路維運助理 API")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info", access_log=True)
