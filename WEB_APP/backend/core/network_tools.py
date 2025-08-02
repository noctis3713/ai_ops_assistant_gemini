#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
網路工具模組 - Cisco 設備連接與指令執行
提供安全的網路設備連接、指令執行、連線池管理和快取功能
"""

import re
import os
import logging
import threading
import time
from typing import Tuple, Optional, Dict, Callable, Any
from functools import lru_cache
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException

# AI 服務相關導入
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logging.warning("langchain_google_genai 未安裝，Gemini AI 摘要功能不可用")

try:
    from langchain_anthropic import ChatAnthropic
    CLAUDE_AVAILABLE = True
except ImportError:
    CLAUDE_AVAILABLE = False
    logging.warning("langchain_anthropic 未安裝，Claude AI 摘要功能不可用")

logger = logging.getLogger(__name__)

def get_ai_logger():
    """建立 AI 專用日誌記錄器（使用統一配置）"""
    from utils import create_ai_logger
    return create_ai_logger()

ai_logger = get_ai_logger()

class OutputSummarizer:
    """AI 輸出摘要器 - 處理超長指令輸出"""
    
    def __init__(self, ai_provider: str = None, model_name: str = None):
        self.ai_provider = ai_provider or os.getenv('AI_PROVIDER', 'gemini')
        self.max_tokens = 2048  # 摘要用較少的 token
        self.llm = None
        
        # 根據提供者設定預設模型，優先使用環境變數
        if self.ai_provider == 'claude':
            self.model_name = model_name or os.getenv('CLAUDE_MODEL', 'claude-3-haiku-20240307')
        else:
            self.model_name = model_name or os.getenv('GEMINI_MODEL', 'gemini-1.5-flash-latest')
        
        # 初始化對應的 AI 服務
        self._initialize_ai_service()
    
    def _initialize_ai_service(self):
        """初始化 AI 服務"""
        if self.ai_provider == 'claude':
            self._initialize_claude()
        else:
            self._initialize_gemini()
    
    def _initialize_claude(self):
        """初始化 Claude AI"""
        if not CLAUDE_AVAILABLE:
            logger.warning("未安裝 langchain_anthropic")
            return
        
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            logger.warning("未設定 ANTHROPIC_API_KEY")
            return
        
        try:
            self.llm = ChatAnthropic(
                model=self.model_name,
                temperature=0,
                max_tokens=self.max_tokens,
                anthropic_api_key=api_key
            )
            logger.info("Claude 摘要器初始化成功")
            ai_logger.info(f"[CLAUDE] 摘要器初始化成功 - 模型: {self.model_name}")
        except Exception as e:
            logger.error(f"Claude 初始化失敗: {e}")
            self.llm = None
    
    def _initialize_gemini(self):
        """初始化 Gemini AI"""
        if not GEMINI_AVAILABLE:
            logger.warning("未安裝 langchain_google_genai")
            return
        
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            logger.warning("未設定 GOOGLE_API_KEY")
            return
        
        try:
            self.llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                temperature=0,
                max_output_tokens=self.max_tokens
            )
            logger.info("Gemini 摘要器初始化成功")
            ai_logger.info(f"[GEMINI] 摘要器初始化成功 - 模型: {self.model_name}")
        except Exception as e:
            logger.error(f"Gemini 初始化失敗: {e}")
            self.llm = None
    
    def get_summary_prompt(self, command: str) -> str:
        """摘要提示詞"""
        return f"""請摘要以下網路指令輸出，保留關鍵診斷資訊，移除冗餘內容：

指令：{command}

要求：
1. 保留錯誤、警告、異常狀態、重要數值
2. 移除重複內容和無關細節
3. 維持技術術語準確性
4. 使用繁體中文
5. 開頭標註：「[AI摘要] 原輸出過長，以下為智能摘要：」

