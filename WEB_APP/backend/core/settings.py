# -*- coding: utf-8 -*-
"""
企業級設定管理模組
使用 Pydantic Settings 進行型別安全的環境變數管理
"""

import os
from typing import List, Optional
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    應用程式全域設定類別 - 型別安全的環境變數管理
    
    特色：
    - 自動型別轉換和驗證
    - 快速失敗 (Fail Fast) 機制
    - 集中管理所有配置
    - 自我文件化
    """
    
    # Pydantic Settings 配置
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"  # 允許額外的環境變數
    )
    
    # =============================================================================
    # AI 服務核心配置
    # =============================================================================
    
    # AI 服務供應商配置
    AI_PROVIDER: str = Field(default="gemini", description="AI 服務供應商 (gemini/claude)")
    
    # API 金鑰 (必填項目)
    GOOGLE_API_KEY: Optional[str] = Field(default=None, description="Google Gemini API 金鑰")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, description="Anthropic Claude API 金鑰")
    
    # AI 模型配置
    GEMINI_MODEL: str = Field(default="gemini-1.5-flash-latest", description="Gemini 模型版本")
    CLAUDE_MODEL: str = Field(default="claude-3-haiku-20240307", description="Claude 模型版本")
    
    # AI 功能開關
    ENABLE_DOCUMENT_SEARCH: bool = Field(default=False, description="啟用文檔搜尋功能")
    PARSER_VERSION: str = Field(default="original", description="解析器版本")
    ENABLE_AI_SUMMARIZATION: bool = Field(default=False, description="啟用 AI 摘要功能")
    
    # AI 處理參數
    AI_SUMMARY_THRESHOLD: int = Field(default=10000, description="AI 摘要觸發門檻 (字元數)")
    
    # =============================================================================
    # 網路連線和設備配置
    # =============================================================================
    
    # 連線池配置
    MAX_CONNECTIONS: int = Field(default=5, description="最大 SSH 連線數")
    CONNECTION_TIMEOUT: int = Field(default=300, description="連線逾時時間 (秒)")
    COMMAND_TIMEOUT: int = Field(default=20, description="指令執行逾時時間 (秒)")
    HEALTH_CHECK_INTERVAL: int = Field(default=30, description="健康檢查間隔 (秒)")
    
    # 設備認證配置 (可選)
    DEVICE_TYPE: str = Field(default="cisco_xe", description="預設設備類型")
    DEVICE_USERNAME: Optional[str] = Field(default=None, description="預設設備使用者名稱")
    DEVICE_PASSWORD: Optional[str] = Field(default=None, description="預設設備密碼")
    
    # Nornir 配置
    NORNIR_WORKERS: int = Field(default=5, description="Nornir 工作執行緒數量")
    
    # =============================================================================
    # 快取和輸出配置
    # =============================================================================
    
    # 指令快取配置
    CACHE_MAX_SIZE: int = Field(default=512, description="快取最大項目數")
    CACHE_TTL: int = Field(default=300, description="快取存活時間 (秒)")
    
    # 輸出處理配置
    DEVICE_OUTPUT_MAX_LENGTH: int = Field(default=50000, description="設備輸出最大長度")
    OUTPUT_MAX_SIZE: int = Field(default=50000, description="輸出快取最大大小")
    
    # =============================================================================
    # 日誌系統配置
    # =============================================================================
    
    # 基礎日誌配置
    LOG_LEVEL: str = Field(default="INFO", description="日誌級別")
    LOG_MAX_SIZE: int = Field(default=10485760, description="日誌檔案最大大小 (位元組)")
    LOG_BACKUP_COUNT: int = Field(default=5, description="日誌備份檔案數量")
    
    # 前端日誌配置
    FRONTEND_LOG_LEVEL: str = Field(default="INFO", description="前端日誌級別")
    FRONTEND_LOG_BATCH_SIZE: int = Field(default=10, description="前端日誌批次大小")
    FRONTEND_LOG_BATCH_INTERVAL: int = Field(default=30000, description="前端日誌批次間隔 (毫秒)")
    FRONTEND_MAX_LOCAL_STORAGE_ENTRIES: int = Field(default=100, description="前端本地儲存最大日誌條目數")
    FRONTEND_LOG_MAX_MESSAGE_LENGTH: int = Field(default=1000, description="前端日誌訊息最大長度")
    FRONTEND_LOG_ENABLE_STACK_TRACE: bool = Field(default=False, description="前端日誌啟用堆疊追蹤")
    
    # 後端前端日誌整合
    BACKEND_ENABLE_FRONTEND_CONSOLE_LOG: bool = Field(default=False, description="後端啟用前端控制台日誌")
    
    # =============================================================================
    # 非同步任務配置
    # =============================================================================
    
    # 任務管理配置
    ASYNC_TASK_CLEANUP_INTERVAL: int = Field(default=3600, description="非同步任務清理間隔 (秒)")
    ASYNC_TASK_TTL: int = Field(default=86400, description="非同步任務存活時間 (秒)")
    
    # =============================================================================
    # 提示詞管理配置
    # =============================================================================
    
    # 提示詞系統配置
    PROMPT_LANGUAGE: str = Field(default="zh_TW", description="提示詞語言")
    PROMPT_TEMPLATE_DIR: Optional[str] = Field(default=None, description="提示詞模板目錄路徑")
    
    # =============================================================================
    # 安全和管理配置
    # =============================================================================
    
    # 管理 API 金鑰
    ADMIN_API_KEY: str = Field(default="admin123", description="管理 API 金鑰")
    
    # =============================================================================
    # 驗證器方法
    # =============================================================================
    
    @validator('AI_PROVIDER')
    def validate_ai_provider(cls, v):
        """驗證 AI 供應商設定"""
        allowed_providers = ['gemini', 'claude']
        if v.lower() not in allowed_providers:
            raise ValueError(f'AI_PROVIDER 必須是 {allowed_providers} 之一')
        return v.lower()
    
    @validator('LOG_LEVEL', 'FRONTEND_LOG_LEVEL')
    def validate_log_level(cls, v):
        """驗證日誌級別設定"""
        allowed_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in allowed_levels:
            raise ValueError(f'日誌級別必須是 {allowed_levels} 之一')
        return v.upper()
    
    @validator('GEMINI_MODEL')
    def validate_gemini_model(cls, v):
        """驗證 Gemini 模型名稱"""
        if v and not v.startswith('gemini-'):
            raise ValueError('GEMINI_MODEL 必須以 "gemini-" 開頭')
        return v
        
    @validator('CLAUDE_MODEL') 
    def validate_claude_model(cls, v):
        """驗證 Claude 模型名稱"""
        if v and not v.startswith('claude-'):
            raise ValueError('CLAUDE_MODEL 必須以 "claude-" 開頭')
        return v
    
    # =============================================================================
    # 輔助方法
    # =============================================================================
    
    def get_ai_api_key(self) -> Optional[str]:
        """根據當前 AI 供應商取得對應的 API 金鑰"""
        if self.AI_PROVIDER == "gemini":
            return self.GOOGLE_API_KEY
        elif self.AI_PROVIDER == "claude":
            return self.ANTHROPIC_API_KEY
        return None
    
    def is_ai_configured(self) -> bool:
        """檢查 AI 服務是否已正確配置"""
        return self.get_ai_api_key() is not None
    
    def get_gemini_configured(self) -> bool:
        """檢查 Gemini 是否已配置"""
        return bool(self.GOOGLE_API_KEY)
    
    def get_claude_configured(self) -> bool:
        """檢查 Claude 是否已配置"""
        return bool(self.ANTHROPIC_API_KEY)
    
    def get_log_config(self) -> dict:
        """取得日誌配置字典"""
        return {
            "MAX_SIZE": self.LOG_MAX_SIZE,
            "BACKUP_COUNT": self.LOG_BACKUP_COUNT,
            "LOG_LEVEL": self.LOG_LEVEL,
        }
    
    def get_frontend_log_config(self) -> dict:
        """取得前端日誌配置字典"""
        enabled_categories = os.getenv("FRONTEND_LOG_ENABLED_CATEGORIES", "api,error,user").split(",")
        
        return {
            "enableRemoteLogging": True,  # 預設啟用遠端日誌
            "logLevel": self.FRONTEND_LOG_LEVEL,
            "batchSize": self.FRONTEND_LOG_BATCH_SIZE,
            "batchInterval": self.FRONTEND_LOG_BATCH_INTERVAL,
            "maxLocalStorageEntries": self.FRONTEND_MAX_LOCAL_STORAGE_ENTRIES,
            "enabledCategories": enabled_categories,
            "maxMessageLength": self.FRONTEND_LOG_MAX_MESSAGE_LENGTH,
            "enableStackTrace": self.FRONTEND_LOG_ENABLE_STACK_TRACE,
        }
    
    def get_connection_pool_config(self) -> dict:
        """取得連線池配置字典"""
        return {
            "max_connections": self.MAX_CONNECTIONS,
            "timeout": self.CONNECTION_TIMEOUT,
            "health_check_interval": self.HEALTH_CHECK_INTERVAL,
        }
    
    def get_cache_config(self) -> dict:
        """取得快取配置字典"""
        return {
            "max_size": self.CACHE_MAX_SIZE,
            "ttl": self.CACHE_TTL,
        }
    
    def get_task_manager_config(self) -> dict:
        """取得任務管理器配置字典"""
        return {
            "cleanup_interval": self.ASYNC_TASK_CLEANUP_INTERVAL,
            "task_ttl": self.ASYNC_TASK_TTL,
        }
    


# =============================================================================
# 全域實例和依賴注入
# =============================================================================

# 建立全域 Settings 實例
settings = Settings()

def get_settings() -> Settings:
    """
    FastAPI 依賴注入提供者
    返回全域 Settings 實例
    """
    return settings

# =============================================================================
# 向後相容性輔助函數
# =============================================================================

def get_env_bool(key: str, default: bool = False) -> bool:
    """向後相容的布林環境變數讀取函數"""
    return getattr(settings, key, os.getenv(key, str(default)).lower() == "true")

def get_env_int(key: str, default: int) -> int:
    """向後相容的整數環境變數讀取函數"""
    return getattr(settings, key, int(os.getenv(key, str(default))))

def get_env_str(key: str, default: str = "") -> str:
    """向後相容的字串環境變數讀取函數"""
    return getattr(settings, key, os.getenv(key, default))