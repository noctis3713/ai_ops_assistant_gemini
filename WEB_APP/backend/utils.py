#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具函數模組 - 統一管理通用工具函數、日誌系統和錯誤處理
提供系統級通用功能和工具函數，已移除對話歷史管理以提升性能
"""

import logging
import logging.handlers
import sys
import time
import os
from typing import Dict, List, Tuple, Any, Optional
from pathlib import Path

# 已移除 LangChain Memory 相關導入，優化性能

logger = logging.getLogger(__name__)

# 日誌輪轉配置參數
LOG_CONFIG = {
    "MAX_SIZE": int(os.getenv("LOG_MAX_SIZE", "10485760")),  # 10MB
    "BACKUP_COUNT": int(os.getenv("LOG_BACKUP_COUNT", "5")),  # 保留5個備份
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "LOG_DIR": Path(__file__).parent / "logs"
}

class LoggerConfig:
    """統一的日誌配置管理器
    
    提供標準化的日誌處理器建立和配置管理，支援檔案大小輪轉機制
    """
    
    @staticmethod
    def create_rotating_handler(log_filename: str, max_bytes: int = None, backup_count: int = None) -> logging.handlers.RotatingFileHandler:
        """建立具有輪轉功能的檔案處理器
        
        Args:
            log_filename: 日誌檔案名稱
            max_bytes: 最大檔案大小（預設使用 LOG_CONFIG）
            backup_count: 備份檔案數量（預設使用 LOG_CONFIG）
            
        Returns:
            logging.handlers.RotatingFileHandler: 配置好的輪轉處理器
        """
        # 確保日誌目錄存在
        LOG_CONFIG["LOG_DIR"].mkdir(exist_ok=True)
        
        # 使用預設值或環境變數配置
        max_bytes = max_bytes or LOG_CONFIG["MAX_SIZE"]
        backup_count = backup_count or LOG_CONFIG["BACKUP_COUNT"]
        
        # 建立完整的日誌檔案路徑
        log_path = LOG_CONFIG["LOG_DIR"] / log_filename
        
        # 建立輪轉處理器
        handler = logging.handlers.RotatingFileHandler(
            filename=str(log_path),
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        
        # 設定格式器
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        
        return handler
    
    @staticmethod
    def create_error_handler() -> logging.handlers.RotatingFileHandler:
        """建立錯誤專用的日誌處理器
        
        Returns:
            logging.handlers.RotatingFileHandler: 錯誤日誌處理器
        """
        handler = LoggerConfig.create_rotating_handler("error.log")
        handler.setLevel(logging.ERROR)  # 只記錄錯誤級別以上的訊息
        return handler
    
    @staticmethod
    def setup_logger(logger_name: str, log_filename: str, level: str = None) -> logging.Logger:
        """設定完整的日誌記錄器
        
        Args:
            logger_name: 記錄器名稱
            log_filename: 日誌檔案名稱
            level: 日誌級別（預設使用 LOG_CONFIG）
            
        Returns:
            logging.Logger: 配置完成的記錄器
        """
        # 取得記錄器
        logger = logging.getLogger(logger_name)
        
        # 避免重複新增處理器
        if logger.handlers:
            return logger
        
        # 設定日誌級別
        log_level = level or LOG_CONFIG["LOG_LEVEL"]
        logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        
        # 新增主要日誌處理器
        main_handler = LoggerConfig.create_rotating_handler(log_filename)
        logger.addHandler(main_handler)
        
        # 新增錯誤日誌處理器（所有記錄器共用）
        error_handler = LoggerConfig.create_error_handler()
        logger.addHandler(error_handler)
        
        # 防止向上傳播（避免重複記錄）
        logger.propagate = False
        
        return logger
    
    @staticmethod
    def get_log_stats() -> Dict[str, Any]:
        """取得日誌檔案統計資訊
        
        Returns:
            Dict[str, Any]: 日誌統計資訊
        """
        stats = {}
        log_dir = LOG_CONFIG["LOG_DIR"]
        
        if log_dir.exists():
            for log_file in log_dir.glob("*.log"):
                try:
                    file_stat = log_file.stat()
                    stats[log_file.name] = {
                        "size_bytes": file_stat.st_size,
                        "size_mb": round(file_stat.st_size / 1024 / 1024, 2),
                        "modified": time.ctime(file_stat.st_mtime)
                    }
                except Exception as e:
                    stats[log_file.name] = {"error": str(e)}
        
        # 建立可 JSON 序列化的配置副本
        json_safe_config = LOG_CONFIG.copy()
        json_safe_config["LOG_DIR"] = str(LOG_CONFIG["LOG_DIR"])  # 將 Path 物件轉換為字串
        
        return {
            "config": json_safe_config,
            "files": stats
        }
    
    @staticmethod
    def cleanup_old_logs(days_to_keep: int = 30):
        """清理舊的日誌檔案
        
        Args:
            days_to_keep: 保留天數
        """
        log_dir = LOG_CONFIG["LOG_DIR"]
        cutoff_time = time.time() - (days_to_keep * 24 * 60 * 60)
        
        cleanup_count = 0
        for log_file in log_dir.glob("*.log.*"):  # 清理備份檔案
            try:
                if log_file.stat().st_mtime < cutoff_time:
                    log_file.unlink()
                    cleanup_count += 1
            except Exception as e:
                logger.warning(f"清理日誌檔案失敗 {log_file}: {e}")
        
        logger.info(f"清理了 {cleanup_count} 個舊日誌檔案")

# 對話歷史儲存和智能記憶體管理功能已完全移除以提升性能

def create_stream_handler():
    """建立支援 UTF-8 的日誌處理器
    
    Returns:
        logging.StreamHandler: 配置好的日誌處理器
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    return handler