請直接輸出摘要結果。"""
    
    def summarize_output(self, command: str, output: str) -> str:
        """AI 摘要超長輸出"""
        if not self.llm:
            logger.warning(f"AI 摘要器不可用: {command}")
            return self._fallback_truncate(command, output)
        
        try:
            logger.info(f"開始 AI 摘要: {command}")
            ai_logger.info(f"[{self.ai_provider.upper()}] 摘要開始 - 指令: {command}, 長度: {len(output)}")
            
            prompt = self.get_summary_prompt(command)
            response = self.llm.invoke(f"{prompt}\n\n輸出內容：\n{output}")
            
            if response and hasattr(response, 'content'):
                summary = response.content.strip()
                compression = round((1 - len(summary)/len(output))*100, 1)
                logger.info(f"摘要完成: {command}, 壓縮率: {compression}%")
                ai_logger.info(f"[{self.ai_provider.upper()}] 摘要完成 - 壓縮率: {compression}%")
                return summary
            
            logger.warning(f"AI 摘要失敗: {command}")
            return self._fallback_truncate(command, output)
            
        except Exception as e:
            logger.error(f"AI 摘要錯誤: {e}")
            ai_logger.error(f"[{self.ai_provider.upper()}] 摘要失敗 - {command}: {str(e)[:100]}")
            return self._fallback_truncate(command, output)
    
    def _fallback_truncate(self, command: str, output: str, max_chars: int = 10000) -> str:
        """備援截斷"""
        return output[:max_chars] + f"\n\n--- [警告] 指令 '{command}' 輸出過長已截斷 ---"

# =============================================================================
# 全域服務實例初始化
# =============================================================================

# AI 摘要服務實例（用於超長輸出處理）
output_summarizer = OutputSummarizer()

def get_device_credentials(device_config=None):
    """取得設備認證資訊"""
    if device_config and hasattr(device_config, 'username') and device_config.username:
        return {
            "device_type": device_config.device_type or device_config.os,
            "username": device_config.username,
            "password": device_config.password,
        }
    
    device_type = os.getenv('DEVICE_TYPE', 'cisco_xe')
    username = os.getenv('DEVICE_USERNAME')
    password = os.getenv('DEVICE_PASSWORD')
    
    if not username or not password:
        raise ValueError(
            "設備憑證未設定！請設定環境變數或 devices.json 中的認證資訊"
        )
    
    return {"device_type": device_type, "username": username, "password": password}

class CommandValidator:
    """指令安全性驗證器 - 支援配置檔案動態載入安全規則"""
    # 預設安全配置（備用）
    DEFAULT_ALLOWED_PREFIXES = ['show', 'ping', 'traceroute']
    DEFAULT_DANGEROUS_KEYWORDS = ['configure', 'write', 'delete', 'shutdown']
    
    # 快取配置以提升效能
    _cached_config = None
    _config_last_loaded = None

    @classmethod
    def _load_security_config(cls) -> Dict[str, Any]:
        """載入安全配置檔案"""
        try:
            from config_manager import get_config_manager
            config_manager = get_config_manager()
            return config_manager.get_security_config()
        except Exception as e:
            logger.warning(f"無法載入安全配置檔案，使用預設配置: {e}")
            return {
                "command_validation": {
                    "allowed_command_prefixes": cls.DEFAULT_ALLOWED_PREFIXES,
                    "dangerous_keywords": cls.DEFAULT_DANGEROUS_KEYWORDS,
                    "max_command_length": 200,
                    "enable_strict_validation": True
                }
            }
    
    @classmethod
    def _get_validation_config(cls) -> Dict[str, Any]:
        """取得驗證配置（使用快取）"""
        import time
        current_time = time.time()
        
        # 快取 30 秒，避免頻繁讀取配置檔案
        if (cls._cached_config is None or 
            cls._config_last_loaded is None or 
            current_time - cls._config_last_loaded > 30):
            
            cls._cached_config = cls._load_security_config()
            cls._config_last_loaded = current_time
            logger.debug("安全配置已重新載入")
        
        return cls._cached_config.get("command_validation", {})
    
    @classmethod
    def reload_security_config(cls):
        """強制重新載入安全配置（用於熱重載）"""
        cls._cached_config = None
        cls._config_last_loaded = None
        logger.info("安全配置快取已清除，下次驗證時將重新載入")

    @classmethod
    def validate_commands(cls, commands: list) -> Tuple[bool, Optional[str]]:
        """驗證指令清單安全性"""
        for command in commands:
            is_safe, error_message = cls.validate_command(command)
            if not is_safe:
                return False, error_message
        return True, None
    
    @classmethod
    def validate_command(cls, command: str) -> Tuple[bool, Optional[str]]:
        """驗證指令安全性 - 從配置檔案載入安全規則"""
        command_lower = command.lower().strip()
        
        # 檢查指令是否為空
        if not command_lower:
            return False, cls._generate_security_alert(command, "指令不能為空")
        
        # 載入安全配置
        validation_config = cls._get_validation_config()
        allowed_prefixes = validation_config.get("allowed_command_prefixes", cls.DEFAULT_ALLOWED_PREFIXES)
        dangerous_keywords = validation_config.get("dangerous_keywords", cls.DEFAULT_DANGEROUS_KEYWORDS)
        max_length = validation_config.get("max_command_length", 200)
        strict_validation = validation_config.get("enable_strict_validation", True)
        
        # 檢查指令長度
        if len(command) > max_length:
            return False, cls._generate_security_alert(command, f"指令長度超過 {max_length} 字元限制")
        
        # 檢查危險關鍵字
        if strict_validation:
            for keyword in dangerous_keywords:
                if keyword in command_lower:
                    return False, cls._generate_security_alert(command, f"指令包含危險關鍵字: {keyword}")
        
        # 檢查允許的指令前綴
        for prefix in allowed_prefixes:
            if command_lower.startswith(prefix + ' ') or command_lower == prefix:
                logger.info(f"允許指令: {command}")
                return True, None
        
        allowed_prefixes_str = "、".join(allowed_prefixes)
        return False, cls._generate_security_alert(command, f"只允許 {allowed_prefixes_str} 開頭的指令")
    
    @classmethod
    def _generate_security_alert(cls, command: str, reason: str) -> str:
        """生成安全警告訊息（動態顯示允許的指令）"""
        try:
            validation_config = cls._get_validation_config()
            allowed_prefixes = validation_config.get("allowed_command_prefixes", cls.DEFAULT_ALLOWED_PREFIXES)
        except:
            allowed_prefixes = cls.DEFAULT_ALLOWED_PREFIXES
        
        # 動態生成允許的指令格式說明
        allowed_formats = []
        command_examples = []
        
        for prefix in allowed_prefixes:
            if prefix == 'show':
                allowed_formats.append("• show [參數] - 查看設備資訊")
                command_examples.extend(["• show version", "• show interface", "• show environment"])
            elif prefix == 'ping':
                allowed_formats.append("• ping [參數] - 網路連通性測試")
                command_examples.extend(["• ping 8.8.8.8", "• ping 192.168.1.1 -c 3"])
            elif prefix == 'traceroute':
                allowed_formats.append("• traceroute [參數] - 網路路由追蹤")
                command_examples.extend(["• traceroute 8.8.8.8", "• traceroute google.com"])
            elif prefix == 'display':
                allowed_formats.append("• display [參數] - 顯示設備資訊")
                command_examples.extend(["• display version", "• display interface"])
            elif prefix == 'get':
                allowed_formats.append("• get [參數] - 獲取設備狀態")
                command_examples.extend(["• get system status", "• get config"])
            else:
                allowed_formats.append(f"• {prefix} [參數] - {prefix} 相關指令")
                command_examples.append(f"• {prefix} <參數>")
        
        allowed_formats_str = "\n".join(allowed_formats)
        command_examples_str = "\n".join(command_examples[:6])  # 最多顯示6個範例
        
        return f"""🚨 安全警告：指令被拒絕

