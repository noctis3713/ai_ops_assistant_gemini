# -*- coding: utf-8 -*-
"""
服務層自訂異常模組
定義全域可用的業務邏輯異常，配合全域異常處理器提供統一的錯誤處理機制
"""

from typing import Optional


class ServiceError(Exception):
    """服務層基礎異常
    
    所有服務層自訂異常的基類，提供統一的異常處理機制
    """
    
    def __init__(
        self, 
        detail: str, 
        error_code: Optional[str] = None,
        status_code: int = 400
    ):
        """初始化服務異常
        
        Args:
            detail: 錯誤詳細描述
            error_code: 錯誤代碼 (可選)
            status_code: HTTP 狀態碼 (預設 400)
        """
        self.detail = detail
        self.error_code = error_code or self.__class__.__name__
        self.status_code = status_code
        super().__init__(detail)


# =============================================================================
# 配置相關異常
# =============================================================================

class ConfigError(ServiceError):
    """配置相關異常基類"""
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(detail, error_code, status_code=500)


class ConfigNotFoundError(ConfigError):
    """配置檔案未找到異常"""
    
    def __init__(self, config_path: str):
        detail = f"配置檔案不存在: {config_path}"
        super().__init__(detail, "CONFIG_NOT_FOUND")


class ConfigValidationError(ConfigError):
    """配置檔案驗證失敗異常"""
    
    def __init__(self, config_type: str, validation_error: str):
        detail = f"配置檔案驗證失敗 [{config_type}]: {validation_error}"
        super().__init__(detail, "CONFIG_VALIDATION_ERROR")


class ConfigParseError(ConfigError):
    """配置檔案解析錯誤異常"""
    
    def __init__(self, config_path: str, parse_error: str):
        detail = f"配置檔案解析失敗 [{config_path}]: {parse_error}"
        super().__init__(detail, "CONFIG_PARSE_ERROR")


# =============================================================================
# 設備連線相關異常
# =============================================================================

class DeviceError(ServiceError):
    """設備相關異常基類"""
    
    def __init__(self, detail: str, device_ip: Optional[str] = None, error_code: Optional[str] = None):
        self.device_ip = device_ip
        if device_ip:
            detail = f"設備 {device_ip}: {detail}"
        super().__init__(detail, error_code, status_code=422)


class DeviceConnectionError(DeviceError):
    """設備連線異常"""
    
    def __init__(self, device_ip: str, connection_error: str):
        detail = f"無法連線到設備: {connection_error}"
        super().__init__(detail, device_ip, "DEVICE_CONNECTION_ERROR")


class DeviceAuthenticationError(DeviceError):
    """設備認證失敗異常"""
    
    def __init__(self, device_ip: str):
        detail = "設備認證失敗，請檢查帳號密碼"
        super().__init__(detail, device_ip, "DEVICE_AUTHENTICATION_ERROR")


class DeviceTimeoutError(DeviceError):
    """設備操作超時異常"""
    
    def __init__(self, device_ip: str, operation: str, timeout: int):
        detail = f"設備操作超時 [{operation}]，超時時間: {timeout}秒"
        super().__init__(detail, device_ip, "DEVICE_TIMEOUT_ERROR")


class DeviceNotFoundError(DeviceError):
    """設備未找到異常"""
    
    def __init__(self, device_ip: str):
        detail = f"設備未找到或未配置"
        super().__init__(detail, device_ip, "DEVICE_NOT_FOUND")


# =============================================================================
# 指令執行相關異常
# =============================================================================

class CommandError(ServiceError):
    """指令執行相關異常基類"""
    
    def __init__(self, detail: str, command: Optional[str] = None, error_code: Optional[str] = None):
        self.command = command
        if command:
            detail = f"指令 '{command}': {detail}"
        super().__init__(detail, error_code, status_code=422)


class CommandValidationError(CommandError):
    """指令驗證失敗異常"""
    
    def __init__(self, command: str, validation_error: str):
        detail = f"指令安全驗證失敗: {validation_error}"
        super().__init__(detail, command, "COMMAND_VALIDATION_ERROR")


class CommandExecutionError(CommandError):
    """指令執行失敗異常"""
    
    def __init__(self, command: str, device_ip: str, execution_error: str):
        detail = f"在設備 {device_ip} 上執行失敗: {execution_error}"
        super().__init__(detail, command, "COMMAND_EXECUTION_ERROR")


class CommandTimeoutError(CommandError):
    """指令執行超時異常"""
    
    def __init__(self, command: str, device_ip: str, timeout: int):
        detail = f"在設備 {device_ip} 上執行超時 (超時時間: {timeout}秒)"
        super().__init__(detail, command, "COMMAND_TIMEOUT_ERROR")


# =============================================================================
# AI 服務相關異常
# =============================================================================

class AIServiceError(ServiceError):
    """AI 服務相關異常基類"""
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(detail, error_code, status_code=503)


class AINotAvailableError(AIServiceError):
    """AI 服務不可用異常"""
    
    def __init__(self, reason: str = "AI 服務未初始化或配置不正確"):
        super().__init__(reason, "AI_NOT_AVAILABLE")


class AIInitializationError(AIServiceError):
    """AI 服務初始化失敗異常"""
    
    def __init__(self, provider: str, init_error: str):
        detail = f"AI 服務初始化失敗 [{provider}]: {init_error}"
        super().__init__(detail, "AI_INITIALIZATION_ERROR")