def create_ai_logger():
    """建立 AI 操作專用日誌記錄器（使用統一配置）
    
    Returns:
        logging.Logger: AI 專用日誌記錄器
    """
    return LoggerConfig.setup_logger('ai_operations', 'ai.log')

def create_network_logger():
    """建立網路操作專用日誌記錄器（使用統一配置）
    
    Returns:
        logging.Logger: 網路專用日誌記錄器
    """
    return LoggerConfig.setup_logger('network_operations', 'network.log')

# 所有對話歷史和記憶體管理相關函數已完全移除以提升性能
# 包括: ConversationMemoryManager, get_memory_manager, chat_history_*, 
# get_conversation_summary, memory_stats, memory_config 等功能

def build_ai_system_prompt_for_pydantic(search_enabled: bool = False) -> str:
    """建立結構化、適用於 PydanticOutputParser 的 AI 系統提示詞
    
    專為 PydanticOutputParser 設計的提示詞，要求 AI 輸出結構化的 JSON 格式
    
    Args:
        search_enabled: 搜尋功能是否啟用（用於動態調整工具說明）
        
    Returns:
        str: 適用於 PydanticOutputParser 的結構化提示詞
    """
    base_prompt = """<role>
你是一名專業的網路工程師和 AI 助理，專精於 Cisco 設備診斷和網路分析。
你具備 CCIE 級別的專業知識，能夠準確分析設備狀態並提供專業建議。
</role>

<security_rules>
**絕對安全限制**：
1. 只能執行 show 類指令（如 show version, show interface, show environment 等）
2. 禁止執行任何配置變更指令（configure, write, delete, shutdown 等）
3. 所有指令都會被安全驗證，危險指令將被自動阻止
4. 專注於分析和診斷，絕不進行配置修改
</security_rules>

<tools_guide>
你有一個強大的工具：**BatchCommandRunner**

**BatchCommandRunner** 用途：
- 在指定的網路設備上執行安全的 show 指令
- 自動驗證指令安全性
- 支援單設備或多設備批次執行
- 返回結構化的執行結果和錯誤分析

**使用格式**：
- 單設備: "device_ip: command"
- 多設備: "device_ip1,device_ip2: command"  
- 所有設備: "command"

**重要**：工具會返回 JSON 格式結果，包含 successful_results 和 failed_results 兩個關鍵陣列。
</tools_guide>

<workflow>
**標準工作流程**：
1. **理解需求**：分析用戶查詢，確定需要執行的指令
2. **選擇工具**：使用 BatchCommandRunner 執行相關 show 指令
3. **分析結果**：深入分析設備輸出，識別關鍵資訊和異常
4. **結構化回應**：將分析結果組織成結構化的 JSON 格式
   - **特別是**在處理多設備時，你**必須**從 BatchCommandRunner 回傳結果的 `summary` 物件中，提取 `successful_devices` 和 `failed_devices` 的數值，並填入到最終 JSON 回應的 `successful_device_count` 和 `failed_device_count` 欄位中
   - 不可猜測或計算這些數值，必須從工具回傳的確切數據中提取
</workflow>

<output_format>
**關鍵要求**：你的最終回答必須是有效的 JSON 物件，嚴格遵循以下格式規範。

{{format_instructions}}

**注意事項**：
- 不要在 JSON 前後添加 Markdown 標記（如 ```json）
- 確保 JSON 格式完全有效
- analysis_type 根據設備數量自動判斷：1台設備="single_device"，多台="multi_device"
- 如果沒有異常，anomalies 欄位應為空陣列 []
- 所有建議都應該具體可操作
</output_format>"""

    return base_prompt


