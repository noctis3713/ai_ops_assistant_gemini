#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nornir 網路自動化整合模組
提供多設備批次操作功能，包括設備群組管理、並行指令執行和結果聚合
"""

import os
import json
import logging
import time
import threading
from typing import Dict, List, Optional, Union, Any
from pathlib import Path
from dataclasses import dataclass

from nornir import InitNornir
from nornir.core import Nornir
from nornir.core.task import Task, Result
from nornir.core.filter import F
from nornir.core.inventory import Inventory, Host, Group
from nornir.core.configuration import Config
from nornir.plugins.runners import ThreadedRunner
from nornir_netmiko.tasks import netmiko_send_command
from nornir_utils.plugins.functions import print_result

from .network_tools import (
    CommandValidator, 
    get_device_credentials, 
    run_readonly_show_command,
    connection_pool,
    command_cache
)

logger = logging.getLogger(__name__)

# 全局設備範圍限制變量（使用線程本地存儲確保線程安全）
_local_data = threading.local()

def set_device_scope_restriction(device_ips: Optional[List[str]]):
    """設置當前線程的設備範圍限制
    
    Args:
        device_ips: 允許的設備 IP 列表，None 表示無限制
    """
    _local_data.device_scope_restriction = device_ips
    if device_ips:
        logger.debug(f"設置設備範圍限制: {device_ips}")
    else:
        logger.debug("清除設備範圍限制")

def get_device_scope_restriction() -> Optional[List[str]]:
    """獲取當前線程的設備範圍限制
    
    Returns:
        允許的設備 IP 列表，None 表示無限制
    """
    return getattr(_local_data, 'device_scope_restriction', None)

def get_network_logger():
    """取得網路操作專用日誌記錄器"""
    from utils import create_network_logger
    return create_network_logger()

network_logger = get_network_logger()

def classify_error(error_message: str) -> Dict[str, Any]:
    """錯誤分類 - 精確區分真正的錯誤和正常回應"""
    error_lower = error_message.lower()
    
    # 首先檢查是否真的是錯誤訊息（以 "錯誤：" 開頭）
    if not error_message.startswith("錯誤："):
        # 這可能是正常的指令輸出，不應該被分類為錯誤
        return {
            "type": "success_output",
            "category": "正常輸出",
            "severity": "info",
            "description": "指令執行成功的正常輸出",
            "suggestion": "這是正常的設備回應，無需處理"
        }
    
    # Cisco 特定錯誤模式
    if "invalid command" in error_lower or "invalid input" in error_lower:
        return {
            "type": "invalid_command",
            "category": "指令錯誤",
            "severity": "medium",
            "description": "設備不認識的指令",
            "suggestion": "請檢查指令語法或設備支援的指令"
        }
    elif "incomplete command" in error_lower:
        return {
            "type": "incomplete_command",
            "category": "指令錯誤",
            "severity": "medium",
            "description": "指令語法不完整",
            "suggestion": "請提供完整的指令語法"
        }
    elif "ambiguous command" in error_lower:
        return {
            "type": "ambiguous_command",
            "category": "指令錯誤",
            "severity": "medium",
            "description": "指令語法模糊",
            "suggestion": "請提供更完整的指令以避免歧義"
        }
    
    # 網路連線相關錯誤
    if "timeout" in error_lower or "連線超時" in error_message:
        return {
            "type": "connection_timeout",
            "category": "網路連線",
            "severity": "high",
            "description": "設備連線超時",
            "suggestion": "檢查網路連線和設備狀態"
        }
    elif "authentication" in error_lower or "身分驗證失敗" in error_message:
        return {
            "type": "authentication_failed",
            "category": "認證錯誤",
            "severity": "high",
            "description": "設備認證失敗",
            "suggestion": "檢查使用者名稱和密碼"
        }
    elif "connection refused" in error_lower or "連線拒絕" in error_message:
        return {
            "type": "connection_refused",
            "category": "網路連線",
            "severity": "high",
            "description": "設備拒絕連線",
            "suggestion": "檢查設備IP和SSH服務狀態"
        }
    elif "host unreachable" in error_lower or "網路無法到達" in error_message:
        return {
            "type": "host_unreachable",
            "category": "網路連線",
            "severity": "high",
            "description": "無法到達目標設備",
            "suggestion": "檢查網路路由和設備IP位址"
        }
    
    # 安全相關錯誤
    elif "安全限制" in error_message or "不安全指令" in error_message or "安全警告" in error_message:
        return {
            "type": "security_violation",
            "category": "安全限制",
            "severity": "medium",
            "description": "指令安全性檢查失敗",
            "suggestion": "請使用允許的唯讀指令"
        }
    elif "permission denied" in error_lower or "權限不足" in error_message:
        return {
            "type": "permission_denied",
            "category": "權限錯誤",
            "severity": "medium",
            "description": "權限不足無法執行指令",
            "suggestion": "請檢查使用者權限或使用其他指令"
        }
    
    # 設備資源相關錯誤
    elif "resource busy" in error_lower or "資源忙碌" in error_message:
        return {
            "type": "resource_busy",
            "category": "設備資源",
            "severity": "medium",
            "description": "設備資源忙碌",
            "suggestion": "請稍後重試或檢查設備負載"
        }
    elif "memory" in error_lower and ("insufficient" in error_lower or "不足" in error_message):
        return {
            "type": "memory_insufficient",
            "category": "設備資源",
            "severity": "high",
            "description": "設備記憶體不足",
            "suggestion": "檢查設備記憶體使用狀況"
        }
    
    # 預設未知錯誤
    else:
        return {
            "type": "unknown_error",
            "category": "未知錯誤",
            "severity": "medium",
            "description": "未分類的錯誤",
            "suggestion": "檢查錯誤詳情並聯繫管理員"
        }

def unified_network_command_task(task: Task, command: str) -> Result:
    """統一設備指令執行任務 - 支援連線池、快取和多層回退機制"""
    device_ip = task.host.hostname
    device_config = task.host.data.get("device_config")
    
    try:
        # 檢查快取
        cacheable_commands = ["version", "inventory", "logging"]
        if any(keyword in command.lower() for keyword in cacheable_commands):
            cached_result = command_cache.get(device_ip, command)
            if cached_result:
                logger.info(f"從快取返回: {device_ip} -> {command}")
                network_logger.info(f"從快取返回: {device_ip} -> {command}")
                return Result(host=task.host, result=cached_result, failed=False)
        
        # 執行指令
        result = run_readonly_show_command(
            device_ip=device_ip,
            command=command,
            device_config=type('DeviceConfig', (), device_config)() if device_config else None
        )
        
        # 檢查錯誤並重試
        if result.startswith("錯誤："):
            if any(keyword in result.lower() for keyword in ["timeout", "connection", "連線"]):
                logger.warning(f"連線錯誤，重試: {device_ip}")
                connection_pool._remove_connection(device_ip)
                
                retry_result = run_readonly_show_command(
                    device_ip=device_ip,
                    command=command,
                    device_config=type('DeviceConfig', (), device_config)() if device_config else None
                )
                
                if not retry_result.startswith("錯誤："):
                    logger.info(f"重試成功: {device_ip}")
                    return Result(host=task.host, result=retry_result, failed=False)
                else:
                    logger.error(f"重試失敗: {device_ip}")
            
            return Result(host=task.host, result=result, failed=True, exception=Exception(result))
        
        return Result(host=task.host, result=result, failed=False)
        
    except Exception as e:
        logger.error(f"執行異常: {device_ip} - {e}")
        
        # 清理資源
        try:
            connection_pool._remove_connection(device_ip)
            from .network_tools import clear_cache_for_device
            clear_cache_for_device(device_ip)
        except:
            pass
        
        return Result(
            host=task.host,
            result=f"錯誤：執行異常 - {str(e)}",
            failed=True,
            exception=e
        )

@dataclass
class BatchResult:
    """批次執行結果"""
    command: str
    total_devices: int
    successful_devices: int
    failed_devices: int
    results: Dict[str, Any]
    execution_time: float
    errors: Dict[str, str]
    error_details: Dict[str, Dict[str, Any]]  # 詳細錯誤分類
    cache_hits: int = 0  # 快取命中次數
    cache_misses: int = 0  # 快取未命中次數
    
    def to_api_response(self) -> Dict[str, Any]:
        """
        將 BatchResult 轉換為標準 API 回應格式
        
        使用外部 formatters.py 模組來處理格式化邏輯，保持代碼組織的清晰性
        
        Returns:
            標準化的 API 回應字典
        """
        # 動態導入避免循環依賴
        from formatters import format_command_results
        return format_command_results(self)

class NornirManager:
    """Nornir 網路自動化管理器
    
    負責初始化 Nornir、管理設備清單、執行批次操作和聚合結果。
    """
    
    def __init__(self, config_dir: str = None):
        """初始化 Nornir 管理器
        
        Args:
            config_dir: 配置檔案目錄路徑
        """
        if config_dir is None:
            config_dir = str(Path(__file__).parent.parent / "config")
        
        self.config_dir = Path(config_dir)
        self.nr = None
        self.devices_config = None
        self.groups_config = None
        
        self._load_configurations()
        self._initialize_nornir()
    
    def _load_configurations(self):
        """載入設備和群組配置"""
        # 載入設備配置
        devices_file = self.config_dir / "devices.json"
        if devices_file.exists():
            with open(devices_file, 'r', encoding='utf-8') as f:
                self.devices_config = json.load(f)
        else:
            raise FileNotFoundError(f"設備配置檔案不存在: {devices_file}")
        
        # 載入群組配置
        groups_file = self.config_dir / "groups.json"
        if groups_file.exists():
            with open(groups_file, 'r', encoding='utf-8') as f:
                self.groups_config = json.load(f)
        else:
            logger.warning(f"群組配置檔案不存在: {groups_file}，將使用預設群組")
            self.groups_config = {"groups": []}
    
    def _initialize_nornir(self):
        """初始化 Nornir 實例 - 使用記憶體字典，避免檔案 I/O 操作"""
        try:
            # 建構配置字典（完全在記憶體中進行）
            hosts_data = self._build_hosts_data()
            groups_data = self._build_groups_data()
            defaults_data = self._build_defaults_data()
            
            # 建構 Inventory 物件 - 直接在記憶體中建立，無需檔案系統操作
            inventory = self._build_inventory_from_dict(hosts_data, groups_data, defaults_data)
            
            # 建構 Nornir 配置
            config = Config(
                runner={
                    "plugin": "threaded",
                    "options": {
                        "num_workers": int(os.getenv("NORNIR_WORKERS", "5"))
                    }
                },
                logging={
                    "enabled": True,
                    "level": "INFO",
                    "log_file": str(Path(__file__).parent.parent / "logs" / "network.log")
                },
                inventory={"plugin": "simple"}  # 占位符，不會被使用
            )
            
            # 初始化 Nornir - 直接使用 Inventory 物件，績過 InitNornir 函數
            self.nr = Nornir(
                inventory=inventory,
                config=config,
                runner=ThreadedRunner(num_workers=int(os.getenv("NORNIR_WORKERS", "5")))
            )
            logger.info(f"Nornir 初始化成功，載入 {len(self.nr.inventory.hosts)} 台設備（使用記憶體字典，無檔案 I/O）")
            network_logger.info(f"Nornir 初始化成功，載入 {len(self.nr.inventory.hosts)} 台設備（使用記憶體字典，無檔案 I/O）")
            
        except Exception as e:
            logger.error(f"Nornir 初始化失敗: {e}")
            raise
    
    def _build_hosts_data(self) -> Dict[str, Any]:
        """建構主機配置字典 - 記憶體操作，替代檔案寫入
        
        Returns:
            主機配置字典
        """
        hosts_data = {}
        for device in self.devices_config.get("devices", []):
            host_config = {
                "hostname": device["ip"],
                "platform": device.get("device_type", "cisco_xe"),
                "groups": self._get_device_groups(device),
                "data": {
                    "model": device.get("model", ""),
                    "description": device.get("description", ""),
                    "device_config": device  # 保存完整設備配置供後續使用
                }
            }
            
            # 添加設備個別憑證（如果存在）
            if device.get("username"):
                host_config["username"] = device["username"]
            if device.get("password"):
                host_config["password"] = device["password"]
            
            hosts_data[device["name"]] = host_config
        
        return hosts_data
    
    def _build_groups_data(self) -> Dict[str, Any]:
        """建構群組配置字典 - 記憶體操作，替代檔案寫入
        
        Returns:
            群組配置字典
        """
        groups_data = {}
        for group in self.groups_config.get("groups", []):
            groups_data[group["name"]] = {
                "platform": group.get("platform", "cisco_xe"),
                "data": group.get("data", {})
            }
        
        return groups_data
    
    def _build_defaults_data(self) -> Dict[str, Any]:
        """建構預設配置字典 - 記憶體操作，替代檔案寫入
        
        Returns:
            預設配置字典
        """
        # 嘗試從環境變數獲取憑證，如果沒有則使用第一個設備的憑證作為預設
        default_username = os.getenv("DEVICE_USERNAME")
        default_password = os.getenv("DEVICE_PASSWORD")
        
        # 如果環境變數沒有設定，使用第一個設備的憑證作為預設
        if not default_username or not default_password:
            first_device = self.devices_config.get("devices", [{}])[0] if self.devices_config.get("devices") else {}
            default_username = default_username or first_device.get("username", "admin")
            default_password = default_password or first_device.get("password", "")
        
        defaults_data = {
            "username": default_username,
            "password": default_password,
            "platform": "cisco_xe",
            "extras": {
                "netmiko_timeout": int(os.getenv("COMMAND_TIMEOUT", "20")),
                "netmiko_banner_timeout": 15
            }
        }
        
        return defaults_data
    
    def _build_inventory_from_dict(self, hosts_data: Dict[str, Any], groups_data: Dict[str, Any], defaults_data: Dict[str, Any]) -> Inventory:
        """從字典建構 Nornir Inventory 物件 - 完全在記憶體中操作
        
        Args:
            hosts_data: 主機配置字典
            groups_data: 群組配置字典
            defaults_data: 預設配置字典
            
        Returns:
            Inventory: Nornir Inventory 物件
        """
        # 建立 Groups
        groups = {}
        for group_name, group_config in groups_data.items():
            groups[group_name] = Group(
                name=group_name,
                platform=group_config.get("platform", "cisco_xe"),
                data=group_config.get("data", {})
            )
        
        # 建立 Hosts
        hosts = {}
        for host_name, host_config in hosts_data.items():
            host_groups = []
            for group_name in host_config.get("groups", []):
                if group_name in groups:
                    host_groups.append(groups[group_name])
            
            hosts[host_name] = Host(
                name=host_name,
                hostname=host_config["hostname"],
                platform=host_config.get("platform", "cisco_xe"),
                groups=host_groups,
                data=host_config.get("data", {}),
                username=host_config.get("username"),
                password=host_config.get("password")
            )
        
        # 建立 Inventory
        inventory = Inventory(
            hosts=hosts,
            groups=groups,
            defaults=Group(
                name="defaults",
                platform=defaults_data.get("platform", "cisco_xe"),
                username=defaults_data.get("username"),
                password=defaults_data.get("password"),
                data=defaults_data.get("extras", {})
            )
        )
        
        return inventory
    
    def _get_device_groups(self, device: Dict) -> List[str]:
        """取得設備所屬的群組"""
        # 簡化群組邏輯：所有 Cisco IOS-XE 設備都屬於 cisco_xe_devices 群組
        if device.get("device_type") == "cisco_xe" or device.get("os") == "cisco_xe":
            return ["cisco_xe_devices"]
        
        return ["cisco_xe_devices"]  # 預設群組
    
    def get_device_config_by_ip(self, device_ip: str) -> Optional[Dict]:
        """根據 IP 位址獲取設備配置
        
        Args:
            device_ip: 設備 IP 位址
            
        Returns:
            設備配置字典，如果找不到則返回 None
        """
        if not self.nr:
            return None
            
        for name, host in self.nr.inventory.hosts.items():
            if host.hostname == device_ip:
                return host.data.get("device_config")
        
        return None
    
    def health_check_devices(self, device_ips: List[str] = None) -> Dict[str, bool]:
        """執行設備健康檢查
        
        Args:
            device_ips: 要檢查的設備 IP 清單，如果為 None 則檢查所有設備
            
        Returns:
            設備健康狀態字典
        """
        health_status = {}
        
        if not self.nr:
            return health_status
        
        # 篩選目標設備
        if device_ips:
            target_hosts = {name: host for name, host in self.nr.inventory.hosts.items() 
                          if host.hostname in device_ips}
        else:
            target_hosts = self.nr.inventory.hosts
        
        logger.info(f"開始健康檢查，目標設備: {len(target_hosts)} 台")
        network_logger.info(f"開始健康檢查，目標設備: {len(target_hosts)} 台")
        
        for name, host in target_hosts.items():
            device_ip = host.hostname
            device_config = host.data.get("device_config")
            
            try:
                # 使用簡單的 show clock 指令進行健康檢查
                result = run_readonly_show_command(
                    device_ip=device_ip,
                    command="show clock",
                    device_config=type('DeviceConfig', (), device_config)() if device_config else None
                )
                
                if result.startswith("錯誤："):
                    health_status[device_ip] = False
                    logger.warning(f"設備 {device_ip} 健康檢查失敗: {result}")
                else:
                    health_status[device_ip] = True
                    logger.debug(f"設備 {device_ip} 健康檢查通過")
                    
            except Exception as e:
                health_status[device_ip] = False
                logger.error(f"設備 {device_ip} 健康檢查異常: {e}")
        
        healthy_count = sum(1 for status in health_status.values() if status)
        total_count = len(health_status)
        logger.info(f"健康檢查完成: {healthy_count}/{total_count} 台設備正常")
        network_logger.info(f"健康檢查完成: {healthy_count}/{total_count} 台設備正常")
        
        return health_status
    
    def cleanup_failed_connections(self):
        """清理失敗的連線"""
        logger.info("開始清理失敗的連線")
        
        # 清理連線池中的過期連線
        connection_pool.cleanup_expired_connections()
        
        # 執行健康檢查並清理有問題的連線
        health_status = self.health_check_devices()
        failed_devices = [ip for ip, status in health_status.items() if not status]
        
        for device_ip in failed_devices:
            connection_pool._remove_connection(device_ip)
            try:
                from .network_tools import clear_cache_for_device
                clear_cache_for_device(device_ip)
            except:
                pass
        
        if failed_devices:
            logger.info(f"清理了 {len(failed_devices)} 台設備的失敗連線")
        else:
            logger.info("沒有找到需要清理的失敗連線")
    
    def get_available_devices(self) -> List[Dict]:
        """取得可用設備清單"""
        if not self.nr:
            return []
        
        devices = []
        for name, host in self.nr.inventory.hosts.items():
            devices.append({
                "name": name,
                "ip": host.hostname,
                "platform": host.platform,
                "groups": [group.name for group in host.groups],
                "description": host.data.get("description", "")
            })
        
        return devices
    
    def get_available_groups(self) -> List[Dict]:
        """取得可用群組清單"""
        groups = []
        
        if self.groups_config:
            for group in self.groups_config.get("groups", []):
                # 計算群組中的設備數量
                if self.nr:
                    group_hosts = self.nr.filter(F(groups__contains=group["name"]))
                    device_count = len(group_hosts.inventory.hosts)
                else:
                    device_count = 0
                
                groups.append({
                    "name": group["name"],
                    "description": group.get("description", ""),
                    "device_count": device_count,
                    "platform": group.get("platform", "cisco_xe")
                })
        
        return groups
    
    def run_batch_command(self, command: str, device_ips: List[str] = None) -> BatchResult:
        """對多台設備執行批次指令
        
        Args:
            command: 要執行的指令
            device_ips: 設備 IP 清單，如果為 None 則對所有設備執行
            
        Returns:
            BatchResult: 批次執行結果
        """
        # 驗證指令安全性
        is_safe, error_message = CommandValidator.validate_command(command)
        if not is_safe:
            logger.warning(f"拒絕執行不安全指令: {command}")
            error_details = {"security": classify_error(error_message)}
            return BatchResult(
                command=command,
                total_devices=0,
                successful_devices=0,
                failed_devices=0,
                results={},
                execution_time=0,
                errors={"security": error_message},
                error_details=error_details,
                cache_hits=0,
                cache_misses=0
            )
        
        start_time = time.time()
        
        # 篩選目標設備
        if device_ips:
            filtered_nr = self.nr.filter(F(hostname__in=device_ips))
        else:
            filtered_nr = self.nr
        
        total_devices = len(filtered_nr.inventory.hosts)
        
        if total_devices == 0:
            error_msg = "沒有找到符合條件的設備"
            error_details = {"filter": classify_error(error_msg)}
            return BatchResult(
                command=command,
                total_devices=0,
                successful_devices=0,
                failed_devices=0,
                results={},
                execution_time=0,
                errors={"filter": error_msg},
                error_details=error_details,
                cache_hits=0,
                cache_misses=0
            )
        
        logger.info(f"開始批次執行指令: {command}，目標設備: {total_devices} 台")
        
        # 執行預檢查：清理失敗的連線
        if total_devices > 1:  # 多設備操作才進行預檢查
            logger.info("執行批次操作前的連線預檢查")
            try:
                self.cleanup_failed_connections()
            except Exception as e:
                logger.warning(f"連線預檢查失敗，繼續執行: {e}")
        
        # 檢查是否為可快取指令，提前計算快取統計
        cacheable_commands = ["version", "inventory", "logging"]
        is_cacheable = any(keyword in command.lower() for keyword in cacheable_commands)
        cache_hits = 0
        cache_misses = 0
        
        if is_cacheable:
            # 預計算快取命中情況
            for host in filtered_nr.inventory.hosts.values():
                if command_cache.get(host.hostname, command):
                    cache_hits += 1
                else:
                    cache_misses += 1
        else:
            cache_misses = total_devices
        
        # 執行批次指令 - 使用統一的任務函式
        try:
            result = filtered_nr.run(
                task=unified_network_command_task,
                command=command
            )
            
            execution_time = time.time() - start_time
            
            # 處理結果 - 將設備名稱映射為 IP 地址
            successful_devices = 0
            failed_devices = 0
            results = {}
            errors = {}
            error_details = {}
            
            # 建立設備名稱到IP的映射
            name_to_ip = {}
            for host_name, host_obj in filtered_nr.inventory.hosts.items():
                name_to_ip[host_name] = host_obj.hostname
            
            for host_name, task_result in result.items():
                # 將設備名稱映射為IP地址作為key
                device_ip = name_to_ip.get(host_name, host_name)
                
                if task_result.failed:
                    failed_devices += 1
                    error_msg = str(task_result.exception) if task_result.exception else task_result.result
                    errors[device_ip] = error_msg
                    error_details[device_ip] = classify_error(error_msg)
                    logger.error(f"設備 {host_name} ({device_ip}) 執行失敗: {task_result.exception}")
                else:
                    successful_devices += 1
                    results[device_ip] = task_result.result
                    logger.info(f"設備 {host_name} ({device_ip}) 執行成功")
            
            return BatchResult(
                command=command,
                total_devices=total_devices,
                successful_devices=successful_devices,
                failed_devices=failed_devices,
                results=results,
                execution_time=execution_time,
                errors=errors,
                error_details=error_details,
                cache_hits=cache_hits,
                cache_misses=cache_misses
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"批次執行失敗: {e}")
            error_msg = str(e)
            error_details = {"batch_execution": classify_error(error_msg)}
            
            return BatchResult(
                command=command,
                total_devices=total_devices,
                successful_devices=0,
                failed_devices=total_devices,
                results={},
                execution_time=execution_time,
                errors={"batch_execution": error_msg},
                error_details=error_details,
                cache_hits=0,
                cache_misses=total_devices
            )
    
    def run_group_command(self, command: str, group_name: str) -> BatchResult:
        """對設備群組執行指令
        
        Args:
            command: 要執行的指令
            group_name: 群組名稱
            
        Returns:
            BatchResult: 批次執行結果
        """
        if not self.nr:
            error_msg = "Nornir 未初始化"
            error_details = {"nornir": classify_error(error_msg)}
            return BatchResult(
                command=command,
                total_devices=0,
                successful_devices=0,
                failed_devices=0,
                results={},
                execution_time=0,
                errors={"nornir": error_msg},
                error_details=error_details,
                cache_hits=0,
                cache_misses=0
            )
        
        # 篩選群組設備
        try:
            group_nr = self.nr.filter(F(groups__contains=group_name))
            device_ips = [host.hostname for host in group_nr.inventory.hosts.values()]
            
            if not device_ips:
                error_msg = f"群組 '{group_name}' 中沒有設備"
                error_details = {"group": classify_error(error_msg)}
                return BatchResult(
                    command=command,
                    total_devices=0,
                    successful_devices=0,
                    failed_devices=0,
                    results={},
                    execution_time=0,
                    errors={"group": error_msg},
                    error_details=error_details,
                    cache_hits=0,
                    cache_misses=0
                )
            
            logger.info(f"對群組 '{group_name}' 執行指令，包含 {len(device_ips)} 台設備")
            return self.run_batch_command(command, device_ips)
            
        except Exception as e:
            logger.error(f"群組操作失敗: {e}")
            error_msg = str(e)
            error_details = {"group_execution": classify_error(error_msg)}
            return BatchResult(
                command=command,
                total_devices=0,
                successful_devices=0,
                failed_devices=0,
                results={},
                execution_time=0,
                errors={"group_execution": error_msg},
                error_details=error_details,
                cache_hits=0,
                cache_misses=0
            )

# 全域 Nornir 管理器實例
nornir_manager = None

def get_nornir_manager() -> NornirManager:
    """取得全域 Nornir 管理器實例"""
    global nornir_manager
    if nornir_manager is None:
        try:
            nornir_manager = NornirManager()
        except Exception as e:
            logger.error(f"Nornir 管理器初始化失敗: {e}")
            raise
    return nornir_manager

def batch_command_wrapper(input_str: str) -> str:
    """批次指令執行包裝函式
    
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
            if device_ips is None:
                # 如果沒有指定設備，但有範圍限制，則使用範圍限制內的設備
                device_ips = scope_restriction
                logger.info(f"應用設備範圍限制，將對以下設備執行指令: {device_ips}")
            else:
                # 如果指定了設備，檢查是否在允許範圍內
                invalid_devices = [ip for ip in device_ips if ip not in scope_restriction]
                if invalid_devices:
                    error_msg = f"指令嘗試在限制範圍外的設備執行: {invalid_devices}。只允許在以下設備執行: {scope_restriction}"
                    logger.warning(error_msg)
                    return f"錯誤：{error_msg}"
                
                logger.info(f"設備範圍驗證通過，允許在設備 {device_ips} 上執行指令")
        
        manager = get_nornir_manager()
        result = manager.run_batch_command(command, device_ips)
        
        return format_batch_result_for_ai(result)
        
    except Exception as e:
        logger.error(f"批次指令執行失敗: {e}")
        return f"錯誤：批次指令執行失敗 - {e}"