class AIAPIError(AIServiceError):
    """AI API 呼叫失敗異常"""
    
    def __init__(self, provider: str, api_error: str):
        detail = f"AI API 呼叫失敗 [{provider}]: {api_error}"
        super().__init__(detail, "AI_API_ERROR")


class AIQuotaExceededError(AIServiceError):
    """AI 服務配額超限異常"""
    
    def __init__(self, provider: str):
        detail = f"AI 服務配額已用完 [{provider}]，請稍後再試或聯繫管理員"
        super().__init__(detail, "AI_QUOTA_EXCEEDED")


class AIResponseParseError(AIServiceError):
    """AI 回應解析失敗異常"""
    
    def __init__(self, provider: str, parse_error: str):
        detail = f"AI 回應格式解析失敗 [{provider}]: {parse_error}"
        super().__init__(detail, "AI_RESPONSE_PARSE_ERROR")


# =============================================================================
# 任務管理相關異常
# =============================================================================

class TaskError(ServiceError):
    """任務管理相關異常基類"""
    
    def __init__(self, detail: str, task_id: Optional[str] = None, error_code: Optional[str] = None):
        self.task_id = task_id
        if task_id:
            detail = f"任務 {task_id}: {detail}"
        super().__init__(detail, error_code, status_code=422)


class TaskNotFoundError(TaskError):
    """任務未找到異常"""
    
    def __init__(self, task_id: str):
        detail = "任務不存在或已被清理"
        super().__init__(detail, task_id, "TASK_NOT_FOUND")


class TaskExecutionError(TaskError):
    """任務執行失敗異常"""
    
    def __init__(self, task_id: str, execution_error: str):
        detail = f"任務執行失敗: {execution_error}"
        super().__init__(detail, task_id, "TASK_EXECUTION_ERROR")


class TaskTimeoutError(TaskError):
    """任務執行超時異常"""
    
    def __init__(self, task_id: str, timeout: int):
        detail = f"任務執行超時 (超時時間: {timeout}秒)"
        super().__init__(detail, task_id, "TASK_TIMEOUT_ERROR")


class TaskCancelledError(TaskError):
    """任務已取消異常"""
    
    def __init__(self, task_id: str):
        detail = "任務已被取消"
        super().__init__(detail, task_id, "TASK_CANCELLED")


# =============================================================================
# 權限和認證相關異常
# =============================================================================

class AuthenticationError(ServiceError):
    """認證失敗異常"""
    
    def __init__(self, detail: str = "認證失敗，請檢查 API Key"):
        super().__init__(detail, "AUTHENTICATION_ERROR", status_code=401)


class AuthorizationError(ServiceError):
    """授權失敗異常"""
    
    def __init__(self, detail: str = "權限不足，無法執行此操作"):
        super().__init__(detail, "AUTHORIZATION_ERROR", status_code=403)


# =============================================================================
# 資料驗證相關異常
# =============================================================================

class ValidationError(ServiceError):
    """資料驗證失敗異常"""
    
    def __init__(self, field: str, validation_error: str):
        detail = f"資料驗證失敗 [{field}]: {validation_error}"
        super().__init__(detail, "VALIDATION_ERROR", status_code=422)


# =============================================================================
# 外部服務相關異常
# =============================================================================

class ExternalServiceError(ServiceError):
    """外部服務異常基類"""
    
    def __init__(self, service_name: str, detail: str, error_code: Optional[str] = None):
        self.service_name = service_name
        detail = f"外部服務異常 [{service_name}]: {detail}"
        super().__init__(detail, error_code, status_code=503)


class NetworkServiceError(ExternalServiceError):
    """網路服務異常"""
    
    def __init__(self, detail: str):
        super().__init__("NetworkService", detail, "NETWORK_SERVICE_ERROR")


# =============================================================================
# 輔助函數
# =============================================================================

def map_exception_to_service_error(exc: Exception, context: str = "") -> ServiceError:
    """將通用異常映射為服務層異常
    
    Args:
        exc: 原始異常
        context: 異常發生的上下文
        
    Returns:
        對應的服務層異常
    """
    exc_str = str(exc).lower()
    context_prefix = f"[{context}] " if context else ""
    
    # 網路連線相關異常
    if any(keyword in exc_str for keyword in ['timeout', '超時', 'timed out']):
        return DeviceTimeoutError("unknown", context, 30)
    elif any(keyword in exc_str for keyword in ['connection', '連線', 'connect']):
        return DeviceConnectionError("unknown", f"{context_prefix}{str(exc)}")
    elif any(keyword in exc_str for keyword in ['authentication', '認證', 'auth']):
        return DeviceAuthenticationError("unknown")
    
    # AI 服務相關異常
    elif any(keyword in exc_str for keyword in ['quota', '配額', 'limit', 'exceeded']):
        return AIQuotaExceededError("unknown")
    elif any(keyword in exc_str for keyword in ['api', 'service']):
        return AIAPIError("unknown", f"{context_prefix}{str(exc)}")
    
    # 配置相關異常
    elif any(keyword in exc_str for keyword in ['config', '配置', 'not found', '未找到']):
        return ConfigNotFoundError(f"{context_prefix}{str(exc)}")
    
    # 驗證相關異常
    elif any(keyword in exc_str for keyword in ['validation', '驗證', 'invalid']):
        return ValidationError("unknown", f"{context_prefix}{str(exc)}")
    
    # 預設為一般服務異常
    else:
        return ServiceError(f"{context_prefix}未預期的錯誤: {str(exc)}", "UNEXPECTED_ERROR", 500)