# build_few_shot_examples 函數已移動到 ai_service.py

# build_chat_history_context 函數已移除以提升性能

def format_device_execution_result(device_name: str, device_ip: str, success: bool, 
                                 output: str = None, error: str = None, 
                                 execution_time: float = 0.0) -> Dict[str, Any]:
    """格式化設備執行結果
    
    Args:
        device_name: 設備名稱
        device_ip: 設備 IP
        success: 執行是否成功
        output: 執行輸出
        error: 錯誤訊息
        execution_time: 執行時間
        
    Returns:
        Dict[str, Any]: 格式化的執行結果
    """
    return {
        "deviceName": device_name,
        "deviceIp": device_ip,
        "success": success,
        "output": output,
        "error": error,
        "executionTime": execution_time
    }

def format_api_response(success: bool, data: Any = None, message: str = None, 
                       error_code: str = None) -> Dict[str, Any]:
    """格式化 API 回應
    
    Args:
        success: 操作是否成功
        data: 回應資料
        message: 回應訊息
        error_code: 錯誤代碼
        
    Returns:
        Dict[str, Any]: 格式化的 API 回應
    """
    response = {
        "success": success,
        "timestamp": time.time()
    }
    
    if data is not None:
        response["data"] = data
    
    if message:
        response["message"] = message
    
    if error_code:
        response["error_code"] = error_code
    
    return response

def validate_ip_address(ip: str) -> bool:
    """驗證 IP 位址格式
    
    Args:
        ip: IP 位址字串
        
    Returns:
        bool: IP 位址是否有效
    """
    try:
        parts = ip.split('.')
        if len(parts) != 4:
            return False
        
        for part in parts:
            if not part.isdigit():
                return False
            num = int(part)
            if num < 0 or num > 255:
                return False
        
        return True
    except:
        return False

def sanitize_input(input_str: str) -> str:
    """清理使用者輸入
    
    Args:
        input_str: 輸入字串
        
    Returns:
        str: 清理後的字串
    """
    if not isinstance(input_str, str):
        return ""
    
    # 移除危險字元
    dangerous_chars = [';', '&', '|', '`', '$', '(', ')']
    cleaned = input_str
    
    for char in dangerous_chars:
        cleaned = cleaned.replace(char, '')
    
    # 限制長度
    max_length = 1000
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    
    return cleaned.strip()

def calculate_cache_stats(hits: int, misses: int) -> Dict[str, Any]:
    """計算快取統計資訊
    
    Args:
        hits: 快取命中次數
        misses: 快取未命中次數
        
    Returns:
        Dict[str, Any]: 快取統計資訊
    """
    total = hits + misses
    if total == 0:
        return {"hits": 0, "misses": 0, "hit_rate": 0.0}
    
    hit_rate = (hits / total) * 100
    return {
        "hits": hits,
        "misses": misses,
        "total": total,
        "hit_rate": round(hit_rate, 1)
    }

def parse_device_list(device_input: str) -> List[str]:
    """解析設備清單輸入
    
    Args:
        device_input: 設備輸入字串（逗號分隔）
        
    Returns:
        List[str]: 設備清單
    """
    if not device_input:
        return []
    
    devices = [device.strip() for device in device_input.split(',')]
    return [device for device in devices if device and validate_ip_address(device)]

def truncate_text(text: str, max_length: int = 1000, suffix: str = "...") -> str:
    """截斷文字到指定長度
    
    Args:
        text: 原始文字
        max_length: 最大長度
        suffix: 截斷後綴
        
    Returns:
        str: 截斷後的文字
    """
    if not text or len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix

def get_system_info() -> Dict[str, Any]:
    """取得系統資訊
    
    Returns:
        Dict[str, Any]: 系統資訊
    """
    import os
    import psutil
    
    return {
        "python_version": sys.version,
        "platform": sys.platform,
        "cpu_count": os.cpu_count(),
        "memory_usage": psutil.virtual_memory()._asdict() if 'psutil' in globals() else None,
        "disk_usage": psutil.disk_usage('/')._asdict() if 'psutil' in globals() else None
    }

class PerformanceTimer:
    """效能計時器"""
    
    def __init__(self, name: str = "Operation"):
        self.name = name
        self.start_time = None
        self.end_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        elapsed = self.end_time - self.start_time
        logger.debug(f"{self.name} 執行時間: {elapsed:.3f} 秒")
    
    def elapsed(self) -> float:
        """取得經過時間
        
        Returns:
            float: 經過時間（秒）
        """
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return 0.0

# 錯誤處理相關函數

def classify_network_error(error_message: str) -> Dict[str, Any]:
    """分類網路錯誤並提供詳細資訊
    
    Args:
        error_message: 錯誤訊息字串
        
    Returns:
        Dict[str, Any]: 包含錯誤分類資訊的字典
    """
    error_lower = error_message.lower()
    
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
    elif "安全限制" in error_message or "不安全指令" in error_message:
        return {
            "type": "security_violation",
            "category": "安全限制",
            "severity": "medium",
            "description": "指令安全性檢查失敗",
            "suggestion": "請使用允許的唯讀指令"
        }
    elif "connection refused" in error_lower or "連線拒絕" in error_message:
        return {
            "type": "connection_refused",
            "category": "網路連線",
            "severity": "high",
            "description": "設備拒絕連線",
            "suggestion": "檢查設備IP和SSH服務狀態"
        }
    else:
        return {
            "type": "unknown_error",
            "category": "未知錯誤",
            "severity": "medium",
            "description": "未分類的錯誤",
            "suggestion": "檢查錯誤詳情並聯繫管理員"
        }

def map_error_to_http_status(error_type: str) -> int:
    """將錯誤類型映射到 HTTP 狀態碼
    
    Args:
        error_type: 錯誤類型
        
    Returns:
        int: HTTP 狀態碼
    """
    status_code_map = {
        "connection_timeout": 408,
        "authentication_failed": 401,
        "connection_refused": 503,
        "security_violation": 400,
        "unknown_error": 500
    }
    
    return status_code_map.get(error_type, 500)

def format_error_response(error_detail: Dict[str, Any], error_message: str = None) -> str:
    """格式化錯誤回應訊息
    
    Args:
        error_detail: 錯誤詳細資訊
        error_message: 原始錯誤訊息
        
    Returns:
        str: 格式化的錯誤訊息
    """
    if error_message:
        formatted_msg = f"執行失敗: {error_message}\n"
    else:
        formatted_msg = "執行失敗\n"
    
    formatted_msg += f"分類: {error_detail['category']} ({error_detail['type']})\n"
    formatted_msg += f"嚴重性: {error_detail['severity']}\n"
    formatted_msg += f"建議: {error_detail['suggestion']}"
    
    return formatted_msg

class ErrorHandler:
    """統一錯誤處理器"""
    
    @staticmethod
    def handle_network_error(error: Exception, context: str = "") -> Tuple[str, int]:
        """處理網路相關錯誤
        
        Args:
            error: 異常物件
            context: 錯誤上下文
            
        Returns:
            Tuple[str, int]: (錯誤訊息, HTTP狀態碼)
        """
        error_str = str(error)
        error_detail = classify_network_error(error_str)
        status_code = map_error_to_http_status(error_detail['type'])
        
        if context:
            error_message = f"{context}: {error_str}"
        else:
            error_message = error_str
        
        formatted_message = format_error_response(error_detail, error_message)
        
        logger.error(f"網路錯誤: {error_str}, 類型: {error_detail['type']}, 狀態碼: {status_code}")
        
        return formatted_message, status_code
    
    @staticmethod
    def handle_generic_error(error: Exception, context: str = "", status_code: int = 500) -> Tuple[str, int]:
        """處理一般錯誤
        
        Args:
            error: 異常物件
            context: 錯誤上下文
            status_code: HTTP 状态码
            
        Returns:
            Tuple[str, int]: (錯誤訊息, HTTP狀態碼)
        """
        error_str = str(error)
        
        if context:
            error_message = f"{context}: {error_str}"
        else:
            error_message = error_str
        
        logger.error(f"一般錯誤: {error_str}, 狀態碼: {status_code}")
        
        return error_message, status_code