指令: {command}
原因: {reason}

⚠️ 系統僅允許使用以下指令：

允許的指令格式:
{allowed_formats_str}

使用範例:
{command_examples_str}

請只使用這些安全的指令進行網路設備操作。"""

class ConnectionPool:
    """SSH 連線池管理器 - 提供連線重用和健康檢查"""
    def __init__(self, max_connections: int = None):
        if max_connections is None:
            max_connections = int(os.getenv("MAX_CONNECTIONS", "5"))
        self.max_connections = max_connections
        self.connections: Dict[str, ConnectHandler] = {}
        self.connection_times: Dict[str, float] = {}
        self.lock = threading.Lock()
        self.timeout = int(os.getenv("CONNECTION_TIMEOUT", "300"))
        self.health_check_interval = int(os.getenv("HEALTH_CHECK_INTERVAL", "30"))
        self.last_health_check = 0
    
    def get_connection(self, device_ip: str, device_config=None) -> Optional[ConnectHandler]:
        with self.lock:
            current_time = time.time()
            
            if (device_ip in self.connections and 
                current_time - self.connection_times.get(device_ip, 0) < self.timeout):
                try:
                    connection_age = current_time - self.connection_times.get(device_ip, 0)
                    if (device_ip in self.connections and 
                        connection_age > self.health_check_interval and 
                        current_time - self.last_health_check > self.health_check_interval):
                        self.connections[device_ip].send_command("show clock", read_timeout=5)
                        self.last_health_check = current_time
                    return self.connections[device_ip]
                except:
                    self._remove_connection(device_ip)
            
            if len(self.connections) < self.max_connections:
                try:
                    device_credentials = get_device_credentials(device_config)
                    device = {"host": device_ip, **device_credentials}
                    conn = ConnectHandler(**device)
                    self.connections[device_ip] = conn
                    self.connection_times[device_ip] = current_time
                    return conn
                except Exception as e:
                    logger.error(f"無法建立連線到 {device_ip}: {e}")
                    return None
            
            logger.warning(f"連線池已滿，無法建立新連線到 {device_ip}")
            return None
    
    def _remove_connection(self, device_ip: str):
        if device_ip in self.connections:
            try:
                self.connections[device_ip].disconnect()
            except:
                pass
            if device_ip in self.connections:
                del self.connections[device_ip]
            if device_ip in self.connection_times:
                del self.connection_times[device_ip]
    
    def cleanup_expired_connections(self):
        """清理過期連線"""
        current_time = time.time()
        with self.lock:
            expired_ips = [ip for ip, connect_time in self.connection_times.items() 
                          if current_time - connect_time > self.timeout]
        
        for ip in expired_ips:
            self._remove_connection(ip)
            logger.info(f"清理過期連線: {ip}")

# 全域連線池實例
connection_pool = ConnectionPool()

class CommandCache:
    """指令結果快取管理器 - 減少重複查詢"""
    def __init__(self, max_size: int = None, ttl: int = None):
        self.cache = {}
        self.timestamps = {}
        self.max_size = int(os.getenv("CACHE_MAX_SIZE", "512")) if max_size is None else max_size
        self.ttl = int(os.getenv("CACHE_TTL", "300")) if ttl is None else ttl
        self.lock = threading.Lock()
    
    def get(self, device_ip: str, command: str) -> Optional[str]:
        key = f"{device_ip}:{command}"
        current_time = time.time()
        
        with self.lock:
            if key in self.cache:
                if current_time - self.timestamps[key] < self.ttl:
                    return self.cache[key]
                else:
                    del self.cache[key]
                    del self.timestamps[key]
        return None
    
    def set(self, device_ip: str, command: str, result: str):
        key = f"{device_ip}:{command}"
        current_time = time.time()
        
        with self.lock:
            if len(self.cache) >= self.max_size:
                oldest_key = min(self.timestamps, key=self.timestamps.get)
                del self.cache[oldest_key]
                del self.timestamps[oldest_key]
            
            self.cache[key] = result
            self.timestamps[key] = current_time

# 全域指令快取實例
command_cache = CommandCache()

def _process_long_output(command: str, output: str, enable_ai_summary: bool = False, execution_mode: str = "device") -> str:
    """
    處理超長輸出 - 根據執行模式決定是否使用 AI 摘要或截斷
    
    Args:
        command: 執行的指令
        output: 指令輸出結果
        enable_ai_summary: 是否啟用 AI 摘要功能
        execution_mode: 執行模式 ("device" 或 "ai")
    
    Returns:
        處理後的輸出內容
    """
    # 從環境變數讀取配置，提供預設值
    ai_threshold = int(os.getenv("AI_SUMMARY_THRESHOLD", "10000"))
    max_chars = int(os.getenv("DEVICE_OUTPUT_MAX_LENGTH", "50000"))
    global_ai_summary_enabled = os.getenv("ENABLE_AI_SUMMARIZATION", "false").lower() == "true"
    
    # 如果輸出長度小於等於門檻值，直接返回完整輸出
    if len(output) <= ai_threshold:
        return output
    
    # 如果輸出超過最大長度限制，強制截斷
    if len(output) > max_chars:
        logger.warning(f"輸出超過上限 ({max_chars} 字元): {command} (模式: {execution_mode})")
        return output[:max_chars] + f"\n\n--- [警告] 指令 '{command}' 輸出已強制截斷 (超過 {max_chars} 字元) ---"
    
    # 處理中等長度輸出 (門檻值 < 長度 <= 最大長度)
    # 只有在同時滿足以下條件時才使用 AI 摘要：
    # 1. 全域 AI 摘要功能已啟用
    # 2. 當前呼叫允許 AI 摘要
    # 3. AI 摘要器可用
    if global_ai_summary_enabled and enable_ai_summary and output_summarizer.llm:
        logger.info(f"使用 AI 摘要處理超長輸出: {command} (模式: {execution_mode}, 長度: {len(output)})")
        return output_summarizer.summarize_output(command, output)
    else:
        # 使用截斷處理
        reason = "設備指令模式" if execution_mode == "device" else "AI 摘要不可用或未啟用"
        logger.info(f"截斷超長輸出: {command} (模式: {execution_mode}, 原因: {reason}, 長度: {len(output)})")
        return output[:ai_threshold] + f"\n\n--- [訊息] 指令 '{command}' 輸出已截斷，如需完整內容請重新查詢 ---"

def run_readonly_show_command(device_ip: str, command: str, device_config=None) -> str:
    """執行唯讀網路指令 - 支援連線池、快取和安全驗證"""
    is_safe, error_message = CommandValidator.validate_command(command)
    if not is_safe:
        logger.warning(f"拒絕執行不安全指令: {command}, 原因: {error_message}")
        return f"錯誤：{error_message}"
    
    # 檢查可快取的指令類型
    cacheable_commands = ["version", "inventory", "logging"]
    if any(keyword in command.lower() for keyword in cacheable_commands):
        cached_result = command_cache.get(device_ip, command)
        if cached_result:
            logger.info(f"從快取返回結果: {command}")
            return cached_result
    
    logger.info(f"執行指令: {device_ip} -> {command}")
    
    connection = connection_pool.get_connection(device_ip, device_config)
    
    if connection:
        try:
            read_timeout = int(os.getenv("COMMAND_TIMEOUT", "20"))
            output = connection.send_command(command, read_timeout=read_timeout)
            logger.info(f"指令執行成功: {command}")
            
            # 使用智能輸出處理 - 設備指令模式不啟用 AI 摘要
            processed_output = _process_long_output(command, output, enable_ai_summary=False, execution_mode="device")
            
            # 將處理後的結果加入快取（針對特定指令類型）
            if any(keyword in command.lower() for keyword in cacheable_commands):
                output_to_cache = processed_output
                # 對於超長輸出進行截斷處理（使用環境變數控制）
                output_max_size = int(os.getenv("OUTPUT_MAX_SIZE", "50000"))
                if len(processed_output) > output_max_size:
                    output_to_cache = processed_output[:output_max_size] + "\n\n[輸出已截斷，如需完整內容請重新查詢]"  
                command_cache.set(device_ip, command, output_to_cache)
            
            return processed_output
            
        except Exception as e:
            logger.error(f"指令執行失敗: {command}, 錯誤: {e}")
            # 移除有問題的連線並清理相關快取
            connection_pool._remove_connection(device_ip)
            clear_cache_for_device(device_ip)
            return f"錯誤：執行指令時發生錯誤: {e}"
    
    return _direct_connection_fallback(device_ip, command, device_config)

def _direct_connection_fallback(device_ip: str, command: str, device_config=None) -> str:
    """直接連線回退方案"""
    try:
        device_credentials = get_device_credentials(device_config)
        device = {"host": device_ip, **device_credentials}
        
        with ConnectHandler(**device) as net_connect:
            read_timeout = int(os.getenv("COMMAND_TIMEOUT", "20"))
            output = net_connect.send_command(command, read_timeout=read_timeout)
            logger.info(f"直接連線執行成功: {command}")
            # 使用智能輸出處理 - 設備指令模式不啟用 AI 摘要
            processed_output = _process_long_output(command, output, enable_ai_summary=False, execution_mode="device")
            return processed_output
            
    except NetmikoTimeoutException:
        error_msg = f"錯誤：無法連線到設備 {device_ip}，連線超時。請檢查IP位址和網路連線。"
        logger.error(error_msg)
        return error_msg
    except NetmikoAuthenticationException:
        error_msg = f"錯誤：對設備 {device_ip} 的身分驗證失敗。請檢查使用者名稱和密碼。"
        logger.error(error_msg)
        return error_msg
    except Exception as e:
        error_msg = f"錯誤：執行指令時發生未知錯誤: {e}"
        logger.error(error_msg)
        return error_msg

def clear_cache_for_device(device_ip: str):
    """清理特定設備快取"""
    with command_cache.lock:
        keys_to_remove = [key for key in command_cache.cache.keys() if key.startswith(f"{device_ip}:")]
        for key in keys_to_remove:
            del command_cache.cache[key]
            del command_cache.timestamps[key]

def is_ai_summary_available() -> bool:
    """檢查 AI 摘要是否可用"""
    return (GEMINI_AVAILABLE or CLAUDE_AVAILABLE) and output_summarizer.llm is not None

def get_ai_summary_status() -> dict:
    """AI 摘要系統狀態"""
    return {
        "ai_provider": output_summarizer.ai_provider,
        "gemini_available": GEMINI_AVAILABLE,
        "claude_available": CLAUDE_AVAILABLE,
        "summarizer_initialized": output_summarizer.llm is not None,
        "model_name": output_summarizer.model_name if output_summarizer.llm else None,
        "ai_summary_threshold": 10000,
        "max_output_chars": 50000
    }