def format_batch_result_for_ai(result: BatchResult) -> str:
    """格式化批次執行結果為 JSON 字串，方便 AI 解析"""
    
    # 建立一個清晰的字典結構
    response_data = {
        "summary": {
            "command": result.command,
            "total_devices": result.total_devices,
            "successful_devices": result.successful_devices,
            "failed_devices": result.failed_devices,
            "execution_time_seconds": round(result.execution_time, 2),
            "cache_stats": {
                "hits": result.cache_hits,
                "misses": result.cache_misses
            }
        },
        "successful_results": [],
        "failed_results": []
    }

    # 填充成功結果
    for device_ip, output in result.results.items():
        response_data["successful_results"].append({
            "device_ip": device_ip,
            "output": output
        })

    # 填充失敗結果
    for device_ip, error_msg in result.errors.items():
        error_detail = result.error_details.get(device_ip, {})
        response_data["failed_results"].append({
            "device_ip": device_ip,
            "error_message": error_msg,
            "error_details": {
                "type": error_detail.get('type', 'unknown'),
                "category": error_detail.get('category', 'unknown'),
                "suggestion": error_detail.get('suggestion', 'N/A')
            }
        })
    
    # 返回 JSON 字串
    # AI 在處理 JSON 格式的資料時通常表現更佳
    return json.dumps(response_data, indent=2, ensure_ascii=False)