# ===================================================================
# 前端日誌處理系統
# ===================================================================

class FrontendLogHandler:
    """前端日誌處理器
    
    負責接收、處理和存儲來自前端的日誌資料
    支援日誌分類、輪轉存儲和格式化處理
    """
    
    def __init__(self):
        """初始化前端日誌處理器"""
        self.frontend_logger = self._setup_frontend_logger()
        self.error_logger = self._setup_frontend_error_logger()
        
        # 日誌級別映射
        self.log_level_map = {
            0: logging.DEBUG,
            1: logging.INFO,
            2: logging.WARNING,
            3: logging.ERROR
        }
        
        # 日誌分類統計
        self.category_stats = {}
        
    def _setup_frontend_logger(self) -> logging.Logger:
        """設置前端一般日誌記錄器"""
        frontend_logger = logging.getLogger('frontend')
        frontend_logger.setLevel(logging.DEBUG)
        
        # 避免重複添加處理器
        if not frontend_logger.handlers:
            # 前端日誌輪轉處理器
            frontend_handler = LoggerConfig.create_rotating_handler("frontend.log")
            
            # 設置日誌格式
            formatter = logging.Formatter(
                '%(asctime)s | %(levelname)-8s | %(name)s | [%(session_id)s] | [%(category)s] | %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            frontend_handler.setFormatter(formatter)
            frontend_logger.addHandler(frontend_handler)
            
            # 控制台處理器（根據環境變數控制）
            enable_console = os.getenv('BACKEND_ENABLE_FRONTEND_CONSOLE_LOG', 'false').lower() == 'true'
            if enable_console:
                console_handler = logging.StreamHandler()
                console_handler.setFormatter(formatter)
                frontend_logger.addHandler(console_handler)
        
        return frontend_logger
    
    def _setup_frontend_error_logger(self) -> logging.Logger:
        """設置前端錯誤專用日誌記錄器"""
        error_logger = logging.getLogger('frontend_error')
        error_logger.setLevel(logging.WARNING)
        
        # 避免重複添加處理器
        if not error_logger.handlers:
            # 前端錯誤日誌輪轉處理器
            error_handler = LoggerConfig.create_rotating_handler("frontend_error.log")
            
            # 設置錯誤日誌格式（包含更多詳細資訊）
            formatter = logging.Formatter(
                '%(asctime)s | %(levelname)-8s | FRONTEND_ERROR | [%(session_id)s] | [%(category)s] | %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            error_handler.setFormatter(formatter)
            error_logger.addHandler(error_handler)
            
            # 錯誤日誌控制台處理器（根據環境變數控制）
            enable_console = os.getenv('BACKEND_ENABLE_FRONTEND_CONSOLE_LOG', 'false').lower() == 'true'
            if enable_console:
                console_handler = logging.StreamHandler()
                console_handler.setFormatter(formatter)
                error_logger.addHandler(console_handler)
        
        return error_logger
    
    def process_log_entries(self, log_entries: List[Dict[str, Any]], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """處理前端日誌條目批次
        
        Args:
            log_entries: 日誌條目列表
            metadata: 請求元數據（包含用戶代理、URL等）
            
        Returns:
            Dict[str, Any]: 處理結果統計
        """
        processed_count = 0
        error_count = 0
        category_count = {}
        level_count = {0: 0, 1: 0, 2: 0, 3: 0}  # DEBUG, INFO, WARN, ERROR
        
        # 提取客戶端資訊
        client_info = f"UA: {metadata.get('userAgent', 'Unknown')[:50]}... | URL: {metadata.get('url', 'Unknown')}"
        
        for entry in log_entries:
            try:
                # 驗證日誌條目格式
                if not self._validate_log_entry(entry):
                    error_count += 1
                    continue
                
                # 統計分類和級別
                category = entry.get('category', 'unknown')
                level = entry.get('level', 1)
                
                category_count[category] = category_count.get(category, 0) + 1
                level_count[level] = level_count.get(level, 0) + 1
                
                # 準備日誌資料
                log_data = {
                    'session_id': entry.get('sessionId', 'unknown'),
                    'category': category,
                    'client_info': client_info,
                }
                
                # 格式化日誌訊息
                message = self._format_log_message(entry)
                
                # 記錄日誌
                logging_level = self.log_level_map.get(level, logging.INFO)
                
                if level >= 2:  # WARNING 或 ERROR
                    # 同時記錄到錯誤日誌
                    self.error_logger.log(logging_level, message, extra=log_data)
                
                # 記錄到一般日誌
                self.frontend_logger.log(logging_level, message, extra=log_data)
                
                processed_count += 1
                
            except Exception as e:
                error_count += 1
                logger.error(f"處理前端日誌條目失敗: {e}")
        
        # 更新統計資訊
        self._update_stats(category_count, level_count)
        
        return {
            'processed_count': processed_count,
            'error_count': error_count,
            'category_breakdown': category_count,
            'level_breakdown': level_count,
            'client_info': client_info,
            'timestamp': time.time()
        }
    
    def _validate_log_entry(self, entry: Dict[str, Any]) -> bool:
        """驗證日誌條目格式
        
        Args:
            entry: 日誌條目
            
        Returns:
            bool: 是否有效
        """
        required_fields = ['timestamp', 'level', 'category', 'message']
        
        for field in required_fields:
            if field not in entry:
                return False
        
        # 驗證級別範圍
        level = entry.get('level')
        if not isinstance(level, int) or level < 0 or level > 3:
            return False
        
        return True
    
    def _format_log_message(self, entry: Dict[str, Any]) -> str:
        """格式化日誌訊息
        
        Args:
            entry: 日誌條目
            
        Returns:
            str: 格式化的訊息
        """
        message = entry.get('message', '')
        
        # 添加額外資料
        if 'data' in entry and entry['data']:
            try:
                import json
                data_str = json.dumps(entry['data'], ensure_ascii=False, separators=(',', ':'))
                # 限制資料長度
                if len(data_str) > 500:
                    data_str = data_str[:497] + '...'
                message += f" | Data: {data_str}"
            except:
                message += f" | Data: {str(entry['data'])[:100]}..."
        
        # 添加堆疊追蹤（如果存在）
        if 'stack' in entry and entry['stack']:
            stack_lines = entry['stack'].split('\n')[:5]  # 限制堆疊行數
            message += f" | Stack: {' | '.join(stack_lines)}"
        
        return message
    
    def _update_stats(self, category_count: Dict[str, int], level_count: Dict[int, int]):
        """更新統計資訊
        
        Args:
            category_count: 分類統計
            level_count: 級別統計
        """
        for category, count in category_count.items():
            self.category_stats[category] = self.category_stats.get(category, 0) + count
    
    def get_stats(self) -> Dict[str, Any]:
        """獲取前端日誌統計資訊
        
        Returns:
            Dict[str, Any]: 統計資訊
        """
        return {
            'category_stats': dict(self.category_stats),
            'total_categories': len(self.category_stats),
            'log_files': {
                'frontend_log': str(LOG_CONFIG["LOG_DIR"] / "frontend.log"),
                'frontend_error_log': str(LOG_CONFIG["LOG_DIR"] / "frontend_error.log"),
            },
            'last_updated': time.time()
        }
    
    def clear_stats(self):
        """清除統計資訊"""
        self.category_stats.clear()
    
    def process_log_batch(self, logs: List[Any], metadata: Any) -> Dict[str, Any]:
        """處理前端日誌批次
        
        Args:
            logs: 日誌條目列表
            metadata: 日誌元數據
            
        Returns:
            Dict[str, Any]: 處理結果和統計資訊
        """
        try:
            category_count = {}
            level_count = {}
            processed_count = 0
            error_count = 0
            
            # 處理每個日誌條目
            for log_entry in logs:
                try:
                    # 轉換為字典格式（如果是 Pydantic 模型）
                    if hasattr(log_entry, 'dict'):
                        entry_dict = log_entry.dict()
                    elif hasattr(log_entry, '__dict__'):
                        entry_dict = log_entry.__dict__
                    else:
                        entry_dict = dict(log_entry)
                    
                    # 記錄日誌
                    self._log_entry(entry_dict, metadata)
                    
                    # 更新統計
                    category = entry_dict.get('category', 'unknown')
                    level = entry_dict.get('level', 1)
                    
                    category_count[category] = category_count.get(category, 0) + 1
                    level_count[level] = level_count.get(level, 0) + 1
                    
                    processed_count += 1
                    
                except Exception as e:
                    error_count += 1
                    # 記錄處理錯誤
                    self.error_logger.error(f"處理日誌條目失敗: {str(e)}", extra={
                        'session_id': getattr(metadata, 'sessionId', 'unknown') if hasattr(metadata, 'sessionId') else 'unknown',
                        'category': 'system_error'
                    })
            
            # 更新統計資訊
            self._update_stats(category_count, level_count)
            
            # 返回處理結果
            return {
                'processed_count': processed_count,
                'error_count': error_count,
                'stats': {
                    'category_breakdown': category_count,
                    'level_breakdown': level_count,
                    'session_id': getattr(metadata, 'sessionId', 'unknown') if hasattr(metadata, 'sessionId') else 'unknown',
                    'user_agent': getattr(metadata, 'userAgent', 'unknown') if hasattr(metadata, 'userAgent') else 'unknown',
                    'url': getattr(metadata, 'url', 'unknown') if hasattr(metadata, 'url') else 'unknown'
                }
            }
            
        except Exception as e:
            # 處理批次失敗
            error_msg = f"處理前端日誌批次失敗: {str(e)}"
            self.error_logger.error(error_msg, extra={
                'session_id': 'unknown',
                'category': 'batch_error'
            })
            
            return {
                'processed_count': 0,
                'error_count': len(logs),
                'stats': {},
                'error': error_msg
            }
    
    def _log_entry(self, entry: Dict[str, Any], metadata: Any):
        """記錄單個日誌條目
        
        Args:
            entry: 日誌條目字典
            metadata: 日誌元數據
        """
        try:
            # 獲取日誌級別
            level = entry.get('level', 1)
            log_level = self.log_level_map.get(level, logging.INFO)
            
            # 格式化訊息
            message = self._format_log_message(entry)
            
            # 準備額外資訊
            extra = {
                'session_id': entry.get('sessionId') or getattr(metadata, 'sessionId', 'unknown') if hasattr(metadata, 'sessionId') else 'unknown',
                'category': entry.get('category', 'unknown'),
                'user_id': entry.get('userId') or getattr(metadata, 'userId', 'unknown') if hasattr(metadata, 'userId') else 'unknown'
            }
            
            # 選擇適當的日誌記錄器
            if log_level >= logging.ERROR:
                self.error_logger.log(log_level, message, extra=extra)
            else:
                self.frontend_logger.log(log_level, message, extra=extra)
                
        except Exception as e:
            # 記錄處理失敗的日誌條目
            self.error_logger.error(f"記錄日誌條目失敗: {str(e)} | 原始條目: {str(entry)[:200]}...", extra={
                'session_id': 'unknown',
                'category': 'log_error'
            })


# 全域前端日誌處理器實例
_frontend_log_handler = None

def get_frontend_log_handler() -> FrontendLogHandler:
    """獲取前端日誌處理器單例
    
    Returns:
        FrontendLogHandler: 前端日誌處理器實例
    """
    global _frontend_log_handler
    if _frontend_log_handler is None:
        _frontend_log_handler = FrontendLogHandler()
    return _frontend_log_handler


def get_frontend_log_config():
    """獲取前端日誌配置
    
    Returns:
        前端日誌配置物件
    """
    # 導入在函數內部避免循環導入
    from main import FrontendLogConfig
    
    return FrontendLogConfig(
        enableRemoteLogging=True,
        logLevel=os.getenv('FRONTEND_LOG_LEVEL', 'INFO'),
        batchSize=int(os.getenv('FRONTEND_LOG_BATCH_SIZE', '10')),
        batchInterval=int(os.getenv('FRONTEND_LOG_BATCH_INTERVAL', '30000')),
        maxLocalStorageEntries=int(os.getenv('FRONTEND_MAX_LOCAL_STORAGE_ENTRIES', '100')),
        enabledCategories=os.getenv('FRONTEND_LOG_CATEGORIES', 'api,error,user,performance').split(','),
        maxMessageLength=int(os.getenv('FRONTEND_LOG_MAX_MESSAGE_LENGTH', '1000')),
        enableStackTrace=os.getenv('FRONTEND_LOG_ENABLE_STACK_TRACE', 'false').lower() == 'true'
    )