#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
網路設備通信模組

提供網路設備的 SSH 連線與指令執行：
- 異步 SSH 連線池管理
- 批次設備指令執行
- 設備認證與安全驗證
- 連線健康檢查

Created: 2025-08-23
Author: Claude Code Assistant
"""

import asyncio
import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# 異步網路相關導入
import asyncssh
from asyncssh import SSHClientConnection

import settings as settings_module
from settings import get_command_validator

logger = logging.getLogger(__name__)

# 全域設備範圍限制變量（線程本地存儲）
_local_data = threading.local()


def set_device_scope_restriction(device_ips: Optional[List[str]]):
    """限制 AI 工具的設備存取範圍"""
    _local_data.device_scope_restriction = device_ips
    if device_ips:
        logger.debug(f"設置設備範圍限制: {device_ips}")
    else:
        logger.debug("清除設備範圍限制")


def get_device_scope_restriction() -> Optional[List[str]]:
    """取得當前的設備存取範圍限制"""
    return getattr(_local_data, "device_scope_restriction", None)


def get_device_credentials(device_config=None):
    """取得設備認證資訊"""
    if device_config:
        if isinstance(device_config, dict):
            username = device_config.get("username")
            password = device_config.get("password")
            device_type = device_config.get("device_type")
            if username and password:
                return {
                    "device_type": device_type,
                    "username": username,
                    "password": password,
                }
        elif hasattr(device_config, "username") and device_config.username:
            return {
                "device_type": device_config.device_type
                or getattr(device_config, "os", None),
                "username": device_config.username,
                "password": device_config.password,
            }

    device_type = settings_module.settings.DEVICE_TYPE
    username = settings_module.settings.DEVICE_USERNAME
    password = settings_module.settings.DEVICE_PASSWORD

    if not username or not password:
        try:
            from settings import get_settings

            settings_instance = get_settings()
            devices_config = settings_instance.get_devices_config()

            available_devices = []
            for device in devices_config:
                ip = device.get("ip")
                name = device.get("name")
                if ip and name:
                    available_devices.append(f"{ip} ({name})")

            if available_devices:
                available_list = "、".join(available_devices)
                error_msg = (
                    f"設備憑證未設定！請確認：\n"
                    f"1. 設備 IP 是否在配置列表中：{available_list}\n"
                    f"2. 或設定環境變數：DEVICE_USERNAME、DEVICE_PASSWORD、DEVICE_TYPE"
                )
            else:
                error_msg = (
                    "設備憑證未設定！請設定環境變數或在 devices.json 中添加設備配置"
                )
        except Exception:
            error_msg = "設備憑證未設定！請設定環境變數或 devices.json 中的認證資訊"

        raise ValueError(error_msg)

    return {"device_type": device_type, "username": username, "password": password}


def get_device_config_by_ip(device_ip: str) -> Optional[Dict[str, Any]]:
    """根據 IP 位址查找設備配置資訊

    從 devices.json 中查找符合 IP 的設備配置。
    """
    try:
        from settings import get_settings

        settings_instance = get_settings()
        devices_config = settings_instance.get_devices_config()

        for device in devices_config:
            if device.get("ip") == device_ip:
                return device
        return None
    except Exception as e:
        logger.debug(f"查找設備配置失敗 {device_ip}: {e}")
        return None


def classify_network_error(error_message: str) -> Dict[str, Any]:
    """分類網路錯誤類型並提供解決建議"""
    error_lower = error_message.lower()

    if not error_message.startswith("錯誤："):
        return {
            "type": "success_output",
            "category": "正常輸出",
            "severity": "info",
            "description": "指令執行成功的正常輸出",
            "suggestion": "這是正常的設備回應，無需處理",
        }

    # Cisco 特定錯誤模式
    if "invalid command" in error_lower or "invalid input" in error_lower:
        return {
            "type": "invalid_command",
            "category": "指令錯誤",
            "severity": "medium",
            "description": "設備不認識的指令",
            "suggestion": "請檢查指令語法或設備支援的指令",
        }
    elif "timeout" in error_lower or "連線超時" in error_message:
        return {
            "type": "connection_timeout",
            "category": "網路連線",
            "severity": "high",
            "description": "設備連線超時",
            "suggestion": "檢查網路連線和設備狀態",
        }
    elif "authentication" in error_lower or "身分驗證失敗" in error_message:
        return {
            "type": "authentication_failed",
            "category": "認證錯誤",
            "severity": "high",
            "description": "設備認證失敗",
            "suggestion": "檢查使用者名稱和密碼",
        }

    return {
        "type": "unknown_error",
        "category": "未知錯誤",
        "severity": "medium",
        "description": "未分類的錯誤",
        "suggestion": "請檢查錯誤訊息詳情",
    }


# =============================================================================
# 執行結果資料結構
# =============================================================================


@dataclass
class SingleResult:
    """單一設備指令執行結果"""

    device_ip: str
    device_name: str = ""
    success: bool = False
    output: str = ""
    error: str = ""
    execution_time: float = 0.0
    timestamp: str = ""


@dataclass
class BatchResult:
    """批次設備執行結果"""

    results: List[SingleResult] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0


# =============================================================================
# 異步網路客戶端
# =============================================================================


class AsyncConnectionPool:
    """異步 SSH 連線池管理器

    管理多個設備的 SSH 連線復用，支援連線池大小限制、
    連線保活和自動清理功能。
    """

    def __init__(self, max_connections: int = None):
        if max_connections is None:
            max_connections = settings_module.settings.MAX_CONNECTIONS
        self.max_connections = max_connections
        self.connections: Dict[str, SSHClientConnection] = {}
        self.connection_times: Dict[str, float] = {}
        self.lock = asyncio.Lock()
        self.timeout = settings_module.settings.CONNECTION_TIMEOUT

        logger.info(
            f"AsyncConnectionPool 已初始化 - max_connections: {max_connections}"
        )

    async def get_connection(
        self, device_ip: str, device_config=None
    ) -> Optional[SSHClientConnection]:
        """獲取設備連線"""
        async with self.lock:
            current_time = time.time()

            # 檢查現有連線是否有效
            if device_ip in self.connections:
                conn = self.connections[device_ip]
                if not conn.is_closed():
                    # 更新使用時間
                    self.connection_times[device_ip] = current_time
                    logger.debug(f"重用現有連線: {device_ip}")
                    return conn
                else:
                    # 清理失效連線
                    await self._remove_connection(device_ip)

            # 檢查連線池是否已滿
            if len(self.connections) >= self.max_connections:
                await self._cleanup_oldest_connection()

            # 建立新連線
            try:
                credentials = get_device_credentials(device_config)
                conn = await asyncssh.connect(
                    device_ip,
                    username=credentials["username"],
                    password=credentials["password"],
                    connect_timeout=5,
                    login_timeout=10,
                    known_hosts=None,
                )

                # 設定 keepalive 參數以維持連線池中的連線活性
                # 每隔 60 秒發送探測封包，最多容許 5 次失敗後斷線
                conn.set_keepalive(
                    settings_module.settings.SSH_KEEPALIVE_INTERVAL,  # interval: 60 秒
                    settings_module.settings.SSH_KEEPALIVE_COUNT,  # count: 5 次失敗後斷線
                )

                self.connections[device_ip] = conn
                self.connection_times[device_ip] = current_time
                logger.info(
                    f"建立新的異步連線: {device_ip} (keepalive: {settings_module.settings.SSH_KEEPALIVE_INTERVAL}s)"
                )
                return conn

            except Exception as e:
                logger.error(f"建立連線失敗 {device_ip}: {e}")
                return None

    async def _remove_connection(self, device_ip: str):
        """移除連線"""
        if device_ip in self.connections:
            conn = self.connections[device_ip]
            try:
                if not conn.is_closed():
                    conn.close()
                    await conn.wait_closed()
            except Exception as e:
                logger.warning(f"關閉連線時發生錯誤 {device_ip}: {e}")

            del self.connections[device_ip]
            self.connection_times.pop(device_ip, None)

    async def _cleanup_oldest_connection(self):
        """清理最舊的連線"""
        if not self.connections:
            return

        oldest_ip = min(self.connection_times.items(), key=lambda x: x[1])[0]
        logger.debug(f"清理最舊連線: {oldest_ip}")
        await self._remove_connection(oldest_ip)

    async def close_all(self):
        """關閉所有連線"""
        async with self.lock:
            device_ips = list(self.connections.keys())
            for device_ip in device_ips:
                await self._remove_connection(device_ip)
            logger.info("已關閉所有異步連線")


class AsyncNetworkClient:
    """主要的異步網路設備通信客戶端

    提供高層次的設備指令執行、批次處理和健康檢查功能，
    內建連線池管理和安全性驗證。
    """

    def __init__(self):
        self.connection_pool = AsyncConnectionPool()
        self.command_validator = get_command_validator()
        logger.info("AsyncNetworkClient 已初始化")

    async def single_execute(
        self, device_ip: str, command: str, device_config=None, timeout: int = None
    ) -> SingleResult:
        """執行單一設備指令"""
        start_time = time.time()
        device_name = (
            device_config.get("name", device_ip) if device_config else device_ip
        )

        result = SingleResult(
            device_ip=device_ip,
            device_name=device_name,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
        )

        try:
            # 驗證指令安全性
            is_valid, error_msg = self.command_validator.validate_command(command)
            if not is_valid:
                result.error = f"指令驗證失敗: {error_msg}"
                return result

            # 獲取連線
            conn = await self.connection_pool.get_connection(device_ip, device_config)
            if not conn:
                result.error = "無法建立連線"
                return result

            # 執行指令
            if timeout is None:
                timeout = settings_module.settings.COMMAND_TIMEOUT

            ssh_result = await conn.run(command, timeout=timeout)

            result.success = True
            result.output = ssh_result.stdout.strip() if ssh_result.stdout else ""
            if ssh_result.stderr:
                result.error = ssh_result.stderr.strip()

        except asyncio.TimeoutError:
            result.error = "指令執行超時"
        except Exception as e:
            result.error = f"執行錯誤: {str(e)}"

        finally:
            result.execution_time = time.time() - start_time

        return result

    async def batch_execute(
        self,
        devices: List[str],
        command: str,
        device_configs: Dict[str, Any] = None,
        max_concurrent: int = None,
    ) -> BatchResult:
        """批次執行指令"""
        if max_concurrent is None:
            max_concurrent = settings_module.settings.MAX_WORKERS

        start_time = time.time()

        # 建立執行任務
        semaphore = asyncio.Semaphore(max_concurrent)

        async def execute_with_semaphore(device_ip: str):
            async with semaphore:
                device_config = (
                    device_configs.get(device_ip)
                    if device_configs
                    else get_device_config_by_ip(device_ip)
                )
                return await self.single_execute(device_ip, command, device_config)

        # 並行執行
        tasks = [execute_with_semaphore(device_ip) for device_ip in devices]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 處理結果
        execution_results = []
        successful = 0
        failed = 0

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                # 處理異常
                error_result = SingleResult(
                    device_ip=devices[i],
                    error=f"批次執行異常: {str(result)}",
                    timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                )
                execution_results.append(error_result)
                failed += 1
            else:
                execution_results.append(result)
                if result.success:
                    successful += 1
                else:
                    failed += 1

        total_time = time.time() - start_time

        batch_result = BatchResult(
            results=execution_results,
            summary={
                "total": len(devices),
                "successful": successful,
                "failed": failed,
                "execution_time": total_time,
            },
            execution_time=total_time,
        )

        logger.info(
            f"異步批次執行完成 - 成功: {successful}, 失敗: {failed}, 總時間: {total_time:.2f}s"
        )
        return batch_result

    async def health_check_devices(self, device_ips: List[str]) -> Dict[str, bool]:
        """批次健康檢查設備"""
        health_results = {}

        # 使用簡單的 ping 檢查替代複雜的 SSH 檢查
        for device_ip in device_ips:
            try:
                # 查找設備配置
                device_config = get_device_config_by_ip(device_ip)
                # 健康檢查 - 嘗試建立連線
                conn = await self.connection_pool.get_connection(
                    device_ip, device_config
                )
                health_results[device_ip] = conn is not None
            except Exception as e:
                logger.debug(f"設備 {device_ip} 健康檢查失敗: {e}")
                health_results[device_ip] = False

        return health_results

    async def run_batch_command(
        self, command: str, devices: List[str], device_configs: Dict[str, Any] = None
    ) -> BatchResult:
        """向下相容的批次執行方法"""
        return await self.batch_execute(devices, command, device_configs)

    async def close(self):
        """關閉網路客戶端"""
        await self.connection_pool.close_all()
        logger.info("AsyncNetworkClient 已關閉")


# =============================================================================
# 同步網路客戶端（用於 AI 工具）
# =============================================================================


def batch_command_wrapper(input_str: str) -> str:
    """批次指令執行包裝函式（用於 AI 工具）

    將同步執行轉換為異步執行

    Args:
        input_str: 輸入格式 "device_ips: command" 或 "command"

    Returns:
        格式化的執行結果
    """
    try:
        if ":" in input_str:
            device_part, command = input_str.split(":", 1)
            device_ips = [ip.strip() for ip in device_part.split(",")]
            command = command.strip()
        else:
            device_ips = None
            command = input_str.strip()

        # 檢查設備範圍限制
        scope_restriction = get_device_scope_restriction()
        if scope_restriction:
            logger.info(f"設備範圍限制生效：{scope_restriction}")
            if device_ips is None:
                device_ips = scope_restriction
            else:
                invalid_devices = [
                    ip for ip in device_ips if ip not in scope_restriction
                ]
                if invalid_devices:
                    error_msg = f"指令嘗試在限制範圍外的設備執行: {invalid_devices}"
                    logger.warning(f"安全違規：{error_msg}")
                    return f"錯誤：{error_msg}"

        # 如果沒有指定設備，從配置中獲取所有設備
        if device_ips is None:
            try:
                from settings import get_settings

                settings_instance = get_settings()
                devices_config = settings_instance.get_devices_config()
                device_ips = [
                    device.get("ip") for device in devices_config if device.get("ip")
                ]

            except Exception as e:
                return f"錯誤：無法載入設備配置 - {str(e)}"

        # 使用異步客戶端執行（在同步上下文中運行異步代碼）
        try:
            # 獲取或創建事件循環
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            # 執行異步批次指令
            result = loop.run_until_complete(
                async_network_client.batch_execute(device_ips, command)
            )

            # 格式化結果為 AI 可讀格式
            return _format_batch_result_for_ai(result)

        except Exception as e:
            logger.error(f"批次指令執行失敗: {e}")
            return f"錯誤：批次指令執行失敗 - {str(e)}"

    except Exception as e:
        logger.error(f"批次指令包裝函式失敗: {e}")
        return f"錯誤：批次指令包裝失敗 - {str(e)}"


def _format_batch_result_for_ai(result: BatchResult) -> str:
    """格式化批次執行結果為 AI 可讀的 JSON 格式"""
    successful_results = []
    failed_results = []

    for exec_result in result.results:
        if exec_result.success:
            successful_results.append(
                {
                    "device_ip": exec_result.device_ip,
                    "device_name": exec_result.device_name,
                    "output": exec_result.output,
                }
            )
        else:
            failed_results.append(
                {
                    "device_ip": exec_result.device_ip,
                    "device_name": exec_result.device_name,
                    "error_message": exec_result.error,
                    "error_details": classify_network_error(exec_result.error),
                }
            )

    formatted_result = {
        "summary": {
            "total_devices": result.summary["total"],
            "successful_devices": result.summary["successful"],
            "failed_devices": result.summary["failed"],
            "execution_time_seconds": result.summary["execution_time"],
            "cache_stats": {"hits": 0, "misses": 0},
        },
        "successful_results": successful_results,
        "failed_results": failed_results,
    }

    return json.dumps(formatted_result, ensure_ascii=False, indent=2)


# =============================================================================
# 全域實例和便利函數
# =============================================================================

# 主要的異步網路客戶端實例
async_network_client = AsyncNetworkClient()


# 異步便利函數
async def async_single_execute(
    device_ip: str, command: str, device_config=None
) -> SingleResult:
    """執行單一設備指令（異步便利函數）"""
    return await async_network_client.single_execute(device_ip, command, device_config)


async def async_batch_execute(
    devices: List[str], command: str, device_configs: Dict[str, Any] = None
) -> BatchResult:
    """批次執行指令（異步便利函數）"""
    return await async_network_client.batch_execute(devices, command, device_configs)