def format_batch_result(result: BatchResult) -> str:
    """格式化批次執行結果 - 讓 AI 更容易識別成功/失敗狀態"""
    
    # 開頭明確標示執行狀態，特別強調成功狀態
    if result.failed_devices == 0:
        status_header = "✅ 批次指令執行完全成功"
        execution_status = "SUCCESS"
    elif result.successful_devices == 0:
        status_header = "❌ 批次指令執行完全失敗"
        execution_status = "FAILED"
    else:
        status_header = "⚠️ 批次指令執行部分成功"
        execution_status = "PARTIAL"
    
    # 使用明確的狀態標記讓 AI 容易理解
    output = f"=== 批次執行結果報告 ===\n"
    output += f"執行狀態：{execution_status}\n"
    output += f"{status_header}\n\n"
    output += f"📋 執行詳情：\n"
    output += f"  指令：{result.command}\n"
    output += f"  執行範圍：{result.total_devices} 台設備\n"
    output += f"  成功設備：{result.successful_devices} 台\n"
    output += f"  失敗設備：{result.failed_devices} 台\n"
    output += f"  執行時間：{result.execution_time:.2f} 秒\n"
    
    # 顯示快取統計
    if hasattr(result, 'cache_hits') and hasattr(result, 'cache_misses'):
        total_cache_requests = result.cache_hits + result.cache_misses
        if total_cache_requests > 0:
            cache_hit_rate = (result.cache_hits / total_cache_requests) * 100
            output += f"  快取效能：命中 {result.cache_hits} 次，未命中 {result.cache_misses} 次（命中率：{cache_hit_rate:.1f}%）\n"
    output += "\n"
    
    # 優先顯示成功結果 - 明確標示執行成功
    if result.results:
        output += "📊 成功執行設備的輸出結果（指令執行正常）：\n"
        for device, device_result in list(result.results.items())[:3]:  # 只顯示前3台
            output += f"\n=== 設備 {device} - 指令執行狀態：SUCCESS ===\n"
            
            # 檢查是否包含溫度相關資訊（針對 show environment 指令）
            if "environment" in result.command.lower() and device_result:
                if any(keyword in device_result.lower() for keyword in ["temperature", "temp", "celsius", "°c", "degrees"]):
                    output += "✅ 溫度資訊已成功獲取\n"
                elif "no output" in device_result.lower() or len(device_result.strip()) < 10:
                    output += "⚠️ 設備回應為空或極短，可能不支援此指令\n"
                else:
                    output += "ℹ️ 設備已回應，請查看詳細輸出\n"
            
            # 根據內容長度調整顯示策略
            if len(device_result) > 1000:
                output += device_result[:1000] + "\n...(輸出較長，已顯示前1000字符)\n"
            else:
                output += device_result + "\n"
        
        if len(result.results) > 3:
            output += f"\n✅ 另外 {len(result.results) - 3} 台設備也執行成功，結果已省略\n"
    
    # 如果有錯誤，清楚標示
    if result.errors:
        output += "\n❌ 執行失敗的設備：\n"
        for device, error in result.errors.items():
            output += f"• 設備 {device} - 失敗原因：{error}\n"
            # 顯示錯誤分類詳情（僅當真正是錯誤時）
            if hasattr(result, 'error_details') and device in result.error_details:
                error_detail = result.error_details[device]
                if error_detail['type'] != 'success_output':  # 排除誤判的成功輸出
                    output += f"  → 錯誤類型: {error_detail['category']} ({error_detail['type']})\n"
                    output += f"  → 嚴重程度: {error_detail['severity']}\n"
                    output += f"  → 建議解決: {error_detail['suggestion']}\n"
    
    # 結尾總結 - 明確的結論讓 AI 理解
    output += "\n=== 執行結果總結 ===\n"
    if result.failed_devices == 0:
        output += f"✅ 【分析結論】所有 {result.successful_devices} 台設備指令執行成功！\n"
        output += "✅ 設備回應正常，資料可用於分析\n"
        if "environment" in result.command.lower():
            output += "✅ 環境監控指令執行成功，可查看設備溫度和環境狀態\n"
    elif result.successful_devices > 0:
        output += f"⚠️ 【分析結論】{result.successful_devices} 台設備成功，{result.failed_devices} 台設備失敗\n"
        output += "✅ 成功的設備資料可用於分析\n"
    else:
        output += "❌ 【分析結論】所有設備指令執行失敗，請檢查網路連接或設備狀態\n"
    
    return output