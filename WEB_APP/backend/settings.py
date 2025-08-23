# -*- coding: utf-8 -*-
"""
統一配置系統 - 遵循 YAGNI 原則
所有配置功能合併到單一檔案，移除過度抽象
整合 ConfigManager 功能到此檔案
"""

import json
import logging
import os
import re
from ipaddress import AddressValueError, IPv4Address, IPv6Address
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    統一配置類別

    整合所有配置到單一類別，移除過度設計：
    - 移除 Mixin 模式
    - 移除動態委託
    - 移除抽象基類
    - 直接定義所有配置屬性
    """

    model_config = SettingsConfigDict(
        env_file=[".env", "../../.env"],
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )

    # =========================================================================
    # AI 服務配置
    # =========================================================================

    AI_PROVIDER: str = Field(default="gemini", description="AI 服務供應商")
    GEMINI_API_KEY: Optional[str] = Field(
        default=None, description="Google Gemini API 金鑰"
    )
    CLAUDE_API_KEY: Optional[str] = Field(
        default=None, description="Anthropic Claude API 金鑰"
    )
    GEMINI_MODEL: str = Field(
        default="gemini-1.5-flash-latest", description="Gemini 模型版本"
    )
    CLAUDE_MODEL: str = Field(
        default="claude-3-haiku-20240307", description="Claude 模型版本"
    )
    PARSER_VERSION: str = Field(default="original", description="解析器版本")
    ENABLE_AI_SUMMARIZATION: bool = Field(default=False, description="啟用 AI 摘要功能")
    AI_SUMMARY_THRESHOLD: int = Field(default=10000, description="AI 摘要觸發門檻")
    PROMPT_LANGUAGE: str = Field(default="zh_TW", description="提示詞語言")
    PROMPT_TEMPLATE_DIR: Optional[str] = Field(
        default="/app/WEB_APP/backend/prompts", description="提示詞模板目錄路徑"
    )

    # =========================================================================
    # 網路連線配置
    # =========================================================================

    MAX_CONNECTIONS: int = Field(default=5, description="最大 SSH 連線數")
    CONNECTION_TIMEOUT: int = Field(default=300, description="連線逾時時間 (秒)")
    COMMAND_TIMEOUT: int = Field(default=20, description="指令執行逾時時間 (秒)")
    DEVICE_USERNAME: Optional[str] = Field(default=None, description="設備預設用戶名")
    DEVICE_PASSWORD: Optional[str] = Field(default=None, description="設備預設密碼")
    DEVICE_TYPE: str = Field(default="cisco_ios", description="預設設備類型")
    MAX_WORKERS: int = Field(default=5, description="最大工作執行緒數")

    # =========================================================================
    # 日誌配置
    # =========================================================================

    LOG_LEVEL: str = Field(default="INFO", description="日誌等級")
    LOG_FORMAT: str = Field(default="detailed", description="日誌格式")

    # =========================================================================
    # 系統配置
    # =========================================================================

    ENVIRONMENT: str = Field(default="development", description="執行環境")
    DEBUG: bool = Field(default=True, description="除錯模式")
    DEVICE_OUTPUT_MAX_LENGTH: int = Field(default=50000, description="設備輸出最大長度")
    ADMIN_API_KEY: Optional[str] = Field(default=None, description="管理員 API 金鑰")

    # =========================================================================
    # Nornir 配置（向下相容）
    # =========================================================================

    NORNIR_WORKERS: int = Field(default=5, description="Nornir 工作執行緒數")

    # =========================================================================
    # 配置驗證和工具方法
    # =========================================================================

    def is_ai_configured(self) -> bool:
        """檢查是否有配置任何 AI 服務"""
        return bool(self.GEMINI_API_KEY or self.CLAUDE_API_KEY)

    def get_gemini_configured(self) -> bool:
        """檢查 Gemini 是否已配置"""
        return bool(self.GEMINI_API_KEY)

    def get_claude_configured(self) -> bool:
        """檢查 Claude 是否已配置"""
        return bool(self.CLAUDE_API_KEY)

    def get_active_ai_provider(self) -> Optional[str]:
        """取得當前啟用的 AI 服務"""
        if self.AI_PROVIDER == "claude" and self.CLAUDE_API_KEY:
            return "claude"
        elif self.AI_PROVIDER == "gemini" and self.GEMINI_API_KEY:
            return "gemini"
        return None

    # =========================================================================
    # 前端/後端配置載入 - 整合自 config.py
    # =========================================================================

    _frontend_config_cache: Optional[Dict[str, Any]] = None
    _backend_config_cache: Optional[Dict[str, Any]] = None

    def get_frontend_config(self) -> Dict[str, Any]:
        """載入前端配置"""
        if self._frontend_config_cache is not None:
            return self._frontend_config_cache

        config_path = Path(__file__).parent / "config" / "frontend_settings.yaml"

        try:
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._frontend_config_cache = yaml.safe_load(f) or {}
            else:
                self._frontend_config_cache = {}

            return self._frontend_config_cache
        except Exception as e:
            print(f"載入前端配置失敗: {e}")
            return {}

    def get_backend_config(self) -> Dict[str, Any]:
        """載入後端配置"""
        if self._backend_config_cache is not None:
            return self._backend_config_cache

        config_path = Path(__file__).parent / "config" / "backend_settings.yaml"

        try:
            if config_path.exists():
                with open(config_path, "r", encoding="utf-8") as f:
                    self._backend_config_cache = yaml.safe_load(f) or {}
            else:
                self._backend_config_cache = {}

            return self._backend_config_cache
        except Exception as e:
            print(f"載入後端配置失敗: {e}")
            return {}

    def clear_frontend_config_cache(self):
        """清除前端配置快取"""
        self._frontend_config_cache = None

    def clear_backend_config_cache(self):
        """清除後端配置快取"""
        self._backend_config_cache = None

    def apply_backend_config_overrides(self):
        """應用後端配置覆蓋"""
        # 記錄配置更新操作
        pass

    # =========================================================================
    # 設備配置管理 - 整合自 ConfigManager
    # =========================================================================

    _devices_config: Optional[List[Dict[str, Any]]] = None
    _groups_config: Optional[Dict[str, Any]] = None  
    _security_config: Optional[Dict[str, Any]] = None

    @property
    def config_dir(self) -> Path:
        """配置目錄路徑"""
        return Path(__file__).parent / "config"

    def get_devices_config(self) -> List[Dict[str, Any]]:
        """載入設備配置 - 整合自 ConfigManager"""
        if self._devices_config is not None:
            return self._devices_config

        config_file = self.config_dir / "devices.json"

        try:
            if not config_file.exists():
                self._devices_config = []
                return self._devices_config

            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            self._devices_config = data.get("devices", [])
            return self._devices_config

        except Exception as e:
            logger.error(f"載入設備配置失敗: {e}")
            self._devices_config = []
            return self._devices_config

    def get_groups_config(self) -> Dict[str, Any]:
        """載入群組配置 - 整合自 ConfigManager"""
        if self._groups_config is not None:
            return self._groups_config

        config_file = self.config_dir / "groups.json"

        try:
            if not config_file.exists():
                self._groups_config = {}
                return self._groups_config

            with open(config_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # 轉換群組格式
            groups_dict = {}
            for group in data.get("groups", []):
                if "name" in group:
                    groups_dict[group["name"]] = {
                        "devices": group.get("devices", []),
                        "description": group.get("description", ""),
                    }

            self._groups_config = groups_dict
            return self._groups_config

        except Exception as e:
            logger.error(f"載入群組配置失敗: {e}")
            self._groups_config = {}
            return self._groups_config

    def get_security_config(self) -> Dict[str, Any]:
        """載入安全配置 - 整合自 ConfigManager"""
        if self._security_config is not None:
            return self._security_config

        config_file = self.config_dir / "security.json"

        try:
            if not config_file.exists():
                self._security_config = {}
                return self._security_config

            with open(config_file, "r", encoding="utf-8") as f:
                self._security_config = json.load(f)

            return self._security_config

        except Exception as e:
            logger.error(f"載入安全配置失敗: {e}")
            self._security_config = {}
            return self._security_config

    def get_device_by_ip(self, ip: str) -> Optional[Dict[str, Any]]:
        """根據 IP 取得設備配置 - 整合自 ConfigManager"""
        devices = self.get_devices_config()
        for device in devices:
            if device.get("ip") == ip:
                return device
        return None

    def get_all_device_ips(self) -> List[str]:
        """取得所有設備 IP - 整合自 ConfigManager"""
        devices = self.get_devices_config()
        return [d.get("ip") for d in devices if d.get("ip")]

    def refresh_config(self):
        """重新載入所有配置 - 整合自 ConfigManager"""
        self._devices_config = None
        self._groups_config = None
        self._security_config = None
        self._frontend_config_cache = None
        self._backend_config_cache = None


# 全域實例
settings = Settings()


def get_settings() -> Settings:
    """取得全域設定實例"""
    return settings


# =============================================================================
# 驗證功能 (原 validators.py)
# =============================================================================


def validate_ip_address(ip_str: str) -> Tuple[bool, str]:
    """驗證 IP 地址格式"""
    if not ip_str or not isinstance(ip_str, str):
        return False, "IP 地址不能為空"

    ip_str = ip_str.strip()

    try:
        # 嘗試解析為 IPv4 或 IPv6
        IPv4Address(ip_str)
        return True, "IPv4 地址有效"
    except AddressValueError:
        try:
            IPv6Address(ip_str)
            return True, "IPv6 地址有效"
        except AddressValueError:
            return False, f"無效的 IP 地址格式: {ip_str}"


def validate_device_list(device_list: List[str]) -> Tuple[bool, str, List[str]]:
    """驗證設備 IP 列表"""
    if not device_list:
        return False, "設備列表不能為空", []

    if not isinstance(device_list, list):
        return False, "設備列表必須是陣列格式", []

    valid_devices = []
    invalid_devices = []

    for device_ip in device_list:
        is_valid, msg = validate_ip_address(device_ip)
        if is_valid:
            valid_devices.append(device_ip.strip())
        else:
            invalid_devices.append(device_ip)

    if invalid_devices:
        return False, f"無效的設備 IP: {', '.join(invalid_devices)}", valid_devices

    return True, f"驗證通過，共 {len(valid_devices)} 台設備", valid_devices


class SimpleCommandValidator:
    """指令驗證器"""

    # 預設安全配置
    DEFAULT_ALLOWED_PREFIXES = ["show", "ping", "traceroute", "display", "get"]
    DEFAULT_DANGEROUS_KEYWORDS = [
        "configure",
        "write",
        "delete",
        "shutdown",
        "reload",
        "erase",
        "format",
        "install",
        "upgrade",
        "boot",
    ]

    def __init__(self):
        """初始化指令驗證器"""
        self.allowed_prefixes = self.DEFAULT_ALLOWED_PREFIXES.copy()
        self.dangerous_keywords = self.DEFAULT_DANGEROUS_KEYWORDS.copy()

    def validate_command(self, command: str) -> Tuple[bool, str]:
        """驗證指令是否安全"""
        if not command or not isinstance(command, str):
            return False, "指令不能為空"

        command = command.strip().lower()

        # 檢查是否以允許的前綴開始
        allowed = False
        for prefix in self.allowed_prefixes:
            if command.startswith(prefix.lower()):
                allowed = True
                break

        if not allowed:
            return (
                False,
                f"指令必須以允許的前綴開始: {', '.join(self.allowed_prefixes)}",
            )

        # 檢查是否包含危險關鍵字
        for keyword in self.dangerous_keywords:
            if keyword.lower() in command:
                return False, f"指令包含危險關鍵字: {keyword}"

        # 檢查是否包含特殊字符（防止指令注入）
        dangerous_chars = [";", "|", "&", "`", "$", "(", ")"]
        for char in dangerous_chars:
            if char in command:
                return False, f"指令包含危險字符: {char}"

        return True, "指令安全驗證通過"

    def reload_config(self):
        """重載安全配置，使用預設配置"""
        try:
            # 直接使用全域 settings 實例
            security_config = settings.get_security_config()
            command_config = security_config.get("command_validation", {})

            self.allowed_prefixes = command_config.get(
                "allowed_command_prefixes", self.DEFAULT_ALLOWED_PREFIXES
            )
            self.dangerous_keywords = command_config.get(
                "dangerous_keywords", self.DEFAULT_DANGEROUS_KEYWORDS
            )
            logger.info("指令驗證配置已重載")
        except Exception as e:
            logger.warning(f"重載指令驗證配置失敗，使用預設配置: {e}")
            self.allowed_prefixes = self.DEFAULT_ALLOWED_PREFIXES.copy()
            self.dangerous_keywords = self.DEFAULT_DANGEROUS_KEYWORDS.copy()


# 全域驗證器實例
_command_validator = None


def get_command_validator() -> SimpleCommandValidator:
    """獲取指令驗證器實例"""
    global _command_validator
    if _command_validator is None:
        _command_validator = SimpleCommandValidator()
    return _command_validator


# 便利函數
def validate_device_ip(device_ip: str) -> bool:
    """簡單的設備 IP 驗證（向後相容）"""
    is_valid, _ = validate_ip_address(device_ip)
    return is_valid


def validate_command_safety(command: str) -> Tuple[bool, str]:
    """驗證指令安全性（向後相容）"""
    validator = get_command_validator()
    return validator.validate_command(command)


def is_safe_command(command: str) -> bool:
    """檢查指令是否安全"""
    is_safe, _ = validate_command_safety(command)
    return is_safe


__all__ = [
    "Settings",
    "settings",
    "get_settings",
    # 驗證功能
    "validate_ip_address",
    "validate_device_list",
    "SimpleCommandValidator",
    "get_command_validator",
    "validate_device_ip",
    "validate_command_safety",
    "is_safe_command",
]
