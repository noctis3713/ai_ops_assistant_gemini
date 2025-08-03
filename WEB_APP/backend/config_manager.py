#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理模組 - 統一管理設備和群組配置
提供設備配置載入、驗證、查詢和群組管理功能
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

logger = logging.getLogger(__name__)


class ConfigManager:
    """配置管理器 - 統一管理設備和群組配置檔案"""

    def __init__(self, config_dir: str = None):
        """初始化配置管理器

        Args:
            config_dir: 配置檔案目錄路徑，預設為當前檔案目錄下的 config 資料夾
        """
        if config_dir is None:
            config_dir = str(Path(__file__).parent / "config")

        self.config_dir = Path(config_dir)
        self._devices_config = None
        self._groups_config = None
        self._security_config = None

        # 確保配置目錄存在
        self.config_dir.mkdir(exist_ok=True)

    def load_devices_config(self) -> Dict[str, Any]:
        """載入設備配置檔案

        Returns:
            設備配置字典

        Raises:
            HTTPException: 當配置檔案不存在或格式錯誤時
        """
        config_path = self.config_dir / "devices.json"

        try:
            if not config_path.exists():
                logger.error(f"設備配置檔案不存在: {config_path}")
                raise HTTPException(
                    status_code=500, detail=f"設備配置檔案不存在: {config_path}"
                )

            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)

            # 驗證配置檔案結構
            self._validate_devices_config(config_data)

            # 快取配置資料
            self._devices_config = config_data

            logger.info(
                f"成功載入設備配置檔案，包含 {len(config_data['devices'])} 台設備"
            )
            return config_data

        except HTTPException:
            raise
        except json.JSONDecodeError as e:
            logger.error(f"設備配置檔案JSON格式錯誤: {e}")
            raise HTTPException(
                status_code=500, detail=f"設備配置檔案JSON格式錯誤: {str(e)}"
            )
        except PermissionError:
            logger.error(f"沒有權限讀取設備配置檔案: {config_path}")
            raise HTTPException(status_code=500, detail="沒有權限讀取設備配置檔案")
        except Exception as e:
            logger.error(f"讀取設備配置檔案時發生未知錯誤: {e}")
            raise HTTPException(
                status_code=500, detail=f"讀取設備配置檔案失敗: {str(e)}"
            )

    def _validate_devices_config(self, config_data: Dict[str, Any]):
        """驗證設備配置檔案結構

        Args:
            config_data: 配置資料字典

        Raises:
            HTTPException: 當配置格式不正確時
        """
        if not isinstance(config_data, dict):
            logger.error("設備配置檔案必須是JSON物件格式")
            raise HTTPException(
                status_code=500, detail="設備配置檔案格式錯誤：必須是JSON物件"
            )

        if "devices" not in config_data:
            logger.error("設備配置檔案缺少 'devices' 欄位")
            raise HTTPException(
                status_code=500, detail="設備配置檔案格式錯誤：缺少 'devices' 欄位"
            )

        if not isinstance(config_data["devices"], list):
            logger.error("設備配置檔案 'devices' 欄位必須是陣列")
            raise HTTPException(
                status_code=500, detail="設備配置檔案格式錯誤：'devices' 欄位必須是陣列"
            )

        # 驗證每個設備的必要欄位
        required_fields = ["ip", "name", "model", "description"]
        for i, device in enumerate(config_data["devices"]):
            if not isinstance(device, dict):
                logger.error(f"設備配置檔案第 {i+1} 個設備必須是物件格式")
                raise HTTPException(
                    status_code=500,
                    detail=f"設備配置檔案格式錯誤：第 {i+1} 個設備必須是物件",
                )

            for field in required_fields:
                if field not in device:
                    logger.error(f"設備配置檔案第 {i+1} 個設備缺少必要欄位: {field}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"設備配置檔案格式錯誤：第 {i+1} 個設備缺少欄位 '{field}'",
                    )

    def load_groups_config(self) -> Dict[str, Any]:
        """載入群組配置檔案

        Returns:
            群組配置字典

        Raises:
            HTTPException: 當配置檔案格式錯誤時
        """
        config_path = self.config_dir / "groups.json"

        try:
            if not config_path.exists():
                logger.warning(f"群組配置檔案不存在: {config_path}，回傳空群組列表")
                return {"groups": []}

            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)

            # 驗證配置檔案結構
            self._validate_groups_config(config_data)

            # 快取配置資料
            self._groups_config = config_data

            logger.info(
                f"成功載入群組配置檔案，包含 {len(config_data['groups'])} 個群組"
            )
            return config_data

        except HTTPException:
            raise
        except json.JSONDecodeError as e:
            logger.error(f"群組配置檔案JSON格式錯誤: {e}")
            raise HTTPException(
                status_code=500, detail=f"群組配置檔案JSON格式錯誤: {str(e)}"
            )
        except PermissionError:
            logger.error(f"沒有權限讀取群組配置檔案: {config_path}")
            raise HTTPException(status_code=500, detail="沒有權限讀取群組配置檔案")
        except Exception as e:
            logger.error(f"讀取群組配置檔案時發生未知錯誤: {e}")
            raise HTTPException(
                status_code=500, detail=f"讀取群組配置檔案失敗: {str(e)}"
            )

    def _validate_groups_config(self, config_data: Dict[str, Any]):
        """驗證群組配置檔案結構

        Args:
            config_data: 配置資料字典

        Raises:
            HTTPException: 當配置格式不正確時
        """
        if not isinstance(config_data, dict):
            logger.error("群組配置檔案必須是JSON物件格式")
            raise HTTPException(
                status_code=500, detail="群組配置檔案格式錯誤：必須是JSON物件"
            )

        if "groups" not in config_data:
            logger.warning("群組配置檔案缺少 'groups' 欄位，回傳空群組列表")
            return

        if not isinstance(config_data["groups"], list):
            logger.error("群組配置檔案 'groups' 欄位必須是陣列")
            raise HTTPException(
                status_code=500, detail="群組配置檔案格式錯誤：'groups' 欄位必須是陣列"
            )

        # 驗證每個群組的必要欄位
        required_fields = ["name", "description"]
        for i, group in enumerate(config_data["groups"]):
            if not isinstance(group, dict):
                logger.error(f"群組配置檔案第 {i+1} 個群組必須是物件格式")
                raise HTTPException(
                    status_code=500,
                    detail=f"群組配置檔案格式錯誤：第 {i+1} 個群組必須是物件",
                )

            for field in required_fields:
                if field not in group:
                    logger.error(f"群組配置檔案第 {i+1} 個群組缺少必要欄位: {field}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"群組配置檔案格式錯誤：第 {i+1} 個群組缺少欄位 '{field}'",
                    )

    def get_device_by_ip(self, device_ip: str) -> Optional[Dict[str, Any]]:
        """根據 IP 位址取得設備配置

        Args:
            device_ip: 設備 IP 位址

        Returns:
            設備配置字典或 None
        """
        try:
            # 如果沒有快取，先載入配置
            if self._devices_config is None:
                config = self.load_devices_config()
            else:
                config = self._devices_config

            for device in config.get("devices", []):
                if device["ip"] == device_ip:
                    logger.debug(
                        f"找到設備配置: {device_ip} -> {device.get('name', 'Unknown')}"
                    )
                    return device

            logger.warning(f"設備 {device_ip} 不在配置列表中")
            return None

        except Exception as e:
            logger.error(f"獲取設備配置失敗: {device_ip} -> {e}")
            return None

    def get_all_device_ips(self) -> List[str]:
        """取得所有設備的 IP 位址清單

        Returns:
            設備 IP 位址清單
        """
        try:
            # 如果沒有快取，先載入配置
            if self._devices_config is None:
                config = self.load_devices_config()
            else:
                config = self._devices_config

            return [device["ip"] for device in config.get("devices", [])]
        except Exception as e:
            logger.error(f"獲取設備IP清單失敗: {e}")
            return []

    def validate_device_ips(self, device_ips: List[str]) -> Tuple[List[str], List[str]]:
        """驗證設備 IP 位址清單

        Args:
            device_ips: 要驗證的設備 IP 位址清單

        Returns:
            (有效的設備IP清單, 無效的設備IP清單)
        """
        try:
            # 如果沒有快取，先載入配置
            if self._devices_config is None:
                config = self.load_devices_config()
            else:
                config = self._devices_config

            valid_ips = [device["ip"] for device in config.get("devices", [])]

            valid_devices = [ip for ip in device_ips if ip in valid_ips]
            invalid_devices = [ip for ip in device_ips if ip not in valid_ips]

            return valid_devices, invalid_devices

        except Exception as e:
            logger.error(f"驗證設備IP清單失敗: {e}")
            return [], device_ips

    def get_device_info_by_ip(self, device_ip: str) -> Optional[Dict[str, str]]:
        """取得設備的基本資訊（僅包含必要欄位）

        Args:
            device_ip: 設備 IP 位址

        Returns:
            包含基本資訊的字典或 None
        """
        device_config = self.get_device_by_ip(device_ip)
        if device_config:
            return {
                "ip": device_config["ip"],
                "name": device_config["name"],
                "model": device_config["model"],
                "description": device_config["description"],
            }
        return None

    def get_device_name_safe(
        self, device_config: Optional[Dict[str, Any]], device_ip: str
    ) -> str:
        """安全的設備名稱獲取函數

        Args:
            device_config: 設備配置字典（可能為 None）
            device_ip: 設備 IP 位址（用於回退命名）

        Returns:
            設備名稱（設備配置中的名稱或回退命名）
        """
        if device_config and isinstance(device_config, dict):
            device_name = device_config.get("name")
            if device_name:
                logger.debug(f"使用配置中的設備名稱: {device_ip} -> {device_name}")
                return device_name

        # 回退命名
        fallback_name = f"Device-{device_ip.split('.')[-1]}"
        logger.warning(f"使用回退設備名稱: {device_ip} -> {fallback_name}")
        return fallback_name

    def load_security_config(self) -> Dict[str, Any]:
        """載入安全配置檔案

        Returns:
            安全配置字典

        Raises:
            HTTPException: 當配置檔案格式錯誤時
        """
        config_path = self.config_dir / "security.json"

        try:
            if not config_path.exists():
                logger.warning(f"安全配置檔案不存在: {config_path}，使用預設安全配置")
                return self._get_default_security_config()

            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)

            # 驗證配置檔案結構
            self._validate_security_config(config_data)

            # 快取配置資料
            self._security_config = config_data

            logger.info("成功載入安全配置檔案")
            return config_data

        except HTTPException:
            raise
        except json.JSONDecodeError as e:
            logger.error(f"安全配置檔案JSON格式錯誤: {e}")
            raise HTTPException(
                status_code=500, detail=f"安全配置檔案JSON格式錯誤: {str(e)}"
            )
        except PermissionError:
            logger.error(f"沒有權限讀取安全配置檔案: {config_path}")
            raise HTTPException(status_code=500, detail="沒有權限讀取安全配置檔案")
        except Exception as e:
            logger.error(f"讀取安全配置檔案時發生未知錯誤: {e}")
            raise HTTPException(
                status_code=500, detail=f"讀取安全配置檔案失敗: {str(e)}"
            )

    def _validate_security_config(self, config_data: Dict[str, Any]):
        """驗證安全配置檔案結構

        Args:
            config_data: 配置資料字典

        Raises:
            HTTPException: 當配置格式不正確時
        """
        if not isinstance(config_data, dict):
            logger.error("安全配置檔案必須是JSON物件格式")
            raise HTTPException(
                status_code=500, detail="安全配置檔案格式錯誤：必須是JSON物件"
            )

        if "command_validation" not in config_data:
            logger.error("安全配置檔案缺少 'command_validation' 欄位")
            raise HTTPException(
                status_code=500,
                detail="安全配置檔案格式錯誤：缺少 'command_validation' 欄位",
            )

        cmd_validation = config_data["command_validation"]
        required_fields = ["allowed_command_prefixes", "dangerous_keywords"]

        for field in required_fields:
            if field not in cmd_validation:
                logger.error(f"安全配置檔案 command_validation 缺少必要欄位: {field}")
                raise HTTPException(
                    status_code=500,
                    detail=f"安全配置檔案格式錯誤：command_validation 缺少欄位 '{field}'",
                )

            if not isinstance(cmd_validation[field], list):
                logger.error(f"安全配置檔案 command_validation.{field} 必須是陣列")
                raise HTTPException(
                    status_code=500,
                    detail=f"安全配置檔案格式錯誤：command_validation.{field} 必須是陣列",
                )

    def _get_default_security_config(self) -> Dict[str, Any]:
        """取得預設安全配置（當配置檔案不存在時使用）"""
        return {
            "version": "1.0.0",
            "command_validation": {
                "allowed_command_prefixes": ["show", "ping", "traceroute"],
                "dangerous_keywords": ["configure", "write", "delete", "shutdown"],
                "max_command_length": 200,
                "enable_strict_validation": True,
            },
            "audit": {
                "log_all_validations": True,
                "log_blocked_commands": True,
                "alert_on_security_violations": True,
            },
        }

    def get_security_config(self) -> Dict[str, Any]:
        """取得安全配置（使用快取機制）

        Returns:
            安全配置字典
        """
        if self._security_config is None:
            return self.load_security_config()
        return self._security_config

    def refresh_config(self):
        """重新載入所有配置檔案"""
        logger.info("重新載入配置檔案")
        self._devices_config = None
        self._groups_config = None
        self._security_config = None
        self.load_devices_config()
        self.load_groups_config()
        self.load_security_config()


# 全域配置管理器實例
_config_manager = None


def get_config_manager() -> ConfigManager:
    """取得全域配置管理器實例

    Returns:
        ConfigManager: 配置管理器實例
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager
