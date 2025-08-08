#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具函數模組 - 統一管理通用工具函數、日誌系統和錯誤處理
提供系統級通用功能和工具函數，已移除對話歷史管理以提升性能
"""

import logging
import logging.handlers
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import psutil
except ImportError:  # pragma: no cover
    psutil = None

# 統一配置管理系統
from core.settings import settings

# 已移除 LangChain Memory 相關導入，優化性能

logger = logging.getLogger(__name__)

# 日誌輪轉配置參數（使用 Pydantic Settings）
LOG_CONFIG = {
    "MAX_SIZE": settings.LOG_MAX_SIZE,
    "BACKUP_COUNT": settings.LOG_BACKUP_COUNT,
    "LOG_LEVEL": settings.LOG_LEVEL,
    "LOG_DIR": Path(__file__).parent / "logs",
}


class LoggerConfig:
    """統一的日誌配置管理器

    提供標準化的日誌處理器建立和配置管理，支援檔案大小輪轉機制
    """

    @staticmethod
    def create_rotating_handler(
        log_filename: str, max_bytes: int = None, backup_count: int = None
    ) -> logging.handlers.RotatingFileHandler:
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
            encoding="utf-8",
        )

        # 設定格式器
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
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
    def setup_logger(
        logger_name: str, log_filename: str, level: str = None
    ) -> logging.Logger:
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
                        "modified": time.ctime(file_stat.st_mtime),
                    }
                except Exception as e:
                    stats[log_file.name] = {"error": str(e)}

        # 建立可 JSON 序列化的配置副本
        json_safe_config = LOG_CONFIG.copy()
        json_safe_config["LOG_DIR"] = str(
            LOG_CONFIG["LOG_DIR"]
        )  # 將 Path 物件轉換為字串

        return {"config": json_safe_config, "files": stats}

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
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    return handler


def create_ai_logger():
    """建立 AI 操作專用日誌記錄器（使用統一配置）

    Returns:
        logging.Logger: AI 專用日誌記錄器
    """
    return LoggerConfig.setup_logger("ai_operations", "ai.log")


def create_network_logger():
    """建立網路操作專用日誌記錄器（使用統一配置）

    Returns:
        logging.Logger: 網路專用日誌記錄器
    """
    return LoggerConfig.setup_logger("network_operations", "network.log")


# 所有對話歷史和記憶體管理相關函數已完全移除以提升性能
# 包括: ConversationMemoryManager, get_memory_manager, chat_history_*,
# get_conversation_summary, memory_stats, memory_config 等功能


# build_few_shot_examples 函數已移動到 ai_service.py

# build_chat_history_context 函數已移除以提升性能


def format_device_execution_result(
    device_name: str,
    device_ip: str,
    success: bool,
    output: str = None,
    error: str = None,
    execution_time: float = 0.0,
) -> Dict[str, Any]:
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
        "executionTime": execution_time,
    }


def validate_ip_address(ip: str) -> bool:
    """驗證 IP 位址格式

    Args:
        ip: IP 位址字串

    Returns:
        bool: IP 位址是否有效
    """
    try:
        parts = ip.split(".")
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
    dangerous_chars = [";", "&", "|", "`", "$", "(", ")"]
    cleaned = input_str

    for char in dangerous_chars:
        cleaned = cleaned.replace(char, "")

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
        "hit_rate": round(hit_rate, 1),
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

    devices = [device.strip() for device in device_input.split(",")]
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

    return text[: max_length - len(suffix)] + suffix


def get_system_info() -> Dict[str, Any]:
    """取得系統資訊

    Returns:
        Dict[str, Any]: 系統資訊
    """
    return {
        "python_version": sys.version,
        "platform": sys.platform,
        "cpu_count": os.cpu_count(),
        "memory_usage": psutil.virtual_memory()._asdict() if psutil else None,
        "disk_usage": psutil.disk_usage("/")._asdict() if psutil else None,
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
            3: logging.ERROR,
        }

        # 日誌分類統計
        self.category_stats = {}

    def _setup_frontend_logger(self) -> logging.Logger:
        """設置前端一般日誌記錄器"""
        frontend_logger = logging.getLogger("frontend")
        frontend_logger.setLevel(logging.DEBUG)

        # 避免重複添加處理器
        if not frontend_logger.handlers:
            # 前端日誌輪轉處理器
            frontend_handler = LoggerConfig.create_rotating_handler("frontend.log")

            # 設置日誌格式
            formatter = logging.Formatter(
                "%(asctime)s | %(levelname)-8s | %(name)s | [%(session_id)s] | [%(category)s] | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
            frontend_handler.setFormatter(formatter)
            frontend_logger.addHandler(frontend_handler)

            # 控制台處理器（根據 Settings 控制）
            enable_console = settings.BACKEND_ENABLE_FRONTEND_CONSOLE_LOG
            if enable_console:
                console_handler = logging.StreamHandler()
                console_handler.setFormatter(formatter)
                frontend_logger.addHandler(console_handler)

            # 防止日誌向上傳播到根 logger，避免出現在主應用程式日誌中
            frontend_logger.propagate = False

        return frontend_logger

    def _setup_frontend_error_logger(self) -> logging.Logger:
        """設置前端錯誤專用日誌記錄器"""
        error_logger = logging.getLogger("frontend_error")
        error_logger.setLevel(logging.WARNING)

        # 避免重複添加處理器
        if not error_logger.handlers:
            # 前端錯誤日誌輪轉處理器
            error_handler = LoggerConfig.create_rotating_handler("frontend_error.log")

            # 設置錯誤日誌格式（包含更多詳細資訊）
            formatter = logging.Formatter(
                "%(asctime)s | %(levelname)-8s | FRONTEND_ERROR | [%(session_id)s] | [%(category)s] | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
            error_handler.setFormatter(formatter)
            error_logger.addHandler(error_handler)

            # 錯誤日誌控制台處理器（根據 Settings 控制）
            enable_console = settings.BACKEND_ENABLE_FRONTEND_CONSOLE_LOG
            if enable_console:
                console_handler = logging.StreamHandler()
                console_handler.setFormatter(formatter)
                error_logger.addHandler(console_handler)

            # 防止日誌向上傳播到根 logger，避免出現在主應用程式日誌中
            error_logger.propagate = False

        return error_logger

    def process_log_entries(
        self, log_entries: List[Dict[str, Any]], metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
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
                category = entry.get("category", "unknown")
                level = entry.get("level", 1)

                category_count[category] = category_count.get(category, 0) + 1
                level_count[level] = level_count.get(level, 0) + 1

                # 準備日誌資料
                log_data = {
                    "session_id": entry.get("sessionId", "unknown"),
                    "category": category,
                    "client_info": client_info,
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
            "processed_count": processed_count,
            "error_count": error_count,
            "category_breakdown": category_count,
            "level_breakdown": level_count,
            "client_info": client_info,
            "timestamp": time.time(),
        }

    def _validate_log_entry(self, entry: Dict[str, Any]) -> bool:
        """驗證日誌條目格式

        Args:
            entry: 日誌條目

        Returns:
            bool: 是否有效
        """
        required_fields = ["timestamp", "level", "category", "message"]

        for field in required_fields:
            if field not in entry:
                return False

        # 驗證級別範圍
        level = entry.get("level")
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
        message = entry.get("message", "")

        # 添加額外資料
        if "data" in entry and entry["data"]:
            try:
                import json

                data_str = json.dumps(
                    entry["data"], ensure_ascii=False, separators=(",", ":")
                )
                # 限制資料長度
                if len(data_str) > 500:
                    data_str = data_str[:497] + "..."
                message += f" | Data: {data_str}"
            except:
                message += f" | Data: {str(entry['data'])[:100]}..."

        # 添加堆疊追蹤（如果存在）
        if "stack" in entry and entry["stack"]:
            stack_lines = entry["stack"].split("\n")[:5]  # 限制堆疊行數
            message += f" | Stack: {' | '.join(stack_lines)}"

        return message

    def _update_stats(
        self, category_count: Dict[str, int], level_count: Dict[int, int]
    ):
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
            "category_stats": dict(self.category_stats),
            "total_categories": len(self.category_stats),
            "log_files": {
                "frontend_log": str(LOG_CONFIG["LOG_DIR"] / "frontend.log"),
                "frontend_error_log": str(LOG_CONFIG["LOG_DIR"] / "frontend_error.log"),
            },
            "last_updated": time.time(),
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
                    if hasattr(log_entry, "dict"):
                        entry_dict = log_entry.dict()
                    elif hasattr(log_entry, "__dict__"):
                        entry_dict = log_entry.__dict__
                    else:
                        entry_dict = dict(log_entry)

                    # 記錄日誌
                    self._log_entry(entry_dict, metadata)

                    # 更新統計
                    category = entry_dict.get("category", "unknown")
                    level = entry_dict.get("level", 1)

                    category_count[category] = category_count.get(category, 0) + 1
                    level_count[level] = level_count.get(level, 0) + 1

                    processed_count += 1

                except Exception as e:
                    error_count += 1
                    # 記錄處理錯誤
                    self.error_logger.error(
                        f"處理日誌條目失敗: {str(e)}",
                        extra={
                            "session_id": (
                                getattr(metadata, "sessionId", "unknown")
                                if hasattr(metadata, "sessionId")
                                else "unknown"
                            ),
                            "category": "system_error",
                        },
                    )

            # 更新統計資訊
            self._update_stats(category_count, level_count)

            # 返回處理結果
            return {
                "processed_count": processed_count,
                "error_count": error_count,
                "stats": {
                    "category_breakdown": category_count,
                    "level_breakdown": level_count,
                    "session_id": (
                        getattr(metadata, "sessionId", "unknown")
                        if hasattr(metadata, "sessionId")
                        else "unknown"
                    ),
                    "user_agent": (
                        getattr(metadata, "userAgent", "unknown")
                        if hasattr(metadata, "userAgent")
                        else "unknown"
                    ),
                    "url": (
                        getattr(metadata, "url", "unknown")
                        if hasattr(metadata, "url")
                        else "unknown"
                    ),
                },
            }

        except Exception as e:
            # 處理批次失敗
            error_msg = f"處理前端日誌批次失敗: {str(e)}"
            self.error_logger.error(
                error_msg, extra={"session_id": "unknown", "category": "batch_error"}
            )

            return {
                "processed_count": 0,
                "error_count": len(logs),
                "stats": {},
                "error": error_msg,
            }

    def _log_entry(self, entry: Dict[str, Any], metadata: Any):
        """記錄單個日誌條目

        Args:
            entry: 日誌條目字典
            metadata: 日誌元數據
        """
        try:
            # 獲取日誌級別
            level = entry.get("level", 1)
            log_level = self.log_level_map.get(level, logging.INFO)

            # 格式化訊息
            message = self._format_log_message(entry)

            # 準備額外資訊
            extra = {
                "session_id": (
                    entry.get("sessionId") or getattr(metadata, "sessionId", "unknown")
                    if hasattr(metadata, "sessionId")
                    else "unknown"
                ),
                "category": entry.get("category", "unknown"),
                "user_id": (
                    entry.get("userId") or getattr(metadata, "userId", "unknown")
                    if hasattr(metadata, "userId")
                    else "unknown"
                ),
            }

            # 選擇適當的日誌記錄器
            if log_level >= logging.ERROR:
                self.error_logger.log(log_level, message, extra=extra)
            else:
                self.frontend_logger.log(log_level, message, extra=extra)

        except Exception as e:
            # 記錄處理失敗的日誌條目
            self.error_logger.error(
                f"記錄日誌條目失敗: {str(e)} | 原始條目: {str(entry)[:200]}...",
                extra={"session_id": "unknown", "category": "log_error"},
            )


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
    """獲取前端日誌配置（使用 Pydantic Settings）

    Returns:
        前端日誌配置物件
    """
    # 導入在函數內部避免循環導入
    from routers.admin_routes import FrontendLogConfig

    # 使用 Settings 的統一前端日誌配置方法
    config_dict = settings.get_frontend_log_config()

    return FrontendLogConfig(
        enableRemoteLogging=config_dict["enableRemoteLogging"],
        logLevel=config_dict["logLevel"],
        batchSize=config_dict["batchSize"],
        batchInterval=config_dict["batchInterval"],
        maxLocalStorageEntries=config_dict["maxLocalStorageEntries"],
        enabledCategories=config_dict["enabledCategories"],
        maxMessageLength=config_dict["maxMessageLength"],
        enableStackTrace=config_dict["enableStackTrace"],
    )
