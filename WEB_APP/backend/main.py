"""Web CLI API for network device commands and AI analysis - 重構版本"""

import logging
import asyncio
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# 載入環境變數並輸出載入狀態
env_loaded = load_dotenv("config/.env")
print(f"環境變數載入狀態: {'成功' if env_loaded else '失敗'}")

# 檢查關鍵環境變數
google_api_key = os.getenv("GOOGLE_API_KEY")
ai_provider = os.getenv("AI_PROVIDER", "gemini")
if google_api_key:
    print(f"Google API Key 載入成功: {google_api_key[:10]}...")
else:
    print("WARNING - Google API Key 未載入")
print(f"AI Provider: {ai_provider}")

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

# 導入新的模組化組件
from config_manager import get_config_manager
from ai_service import get_ai_service
from utils import (
    LoggerConfig, create_stream_handler,
    format_device_execution_result, create_ai_logger,
    get_frontend_log_handler, get_frontend_log_config
)
from core.network_tools import run_readonly_show_command, CommandValidator
from core.nornir_integration import (
    get_nornir_manager,
    BatchResult,
    format_batch_result,
    classify_error
)
# 導入非同步任務管理器
from async_task_manager import (
    get_task_manager, 
    shutdown_task_manager,
    TaskStatus, 
    TaskType,
    AsyncTask
)

# 設定 UTF-8 編碼
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# 初始化服務實例
config_manager = get_config_manager()
ai_service = get_ai_service()
ai_logger = create_ai_logger()

# 設定統一日誌系統
app_logger = LoggerConfig.setup_logger('web_app', 'app.log')

# 設定根日誌系統（包含控制台輸出）
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[create_stream_handler()],
    force=True
)

logger = logging.getLogger(__name__)

# 初始化 FastAPI 應用程式
app = FastAPI(
    title="AI 網路維運助理 API",
    description="網路設備指令執行與 AI 智能分析 Web 介面",
    version="1.0.0"
)

