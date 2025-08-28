# -*- coding: utf-8 -*-
"""
系統配置管理模組

提供集中化的應用程式配置和環境變數管理：
- AI 服務配置（Gemini 和 Claude 金鑰）
- 網路連線參數和設備認證
- 日誌系統和除錯設定
- 設備和群組配置載入
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
    主要配置管理類別

    使用 Pydantic BaseSettings 提供簡單且安全的配置管理：
    - 自動環境變數載入和驗證
    - 型別安全的配置屬性
    - JSON 和 YAML 配置檔案支援
    - 配置快取和依賴注入
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
        default="gemini-1.5-pro-latest", description="Gemini 模型版本"
    )
    CLAUDE_MODEL: str = Field(
        default="claude-3-haiku-20240307", description="Claude 模型版本"
    )
    PARSER_VERSION: str = Field(default="original", description="解析器版本")
    PROMPT_LANGUAGE: str = Field(default="zh_TW", description="提示詞語言")
    PROMPT_TEMPLATE_DIR: Optional[str] = Field(
        default="/app/WEB_APP/backend/prompts", description="提示詞模板目錄路徑"
    )
    
    # 長上下文相關配置
    GEMINI_ENABLE_LONG_CONTEXT: bool = Field(
        default=True, description="啟用 Gemini 長上下文功能"
    )
    GEMINI_CONTEXT_WINDOW: int = Field(
        default=2000000, description="Gemini 上下文窗口大小 (tokens)"
    )
    GEMINI_LONG_CONTEXT_THRESHOLD: int = Field(
        default=50000, description="觸發長上下文處理的文本長度門檻"
    )

    # =========================================================================
    # 網路連線配置
    # =========================================================================

    MAX_CONNECTIONS: int = Field(default=5, description="最大 SSH 連線數")
    CONNECTION_TIMEOUT: int = Field(default=300, description="連線逾時時間 (秒)")
    COMMAND_TIMEOUT: int = Field(default=20, description="指令執行逾時時間 (秒)")
    SSH_KEEPALIVE_INTERVAL: int = Field(default=60, description="SSH keepalive 間隔 (秒)")
    SSH_KEEPALIVE_COUNT: int = Field(default=5, description="SSH keepalive 最大失敗次數")
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
    # 移除 DEVICE_OUTPUT_MAX_LENGTH - AI 直接處理完整輸出
    ADMIN_API_KEY: Optional[str] = Field(default="Cisc0123", description="管理員 API 金鑰")

    # =========================================================================
    # Nornir 配置（向下相容）
    # =========================================================================

    NORNIR_WORKERS: int = Field(default=5, description="Nornir 工作執行緒數")

    # =========================================================================
    # 配置驗證和工具方法
    # =========================================================================

    def is_ai_configured(self) -> bool:
        """檢查 AI 服務是否已配置

        返回 True 如果 Gemini 或 Claude 中至少一個已設定 API 金鑰。
        """
        return bool(self.GEMINI_API_KEY or self.CLAUDE_API_KEY)

    def get_gemini_configured(self) -> bool:
        """檢查 Google Gemini AI 的配置狀態"""
        return bool(self.GEMINI_API_KEY)

    def get_claude_configured(self) -> bool:
        """檢查 Anthropic Claude AI 的配置狀態"""
        return bool(self.CLAUDE_API_KEY)

    def get_active_ai_provider(self) -> Optional[str]:
        """獲取當前有效的 AI 服務提供者

        根據 AI_PROVIDER 設定和對應 API 金鑰的可用性回傳。
        """
        if self.AI_PROVIDER == "claude" and self.CLAUDE_API_KEY:
            return "claude"
        elif self.AI_PROVIDER == "gemini" and self.GEMINI_API_KEY:
            return "gemini"
        return None

    # =========================================================================
    # 設備配置管理
    # =========================================================================

    _devices_config: Optional[List[Dict[str, Any]]] = None
    _groups_config: Optional[Dict[str, Any]] = None
    _security_config: Optional[Dict[str, Any]] = None

    @property
    def config_dir(self) -> Path:
        """配置目錄路徑"""
        return Path(__file__).parent / "config"

    def get_devices_config(self) -> List[Dict[str, Any]]:
        """載入網路設備配置清單

        從 devices.json 讀取設備資訊，包含 IP、名稱和認證資訊。
        """
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
        """載入設備群組配置資訊

        從 groups.json 讀取設備群組設定，支援群組化管理。
        """
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
        """載入安全政策和驗證配置

        從 security.json 讀取安全設定，用於指令驗證。
        """
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
        """根據 IP 位址查找設備配置

        返回符合 IP 的設備配置資訊，如果找不到則返回 None。
        """
        devices = self.get_devices_config()
        for device in devices:
            if device.get("ip") == ip:
                return device
        return None

    def get_all_device_ips(self) -> List[str]:
        """獲取系統中所有設備的 IP 位址清單

        返回所有已配置設備的 IP 位址列表。
        """
        devices = self.get_devices_config()
        return [d.get("ip") for d in devices if d.get("ip")]

    def refresh_config(self):
        """刷新所有配置檔案的快取

        清除所有內存快取，強制重新讀取配置檔案。
        """
        self._devices_config = None
        self._groups_config = None
        self._security_config = None
        
    # 移除 get_dynamic_output_max_length 函式 - 不再需要動態截斷


# 全域實例
settings = Settings()


def get_settings() -> Settings:
    """獲取全域配置管理實例

    提供單例模式的配置存取，確保在應用程式中
    的配置一致性。
    """
    return settings


# =============================================================================
# 驗證功能 (原 validators.py)
# =============================================================================


def validate_ip_address(ip_str: str) -> Tuple[bool, str]:
    """驗證 IP 位址格式的正確性

    支援 IPv4 和 IPv6 格式驗證，返回驗證結果和描述。
    """
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
    """驗證設備 IP 位址清單的有效性

    檢查清單中每個 IP 位址的格式，返回驗證結果、
    訊息和有效的 IP 清單。
    """
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
    """網路設備指令安全性驗證器

    防止危險指令的執行，只允許安全的唯讀指令。
    """

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
        """初始化安全驗證器

        設定允許的指令前綴和危險關鍵字清單。
        """
        self.allowed_prefixes = self.DEFAULT_ALLOWED_PREFIXES.copy()
        self.dangerous_keywords = self.DEFAULT_DANGEROUS_KEYWORDS.copy()

    def validate_command(self, command: str) -> Tuple[bool, str]:
        """檢查指令的安全性

        驗證指令前綴、檢查危險關鍵字和特殊字元，
        返回驗證結果和詳細訊息。
        """
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
        """重新讀取安全政策配置

        從 security.json 更新允許的指令和危險關鍵字，
        如果失敗則使用預設安全設定。
        """
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
    """獲取安全指令驗證器實例

    單例模式的驗證器，確保一致的安全政策。
    """
    global _command_validator
    if _command_validator is None:
        _command_validator = SimpleCommandValidator()
    return _command_validator


# 便利函數
def validate_device_ip(device_ip: str) -> bool:
    """快速驗證設備 IP 位址格式

    回傳 IP 位址驗證的布爾值結果。
    """
    is_valid, _ = validate_ip_address(device_ip)
    return is_valid


def validate_command_safety(command: str) -> Tuple[bool, str]:
    """驗證指令安全性的便捷函數

    使用全域驗證器驗證指令，返回結果和訊息。
    """
    validator = get_command_validator()
    return validator.validate_command(command)


def is_safe_command(command: str) -> bool:
    """檢查指令是否通過安全檢查

    回傳指令安全檢查的布爾值結果。
    """
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
