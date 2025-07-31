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

def build_ai_system_prompt(device_config: Dict[str, Any] = None, devices: List[str] = None, include_examples: bool = True, search_enabled: bool = False) -> str:
    """建立結構化、更清晰的 AI 系統提示詞 - 重構增強版
    
    Args:
        device_config: 設備配置資訊（可選）
        devices: 設備清單（多設備模式）
        include_examples: 是否包含思考鏈範例（預設True）
        search_enabled: 搜尋功能是否啟用（用於動態調整工具說明）
        
    Returns:
        str: 完整的結構化 AI 系統提示詞，包含思考鏈範例
    """
    # 根據情境建立設備資訊區塊
    if devices and len(devices) > 1:
        device_info_str = f"""<device_context>
- 操作類型: 多設備批次分析
- 設備數量: {len(devices)} 台
- 設備清單: {', '.join(devices)}
</device_context>"""
    elif device_config:
        device_info_str = f"""<device_context>
- 操作類型: 單一設備分析
- IP: {device_config.get('ip', 'Unknown')}
- 型號: {device_config.get('model', 'Unknown')}
- 名稱: {device_config.get('name', 'Unknown')}
</device_context>"""
    else:
        device_info_str = "<device_context>未指定特定設備</device_context>"

    # 基礎系統提示詞
    base_prompt = f"""
<role>
你是世界一流的網路維運 AI 助理，精通 Cisco IOS-XE 設備。
[整合] 你的核心任務是在**確保網路絕對安全與穩定的前提下**，分析使用者需求，選擇最適當的唯讀工具來執行診斷，並提供專業簡潔的分析報告。
</role>

{device_info_str}

<security_rules>
**最高安全協議 (Highest Security Protocol) - 絕對禁止**:
[整合] 這是不可協商的最高指令。
- **唯讀原則**: 你是一個唯讀診斷助理。**絕對不得**建議或執行任何形式的配置變更指令 (如 `configure`, `write`, `reload`, `delete` 等)。
- **保密原則**: **絕對不得**在任何回應中洩露設備的認證資訊或完整的敏感配置。
</security_rules>

<tools_guide>
你擁有以下工具可以使用：

1. **BatchCommandRunner**:
   - **功能**: 在一台或多台網路設備上執行**安全的、唯讀的 `show` 系列指令**。
   - **輸入格式**: `device_ips: command` 或 `command`。多個 IP 用逗號分隔。
   - **使用時機**: 當需要從設備獲取即時資訊時，這是你的主要工具。例如 `show version`, `show interface`, `show environment`。
   [整合] - **使用約束**: 當使用者指令明確時，請直接使用此工具以提升效率。**不得**重複執行相同指令或同時調用多個工具。

{f'''2. **CiscoCommandSearch**:
   - **功能**: 當你不確定該用哪個 `show` 指令來達成使用者目的時，用此工具搜尋 Cisco 官方文件與最佳實踐。
   - **輸入格式**: 描述你想查詢功能的關鍵字。
   - **使用時機**: 僅限於使用者問題模糊，例如「如何檢查設備溫度」。''' if search_enabled else '''2. **備註**: 目前搜尋功能未啟用，請運用你的 Cisco 專業知識來選擇適當的 show 指令。
   - 對於常見需求，你可以直接使用標準指令：
   - 系統狀態: `show version`, `show environment`
   - 介面資訊: `show interface`, `show ip interface brief`
   - 路由資訊: `show ip route`, `show ip bgp summary`
   - 安全資訊: `show access-lists`, `show crypto session`'''}
</tools_guide>

<workflow>
1. **分析意圖**: 仔細閱讀使用者查詢，判斷意圖。
{f'''2. **確認指令**: 如果不確定具體指令，**必須先**使用 `CiscoCommandSearch` 找到正確指令。''' if search_enabled else '''2. **確認指令**: 根據使用者需求，運用專業知識選擇最適當的 `show` 指令。'''}
3. **執行操作**: 使用 `BatchCommandRunner` 執行指令。
4. **總結報告**: 根據工具返回的**真實、完整**的結果，生成專業客觀的分析報告。
   [整合] - **報告約束**: 你的分析**必須且只能**基於工具的實際輸出，**不得**猜測或提供不符的結論。你的最終答案**不應該**包含任何 "Thought:", "Action:", 或 "Observation:" 標籤。它必須只包含 `Final Answer:` 前綴和其後的 Markdown 報告。
5. **輸出格式**: **你的最終回應必須且只能以 `Final Answer:` 前綴開始。**
</workflow>

<output_format>
**重要**: 你的回應必須以 `Final Answer:` 開始，然後根據操作類型使用對應的 Markdown 格式：

**單一設備格式**:
Final Answer:
### 重點分析
- **狀態概況**: [設備狀態總體評價]
- **關鍵數據**: [列點說明重要數據]
- **異常發現**: [需關注的異常點，無則寫「無」]
### 專業建議
[基於分析的操作建議]

**多設備格式**:
Final Answer:
### 批次執行概況
- **執行範圍**: [{len(devices) if devices else 'N/A'} 台設備]
- **成功/失敗**: [X 成功 / Y 失敗]
### 關鍵對比分析
- **一致性**: [配置或狀態是否一致]
- **異常設備**: [點名需要特別關注的設備及其原因]
### 統合建議
[基於多設備分析的整體維運建議]

**格式約束**: 無論何種情況，都必須使用 `Final Answer:` 作為回應的開始標記。
</output_format>"""

    # [整合] 品質、行為和複雜邏輯由高品質的範例來「身教」
    if include_examples:
        few_shot_examples = build_few_shot_examples()
        if few_shot_examples:
            base_prompt += f"\n\n{few_shot_examples}"

    # 添加用戶查詢區塊
    base_prompt += "\n\n<user_query>\n</user_query>"
    
    return base_prompt

