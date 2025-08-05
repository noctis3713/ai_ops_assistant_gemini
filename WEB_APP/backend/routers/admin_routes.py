#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
管理功能路由模組

提供管理功能相關的 API 端點：
- 配置重載
- 提示詞管理
- 前端日誌收集
- AI 服務狀態查詢

Created: 2025-08-04
Author: Claude Code Assistant
"""

import logging
import sys
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from starlette import status

# 導入核心服務和依賴
from .dependencies import get_ai_service_dep, get_settings_dep
from core.settings import Settings
from utils import get_frontend_log_handler

# 導入 Pydantic 模型
from pydantic import BaseModel
from typing import TypeVar, Generic
from datetime import datetime

# 設定日誌
logger = logging.getLogger(__name__)

# 建立路由器實例
router = APIRouter(
    prefix="/api/admin",
    tags=["系統管理"]
)

# 額外的非管理端點（與管理相關但不在 /admin 路徑下）
status_router = APIRouter(
    prefix="/api", 
    tags=["系統狀態"]
)

# =============================================================================
# Pydantic 模型定義 (管理功能相關) - 企業級 Generic[T] 型別安全
# =============================================================================

T = TypeVar("T")

class BaseResponse(BaseModel, Generic[T]):
    """統一的 API 回應格式 - 企業級 Generic[T] 實現
    
    特色功能:
    - 完整的型別安全支援
    - 自動時間戳記產生  
    - 標準化錯誤代碼
    - IDE 智能提示支援
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: str = None

    def __init__(self, **data):
        if "timestamp" not in data or data["timestamp"] is None:
            data["timestamp"] = datetime.now().isoformat()
        super().__init__(**data)
    
    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
        schema_extra = {
            "example": {
                "success": True,
                "data": "<Generic[T] type data>",
                "message": "操作成功完成",
                "error_code": None,
                "timestamp": "2025-08-04T10:30:15.123456"
            }
        }

class ReloadConfigRequest(BaseModel):
    """配置重載請求模型"""
    api_key: str
    reload_configs: Optional[List[str]] = [
        "devices",
        "groups", 
        "security",
    ]  # 預設重載所有配置

class ReloadConfigResponse(BaseModel):
    """配置重載回應模型"""
    success: bool
    message: str
    reloaded_configs: List[str]
    timestamp: str
    errors: Optional[List[str]] = None

class FrontendLogEntry(BaseModel):
    """前端日誌條目模型"""
    timestamp: str
    level: int  # 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR
    category: str
    message: str
    data: Optional[Dict[str, Any]] = None
    stack: Optional[str] = None
    sessionId: Optional[str] = None
    userId: Optional[str] = None

class FrontendLogMetadata(BaseModel):
    """前端日誌元數據模型"""
    userAgent: str
    url: str
    timestamp: str
    sessionId: Optional[str] = None
    userId: Optional[str] = None

class FrontendLogRequest(BaseModel):
    """前端日誌請求模型"""
    logs: List[FrontendLogEntry]
    metadata: FrontendLogMetadata

class FrontendLogResponse(BaseModel):
    """前端日誌回應模型"""
    success: bool
    message: str
    logCount: int
    processedAt: str
    stats: Optional[Dict[str, Any]] = None

class FrontendLogConfig(BaseModel):
    """前端日誌配置模型"""
    enableRemoteLogging: bool
    logLevel: str
    batchSize: int
    batchInterval: int
    maxLocalStorageEntries: int
    enabledCategories: List[str]
    maxMessageLength: int
    enableStackTrace: bool

class PromptReloadResponse(BaseModel):
    """提示詞重載回應模型"""
    success: bool
    message: str
    timestamp: str
    
class AIStatusResponse(BaseModel):
    """AI 狀態查詢回應模型"""
    ai_initialized: bool
    api_keys: Dict[str, Any]
    recommendations: List[str]
    current_provider: str

# 企業級型別別名定義 - 增強 IDE 支援和程式碼可讀性
ReloadConfigResponseTyped = BaseResponse[ReloadConfigResponse]
PromptReloadResponseTyped = BaseResponse[PromptReloadResponse]
FrontendLogResponseTyped = BaseResponse[FrontendLogResponse]
FrontendLogConfigTyped = BaseResponse[FrontendLogConfig]
AIStatusResponseTyped = BaseResponse[AIStatusResponse]

# =============================================================================
# 管理功能 API 端點
# =============================================================================

@router.post(
    "/reload-config",
    response_model=ReloadConfigResponseTyped,
    summary="🔄 重載配置檔案",
    description="管理員功能：在不重啟服務的情況下重新載入配置檔案，支援熱重載功能",
    response_description="配置重載結果和詳細資訊的標準化回應格式",
    responses={
        200: {
            "description": "配置重載成功",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "success": True,
                            "message": "成功重載 3 個配置檔案",
                            "reloaded_configs": ["devices", "groups", "security"],
                            "timestamp": "2025-08-04T10:30:15.123456",
                            "errors": None
                        },
                        "message": "系統配置熱重載完成",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        401: {"description": "API Key 驗證失敗"},
        500: {"description": "伺服器內部錯誤"}
    }
)
async def reload_config_endpoint(
    request: ReloadConfigRequest,
    app_settings: Settings = Depends(get_settings_dep),
) -> ReloadConfigResponseTyped:
    """
    重載配置檔案（管理員功能）

    這個端點允許在不重啟服務的情況下重新載入配置檔案，
    適用於生產環境中需要更新設備清單或安全規則的場景。

    Args:
        request: 包含 API Key 和要重載的配置類型
        app_settings: 應用程式設定實例（依賴注入）

    Returns:
        ReloadConfigResponse: 重載結果和詳細資訊
        
    Raises:
        HTTPException: 當 API Key 無效或重載失敗時
    """
    logger.info(f"收到配置重載請求: {request.reload_configs}")

    # 簡單的 API Key 驗證 (使用 Settings)
    if request.api_key != app_settings.ADMIN_API_KEY:
        logger.warning("配置重載請求 - API Key 驗證失敗")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的 API Key"
        )

    try:
        from config_manager import get_config_manager
        
        config_manager = get_config_manager()
        reloaded_configs = []
        errors = []

        # 重載指定的配置類型
        for config_type in request.reload_configs:
            try:
                if config_type == "devices":
                    config_manager.refresh_config()
                    reloaded_configs.append("devices")
                elif config_type == "groups":
                    config_manager.refresh_config()
                    reloaded_configs.append("groups")
                elif config_type == "security":
                    # 重載安全配置時，也需要刷新指令驗證器的快取
                    from core.network_tools import CommandValidator
                    CommandValidator.reload_security_config()
                    config_manager.refresh_config()
                    reloaded_configs.append("security")
                else:
                    errors.append(f"未知的配置類型: {config_type}")
            except Exception as e:
                error_msg = f"重載 {config_type} 配置失敗: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

        success = len(reloaded_configs) > 0
        message = f"成功重載 {len(reloaded_configs)} 個配置檔案"
        if errors:
            message += f"，{len(errors)} 個失敗"

        logger.info(f"配置重載完成: 成功={len(reloaded_configs)}, 失敗={len(errors)}")

        # 構建標準化的 ReloadConfigResponse
        config_data = ReloadConfigResponse(
            success=success,
            message=message,
            reloaded_configs=reloaded_configs,
            timestamp=datetime.now().isoformat(),
            errors=errors if errors else None,
        )
        
        return ReloadConfigResponseTyped(
            success=True,
            data=config_data,
            message="系統配置熱重載完成",
            error_code=None
        )

    except Exception as e:
        error_msg = f"配置重載過程發生錯誤: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg
        )

@router.post(
    "/reload-prompts",
    response_model=PromptReloadResponseTyped,
    summary="📝 重載提示詞配置",
    description="管理員功能：重新載入提示詞模板和配置檔案，支援 Jinja2 模板熱重載",
    response_description="提示詞重載結果的標準化回應格式",
    responses={
        200: {
            "description": "提示詞重載成功",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "success": True,
                            "message": "提示詞配置已成功重載",
                            "timestamp": "2025-08-04T10:30:15.123456"
                        },
                        "message": "AI 提示詞系統熱重載完成",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def reload_prompts() -> PromptReloadResponseTyped:
    """重載提示詞配置 - 管理員功能

    這個端點允許在不重啟服務的情況下重新載入提示詞模板和配置檔案，
    適用於調整 AI 提示詞內容或新增範例的場景。

    Returns:
        PromptReloadResponse: 重載操作結果
        
    Raises:
        HTTPException: 當重載失敗時
    """
    logger.info("收到提示詞重載請求")

    try:
        from core.prompt_manager import get_prompt_manager
        
        # 獲取提示詞管理器實例並清除快取
        prompt_manager = get_prompt_manager()
        prompt_manager.clear_cache()

        logger.info("提示詞配置重載成功")
        # 構建標準化的 PromptReloadResponse
        prompt_data = PromptReloadResponse(
            success=True,
            message="提示詞配置已成功重載",
            timestamp=datetime.now().isoformat()
        )
        
        return PromptReloadResponseTyped(
            success=True,
            data=prompt_data,
            message="AI 提示詞系統熱重載完成",
            error_code=None
        )

    except Exception as e:
        logger.error(f"提示詞重載失敗: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重載失敗: {str(e)}",
        )

# =============================================================================
# 前端日誌收集端點 (放在主 /api 路徑下)
# =============================================================================

@status_router.post(
    "/frontend-logs",
    response_model=FrontendLogResponseTyped,
    summary="📄 前端日誌收集",
    description="收集前端日誌資料進行統一管理和分析，支援批量日誌處理",
    response_description="日誌處理結果和統計資訊的標準化回應格式",
    responses={
        200: {
            "description": "日誌處理成功",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "success": True,
                            "message": "成功處理 5 條日誌",
                            "logCount": 5,
                            "processedAt": "2025-08-04T10:30:15.123456",
                            "stats": {"info": 3, "error": 2}
                        },
                        "message": "前端日誌批量處理完成",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def receive_frontend_logs(request: FrontendLogRequest) -> FrontendLogResponseTyped:
    """
    接收前端日誌資料

    Args:
        request: 包含日誌條目和元數據的請求物件

    Returns:
        FrontendLogResponse: 處理結果和統計資訊
        
    Raises:
        HTTPException: 當日誌處理失敗時
    """
    logger.info(f"收到前端日誌請求，包含 {len(request.logs)} 條日誌")

    try:
        # 獲取前端日誌處理器
        frontend_log_handler = get_frontend_log_handler()

        # 處理日誌批次
        processing_result = frontend_log_handler.process_log_batch(
            logs=request.logs, metadata=request.metadata
        )

        # 構建回應
        response = FrontendLogResponse(
            success=True,
            message=f"成功處理 {processing_result['processed_count']} 條日誌",
            logCount=len(request.logs),
            processedAt=datetime.now().isoformat(),
            stats=processing_result.get("stats"),
        )

        # 如果有處理錯誤，調整回應訊息
        if processing_result.get("error_count", 0) > 0:
            response.message += f"，{processing_result['error_count']} 條失敗"

        logger.info(f"前端日誌處理完成: {processing_result}")
        
        return FrontendLogResponseTyped(
            success=True,
            data=response,
            message="前端日誌批量處理完成",
            error_code=None
        )

    except Exception as e:
        error_msg = f"前端日誌處理失敗: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg
        )

@status_router.get(
    "/frontend-log-config",
    response_model=FrontendLogConfigTyped,
    summary="⚙️ 取得前端日誌配置",
    description="獲取前端日誌系統的配置資訊，包含日誌級別、批量大小等設定",
    response_description="前端日誌配置詳細資訊的標準化回應格式",
    responses={
        200: {
            "description": "成功獲取配置",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "enableRemoteLogging": True,
                            "logLevel": "INFO",
                            "batchSize": 10,
                            "batchInterval": 5000,
                            "maxLocalStorageEntries": 100,
                            "enabledCategories": ["api", "ui", "error"],
                            "maxMessageLength": 1000,
                            "enableStackTrace": True
                        },
                        "message": "前端日誌配置獲取成功",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_frontend_log_config_endpoint() -> FrontendLogConfigTyped:
    """
    取得前端日誌系統配置

    Returns:
        FrontendLogConfig: 前端日誌配置資訊
        
    Raises:
        HTTPException: 當配置獲取失敗時
    """
    logger.info("收到前端日誌配置查詢請求")

    try:
        # 導入 utils 模組中的函數，避免名稱衝突
        from utils import get_frontend_log_config

        # 獲取前端日誌配置
        config = get_frontend_log_config()

        logger.info("成功回傳前端日誌配置")
        
        return FrontendLogConfigTyped(
            success=True,
            data=config,
            message="前端日誌配置獲取成功",
            error_code=None
        )

    except Exception as e:
        error_msg = f"獲取前端日誌配置失敗: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg
        )

@status_router.get(
    "/ai-status",
    response_model=AIStatusResponseTyped,
    summary="🤖 AI 服務狀態查詢",
    description="獲取 AI 服務的狀態和配額資訊，包含 Gemini 和 Claude 支援狀態",
    response_description="AI 服務狀態和建議的標準化回應格式",
    responses={
        200: {
            "description": "成功獲取 AI 狀態",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "ai_initialized": True,
                            "api_keys": {
                                "gemini_configured": True,
                                "claude_configured": False,
                                "current_provider": "gemini"
                            },
                            "recommendations": [],
                            "current_provider": "gemini"
                        },
                        "message": "AI 服務狀態檢查完成",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_ai_status(
    app_settings: Settings = Depends(get_settings_dep),
    ai_service=Depends(get_ai_service_dep)
) -> AIStatusResponseTyped:
    """獲取 AI 服務狀態和配額資訊
    
    Args:
        app_settings: 應用程式設定實例（依賴注入）
        ai_service: AI 服務實例（依賴注入）
        
    Returns:
        AIStatusResponse: AI 服務狀態資訊
        
    Raises:
        HTTPException: 當狀態檢查失敗時
    """
    logger.info("收到 AI 狀態檢查請求")

    try:
        # 獲取 AI 服務詳細狀態
        ai_status = ai_service.get_ai_status()

        # 檢查 API 金鑰狀態 (使用 Settings)
        api_key_status = {
            "gemini_configured": app_settings.get_gemini_configured(),
            "claude_configured": app_settings.get_claude_configured(),
            "current_provider": app_settings.AI_PROVIDER,
        }

        # 構建建議清單
        recommendations = []
        if not ai_status["ai_initialized"]:
            recommendations.append("請檢查 AI API Key 設定是否正確")

        if (
            not api_key_status["gemini_configured"]
            and not api_key_status["claude_configured"]
        ):
            recommendations.append(
                "請設定至少一個 AI 提供者的 API Key"
            )

        logger.info(
            f"AI 狀態檢查完成: 初始化={ai_status['ai_initialized']}, 提供者={api_key_status['current_provider']}"
        )
        
        # 構建標準化的 AIStatusResponse
        ai_status_data = AIStatusResponse(
            ai_initialized=ai_status["ai_initialized"],
            api_keys=api_key_status,
            recommendations=recommendations,
            current_provider=api_key_status["current_provider"]
        )
        
        return AIStatusResponseTyped(
            success=True,
            data=ai_status_data,
            message="AI 服務狀態檢查完成",
            error_code=None
        )

    except Exception as e:
        logger.error(f"AI 狀態檢查失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 狀態檢查失敗: {str(e)}",
        )

# =============================================================================
# 前端動態配置端點
# =============================================================================

class FrontendConfig(BaseModel):
    """前端動態配置模型"""
    polling: Dict[str, Any]
    ui: Dict[str, Any]
    api: Dict[str, Any]

FrontendConfigTyped = BaseResponse[FrontendConfig]

@status_router.get(
    "/frontend-config",
    response_model=FrontendConfigTyped,
    summary="⚙️ 取得前端動態配置",
    description="獲取前端應用程式的動態配置，包含輪詢間隔、UI 設定、API 配置等",
    response_description="前端動態配置的標準化回應格式",
    responses={
        200: {
            "description": "成功獲取前端配置",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "polling": {
                                "pollInterval": 2000,
                                "maxPollInterval": 10000,
                                "timeout": 1800000,
                                "autoStartPolling": True
                            },
                            "ui": {
                                "progressUpdateInterval": 500,
                                "errorDisplayDuration": 5000,
                                "successDisplayDuration": 3000
                            },
                            "api": {
                                "retryCount": 3,
                                "retryDelay": 1000,
                                "timeouts": {
                                    "command": 60000,
                                    "aiQuery": 120000,
                                    "batchCommand": 300000
                                }
                            }
                        },
                        "message": "前端配置獲取成功",
                        "error_code": None,
                        "timestamp": "2025-08-04T10:30:15.123456"
                    }
                }
            }
        },
        500: {"description": "伺服器內部錯誤"}
    }
)
async def get_frontend_config_endpoint(
    app_settings: Settings = Depends(get_settings_dep)
) -> FrontendConfigTyped:
    """
    取得前端動態配置
    
    這個端點允許前端在啟動時從後端獲取配置參數，
    包含輪詢間隔、超時設定、UI 行為等，實現配置的集中化管理。

    Args:
        app_settings: 應用程式設定實例（依賴注入）

    Returns:
        FrontendConfig: 前端動態配置資訊
        
    Raises:
        HTTPException: 當配置獲取失敗時
    """
    logger.info("收到前端動態配置查詢請求")

    try:
        # 構建前端配置
        frontend_config = FrontendConfig(
            polling={
                "pollInterval": 2000,  # 基礎輪詢間隔 (ms)
                "maxPollInterval": 10000,  # 最大輪詢間隔 (ms) 
                "timeout": 30 * 60 * 1000,  # 總超時時間 (30分鐘)
                "autoStartPolling": True,  # 自動開始輪詢
                "backoffMultiplier": 1.2,  # 指數退避倍數
                "maxRetries": 3,  # 最大重試次數
            },
            ui={
                "progressUpdateInterval": 500,  # 進度更新間隔 (ms)
                "errorDisplayDuration": 5000,  # 錯誤訊息顯示時間 (ms)
                "successDisplayDuration": 3000,  # 成功訊息顯示時間 (ms)
                "animationDuration": 300,  # 動畫持續時間 (ms)
                "debounceDelay": 300,  # 防抖延遲 (ms)
                "maxConcurrentRequests": 5,  # 最大併發請求數
            },
            api={
                "retryCount": 3,  # API 重試次數
                "retryDelay": 1000,  # 重試延遲 (ms)
                "enableRequestDeduplication": True,  # 啟用請求去重
                "deduplicationTTL": 5000,  # 去重快取 TTL (ms)
                "timeouts": {
                    "command": 60000,  # 指令執行超時 (60秒)
                    "aiQuery": 120000,  # AI 查詢超時 (2分鐘)
                    "batchCommand": 300000,  # 批次執行超時 (5分鐘)
                    "taskPolling": 2000,  # 任務輪詢超時 (2秒)
                    "healthCheck": 10000,  # 健康檢查超時 (10秒)
                }
            }
        )

        logger.info("前端動態配置構建完成")
        
        return FrontendConfigTyped(
            success=True,
            data=frontend_config,
            message="前端配置獲取成功",
            error_code=None
        )

    except Exception as e:
        error_msg = f"獲取前端配置失敗: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error_msg
        )