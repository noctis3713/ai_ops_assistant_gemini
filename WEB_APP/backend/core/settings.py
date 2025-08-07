# -*- coding: utf-8 -*-
"""
企業級設定管理模組
使用 Pydantic Settings 進行型別安全的環境變數管理
"""

import os
import yaml
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    應用程式全域設定類別 - 型別安全的環境變數管理
    
    特色：
    - 自動型別轉換和驗證
    - YAML 配置檔案支援 (v2.5.0)
    - 環境變數覆蓋機制
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
    
    # AI 功能開關 (移除 ENABLE_DOCUMENT_SEARCH - 不再支援外部文檔搜尋)
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
    
    # 移除指令快取配置 - 每次執行都必須是真實結果
    
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
    # 前端配置檔案路徑
    # =============================================================================
    
    # 前端配置檔案路徑
    FRONTEND_SETTINGS_PATH: str = Field(
        default="config/frontend_settings.yaml", 
        description="前端配置檔案路徑"
    )
    
    # 後端配置檔案路徑 ✨ v2.5.0 新增
    BACKEND_SETTINGS_PATH: str = Field(
        default="config/backend_settings.yaml", 
        description="後端配置檔案路徑"
    )
    
    # 配置快取 (內部使用)
    _frontend_config_cache: Optional[Dict[str, Any]] = None
    _backend_config_cache: Optional[Dict[str, Any]] = None
    
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
    
    # 移除 get_cache_config 方法 - 不再使用快取
    
    def get_task_manager_config(self) -> dict:
        """取得任務管理器配置字典"""
        return {
            "cleanup_interval": self.ASYNC_TASK_CLEANUP_INTERVAL,
            "task_ttl": self.ASYNC_TASK_TTL,
        }
    
    def load_frontend_config(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        載入前端配置檔案
        
        Args:
            force_reload: 強制重新載入配置檔案
            
        Returns:
            Dict[str, Any]: 前端配置字典
            
        Raises:
            FileNotFoundError: 配置檔案不存在
            yaml.YAMLError: YAML 解析錯誤
        """
        # 檢查快取
        if not force_reload and self._frontend_config_cache is not None:
            return self._frontend_config_cache
        
        # 建構配置檔案路徑
        config_path = Path(self.FRONTEND_SETTINGS_PATH)
        
        # 如果路徑不是絕對路徑，則相對於 backend 目錄
        if not config_path.is_absolute():
            # 取得 backend 目錄的絕對路徑
            backend_dir = Path(__file__).parent.parent  # core/../backend
            config_path = backend_dir / config_path
        
        # 檢查檔案是否存在
        if not config_path.exists():
            raise FileNotFoundError(f"前端配置檔案不存在: {config_path}")
        
        try:
            # 讀取 YAML 配置檔案
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            # 快取配置
            self._frontend_config_cache = config
            
            return config
            
        except yaml.YAMLError as e:
            raise yaml.YAMLError(f"前端配置檔案解析失敗: {e}")
    
    def get_frontend_config(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        取得前端動態配置
        
        這個方法會從 YAML 配置檔案載入前端配置，並支援環境變數覆蓋。
        
        Args:
            force_reload: 強制重新載入配置檔案
            
        Returns:
            Dict[str, Any]: 格式化的前端配置字典
        """
        try:
            # 載入基礎配置
            config = self.load_frontend_config(force_reload)
            
            # 環境變數覆蓋機制 (可選)
            # 例如: FRONTEND_POLLING_POLL_INTERVAL=3000 會覆蓋 polling.pollInterval
            frontend_config = {
                "polling": config.get("polling", {}),
                "ui": config.get("ui", {}),
                "api": config.get("api", {}),
                "cache": config.get("cache", {}),
                "logging": config.get("logging", {}),
                "performance": config.get("performance", {}),
                "development": config.get("development", {}),
            }
            
            return frontend_config
            
        except (FileNotFoundError, yaml.YAMLError) as e:
            # 配置檔案讀取失敗時，回傳預設配置
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"無法載入前端配置檔案，使用預設配置: {e}")
            
            # 回傳預設配置 (與原來硬編碼相同)
            return self._get_default_frontend_config()
    
    def _get_default_frontend_config(self) -> Dict[str, Any]:
        """
        取得預設前端配置 (作為後備方案)
        
        Returns:
            Dict[str, Any]: 預設的前端配置字典
        """
        return {
            "polling": {
                "pollInterval": 2000,
                "maxPollInterval": 10000,
                "timeout": 1800000,
                "autoStartPolling": True,
                "backoffMultiplier": 1.2,
                "maxRetries": 3,
            },
            "ui": {
                "progressUpdateInterval": 500,
                "errorDisplayDuration": 5000,
                "successDisplayDuration": 3000,
                "animationDuration": 300,
                "debounceDelay": 300,
                "maxConcurrentRequests": 5,
            },
            "api": {
                "retryCount": 3,
                "retryDelay": 1000,
                "enableRequestDeduplication": True,
                "deduplicationTTL": 5000,
                "timeouts": {
                    "command": 60000,
                    "aiQuery": 120000,
                    "batchCommand": 300000,
                    "taskPolling": 2000,
                    "healthCheck": 10000,
                }
            },
            "cache": {
                "deviceListTTL": 300000,
                "groupListTTL": 600000,
                "aiStatusTTL": 60000,
                "maxLocalStorageEntries": 100,
                "maxCacheAge": 3600000,
            },
            "logging": {
                "enableRemoteLogging": True,
                "logLevel": "INFO",
                "batchSize": 10,
                "batchInterval": 5000,
                "enabledCategories": ["api", "ui", "error"],
                "maxMessageLength": 1000,
                "enableStackTrace": True,
            },
            "performance": {
                "enablePerformanceMonitoring": True,
                "slowRequestThreshold": 5000,
                "memoryMonitoringInterval": 30000,
                "maxMemoryUsage": 512,
                "metricsCollectionInterval": 60000,
            },
            "development": {
                "enableDebugMode": False,
                "showApiDetails": False,
                "simulateNetworkDelay": 0,
                "showPerformanceStats": False,
                "enableHotReloadNotification": True,
            }
        }
    
    def load_backend_config(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        載入後端配置檔案
        
        Args:
            force_reload: 強制重新載入配置檔案
            
        Returns:
            Dict[str, Any]: 後端配置字典
            
        Raises:
            FileNotFoundError: 配置檔案不存在
            yaml.YAMLError: YAML 解析錯誤
        """
        # 檢查快取
        if not force_reload and self._backend_config_cache is not None:
            return self._backend_config_cache
        
        # 建構配置檔案路徑
        config_path = Path(self.BACKEND_SETTINGS_PATH)
        
        # 如果路徑不是絕對路徑，則相對於 backend 目錄
        if not config_path.is_absolute():
            # 取得 backend 目錄的絕對路徑
            backend_dir = Path(__file__).parent.parent  # core/../backend
            config_path = backend_dir / config_path
        
        # 檢查檔案是否存在
        if not config_path.exists():
            raise FileNotFoundError(f"後端配置檔案不存在: {config_path}")
        
        try:
            # 讀取 YAML 配置檔案
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            # 快取配置
            self._backend_config_cache = config
            
            return config
            
        except yaml.YAMLError as e:
            raise yaml.YAMLError(f"後端配置檔案解析失敗: {e}")
    
    def get_backend_config(self, force_reload: bool = False) -> Dict[str, Any]:
        """
        取得後端動態配置
        
        這個方法會從 YAML 配置檔案載入後端配置，並支援環境變數覆蓋。
        配置讀取失敗時自動降級為預設值。
        
        Args:
            force_reload: 強制重新載入配置檔案
            
        Returns:
            Dict[str, Any]: 格式化的後端配置字典
        """
        try:
            # 載入基礎配置
            config = self.load_backend_config(force_reload)
            
            # 回傳完整配置結構
            backend_config = {
                "ai": config.get("ai", {}),
                "network": config.get("network", {}),
                "cache": config.get("cache", {}),
                "logging": config.get("logging", {}),
                "async": config.get("async", {}),
                "prompts": config.get("prompts", {}),
                "security": config.get("security", {}),
                "performance": config.get("performance", {}),
            }
            
            return backend_config
            
        except (FileNotFoundError, yaml.YAMLError) as e:
            # 配置檔案讀取失敗時，回傳空字典（使用 Pydantic 預設值）
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"無法載入後端配置檔案，使用 Pydantic 預設配置: {e}")
            
            # 回傳空配置（觸發 Pydantic 預設值）
            return {}
    
    def clear_frontend_config_cache(self):
        """清除前端配置快取 (用於熱重載)"""
        self._frontend_config_cache = None
    
    def clear_backend_config_cache(self):
        """清除後端配置快取 (用於熱重載)"""
        self._backend_config_cache = None
    
    def apply_backend_config_overrides(self):
        """
        應用後端 YAML 配置覆蓋
        
        這個方法會在實例化後調用，從 YAML 配置檔案載入設定值，
        但仍保留環境變數的最高優先級。
        
        優先級順序: 環境變數 > YAML 配置 > Pydantic 預設值
        """
        try:
            backend_config = self.get_backend_config()
            
            # AI 服務配置覆蓋
            ai_config = backend_config.get("ai", {})
            if ai_config:
                # 功能開關覆蓋 (只在環境變數未設定時生效)
                # 移除 enableDocumentSearch 覆蓋邏輯 - 不再支援搜尋功能
                
                if not os.getenv("PARSER_VERSION") and "parserVersion" in ai_config:
                    self.PARSER_VERSION = ai_config["parserVersion"]
                
                if not os.getenv("ENABLE_AI_SUMMARIZATION") and "enableSummarization" in ai_config:
                    self.ENABLE_AI_SUMMARIZATION = ai_config["enableSummarization"]
                
                if not os.getenv("AI_SUMMARY_THRESHOLD") and "summaryThreshold" in ai_config:
                    self.AI_SUMMARY_THRESHOLD = ai_config["summaryThreshold"]
            
            # 網路連線配置覆蓋
            network_config = backend_config.get("network", {})
            connection_config = network_config.get("connection", {})
            if connection_config:
                if not os.getenv("MAX_CONNECTIONS") and "maxConnections" in connection_config:
                    self.MAX_CONNECTIONS = connection_config["maxConnections"]
                
                if not os.getenv("CONNECTION_TIMEOUT") and "connectionTimeout" in connection_config:
                    self.CONNECTION_TIMEOUT = connection_config["connectionTimeout"]
                
                if not os.getenv("COMMAND_TIMEOUT") and "commandTimeout" in connection_config:
                    self.COMMAND_TIMEOUT = connection_config["commandTimeout"]
                
                if not os.getenv("HEALTH_CHECK_INTERVAL") and "healthCheckInterval" in connection_config:
                    self.HEALTH_CHECK_INTERVAL = connection_config["healthCheckInterval"]
            
            # 設備配置覆蓋
            device_config = network_config.get("device", {})
            if device_config:
                if not os.getenv("DEVICE_TYPE") and "defaultType" in device_config:
                    self.DEVICE_TYPE = device_config["defaultType"]
            
            # Nornir 配置覆蓋
            nornir_config = network_config.get("nornir", {})
            if nornir_config:
                if not os.getenv("NORNIR_WORKERS") and "workers" in nornir_config:
                    self.NORNIR_WORKERS = nornir_config["workers"]
            
            # 輸出處理配置覆蓋
            output_config = backend_config.get("output", {})
            output_processing = output_config.get("processing", {})
            if output_processing:
                if not os.getenv("DEVICE_OUTPUT_MAX_LENGTH") and "maxLength" in output_processing:
                    self.DEVICE_OUTPUT_MAX_LENGTH = output_processing["maxLength"]
            
            # 日誌配置覆蓋
            logging_config = backend_config.get("logging", {})
            basic_logging = logging_config.get("basic", {})
            if basic_logging:
                if not os.getenv("LOG_LEVEL") and "logLevel" in basic_logging:
                    self.LOG_LEVEL = basic_logging["logLevel"]
                
                if not os.getenv("LOG_MAX_SIZE") and "maxFileSize" in basic_logging:
                    self.LOG_MAX_SIZE = basic_logging["maxFileSize"]
                
                if not os.getenv("LOG_BACKUP_COUNT") and "backupCount" in basic_logging:
                    self.LOG_BACKUP_COUNT = basic_logging["backupCount"]
            
            # 前端日誌配置覆蓋
            frontend_logging = logging_config.get("frontend", {})
            if frontend_logging:
                if not os.getenv("FRONTEND_LOG_LEVEL") and "logLevel" in frontend_logging:
                    self.FRONTEND_LOG_LEVEL = frontend_logging["logLevel"]
                
                if not os.getenv("FRONTEND_LOG_BATCH_SIZE") and "batchSize" in frontend_logging:
                    self.FRONTEND_LOG_BATCH_SIZE = frontend_logging["batchSize"]
                
                if not os.getenv("FRONTEND_LOG_BATCH_INTERVAL") and "batchInterval" in frontend_logging:
                    self.FRONTEND_LOG_BATCH_INTERVAL = frontend_logging["batchInterval"]
                
                if not os.getenv("FRONTEND_MAX_LOCAL_STORAGE_ENTRIES") and "maxLocalStorageEntries" in frontend_logging:
                    self.FRONTEND_MAX_LOCAL_STORAGE_ENTRIES = frontend_logging["maxLocalStorageEntries"]
                
                if not os.getenv("FRONTEND_LOG_MAX_MESSAGE_LENGTH") and "maxMessageLength" in frontend_logging:
                    self.FRONTEND_LOG_MAX_MESSAGE_LENGTH = frontend_logging["maxMessageLength"]
                
                if not os.getenv("FRONTEND_LOG_ENABLE_STACK_TRACE") and "enableStackTrace" in frontend_logging:
                    self.FRONTEND_LOG_ENABLE_STACK_TRACE = frontend_logging["enableStackTrace"]
                
                if not os.getenv("BACKEND_ENABLE_FRONTEND_CONSOLE_LOG") and "enableConsoleLog" in frontend_logging:
                    self.BACKEND_ENABLE_FRONTEND_CONSOLE_LOG = frontend_logging["enableConsoleLog"]
            
            # 非同步任務配置覆蓋
            async_config = backend_config.get("async", {})
            tasks_config = async_config.get("tasks", {})
            if tasks_config:
                if not os.getenv("ASYNC_TASK_CLEANUP_INTERVAL") and "cleanupInterval" in tasks_config:
                    self.ASYNC_TASK_CLEANUP_INTERVAL = tasks_config["cleanupInterval"]
                
                if not os.getenv("ASYNC_TASK_TTL") and "taskTTL" in tasks_config:
                    self.ASYNC_TASK_TTL = tasks_config["taskTTL"]
            
            # 提示詞配置覆蓋
            prompts_config = backend_config.get("prompts", {})
            basic_prompts = prompts_config.get("basic", {})
            if basic_prompts:
                if not os.getenv("PROMPT_LANGUAGE") and "language" in basic_prompts:
                    self.PROMPT_LANGUAGE = basic_prompts["language"]
                
        except Exception as e:
            # 配置覆蓋失敗不應該導致系統啟動失敗
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"後端配置覆蓋失敗，使用預設配置: {e}")
    


# =============================================================================
# 全域實例和依賴注入
# =============================================================================

# 建立全域 Settings 實例並應用 YAML 配置覆蓋 ✨ v2.5.0
settings = Settings()

# 應用後端配置 YAML 檔案的覆蓋設定
# 這會在系統啟動時執行一次，實現 YAML 配置優先於 Pydantic 預設值
settings.apply_backend_config_overrides()

def get_settings() -> Settings:
    """
    FastAPI 依賴注入提供者
    返回全域 Settings 實例
    
    注意: v2.5.0 開始，Settings 實例已整合 YAML 配置載入
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