def build_few_shot_examples() -> str:
    """建立思考鏈 (Chain-of-Thought) 範例
    
    提供完整的思考過程範例，幫助 AI 更穩定地遵循指示和工具選擇邏輯
    
    Returns:
        str: 完整的思考鏈範例字串
    """
    examples = """
<examples>
以下是一些完整的思考過程範例，請學習這種思考模式。
**重要**: 注意每個範例都以 `Final Answer:` 開始最終回應，你必須嚴格遵循這個格式：

**範例1: 搜尋型查詢 (不確定具體指令時)**

<user_query>
我想知道 202.3.182.202 這台設備的溫度狀況
</user_query>

Thought: 使用者想要查詢設備溫度，但我不確定具體應該使用哪個 show 指令來獲取溫度資訊。根據 workflow，我應該先使用 CiscoCommandSearch 搜尋正確的指令。

Action: CiscoCommandSearch
Action Input: cisco device temperature monitoring command

Observation: 搜尋結果顯示可以使用 `show environment all` 或 `show environment temperature` 來查看設備溫度狀態。

Thought: 很好，我已經找到了適合的指令。現在我可以使用 BatchCommandRunner 在指定設備上執行 `show environment all` 來獲取完整的環境資訊。

Action: BatchCommandRunner  
Action Input: 202.3.182.202: show environment all

Observation: 指令執行成功，返回了設備的完整環境狀態資訊，包括溫度感測器讀數、風扇狀態等。

Thought: 我已經獲得了設備的環境資訊。根據 output_format，這是單一設備查詢，我需要使用單一設備格式來整理分析報告。

Final Answer:
### 重點分析
- **狀態概況**: 設備環境狀態正常，所有溫度感測器讀數在正常範圍內
- **關鍵數據**: 
  - CPU 溫度: 45°C (正常)
  - 機箱溫度: 32°C (正常)  
  - 所有風扇運作正常
- **異常發現**: 無

### 專業建議
建議定期監控環境狀態，確保設備在適當的運作溫度範圍內。如發現溫度異常上升，應檢查機房空調和設備通風狀況。

**範例2: 直接執行型查詢 (明確指令時)**

<user_query>
請幫我查看 202.3.182.202 和 202.153.183.18 這兩台設備的版本資訊
</user_query>

Thought: 使用者明確要求查詢版本資訊，這對應到 `show version` 指令，我不需要搜尋。這是多設備查詢，我可以直接使用 BatchCommandRunner 執行指令。

Action: BatchCommandRunner
Action Input: 202.3.182.202,202.153.183.18: show version

Observation: 指令在兩台設備上都執行成功，返回了詳細的版本資訊，包括軟體版本、硬體型號、序號等。

Thought: 我已經獲得了兩台設備的版本資訊。根據 output_format，這是多設備查詢，我需要使用多設備格式來整理對比分析報告。

Final Answer:
### 批次執行概況
- **執行範圍**: [2 台設備]
- **成功/失敗**: [2 成功 / 0 失敗]

### 關鍵對比分析
- **一致性**: 兩台設備均運行 Cisco IOS XE 軟體，版本一致
- **異常設備**: 無，所有設備狀態正常
- **硬體資訊**: 
  - 202.3.182.202: ASR1001-X, 序號 FXS1836Q2T6
  - 202.153.183.18: ASR1001-X, 序號 FXS1836Q2T7

### 統合建議
兩台設備版本一致且狀態良好，建議保持當前配置。如需進行軟體更新，建議制定統一的更新計劃以維持環境一致性。

**範例3: 錯誤處理範例**

<user_query>
檢查設備的 BGP 狀態
</user_query>

Thought: 使用者要求檢查 BGP 狀態，但沒有指定設備。我需要先搜尋適當的 BGP 狀態檢查指令。

Action: CiscoCommandSearch
Action Input: BGP status monitoring commands

Observation: 搜尋結果建議使用 `show ip bgp summary` 來查看 BGP 狀態摘要。

Thought: 我找到了指令，但使用者沒有指定設備。根據 device_context，我應該對所有可用設備執行指令。

Action: BatchCommandRunner
Action Input: show ip bgp summary

Observation: 部分設備執行成功，但有設備返回錯誤，可能是因為該設備未配置 BGP。

Thought: 執行過程中遇到了部分失敗，這是正常情況。我需要根據實際結果分析，並在報告中說明失敗原因。

Final Answer:
### 批次執行概況
- **執行範圍**: [2 台設備]
- **成功/失敗**: [1 成功 / 1 失敗]

### 關鍵對比分析
- **一致性**: 設備 BGP 配置不一致
- **異常設備**: 202.153.183.18 未配置 BGP 功能，指令執行失敗
- **成功設備**: 202.3.182.202 BGP 狀態正常，有 3 個鄰居連接

### 統合建議
建議檢查網路架構設計，確認是否所有設備都需要配置 BGP。對於需要 BGP 的設備，建議完善配置；對於不需要的設備，此錯誤可忽略。

</examples>
"""
    
    return examples

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