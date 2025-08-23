#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統一異常處理模組

所有異常處理相關功能合併到單一檔案中，遵循 YAGNI 原則。
包含：異常定義、錯誤代碼、異常處理器、異常轉換器。

Created: 2025-08-22
Author: Claude Code Assistant
"""

import json
import logging
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Type

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
# 服務層異常定義
# =============================================================================


class ServiceError(Exception):
    """服務層基礎異常"""

    def __init__(
        self, detail: str, error_code: Optional[str] = None, status_code: int = 400
    ):
        self.detail = detail
        self.error_code = error_code or self.__class__.__name__
        self.status_code = status_code
        super().__init__(detail)


# 配置相關異常
class ConfigError(ServiceError):
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(detail, error_code, status_code=500)


class ConfigNotFoundError(ConfigError):
    def __init__(self, config_path: str):
        detail = f"配置檔案不存在: {config_path}"
        super().__init__(detail, "CONFIG_NOT_FOUND")


class ConfigValidationError(ConfigError):
    def __init__(self, config_type: str, validation_error: str):
        detail = f"配置檔案驗證失敗 [{config_type}]: {validation_error}"
        super().__init__(detail, "CONFIG_VALIDATION_ERROR")


class ConfigParseError(ConfigError):
    def __init__(self, config_path: str, parse_error: str):
        detail = f"配置檔案解析失敗 [{config_path}]: {parse_error}"
        super().__init__(detail, "CONFIG_PARSE_ERROR")


# 設備相關異常
class DeviceError(ServiceError):
    def __init__(
        self,
        detail: str,
        device_ip: Optional[str] = None,
        error_code: Optional[str] = None,
    ):
        self.device_ip = device_ip
        if device_ip:
            detail = f"設備 {device_ip}: {detail}"
        super().__init__(detail, error_code, status_code=422)


class DeviceConnectionError(DeviceError):
    def __init__(self, device_ip: str, connection_error: str):
        detail = f"無法連線到設備: {connection_error}"
        super().__init__(detail, device_ip, "DEVICE_CONNECTION_ERROR")


class DeviceAuthenticationError(DeviceError):
    def __init__(self, device_ip: str):
        detail = "設備認證失敗，請檢查帳號密碼"
        super().__init__(detail, device_ip, "DEVICE_AUTHENTICATION_ERROR")


class DeviceTimeoutError(DeviceError):
    def __init__(self, device_ip: str, operation: str, timeout: int):
        detail = f"設備操作超時 [{operation}]，超時時間: {timeout}秒"
        super().__init__(detail, device_ip, "DEVICE_TIMEOUT_ERROR")


class DeviceNotFoundError(DeviceError):
    def __init__(self, device_ip: str):
        detail = "設備未找到或未配置"
        super().__init__(detail, device_ip, "DEVICE_NOT_FOUND")


# 指令相關異常
class CommandError(ServiceError):
    def __init__(
        self,
        detail: str,
        command: Optional[str] = None,
        error_code: Optional[str] = None,
    ):
        self.command = command
        if command:
            detail = f"指令 '{command}': {detail}"
        super().__init__(detail, error_code, status_code=422)


class CommandValidationError(CommandError):
    def __init__(self, command: str, validation_error: str):
        detail = f"指令安全驗證失敗: {validation_error}"
        super().__init__(detail, command, "COMMAND_VALIDATION_ERROR")


class CommandExecutionError(CommandError):
    def __init__(self, command: str, device_ip: str, execution_error: str):
        detail = f"在設備 {device_ip} 上執行失敗: {execution_error}"
        super().__init__(detail, command, "COMMAND_EXECUTION_ERROR")


class CommandTimeoutError(CommandError):
    def __init__(self, command: str, device_ip: str, timeout: int):
        detail = f"在設備 {device_ip} 上執行超時 (超時時間: {timeout}秒)"
        super().__init__(detail, command, "COMMAND_TIMEOUT_ERROR")


# AI 服務相關異常
class AIServiceError(ServiceError):
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(detail, error_code, status_code=503)


class AINotAvailableError(AIServiceError):
    def __init__(self, reason: str = "AI 服務未初始化或配置不正確"):
        super().__init__(reason, "AI_NOT_AVAILABLE")


class AIInitializationError(AIServiceError):
    def __init__(self, provider: str, init_error: str):
        detail = f"AI 服務初始化失敗 [{provider}]: {init_error}"
        super().__init__(detail, "AI_INITIALIZATION_ERROR")


class AIAPIError(AIServiceError):
    def __init__(self, provider: str, api_error: str):
        detail = f"AI API 呼叫失敗 [{provider}]: {api_error}"
        super().__init__(detail, "AI_API_ERROR")


class AIQuotaExceededError(AIServiceError):
    def __init__(self, provider: str):
        detail = f"AI 服務配額已用完 [{provider}]，請稍後再試或聯繫管理員"
        super().__init__(detail, "AI_QUOTA_EXCEEDED")


class AIResponseParseError(AIServiceError):
    def __init__(self, provider: str, parse_error: str):
        detail = f"AI 回應格式解析失敗 [{provider}]: {parse_error}"
        super().__init__(detail, "AI_RESPONSE_PARSE_ERROR")


# 任務相關異常
class TaskError(ServiceError):
    def __init__(
        self,
        detail: str,
        task_id: Optional[str] = None,
        error_code: Optional[str] = None,
    ):
        self.task_id = task_id
        if task_id:
            detail = f"任務 {task_id}: {detail}"
        super().__init__(detail, error_code, status_code=422)


class TaskNotFoundError(TaskError):
    def __init__(self, task_id: str):
        detail = "任務不存在或已被清理"
        super().__init__(detail, task_id, "TASK_NOT_FOUND")


class TaskExecutionError(TaskError):
    def __init__(self, task_id: str, execution_error: str):
        detail = f"任務執行失敗: {execution_error}"
        super().__init__(detail, task_id, "TASK_EXECUTION_ERROR")


class TaskTimeoutError(TaskError):
    def __init__(self, task_id: str, timeout: int):
        detail = f"任務執行超時 (超時時間: {timeout}秒)"
        super().__init__(detail, task_id, "TASK_TIMEOUT_ERROR")


class TaskCancelledError(TaskError):
    def __init__(self, task_id: str):
        detail = "任務已被取消"
        super().__init__(detail, task_id, "TASK_CANCELLED")


# 提示詞管理器相關異常
class PromptManagerError(ServiceError):
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(detail, error_code, status_code=500)


class PromptConfigError(PromptManagerError):
    def __init__(
        self,
        message: str,
        config_path: Optional[str] = None,
        line_number: Optional[int] = None,
    ):
        self.config_path = config_path
        self.line_number = line_number
        detail = f"提示詞配置錯誤: {message}"
        if config_path:
            detail += f" (檔案: {config_path})"
        if line_number:
            detail += f" (行號: {line_number})"
        super().__init__(detail, "PROMPT_CONFIG_ERROR")


class PromptTemplateError(PromptManagerError):
    def __init__(
        self,
        message: str,
        template_name: Optional[str] = None,
        context: Optional[dict] = None,
    ):
        self.template_name = template_name
        self.context = context
        detail = f"提示詞模板錯誤: {message}"
        if template_name:
            detail += f" (模板: {template_name})"
        super().__init__(detail, "PROMPT_TEMPLATE_ERROR")


class PromptLanguageError(PromptManagerError):
    def __init__(self, message: str, language: str, available_languages: list = None):
        self.language = language
        self.available_languages = available_languages or []
        detail = f"提示詞語言錯誤: {message} (語言: {language})"
        super().__init__(detail, "PROMPT_LANGUAGE_ERROR")


# 權限和認證相關異常
class AuthenticationError(ServiceError):
    def __init__(self, detail: str = "認證失敗，請檢查 API Key"):
        super().__init__(detail, "AUTHENTICATION_ERROR", status_code=401)


class AuthorizationError(ServiceError):
    def __init__(self, detail: str = "權限不足，無法執行此操作"):
        super().__init__(detail, "AUTHORIZATION_ERROR", status_code=403)


class ValidationError(ServiceError):
    def __init__(self, field: str, validation_error: str):
        detail = f"資料驗證失敗 [{field}]: {validation_error}"
        super().__init__(detail, "VALIDATION_ERROR", status_code=422)


class ExternalServiceError(ServiceError):
    def __init__(
        self, service_name: str, detail: str, error_code: Optional[str] = None
    ):
        self.service_name = service_name
        detail = f"外部服務異常 [{service_name}]: {detail}"
        super().__init__(detail, error_code, status_code=503)


class NetworkServiceError(ExternalServiceError):
    def __init__(self, detail: str):
        super().__init__("NetworkService", detail, "NETWORK_SERVICE_ERROR")


# =============================================================================
# 錯誤代碼定義
# =============================================================================


class ErrorCodes:
    """統一錯誤代碼管理"""

    # AI 相關錯誤代碼
    AI_QUOTA_EXCEEDED = "AI_QUOTA_EXCEEDED"
    AI_RATE_LIMIT = "AI_RATE_LIMIT"
    AI_AUTH_FAILED = "AI_AUTH_FAILED"
    AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE"
    AI_SERVICE_TIMEOUT = "AI_SERVICE_TIMEOUT"
    AI_QUERY_FAILED = "AI_QUERY_FAILED"

    # 網路設備相關錯誤代碼
    CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT"
    CONNECTION_REFUSED = "CONNECTION_REFUSED"
    HOST_UNREACHABLE = "HOST_UNREACHABLE"
    AUTH_FAILED = "AUTH_FAILED"
    COMMAND_FAILED = "COMMAND_FAILED"
    COMMAND_UNSAFE = "COMMAND_UNSAFE"
    DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND"
    DEVICE_UNREACHABLE = "DEVICE_UNREACHABLE"

    # 任務管理相關錯誤代碼
    TASK_NOT_FOUND = "TASK_NOT_FOUND"
    TASK_CREATION_FAILED = "TASK_CREATION_FAILED"
    TASK_EXECUTION_FAILED = "TASK_EXECUTION_FAILED"
    TASK_TIMEOUT = "TASK_TIMEOUT"

    # 系統相關錯誤代碼
    CONFIG_LOAD_FAILED = "CONFIG_LOAD_FAILED"
    CONFIG_VALIDATION_FAILED = "CONFIG_VALIDATION_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    PERMISSION_DENIED = "PERMISSION_DENIED"


# 前端友善錯誤訊息映射
ERROR_MESSAGE_MAP = {
    ErrorCodes.AI_QUOTA_EXCEEDED: "AI API 配額已用完，請稍後再試或升級方案",
    ErrorCodes.AI_SERVICE_UNAVAILABLE: "AI 服務暫時不可用，請稍後再試",
    ErrorCodes.AI_SERVICE_TIMEOUT: "AI 分析超時，請縮短查詢內容或稍後重試",
    ErrorCodes.CONNECTION_TIMEOUT: "設備連線超時，請檢查網路狀況",
    ErrorCodes.CONNECTION_REFUSED: "設備拒絕連線，請檢查設備狀態",
    ErrorCodes.AUTH_FAILED: "設備認證失敗，請檢查憑證設定",
    ErrorCodes.COMMAND_UNSAFE: "指令不安全，系統已自動阻止",
    ErrorCodes.DEVICE_NOT_FOUND: "設備不存在，請檢查 IP 位址",
    ErrorCodes.TASK_NOT_FOUND: "任務不存在或已被清理",
    ErrorCodes.TASK_CREATION_FAILED: "任務建立失敗",
    ErrorCodes.TASK_EXECUTION_FAILED: "任務執行失敗",
    ErrorCodes.CONFIG_LOAD_FAILED: "配置載入失敗",
    ErrorCodes.INTERNAL_ERROR: "系統內部錯誤",
    ErrorCodes.VALIDATION_ERROR: "輸入驗證失敗",
    ErrorCodes.PERMISSION_DENIED: "權限不足",
}


def get_error_message(error_code: str) -> str:
    """根據錯誤代碼獲取用戶友善的錯誤訊息"""
    return ERROR_MESSAGE_MAP.get(error_code, "發生未知錯誤，請聯繫系統管理員")


# =============================================================================
# 異常轉換器
# =============================================================================


@dataclass
class ExceptionContext:
    """異常轉換上下文"""

    error_category: str
    source_module: str
    operation: str
    additional_info: Optional[Dict[str, Any]] = None


class ExceptionConverter:
    """統一異常轉換器"""

    def __init__(self, debug_mode: bool = False):
        self.debug_mode = debug_mode
        self.conversion_stats = {
            "total_conversions": 0,
            "by_category": {},
            "by_exception_type": {},
        }

    def convert_to_service_error(
        self, exc: Exception, context: Optional[ExceptionContext] = None
    ) -> ServiceError:
        """將任何異常轉換為 ServiceError"""
        if context:
            self._update_stats(context.error_category, type(exc).__name__)

        exc_str = str(exc).lower()

        # 網路連線相關異常
        if any(keyword in exc_str for keyword in ["timeout", "超時", "timed out"]):
            return DeviceTimeoutError("unknown", "操作", 30)
        elif any(keyword in exc_str for keyword in ["connection", "連線", "connect"]):
            return DeviceConnectionError("unknown", str(exc))
        elif any(keyword in exc_str for keyword in ["authentication", "認證", "auth"]):
            return DeviceAuthenticationError("unknown")

        # AI 服務相關異常
        elif any(
            keyword in exc_str for keyword in ["quota", "配額", "limit", "exceeded"]
        ):
            return AIQuotaExceededError("unknown")
        elif any(keyword in exc_str for keyword in ["api", "service"]):
            return AIAPIError("unknown", str(exc))

        # 配置相關異常
        elif isinstance(exc, FileNotFoundError):
            return ConfigNotFoundError(str(exc))
        elif isinstance(exc, json.JSONDecodeError):
            return ConfigParseError("unknown", str(exc))

        # 驗證相關異常
        elif isinstance(exc, (ValueError, TypeError)):
            return ValidationError("unknown", str(exc))

        # 預設為一般服務異常
        else:
            error_message = str(exc) if self.debug_mode else "系統發生內部錯誤"
            return ServiceError(error_message, "UNKNOWN_ERROR", 500)

    def get_conversion_stats(self) -> Dict[str, Any]:
        """獲取異常轉換統計資訊"""
        return {
            "total_conversions": self.conversion_stats["total_conversions"],
            "by_category": dict(self.conversion_stats["by_category"]),
            "by_exception_type": dict(self.conversion_stats["by_exception_type"]),
        }

    def reset_stats(self) -> None:
        """重置統計資訊"""
        self.conversion_stats = {
            "total_conversions": 0,
            "by_category": {},
            "by_exception_type": {},
        }

    def _update_stats(self, category: str, exception_type: str) -> None:
        """更新轉換統計資訊"""
        self.conversion_stats["total_conversions"] += 1

        if category not in self.conversion_stats["by_category"]:
            self.conversion_stats["by_category"][category] = 0
        self.conversion_stats["by_category"][category] += 1

        if exception_type not in self.conversion_stats["by_exception_type"]:
            self.conversion_stats["by_exception_type"][exception_type] = 0
        self.conversion_stats["by_exception_type"][exception_type] += 1


# 全域實例
_exception_converter = None


def get_exception_converter(debug_mode: bool = False) -> ExceptionConverter:
    """取得異常轉換器實例"""
    global _exception_converter
    if _exception_converter is None:
        _exception_converter = ExceptionConverter(debug_mode=debug_mode)
    return _exception_converter


# =============================================================================
# 異常處理器
# =============================================================================


def _create_error_response(
    status_code: int,
    message: str,
    error_code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    """創建統一格式的錯誤回應"""
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
    """記錄異常日誌"""
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
    """處理所有自訂業務異常"""
    _log_exception(request, exc, level=logging.WARNING)

    status_code = getattr(exc, "status_code", status.HTTP_400_BAD_REQUEST)

    # 準備額外詳情
    details = {}
    if isinstance(exc, DeviceError) and hasattr(exc, "device_ip"):
        details["device_ip"] = exc.device_ip
    elif isinstance(exc, CommandError) and hasattr(exc, "command"):
        details["command"] = exc.command
    elif isinstance(exc, TaskError) and hasattr(exc, "task_id"):
        details["task_id"] = exc.task_id

    return _create_error_response(
        status_code=status_code,
        message=exc.detail,
        error_code=exc.error_code,
        details=details if details else None,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """處理請求驗證錯誤"""
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
    """處理 HTTP 異常"""
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
    """處理所有未預期的異常"""
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
    """註冊所有異常處理器到 FastAPI 應用"""
    # 註冊自訂業務異常處理器
    app.add_exception_handler(ServiceError, service_error_handler)
    app.add_exception_handler(DeviceError, service_error_handler)
    app.add_exception_handler(CommandError, service_error_handler)
    app.add_exception_handler(AIServiceError, service_error_handler)
    app.add_exception_handler(TaskError, service_error_handler)
    app.add_exception_handler(ConfigError, service_error_handler)
    app.add_exception_handler(AuthenticationError, service_error_handler)
    app.add_exception_handler(AuthorizationError, service_error_handler)

    # 註冊驗證異常處理器
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(PydanticValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, service_error_handler)

    # 註冊 HTTP 異常處理器
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # 註冊通用異常處理器（必須最後註冊）
    app.add_exception_handler(Exception, general_exception_handler)

    logger.info("已註冊所有全域異常處理器")


# =============================================================================
# 便利函數
# =============================================================================


def convert_to_service_error(
    exc: Exception, operation: str = "系統操作"
) -> ServiceError:
    """便利函數：將任何異常轉換為 ServiceError"""
    converter = get_exception_converter()
    context = ExceptionContext(
        error_category="general", source_module="unknown", operation=operation
    )
    return converter.convert_to_service_error(exc, context)


def map_exception_to_service_error(exc: Exception, context: str = "") -> ServiceError:
    """將通用異常映射為服務層異常（向後相容）"""
    return convert_to_service_error(exc, context or "系統操作")