# 設定 CORS 中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# 非同步任務管理器生命週期事件
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """應用程式啟動時執行的事件"""
    try:
        task_manager = get_task_manager()
        await task_manager.start_cleanup_loop()
        logger.info("應用程式啟動完成，任務管理器已啟動")
    except Exception as e:
        logger.error(f"啟動事件處理失敗: {e}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_event():
    """應用程式關閉時執行的事件"""
    try:
        await shutdown_task_manager()
        logger.info("應用程式關閉完成，任務管理器已清理")
    except Exception as e:
        logger.error(f"關閉事件處理失敗: {e}", exc_info=True)

# API 請求和回應模型
class ExecuteRequest(BaseModel):
    """設備指令執行請求模型"""
    device_ip: str
    command: str

class AIQueryRequest(BaseModel):
    """AI 查詢請求模型"""
    device_ip: str
    query: str

class DeviceInfo(BaseModel):
    """設備資訊模型"""
    ip: str
    name: str
    model: str
    description: str

class DeviceGroupInfo(BaseModel):
    """設備群組資訊模型"""
    name: str
    description: str
    device_count: int
    platform: str

class BatchExecuteRequest(BaseModel):
    """批次執行請求模型"""
    devices: List[str]
    command: str
    mode: str

class BatchExecutionResult(BaseModel):
    """批次執行結果模型"""
    deviceName: str
    deviceIp: str
    success: bool
    output: str
    error: Optional[str] = None
    executionTime: float

# =============================================================================
# 非同步任務相關模型
# =============================================================================

class TaskCreationResponse(BaseModel):
    """任務建立回應模型"""
    task_id: str
    message: str

class TaskProgressResponse(BaseModel):
    """任務進度回應模型"""
    percentage: float
    current_stage: str
    details: Dict[str, Any] = {}

class TaskResponse(BaseModel):
    """任務狀態回應模型"""
    task_id: str
    task_type: str
    status: str
    params: Dict[str, Any]
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: TaskProgressResponse
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None

# ===================================================================
# 前端日誌相關模型
# ===================================================================

class FrontendLogEntry(BaseModel):
    """前端日誌條目模型"""
    timestamp: str
    level: int  # 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR
    category: str
    message: str
    data: Optional[Dict[str, Any]] = None
    stack: Optional[str] = None
    sessionId: Optional[str] = None
    userId: Optional[str] = None

class FrontendLogMetadata(BaseModel):
    """前端日誌元數據模型"""
    userAgent: str
    url: str
    timestamp: str
    sessionId: Optional[str] = None
    userId: Optional[str] = None

class FrontendLogRequest(BaseModel):
    """前端日誌請求模型"""
    logs: List[FrontendLogEntry]
    metadata: FrontendLogMetadata

class FrontendLogResponse(BaseModel):
    """前端日誌回應模型"""
    success: bool
    message: str
    logCount: int
    processedAt: str
    stats: Optional[Dict[str, Any]] = None

class FrontendLogConfig(BaseModel):
    """前端日誌配置模型"""
    enableRemoteLogging: bool
    logLevel: str
    batchSize: int
    batchInterval: int
    maxLocalStorageEntries: int
    enabledCategories: List[str]
    maxMessageLength: int
    enableStackTrace: bool

class ReloadConfigRequest(BaseModel):
    """配置重載請求模型"""
    api_key: str
    reload_configs: Optional[List[str]] = ["devices", "groups", "security"]  # 預設重載所有配置

class ReloadConfigResponse(BaseModel):
    """配置重載回應模型"""
    success: bool
    message: str
    reloaded_configs: List[str]
    timestamp: str
    errors: Optional[List[str]] = None

# =============================================================================
# 統一的 AI 請求處理輔助函數
# =============================================================================

async def _handle_ai_request(query: str, device_ips: List[str] = None) -> str:
    """統一處理所有 AI 相關請求的輔助函數
    
    這個函數封裝了與 AIService 的互動、錯誤處理和回應格式化。
    AIService 內部會自動處理所有提示詞工程，不需要手動建構。
    
    Args:
        query: 用戶的純粹查詢內容
        device_ips: 相關的設備 IP 列表（可選）
        
    Returns:
        str: AI 分析結果（Markdown 格式）
        
    Raises:
        HTTPException: 當 AI 服務未初始化或查詢失敗時
    """
    if not ai_service.ai_initialized:
        raise HTTPException(status_code=503, detail="AI 服務未啟用或初始化失敗")
    
    try:
        # 直接傳入用戶查詢，讓 AIService 內部處理所有提示詞工程
        # 如果指定了設備 IP，傳遞設備限制
        ai_response = await ai_service.query_ai(
            prompt=query, 
            timeout=40.0,
            device_ips=device_ips
        )
        return ai_response
        
    except Exception as e:
        # 使用 AIService 的錯誤分類機制
        error_msg, status_code = ai_service.classify_ai_error(str(e))
        logger.error(f"AI 請求處理失敗: {error_msg} (Query: {query[:50]}...)")
        raise HTTPException(status_code=status_code, detail=error_msg)

@app.get("/api/devices")
async def get_devices():
    """取得所有設備列表"""
    logger.info("收到獲取設備列表請求")
    
    try:
        config = config_manager.load_devices_config()
        devices = []
        
        for device in config.get("devices", []):
            devices.append(DeviceInfo(
                ip=device["ip"],
                name=device["name"],
                model=device["model"],
                description=device["description"]
            ))
        
        logger.info(f"成功回傳 {len(devices)} 個設備")
        return {"devices": devices}
        
    except Exception as e:
        logger.error(f"獲取設備列表失敗: {e}")
        raise HTTPException(status_code=500, detail=f"獲取設備列表失敗: {str(e)}")

@app.get("/api/device-groups")
async def get_device_groups():
    """取得所有設備群組列表"""
    logger.info("收到獲取設備群組列表請求")
    
    try:
        groups_config = config_manager.load_groups_config()
        devices_config = config_manager.load_devices_config()
        
        groups = []
        
        for group in groups_config.get("groups", []):
            # 計算群組中的設備數量
            if group.get("name") == "cisco_xe_devices":
                # cisco_xe_devices 群組包含所有 Cisco IOS-XE 設備
                device_count = len([
                    device for device in devices_config.get("devices", [])
                    if device.get("device_type") == "cisco_xe" or device.get("os") == "cisco_xe"
                ])
            else:
                # 其他群組的計算邏輯（目前只有 cisco_xe_devices）
                device_count = 0
            
            groups.append(DeviceGroupInfo(
                name=group["name"],
                description=group.get("description", ""),
                device_count=device_count,
                platform=group.get("platform", "cisco_xe")
            ))
        
        logger.info(f"成功回傳 {len(groups)} 個設備群組")
        return {"groups": groups}
        
    except Exception as e:
        logger.error(f"獲取設備群組列表失敗: {e}")
        raise HTTPException(status_code=500, detail=f"獲取設備群組列表失敗: {str(e)}")

@app.post("/api/execute", response_class=PlainTextResponse)
async def execute_command(request: ExecuteRequest):
    """執行網路設備指令"""
    logger.info(f"收到指令執行請求: {request.device_ip} -> {request.command}")
    
    # 指令安全性驗證
    is_safe, error_message = CommandValidator.validate_command(request.command)
    if not is_safe:
        logger.warning(f"拒絕執行不安全指令: {request.command}, 原因: {error_message}")
        raise HTTPException(status_code=400, detail=error_message)
    
    # 驗證設備IP
    try:
        device_config = config_manager.get_device_by_ip(request.device_ip)
        
        if not device_config:
            error_msg = f"設備 {request.device_ip} 不在配置列表中"
            logger.error(error_msg)
            raise HTTPException(status_code=404, detail=error_msg)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(status_code=500, detail="驗證設備配置失敗")
    
    # 執行指令
    try:
        logger.info(f"開始執行指令: {request.device_ip} -> {request.command}")
        
        result = await asyncio.to_thread(
            run_readonly_show_command,
            request.device_ip,
            request.command,
            device_config
        )
        
        logger.info(f"指令執行成功: {request.device_ip} -> {request.command}")
        return result
        
    except Exception as e:
        error_str = str(e)
        logger.error(f"指令執行原始錯誤: {error_str} - {request.device_ip} -> {request.command}")
        
        # 使用統一的錯誤分類機制
        error_detail = classify_error(error_str)
        
        # 根據錯誤分類提供對應的 HTTP 狀態碼
        status_code_map = {
            "connection_timeout": 408,
            "authentication_failed": 401,
            "connection_refused": 503,
            "security_violation": 400,
            "unknown_error": 500
        }
        
        status_code = status_code_map.get(error_detail['type'], 500)
        
        # 構建詳細的錯誤訊息
        error_msg = f"設備 {request.device_ip} 執行失敗: {error_str}\n"
        error_msg += f"分類: {error_detail['category']} ({error_detail['type']})\n"
        error_msg += f"嚴重性: {error_detail['severity']}\n"
        error_msg += f"建議: {error_detail['suggestion']}"
            
        raise HTTPException(status_code=status_code, detail=error_msg)

@app.post("/api/ai-query", response_class=PlainTextResponse)
async def ai_query(request: AIQueryRequest):
    """AI 查詢端點（重構版）"""
    logger.info(f"收到 AI 查詢請求: {request.device_ip} -> {request.query}")
    
    # 驗證設備IP
    try:
        device_config = config_manager.get_device_by_ip(request.device_ip)
        
        if not device_config:
            error_msg = f"設備 {request.device_ip} 不在配置列表中"
            logger.error(error_msg)
            raise HTTPException(status_code=404, detail=error_msg)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(status_code=500, detail="驗證設備配置失敗")
    
    # 直接呼叫統一的 AI 處理函數
    return await _handle_ai_request(
        query=request.query,
        device_ips=[request.device_ip]
    )


# =============================================================================
# 非同步任務背景工作函數
# =============================================================================

async def run_batch_task_worker(task_id: str, devices: List[str], command: str, mode: str):
    """
    執行批次任務的背景工作函數
    
    Args:
        task_id: 任務ID
        devices: 設備列表
        command: 執行指令
        mode: 執行模式 ("command" 或 "ai")
    """
    task_manager = get_task_manager()
    
    try:
        # 更新任務狀態為執行中
        await task_manager.update_task_status(task_id, TaskStatus.RUNNING)
        await task_manager.update_progress(task_id, 5.0, "開始執行批次任務...")
        
        logger.info(f"開始執行背景批次任務", extra={
            "task_id": task_id,
            "mode": mode,
            "devices_count": len(devices),
            "command": command[:50] + "..." if len(command) > 50 else command
        })
        
        if mode == "ai":
            # AI 模式執行
            await task_manager.update_progress(task_id, 10.0, "AI 正在分析需求...")
            
            try:
                # 直接呼叫 _handle_ai_request，不再需要 execute_ai_mode
                result = await _handle_ai_request(query=command, device_ips=devices)
                await task_manager.update_progress(task_id, 90.0, "AI 分析完成")
                
                # 使用統一的格式化函數處理 AI 結果
                from formatters import format_ai_results
                final_result = format_ai_results(devices, result, execution_time=2.0)
                
            except Exception as ai_error:
                logger.error(f"AI 模式執行失敗: {ai_error}")
                raise ai_error
                
        else:
            # 指令模式執行
            await task_manager.update_progress(task_id, 20.0, "Nornir 正在執行批次指令...")
            
            try:
                manager = get_nornir_manager()
                
                # 使用 asyncio.to_thread 在執行緒中運行同步函數
                batch_result: BatchResult = await asyncio.to_thread(
                    manager.run_batch_command, command, devices
                )
                
                await task_manager.update_progress(task_id, 80.0, "處理執行結果...")
                
                # 使用 BatchResult 的新方法轉換為 API 回應格式
                final_result = batch_result.to_api_response()
                
            except Exception as cmd_error:
                logger.error(f"指令模式執行失敗: {cmd_error}")
                raise cmd_error
        
        # 標記任務完成
        await task_manager.complete_task(task_id, final_result)
        
        logger.info(f"背景批次任務執行完成", extra={
            "task_id": task_id,
            "successful_devices": final_result["summary"]["successful"],
            "failed_devices": final_result["summary"]["failed"],
            "total_time": final_result["summary"]["totalTime"]
        })
        
    except Exception as e:
        # 標記任務失敗
        error_msg = str(e)
        await task_manager.fail_task(task_id, error_msg)
        
        logger.error(f"背景批次任務執行失敗", extra={
            "task_id": task_id,
            "error": error_msg
        }, exc_info=True)

# =============================================================================
# 非同步任務 API 端點
# =============================================================================

@app.post("/api/batch-execute-async", response_model=TaskCreationResponse)
async def batch_execute_async(request: BatchExecuteRequest, background_tasks: BackgroundTasks):
    """
    非同步批次執行指令，立即返回任務 ID
    
    這個端點適用於長時間執行的批次操作，避免 HTTP 超時問題。
    用戶可以通過返回的 task_id 查詢任務進度和結果。
    """
    logger.info(f"收到非同步批次執行請求", extra={
        "devices_count": len(request.devices),
        "command": request.command[:50] + "..." if len(request.command) > 50 else request.command,
        "mode": request.mode
    })
    
    # 指令安全性驗證 - AI 模式不需要預先驗證
    if request.mode != "ai":
        is_safe, error_message = CommandValidator.validate_command(request.command)
        if not is_safe:
            logger.warning(f"拒絕執行不安全指令: {request.command}, 原因: {error_message}")
            raise HTTPException(status_code=400, detail=error_message)
    
    # 驗證所有設備IP是否在配置中
    try:
        valid_devices, invalid_devices = config_manager.validate_device_ips(request.devices)
        
        if invalid_devices:
            error_msg = f"以下設備不在配置列表中: {', '.join(invalid_devices)}"
            logger.error(error_msg)
            raise HTTPException(status_code=404, detail=error_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(status_code=500, detail="驗證設備配置失敗")
    
    try:
        # 建立非同步任務
        task_manager = get_task_manager()
        task = await task_manager.create_task(
            task_type=TaskType.BATCH_EXECUTE,
            params={
                "devices": request.devices,
                "command": request.command,
                "mode": request.mode
            }
        )
        
        # 將實際工作交給背景任務
        background_tasks.add_task(
            run_batch_task_worker,
            task.task_id,
            request.devices,
            request.command,
            request.mode
        )
        
        logger.info(f"非同步批次任務已建立", extra={
            "task_id": task.task_id,
            "devices_count": len(request.devices)
        })
        
        return TaskCreationResponse(
            task_id=task.task_id, 
            message="任務已成功建立並在背景執行"
        )
        
    except Exception as e:
        error_msg = f"建立非同步任務失敗: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/api/task/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """
    查詢特定任務的狀態和結果
    
    Args:
        task_id: 任務唯一識別符
        
    Returns:
        TaskResponse: 完整的任務狀態資訊
    """
    task_manager = get_task_manager()
    task = await task_manager.get_task(task_id)
    
    if not task:
        logger.warning(f"查詢不存在的任務: {task_id}")
        raise HTTPException(status_code=404, detail="找不到該任務")
    
    # 將 AsyncTask 轉換為 TaskResponse 格式
    task_dict = task.to_dict()
    
    return TaskResponse(
        task_id=task_dict["task_id"],
        task_type=task_dict["task_type"],
        status=task_dict["status"],
        params=task_dict["params"],
        created_at=task_dict["created_at"],
        started_at=task_dict["started_at"],
        completed_at=task_dict["completed_at"],
        progress=TaskProgressResponse(
            percentage=task_dict["progress"]["percentage"],
            current_stage=task_dict["progress"]["current_stage"],
            details=task_dict["progress"]["details"]
        ),
        result=task_dict["result"],
        error=task_dict["error"],
        execution_time=task_dict["execution_time"]
    )

@app.get("/api/tasks")
async def list_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    limit: Optional[int] = 50
):
    """
    列出任務，支援篩選和分頁
    
    Args:
        status: 狀態篩選 (pending, running, completed, failed, cancelled)
        task_type: 類型篩選 (batch_execute, ai_query, health_check)
        limit: 返回數量限制，預設 50
        
    Returns:
        List[TaskResponse]: 符合條件的任務列表
    """
    task_manager = get_task_manager()
    
    # 轉換篩選參數
    status_filter = None
    if status:
        try:
            status_filter = TaskStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"無效的狀態值: {status}")
    
    task_type_filter = None
    if task_type:
        try:
            task_type_filter = TaskType(task_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"無效的任務類型: {task_type}")
    
    # 查詢任務
    tasks = await task_manager.list_tasks(
        status_filter=status_filter,
        task_type_filter=task_type_filter,
        limit=limit
    )
    
    # 轉換為回應格式
    task_responses = []
    for task in tasks:
        task_dict = task.to_dict()
        task_responses.append(TaskResponse(
            task_id=task_dict["task_id"],
            task_type=task_dict["task_type"],
            status=task_dict["status"],
            params=task_dict["params"],
            created_at=task_dict["created_at"],
            started_at=task_dict["started_at"],
            completed_at=task_dict["completed_at"],
            progress=TaskProgressResponse(
                percentage=task_dict["progress"]["percentage"],
                current_stage=task_dict["progress"]["current_stage"],
                details=task_dict["progress"]["details"]
            ),
            result=task_dict["result"],
            error=task_dict["error"],
            execution_time=task_dict["execution_time"]
        ))
    
    return {
        "tasks": task_responses,
        "total_count": len(task_responses),
        "filters_applied": {
            "status": status,
            "task_type": task_type,
            "limit": limit
        }
    }

@app.delete("/api/task/{task_id}")
async def cancel_task(task_id: str):
    """
    取消指定任務
    
    Args:
        task_id: 任務唯一識別符
        
    Returns:
        取消操作結果
    """
    task_manager = get_task_manager()
    
    success = await task_manager.cancel_task(task_id, "用戶手動取消")
    
    if not success:
        raise HTTPException(status_code=400, detail="任務無法取消（可能已完成或不存在）")
    
    logger.info(f"任務已被用戶取消: {task_id}")
    
    return {
        "message": "任務已成功取消",
        "task_id": task_id
    }

@app.get("/api/task-manager/stats")
async def get_task_manager_stats():
    """
    取得任務管理器統計資訊
    
    Returns:
        任務管理器的統計資訊
    """
    task_manager = get_task_manager()
    stats = await task_manager.get_stats()
    
    return {
        "task_manager_stats": stats,
        "system_info": {
            "python_version": sys.version_info[:3],
            "platform": sys.platform
        }
    }

# ===================================================================
# 前端日誌 API 端點
# ===================================================================

@app.post("/api/frontend-logs", response_model=FrontendLogResponse)
async def receive_frontend_logs(request: FrontendLogRequest):
    """
    接收前端日誌資料
    
    Args:
        request: 包含日誌條目和元數據的請求物件
        
    Returns:
        FrontendLogResponse: 處理結果和統計資訊
    """
    logger.info(f"收到前端日誌請求，包含 {len(request.logs)} 條日誌")
    
    try:
        # 獲取前端日誌處理器
        frontend_log_handler = get_frontend_log_handler()
        
        # 處理日誌批次
        result = frontend_log_handler.process_log_batch(
            logs=request.logs,
            metadata=request.metadata
        )
        
        # 構建回應
        response = FrontendLogResponse(
            success=True,
            message=f"成功處理 {len(request.logs)} 條前端日誌",
            logCount=len(request.logs),
            processedAt=datetime.now().isoformat(),
            stats=result.get('stats', {})
        )
        
        logger.info(f"前端日誌處理完成: {response.logCount} 條日誌")
        return response
        
    except Exception as e:
        error_msg = f"處理前端日誌失敗: {str(e)}"
        logger.error(error_msg)
        
        # 返回錯誤回應
        return FrontendLogResponse(
            success=False,
            message=error_msg,
            logCount=0,
            processedAt=datetime.now().isoformat(),
            stats=None
        )

@app.get("/api/frontend-log-config", response_model=FrontendLogConfig)
async def get_frontend_log_config_endpoint():
    """
    取得前端日誌系統配置
    
    Returns:
        FrontendLogConfig: 前端日誌配置資訊
    """
    logger.info("收到前端日誌配置查詢請求")
    
    try:
        # 導入 utils 模組中的函數，避免名稱衝突
        from utils import get_frontend_log_config
        
        # 獲取前端日誌配置
        config = get_frontend_log_config()
        
        logger.info("成功回傳前端日誌配置")
        return config
        
    except Exception as e:
        error_msg = f"獲取前端日誌配置失敗: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/")
async def root():
    """根路徑，提供API資訊"""
    ai_provider = os.getenv("AI_PROVIDER", "gemini").lower()
    return {
        "message": "Web CLI API 服務運行中",
        "version": "1.0.0",
        "endpoints": {
            "devices": "/api/devices",
            "device-groups": "/api/device-groups",
            "devices-status": "/api/devices/status",
            "execute": "/api/execute",
            "ai-query": "/api/ai-query",
            "ai-status": "/api/ai-status",
            "batch-execute": "/api/batch-execute",
            "batch-execute-async": "/api/batch-execute-async",
            "task-status": "/api/task/{task_id}",
            "tasks": "/api/tasks",
            "cancel-task": "/api/task/{task_id}",
            "task-manager-stats": "/api/task-manager/stats",
            "admin-reload-config": "/api/admin/reload-config"
        },
        "ai_available": ai_service.ai_initialized,
        "ai_provider": ai_provider,
        "search_enabled": False  # 搜索功能暫時停用
    }

@app.get("/api/ai-status")
async def get_ai_status():
    """獲取 AI 服務狀態和配額資訊"""
    logger.info("收到 AI 狀態檢查請求")
    
    try:
        # 獲取 AI 服務詳細狀態
        ai_status = ai_service.get_ai_status()
        
        # 檢查 API 金鑰狀態
        api_key_status = {
            "gemini_configured": bool(os.getenv("GOOGLE_API_KEY")),
            "claude_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
            "current_provider": os.getenv("AI_PROVIDER", "gemini").lower()
        }
        
        # 結合所有資訊
        status_response = {
            **ai_status,
            "api_keys": api_key_status,
            "recommendations": []
        }
        
        # 提供建議
        if not ai_status["ai_initialized"]:
            status_response["recommendations"].append("請檢查 AI API Key 設定是否正確")
        
        if not api_key_status["gemini_configured"] and not api_key_status["claude_configured"]:
            status_response["recommendations"].append("請設定至少一個 AI 提供者的 API Key")
        
        logger.info(f"AI 狀態檢查完成: 初始化={ai_status['ai_initialized']}, 提供者={api_key_status['current_provider']}")
        return status_response
        
    except Exception as e:
        logger.error(f"AI 狀態檢查失敗: {e}")
        raise HTTPException(status_code=500, detail=f"AI 狀態檢查失敗: {str(e)}")

@app.post("/api/batch-execute")
async def batch_execute(request: BatchExecuteRequest):
    """批次執行指令"""
    logger.info(f"收到批次執行請求: {len(request.devices)} 個設備 -> {request.command}")
    
    # 指令安全性驗證 - AI 模式不需要預先驗證，讓 AI Agent 自行選擇安全指令
    if request.mode != "ai":
        is_safe, error_message = CommandValidator.validate_command(request.command)
        if not is_safe:
            logger.warning(f"拒絕執行不安全指令: {request.command}, 原因: {error_message}")
            raise HTTPException(status_code=400, detail=error_message)
    
    # 驗證所有設備IP是否在配置中
    try:
        valid_devices, invalid_devices = config_manager.validate_device_ips(request.devices)
        
        if invalid_devices:
            error_msg = f"以下設備不在配置列表中: {', '.join(invalid_devices)}"
            logger.error(error_msg)
            raise HTTPException(status_code=404, detail=error_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"驗證設備配置失敗: {e}")
        raise HTTPException(status_code=500, detail="驗證設備配置失敗")
    
    # 使用 Nornir 執行批次指令
    try:
        logger.info(f"開始批次執行指令: {request.devices} -> {request.command}")
        
        if request.mode == "ai":
            # AI 模式批次執行 - 使用統一處理函數
            logger.info(f"AI 模式批次執行: {request.devices} -> {request.command}")
            
            # 直接呼叫 _handle_ai_request，不再需要 execute_ai_mode
            ai_response = await _handle_ai_request(
                query=request.command,
                device_ips=request.devices
            )
            
            # 構建AI模式的回應格式 - 每個設備顯示相同的 AI 分析結果
            results = []
            for device_ip in request.devices:
                device_config = config_manager.get_device_by_ip(device_ip)
                device_name = config_manager.get_device_name_safe(device_config, device_ip)
                
                results.append(BatchExecutionResult(
                    deviceName=device_name,
                    deviceIp=device_ip,
                    success=True,
                    output=ai_response,
                    error=None,
                    executionTime=2.0
                ))
        else:
            # 指令模式批次執行 - 直接調用 Nornir 管理器
            from core.nornir_integration import get_nornir_manager
            
            manager = get_nornir_manager()
            batch_result = await asyncio.to_thread(
                manager.run_batch_command,
                request.command,
                request.devices
            )
            
            # 轉換 Nornir 結果格式為 API 回應格式
            results = []
            for device_ip, device_output in batch_result.results.items():
                device_config = config_manager.get_device_by_ip(device_ip)
                device_name = config_manager.get_device_name_safe(device_config, device_ip)
                
                results.append(BatchExecutionResult(
                    deviceName=device_name,
                    deviceIp=device_ip,
                    success=True,  # 如果在 results 中說明執行成功
                    output=device_output,
                    error=None,
                    executionTime=batch_result.execution_time / batch_result.total_devices
                ))
            
            # 處理失敗的設備
            for device_ip, error_msg in batch_result.errors.items():
                device_config = config_manager.get_device_by_ip(device_ip)
                device_name = config_manager.get_device_name_safe(device_config, device_ip)
                
                # 獲取詳細錯誤分類
                error_detail = batch_result.error_details.get(device_ip, {})
                formatted_error = f"{error_msg}"
                if error_detail:
                    formatted_error += f"\n分類: {error_detail.get('category', '未知')} ({error_detail.get('type', 'unknown')})"
                    formatted_error += f"\n嚴重性: {error_detail.get('severity', 'unknown')}"
                    formatted_error += f"\n建議: {error_detail.get('suggestion', '請檢查設備狀態')}"
                
                results.append(BatchExecutionResult(
                    deviceName=device_name,
                    deviceIp=device_ip,
                    success=False,
                    output=None,
                    error=formatted_error,
                    executionTime=0.0
                ))
        
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        total_time = sum(r.executionTime for r in results)
        
        logger.info(f"批次執行完成: {successful} 成功, {failed} 失敗")
        
        # 構建摘要，包含快取統計（如果可用）
        summary = {
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "totalTime": total_time
        }
        
        # 如果不是 AI 模式，加入快取統計
        if request.mode != "ai" and 'batch_result' in locals():
            if hasattr(batch_result, 'cache_hits') and hasattr(batch_result, 'cache_misses'):
                cache_total = batch_result.cache_hits + batch_result.cache_misses
                if cache_total > 0:
                    summary["cacheStats"] = {
                        "hits": batch_result.cache_hits,
                        "misses": batch_result.cache_misses,
                        "hitRate": round((batch_result.cache_hits / cache_total) * 100, 1)
                    }
        
        return {
            "results": results,
            "summary": summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e)
        logger.error(f"批次執行失敗: {error_str}")
        
        # 分析錯誤類型
        if "timeout" in error_str.lower():
            error_msg = f"批次執行超時 - 部分設備連接超時，請檢查網路狀況"
            status_code = 408
        elif "authentication" in error_str.lower():
            error_msg = f"批次執行認證失敗 - 請檢查設備憑證設定"
            status_code = 401
        else:
            error_msg = f"批次執行失敗: {error_str}"
            status_code = 500
            
        raise HTTPException(status_code=status_code, detail=error_msg)


@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {"status": "healthy", "message": "API 服務運行正常"}

@app.get("/api/devices/status")
async def get_devices_status():
    """檢查所有設備的連線狀態"""
    logger.info("收到設備狀態檢查請求")
    
    try:
        config = config_manager.load_devices_config()
        devices_status = []
        
        # 使用 Nornir 管理器進行健康檢查
        from core.nornir_integration import get_nornir_manager
        
        manager = get_nornir_manager()
        device_ips = [device["ip"] for device in config.get("devices", [])]
        
        # 執行健康檢查
        health_results = await asyncio.to_thread(
            manager.health_check_devices,
            device_ips
        )
        
        # 構建回應
        for device in config.get("devices", []):
            device_ip = device["ip"]
            is_healthy = health_results.get(device_ip, False)
            
            devices_status.append({
                "ip": device_ip,
                "name": device["name"],
                "model": device["model"],
                "status": "online" if is_healthy else "offline",
                "last_checked": time.time()
            })
        
        online_count = sum(1 for status in devices_status if status["status"] == "online")
        total_count = len(devices_status)
        
        logger.info(f"設備狀態檢查完成: {online_count}/{total_count} 台設備在線")
        
        return {
            "devices": devices_status,
            "summary": {
                "total": total_count,
                "online": online_count,
                "offline": total_count - online_count,
                "checked_at": time.time()
            }
        }
        
    except Exception as e:
        logger.error(f"設備狀態檢查失敗: {e}")
        raise HTTPException(status_code=500, detail=f"設備狀態檢查失敗: {str(e)}")

@app.get("/api/devices/{device_ip}/status")
async def get_device_status(device_ip: str):
    """檢查特定設備的連線狀態"""
    logger.info(f"收到設備 {device_ip} 狀態檢查請求")
    
    try:
        # 驗證設備是否在配置中
        device_config = config_manager.get_device_by_ip(device_ip)
        if not device_config:
            raise HTTPException(status_code=404, detail=f"設備 {device_ip} 不在配置列表中")
        
        # 使用 Nornir 管理器進行健康檢查
        from core.nornir_integration import get_nornir_manager
        
        manager = get_nornir_manager()
        health_results = await asyncio.to_thread(
            manager.health_check_devices,
            [device_ip]
        )
        
        is_healthy = health_results.get(device_ip, False)
        
        result = {
            "ip": device_ip,
            "name": device_config["name"],
            "model": device_config["model"],
            "status": "online" if is_healthy else "offline",
            "last_checked": time.time(),
            "details": {
                "ping_successful": is_healthy,
                "ssh_accessible": is_healthy
            }
        }
        
        logger.info(f"設備 {device_ip} 狀態檢查完成: {'在線' if is_healthy else '離線'}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"設備 {device_ip} 狀態檢查失敗: {e}")
        raise HTTPException(status_code=500, detail=f"設備狀態檢查失敗: {str(e)}")

# =============================================================================
# 管理 API 端點
# =============================================================================

@app.post("/api/admin/reload-config", response_model=ReloadConfigResponse)
async def reload_config_endpoint(request: ReloadConfigRequest):
    """
    重載配置檔案（管理員功能）
    
    這個端點允許在不重啟服務的情況下重新載入配置檔案，
    適用於生產環境中需要更新設備清單或安全規則的場景。
    
    Args:
        request: 包含 API Key 和要重載的配置類型
        
    Returns:
        ReloadConfigResponse: 重載結果和詳細資訊
    """
    logger.info(f"收到配置重載請求: {request.reload_configs}")
    
    # 簡單的 API Key 驗證
    expected_api_key = os.getenv('ADMIN_API_KEY', 'admin123')  # 生產環境應使用強密碼
    if request.api_key != expected_api_key:
        logger.warning("配置重載請求 - API Key 驗證失敗")
        raise HTTPException(status_code=401, detail="無效的 API Key")
    
    reloaded_configs = []
    errors = []
    
    try:
        # 重載設備配置
        if "devices" in request.reload_configs:
            try:
                config_manager.load_devices_config()
                reloaded_configs.append("devices")
                logger.info("設備配置已重新載入")
            except Exception as e:
                error_msg = f"設備配置重載失敗: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        # 重載群組配置
        if "groups" in request.reload_configs:
            try:
                config_manager.load_groups_config()
                reloaded_configs.append("groups")
                logger.info("群組配置已重新載入")
            except Exception as e:
                error_msg = f"群組配置重載失敗: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        # 重載安全配置
        if "security" in request.reload_configs:
            try:
                config_manager.load_security_config()
                # 清除 CommandValidator 的快取配置
                from core.network_tools import CommandValidator
                CommandValidator.reload_security_config()
                reloaded_configs.append("security")
                logger.info("安全配置已重新載入")
            except Exception as e:
                error_msg = f"安全配置重載失敗: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        # 判斷整體成功狀態
        success = len(reloaded_configs) > 0 and len(errors) == 0
        
        response = ReloadConfigResponse(
            success=success,
            message="配置重載完成" if success else "配置重載部分失敗",
            reloaded_configs=reloaded_configs,
            timestamp=datetime.now().isoformat(),
            errors=errors if errors else None
        )
        
        if success:
            logger.info(f"配置重載成功: {reloaded_configs}")
        else:
            logger.warning(f"配置重載部分失敗: 成功={reloaded_configs}, 錯誤={errors}")
        
        return response
        
    except Exception as e:
        error_msg = f"配置重載過程發生未預期錯誤: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

# 對話歷史 API 已移除以提升性能



if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Web CLI API service...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # 停用自動重載以避免持續產生日誌
        log_level="info"
    )