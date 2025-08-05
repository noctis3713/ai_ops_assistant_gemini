#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
錯誤代碼常數定義

統一管理所有 API 端點的錯誤代碼，提供標準化的錯誤分類和前端友善的錯誤處理。

Created: 2025-08-05
Author: Claude Code Assistant  
"""

# =============================================================================
# AI 相關錯誤代碼
# =============================================================================

class AIErrorCodes:
    """AI 服務相關錯誤代碼"""
    
    # API 配額和頻率限制
    QUOTA_EXCEEDED = "AI_QUOTA_EXCEEDED"
    RATE_LIMIT = "AI_RATE_LIMIT"
    
    # 認證和授權
    AUTH_FAILED = "AI_AUTH_FAILED"
    PERMISSION_DENIED = "AI_PERMISSION_DENIED"
    
    # 服務可用性
    SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE"
    SERVICE_TIMEOUT = "AI_SERVICE_TIMEOUT"
    
    # 查詢處理
    QUERY_FAILED = "AI_QUERY_FAILED"
    PARSING_FAILED = "AI_PARSING_FAILED"
    INVALID_RESPONSE = "AI_INVALID_RESPONSE"

# =============================================================================
# 網路設備相關錯誤代碼
# =============================================================================

class NetworkErrorCodes:
    """網路設備相關錯誤代碼"""
    
    # 連線相關
    CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT"
    CONNECTION_REFUSED = "CONNECTION_REFUSED"
    HOST_UNREACHABLE = "HOST_UNREACHABLE"
    
    # 認證相關
    AUTH_FAILED = "AUTH_FAILED"
    CREDENTIALS_INVALID = "CREDENTIALS_INVALID"
    
    # 指令執行
    COMMAND_FAILED = "COMMAND_FAILED"
    COMMAND_UNSAFE = "COMMAND_UNSAFE"
    COMMAND_SYNTAX_ERROR = "COMMAND_SYNTAX_ERROR"
    
    # 設備狀態
    DEVICE_NOT_FOUND = "DEVICE_NOT_FOUND"
    DEVICE_UNREACHABLE = "DEVICE_UNREACHABLE"
    DEVICE_BUSY = "DEVICE_BUSY"

# =============================================================================
# 任務管理相關錯誤代碼
# =============================================================================

class TaskErrorCodes:
    """任務管理相關錯誤代碼"""
    
    # 任務狀態
    TASK_NOT_FOUND = "TASK_NOT_FOUND"
    TASK_EXPIRED = "TASK_EXPIRED"
    TASK_CANCELLED = "TASK_CANCELLED"
    
    # 任務執行
    TASK_CREATION_FAILED = "TASK_CREATION_FAILED"
    TASK_EXECUTION_FAILED = "TASK_EXECUTION_FAILED"
    TASK_TIMEOUT = "TASK_TIMEOUT"
    
    # 任務管理
    TASK_MANAGER_OVERLOAD = "TASK_MANAGER_OVERLOAD"
    TASK_CLEANUP_FAILED = "TASK_CLEANUP_FAILED"

# =============================================================================
# 配置和系統相關錯誤代碼
# =============================================================================

class SystemErrorCodes:
    """系統和配置相關錯誤代碼"""
    
    # 配置相關
    CONFIG_LOAD_FAILED = "CONFIG_LOAD_FAILED"
    CONFIG_VALIDATION_FAILED = "CONFIG_VALIDATION_FAILED"
    CONFIG_RELOAD_FAILED = "CONFIG_RELOAD_FAILED"
    
    # 系統資源
    MEMORY_EXHAUSTED = "MEMORY_EXHAUSTED"
    DISK_SPACE_LOW = "DISK_SPACE_LOW"
    CPU_OVERLOAD = "CPU_OVERLOAD"
    
    # 服務相關
    SERVICE_INITIALIZATION_FAILED = "SERVICE_INITIALIZATION_FAILED"
    DEPENDENCY_MISSING = "DEPENDENCY_MISSING"
    
    # 通用錯誤
    INTERNAL_ERROR = "INTERNAL_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    PERMISSION_DENIED = "PERMISSION_DENIED"

# =============================================================================
# 前端友善錯誤訊息映射
# =============================================================================

ERROR_MESSAGE_MAP = {
    # AI 錯誤訊息
    AIErrorCodes.QUOTA_EXCEEDED: "AI API 配額已用完，請稍後再試或升級方案",
    AIErrorCodes.RATE_LIMIT: "AI API 請求頻率過高，請稍後再試",
    AIErrorCodes.AUTH_FAILED: "AI 服務認證失敗，請檢查 API 金鑰",
    AIErrorCodes.SERVICE_UNAVAILABLE: "AI 服務暫時不可用，請稍後再試",
    AIErrorCodes.SERVICE_TIMEOUT: "AI 分析超時，請簡化查詢內容",
    AIErrorCodes.QUERY_FAILED: "AI 查詢失敗，請重試",
    
    # 網路設備錯誤訊息
    NetworkErrorCodes.CONNECTION_TIMEOUT: "設備連線超時，請檢查網路狀況",
    NetworkErrorCodes.CONNECTION_REFUSED: "設備拒絕連線，請檢查設備狀態",
    NetworkErrorCodes.AUTH_FAILED: "設備認證失敗，請檢查憑證設定",
    NetworkErrorCodes.COMMAND_UNSAFE: "指令不安全，系統已自動阻止",
    NetworkErrorCodes.DEVICE_NOT_FOUND: "設備不存在，請檢查 IP 位址",
    NetworkErrorCodes.DEVICE_UNREACHABLE: "設備無法連線，請檢查網路連通性",
    
    # 任務管理錯誤訊息
    TaskErrorCodes.TASK_NOT_FOUND: "任務不存在或已被清理",
    TaskErrorCodes.TASK_EXPIRED: "任務已過期",
    TaskErrorCodes.TASK_CANCELLED: "任務已被取消",
    TaskErrorCodes.TASK_CREATION_FAILED: "任務建立失敗",
    TaskErrorCodes.TASK_EXECUTION_FAILED: "任務執行失敗",
    TaskErrorCodes.TASK_TIMEOUT: "任務執行超時",
    
    # 系統錯誤訊息
    SystemErrorCodes.CONFIG_LOAD_FAILED: "配置載入失敗",
    SystemErrorCodes.CONFIG_VALIDATION_FAILED: "配置驗證失敗",
    SystemErrorCodes.INTERNAL_ERROR: "系統內部錯誤",
    SystemErrorCodes.VALIDATION_ERROR: "輸入驗證失敗",
    SystemErrorCodes.PERMISSION_DENIED: "權限不足"
}

# =============================================================================
# 錯誤代碼工具函數
# =============================================================================

def get_error_message(error_code: str) -> str:
    """根據錯誤代碼獲取用戶友善的錯誤訊息
    
    Args:
        error_code: 錯誤代碼
        
    Returns:
        str: 用戶友善的錯誤訊息
    """
    return ERROR_MESSAGE_MAP.get(error_code, "發生未知錯誤，請聯繫系統管理員")

def classify_network_error(error_str: str) -> str:
    """根據錯誤字串分類網路錯誤
    
    Args:
        error_str: 錯誤訊息字串
        
    Returns:
        str: 對應的錯誤代碼
    """
    error_lower = error_str.lower()
    
    if "timeout" in error_lower:
        return NetworkErrorCodes.CONNECTION_TIMEOUT
    elif "connection refused" in error_lower or "refused" in error_lower:
        return NetworkErrorCodes.CONNECTION_REFUSED
    elif "authentication" in error_lower or "auth" in error_lower:
        return NetworkErrorCodes.AUTH_FAILED
    elif "unreachable" in error_lower:
        return NetworkErrorCodes.HOST_UNREACHABLE
    elif "not found" in error_lower:
        return NetworkErrorCodes.DEVICE_NOT_FOUND
    else:
        return NetworkErrorCodes.COMMAND_FAILED

def classify_ai_error(error_str: str, status_code: int = None) -> str:
    """根據錯誤字串和狀態碼分類 AI 錯誤
    
    Args:
        error_str: 錯誤訊息字串
        status_code: HTTP 狀態碼
        
    Returns:
        str: 對應的錯誤代碼
    """
    error_lower = error_str.lower()
    
    # 優先使用狀態碼判斷
    if status_code == 429:
        return AIErrorCodes.QUOTA_EXCEEDED
    elif status_code == 401:
        return AIErrorCodes.AUTH_FAILED
    elif status_code == 503:
        return AIErrorCodes.SERVICE_UNAVAILABLE
    
    # 使用錯誤訊息內容判斷
    if "quota" in error_lower or "limit" in error_lower or "exceeded" in error_lower:
        return AIErrorCodes.QUOTA_EXCEEDED
    elif "unauthorized" in error_lower or "auth" in error_lower:
        return AIErrorCodes.AUTH_FAILED
    elif "timeout" in error_lower:
        return AIErrorCodes.SERVICE_TIMEOUT
    elif "unavailable" in error_lower or "service" in error_lower:
        return AIErrorCodes.SERVICE_UNAVAILABLE
    else:
        return AIErrorCodes.QUERY_FAILED