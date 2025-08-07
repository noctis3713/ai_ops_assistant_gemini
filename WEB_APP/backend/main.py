"""Web CLI API for network device commands and AI analysis - 模組化重構版本"""

import asyncio
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# 載入環境變數
env_loaded = load_dotenv("config/.env")

# 先導入 settings 才能使用
from core.settings import Settings, get_settings, settings

# 環境變數已載入，settings 可使用

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ai_service import get_ai_service

# 導入非同步任務管理器
from async_task_manager import get_task_manager, shutdown_task_manager

# 導入新的模組化組件
from config_manager import get_config_manager
from core.exceptions import ServiceError
from models.common import BaseResponse
from utils import LoggerConfig, create_stream_handler

# 導入路由模組
from routers import device_routes, execution_routes, task_routes, admin_routes
from routers.dependencies import get_config_manager_dep, get_ai_service_dep, get_task_manager_dep, get_settings_dep

# 設定 UTF-8 編碼
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# 設定根日誌系統（包含控制台輸出）
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[create_stream_handler()],
    force=True,
)

logger = logging.getLogger(__name__)

# 應用程式版本常數
APP_VERSION = "2.6.6"

# 初始化 FastAPI 應用程式
app = FastAPI(
    title="AI 網路維運助理 API",
    description="網路設備指令執行與 AI 智能分析 Web 介面 - 模組化架構",
    version=APP_VERSION,
)

# 設定 CORS 中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# 全域異常處理器 - 企業級錯誤處理機制
# =============================================================================

@app.exception_handler(ServiceError)
async def service_exception_handler(request: Request, exc: ServiceError):
    """
    捕獲所有自訂的 ServiceError 異常
    提供統一的服務層錯誤回應格式
    """
    logger.warning(f"服務層發生錯誤: {exc.detail} (路徑: {request.url.path})")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=BaseResponse.error_response(
            message=exc.detail,
            error_code=exc.error_code
        ).model_dump(exclude_unset=True),
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    捕獲所有未被處理的通用 Exception 異常
    最後的防線，確保不會有未處理的異常
    """
    logger.error(f"發生未預期的全域錯誤: {exc} (路徑: {request.url.path})", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content=BaseResponse.error_response(
            message="內部伺服器發生未預期錯誤，請聯繫管理員",
            error_code="INTERNAL_SERVER_ERROR"
        ).model_dump(exclude_unset=True),
    )

# =============================================================================
# 應用程式生命週期事件
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """應用程式啟動時執行的事件 - 初始化所有服務實例"""
    try:
        # 初始化並掛載所有服務到 app.state
        app.state.settings = settings
        app.state.config_manager = get_config_manager()
        app.state.ai_service = get_ai_service()
        app.state.app_logger = LoggerConfig.setup_logger("web_app", "app.log")
        app.state.task_manager = get_task_manager()

        # 啟動任務管理器清理循環
        await app.state.task_manager.start_cleanup_loop()

        logger.info(f"Settings 配置驗證完成 - AI Provider: {settings.AI_PROVIDER}")
        logger.info(f"AI 服務配置狀態 - Gemini: {settings.get_gemini_configured()}, Claude: {settings.get_claude_configured()}")
        
        logger.info("應用程式啟動完成，所有服務已初始化並注入 app.state")
    except Exception as e:
        logger.error(f"啟動事件處理失敗: {e}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_event():
    """應用程式關閉時執行的事件"""
    try:
        # 關閉任務管理器
        await shutdown_task_manager()
        logger.info("應用程式已安全關閉")
    except Exception as e:
        logger.error(f"關閉事件處理失敗: {e}", exc_info=True)

# =============================================================================
# 註冊路由模組
# =============================================================================

# 註冊所有路由模組
app.include_router(device_routes.router)
app.include_router(execution_routes.router)
app.include_router(task_routes.router)
app.include_router(admin_routes.router)

# 註冊管理路由的狀態端點（非 /admin 路徑）
app.include_router(admin_routes.status_router)

# =============================================================================
# 基本端點（保留必要的端點）
# =============================================================================

@app.get("/")
async def root():
    """根路徑，提供API資訊"""
    return {
        "message": "Web CLI API 服務運行中 - 模組化架構",
        "version": APP_VERSION, 
        "architecture": "模組化路由架構",
        "modules": {
            "device_management": "設備管理 (/api/devices, /api/device-groups, /api/devices/status)",
            "command_execution": "指令執行 (/api/execute, /api/ai-query, /api/batch-execute)",
            "task_management": "任務管理 (/api/tasks, /api/task/{id})",
            "system_admin": "系統管理 (/api/admin/*, /api/ai-status)"
        },
        "ai_provider": settings.AI_PROVIDER,
        "documentation": "/docs"
    }

@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {
        "status": "healthy", 
        "message": "API 服務運行正常 - 模組化架構",
        "version": APP_VERSION,
        "timestamp": datetime.now().isoformat()
    }

# =============================================================================
# 應用程式啟動
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    logger.info("啟動 FastAPI 應用程式 - 模組化架構")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )
