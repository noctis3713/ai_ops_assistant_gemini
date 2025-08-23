#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
異常處理和錯誤管理模組

提供統一的異常處理機制：
- 核心異常類別定義
- 標準化錯誤回應格式  
- FastAPI 異常處理器

Created: 2025-08-23
Author: Claude Code Assistant
"""

import logging
import traceback
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request, status
from fastapi.exception_handlers import (
    http_exception_handler as default_http_exception_handler,
)
from fastapi.exception_handlers import (
    request_validation_exception_handler as default_request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# 設定日誌
logger = logging.getLogger(__name__)


# =============================================================================
# 核心異常類別定義
# =============================================================================


class ServiceError(Exception):
    """通用業務邏輯異常基礎類別"""

    def __init__(
        self, 
        detail: str, 
        error_code: Optional[str] = None, 
        status_code: int = 400,
        **kwargs
    ):
        self.detail = detail
        self.error_code = error_code or "SERVICE_ERROR"
        self.status_code = status_code
        # 儲存相關上下文資訊
        self.extra_info = kwargs
        super().__init__(detail)


class AuthenticationError(ServiceError):
    """用戶認證失敗異常"""

    def __init__(self, detail: str = "認證失敗，請檢查憑證"):
        super().__init__(detail, "AUTHENTICATION_ERROR", status_code=401)


class ValidationError(ServiceError):
    """資料驗證錯誤異常"""

    def __init__(self, detail: str, field: Optional[str] = None):
        error_code = "VALIDATION_ERROR"
        if field:
            detail = f"欄位 '{field}': {detail}"
        super().__init__(detail, error_code, status_code=422)


class ExternalServiceError(ServiceError):
    """外部服務通訊異常"""

    def __init__(self, service_name: str, detail: str, error_code: Optional[str] = None):
        full_detail = f"外部服務異常 [{service_name}]: {detail}"
        super().__init__(
            full_detail, 
            error_code or "EXTERNAL_SERVICE_ERROR", 
            status_code=503,
            service_name=service_name
        )


# =============================================================================
# 異常建構工具函數
# =============================================================================

def device_error(device_ip: str, detail: str, error_code: str = "DEVICE_ERROR") -> ServiceError:
    """建立網路設備相關異常"""
    return ServiceError(
        f"設備 {device_ip}: {detail}",
        error_code,
        status_code=422,
        device_ip=device_ip
    )

def ai_error(provider: str, detail: str, error_code: str = "AI_ERROR") -> ExternalServiceError:
    """建立 AI 服務相關異常"""
    return ExternalServiceError(f"AI-{provider}", detail, error_code)

def task_error(task_id: str, detail: str, error_code: str = "TASK_ERROR") -> ServiceError:
    """建立任務管理相關異常"""
    return ServiceError(
        f"任務 {task_id}: {detail}",
        error_code,
        status_code=422,
        task_id=task_id
    )

def config_error(detail: str, config_path: Optional[str] = None) -> ServiceError:
    """建立系統配置相關異常"""
    if config_path:
        detail = f"配置檔案 {config_path}: {detail}"
    return ServiceError(detail, "CONFIG_ERROR", status_code=500)


# =============================================================================
# 異常處理器
# =============================================================================

def _create_error_response(
    status_code: int,
    message: str,
    error_code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    """建立標準化錯誤回應"""
    from common import BaseResponse

    response_data = BaseResponse.error_response(
        message=message, error_code=error_code
    ).model_dump()

    if details:
        response_data["details"] = details

    return JSONResponse(status_code=status_code, content=response_data)


def _log_exception(
    request: Request,
    exc: Exception,
    level: int = logging.ERROR,
    include_traceback: bool = False,
) -> None:
    """記錄異常相關日誌"""
    log_data = {
        "method": request.method,
        "url": str(request.url),
        "client": request.client.host if request.client else "unknown",
        "exception_type": type(exc).__name__,
        "exception_message": str(exc),
    }

    if include_traceback:
        log_data["traceback"] = traceback.format_exc()
        logger.log(level, "異常詳情", extra=log_data, exc_info=True)
    else:
        logger.log(level, f"處理異常: {type(exc).__name__}", extra=log_data)


async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
    """處理業務邏輯異常"""
    _log_exception(request, exc, level=logging.WARNING)

    # 準備額外詳情
    details = {}
    if hasattr(exc, 'extra_info') and exc.extra_info:
        details.update(exc.extra_info)

    return _create_error_response(
        status_code=exc.status_code,
        message=exc.detail,
        error_code=exc.error_code,
        details=details if details else None,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """處理 FastAPI 請求驗證錯誤"""
    _log_exception(request, exc, level=logging.INFO)

    # 格式化驗證錯誤
    formatted_errors = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error.get("loc", []))
        error_msg = error.get("msg", "驗證失敗")
        formatted_errors.append(f"欄位 '{field_path}': {error_msg}")

    error_message = "; ".join(formatted_errors)

    return _create_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        message=f"請求資料驗證失敗: {error_message}",
        error_code="VALIDATION_ERROR",
        details={"validation_errors": exc.errors()},
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """處理 HTTP 狀態碼異常"""
    log_level = logging.WARNING if exc.status_code < 500 else logging.ERROR
    _log_exception(request, exc, level=log_level)

    # 狀態碼對應的中文訊息
    status_messages = {
        400: "請求格式錯誤",
        401: "認證失敗，請檢查您的憑證",
        403: "權限不足，無法存取此資源",
        404: "請求的資源不存在",
        405: "不支援的請求方法",
        422: "請求資料無法處理",
        429: "請求過於頻繁，請稍後再試",
        500: "伺服器內部錯誤",
        503: "服務暫時不可用",
    }

    message = (
        exc.detail
        if hasattr(exc, "detail") and exc.detail
        else status_messages.get(exc.status_code, f"HTTP {exc.status_code} 錯誤")
    )

    return _create_error_response(
        status_code=exc.status_code,
        message=message,
        error_code=f"HTTP_{exc.status_code}",
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """處理未捕捉的通用異常"""
    _log_exception(request, exc, level=logging.ERROR, include_traceback=True)

    import os
    is_debug = os.getenv("DEBUG", "false").lower() == "true"

    if is_debug:
        return _create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"內部錯誤: {str(exc)}",
            error_code="INTERNAL_ERROR",
            details={
                "exception_type": type(exc).__name__,
                "exception_message": str(exc),
            },
        )
    else:
        return _create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message="伺服器發生內部錯誤，請稍後再試或聯繫管理員",
            error_code="INTERNAL_ERROR",
        )


def register_exception_handlers(app):
    """在 FastAPI 應用中註冊異常處理器"""
    # 註冊核心異常處理器
    app.add_exception_handler(ServiceError, service_error_handler)
    app.add_exception_handler(AuthenticationError, service_error_handler)
    app.add_exception_handler(ValidationError, service_error_handler)
    app.add_exception_handler(ExternalServiceError, service_error_handler)

    # 註冊驗證異常處理器
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(PydanticValidationError, validation_exception_handler)

    # 註冊 HTTP 異常處理器
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # 註冊通用異常處理器（必須最後註冊）
    app.add_exception_handler(Exception, general_exception_handler)

    logger.info("已註冊異常處理器")


# =============================================================================
# 相容性支援和工具函數
# =============================================================================

def convert_to_service_error(exc: Exception, operation: str = "系統操作") -> ServiceError:
    """將任意異常轉換為 ServiceError 類型"""
    exc_str = str(exc).lower()

    # 根據異常訊息進行類型映射
    if any(keyword in exc_str for keyword in ["timeout", "超時", "timed out"]):
        return ServiceError(f"{operation}超時", "TIMEOUT_ERROR", 408)
    elif any(keyword in exc_str for keyword in ["connection", "連線", "connect"]):
        return ServiceError(f"{operation}連線失敗: {str(exc)}", "CONNECTION_ERROR", 503)
    elif any(keyword in exc_str for keyword in ["authentication", "認證", "auth"]):
        return AuthenticationError(f"{operation}認證失敗")
    elif any(keyword in exc_str for keyword in ["quota", "配額", "limit", "exceeded"]):
        return ExternalServiceError("API", f"配額已用完: {str(exc)}", "QUOTA_EXCEEDED")
    elif isinstance(exc, FileNotFoundError):
        return config_error(f"檔案不存在: {str(exc)}")
    elif isinstance(exc, (ValueError, TypeError)):
        return ValidationError(str(exc))
    else:
        return ServiceError(f"{operation}失敗: {str(exc)}", "UNKNOWN_ERROR", 500)


# 兼容性別名
map_exception_to_service_error = convert_to_service_error

# 兼容性異常類別別名
DeviceNotFoundError = lambda device_ip: device_error(device_ip, "設備未找到", "DEVICE_NOT_FOUND")
AINotAvailableError = lambda reason="AI 服務不可用": ai_error("Unknown", reason, "AI_NOT_AVAILABLE")
TaskNotFoundError = lambda task_id: task_error(task_id, "任務不存在", "TASK_NOT_FOUND")
ConfigNotFoundError = lambda path: config_error(f"配置檔案不存在: {path}", path)