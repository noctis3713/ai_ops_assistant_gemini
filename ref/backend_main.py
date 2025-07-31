#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 網路運維助理 - WEB 版本主程式
支援單一設備、多設備批次操作和群組設備管理
整合 Google Gemini AI 和 Claude AI 雙引擎智能分析
包含非同步任務處理和進度追蹤功能

Created: 2025-07-27 (v1.0.0)
Updated: 2025-07-31 (v1.0.9) - 健壯的後端與非同步任務處理版本
Author: Claude Code Assistant
"""

import os
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

# 核心模組匯入
from core.network_tools import (
    run_readonly_show_command, 
    get_device_credentials,
    CommandValidator
)
from core.nornir_integration import (
    NornirManager,
    execute_command_on_devices,
    execute_command_on_group,
    get_available_devices,
    get_available_groups
)

# 服務模組匯入
from ai_service import get_ai_service
from config_manager import get_config_manager
from utils import LoggerConfig, format_execution_results
from async_task_manager import (
    get_task_manager, 
    shutdown_task_manager,
    TaskType,
    TaskStatus,
    AsyncTask,
    create_and_run_task
)

# 建立主應用程式日誌記錄器
app_logger = LoggerConfig.setup_logger('main_app', 'app.log')

# =============================================================================
# Pydantic 模型定義
# =============================================================================

class CommandRequest(BaseModel):
    """單一設備指令請求"""
    device_ip: str = Field(..., description="設備 IP 位址")
    command: str = Field(..., description="要執行的指令")

class BatchCommandRequest(BaseModel):
    """批次設備指令請求"""
    device_ips: List[str] = Field(..., description="設備 IP 位址列表")
    command: str = Field(..., description="要執行的指令")

class GroupCommandRequest(BaseModel):
    """群組設備指令請求"""
    group_name: str = Field(..., description="群組名稱")
    command: str = Field(..., description="要執行的指令")

class AIQueryRequest(BaseModel):
    """AI 查詢請求"""
    query: str = Field(..., description="用戶查詢")
    mode: Literal["command", "ai"] = Field(default="ai", description="執行模式")
    devices: Optional[List[str]] = Field(default=None, description="目標設備列表")

class CommandResponse(BaseModel):
    """指令執行回應"""
    success: bool
    output: str
    device_ip: str
    execution_time: float
    error: Optional[str] = None

class BatchExecutionResult(BaseModel):
    """批次執行結果"""
    device_ip: str
    success: bool
    output: str
    execution_time: float
    error: Optional[str] = None

class BatchCommandResponse(BaseModel):
    """批次指令執行回應"""
    total_devices: int
    successful_devices: int
    failed_devices: int
    results: List[BatchExecutionResult]
    total_execution_time: float

class DeviceInfo(BaseModel):
    """設備資訊"""
    ip: str
    hostname: str
    device_type: str
    platform: str

class GroupInfo(BaseModel):
    """群組資訊"""
    name: str
    devices: List[str]
    device_count: int

# 非同步任務相關模型
class TaskRequest(BaseModel):
    """任務建立請求"""
    task_type: str = Field(..., description="任務類型")
    params: Dict[str, Any] = Field(..., description="任務參數")

class TaskResponse(BaseModel):
    """任務回應"""
    task_id: str
    task_type: str
    status: str
    params: Dict[str, Any]
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    progress: Dict[str, Any]
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None

class TaskListResponse(BaseModel):
    """任務列表回應"""
    tasks: List[TaskResponse]
    total_count: int

class TaskStatsResponse(BaseModel):
    """任務統計回應"""
    total_created: int
    total_completed: int
    total_failed: int
    total_cancelled: int
    current_tasks: int
    active_tasks: int
    finished_tasks: int
    cleanup_runs: int
    tasks_cleaned: int

# =============================================================================
# 應用程式生命週期管理
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理器"""
    app_logger.info("🚀 AI 網路運維助理 WEB 服務啟動中...")
    
    try:
        # 初始化任務管理器並啟動清理循環
        task_manager = get_task_manager()
        await task_manager.start_cleanup_loop()
        app_logger.info("✅ 非同步任務管理器已初始化並啟動清理循環")
        
        # 初始化配置管理器
        config_manager = get_config_manager()
        app_logger.info("✅ 配置管理器已初始化")
        
        # 初始化 AI 服務
        ai_service = get_ai_service()
        app_logger.info("✅ AI 服務已初始化")
        
        app_logger.info("🎉 所有服務已成功啟動")
        
        yield  # 應用程式運行階段
        
    finally:
        # 應用程式關閉時的清理工作
        app_logger.info("🔄 正在關閉應用程式...")
        
        try:
            # 關閉任務管理器
            await shutdown_task_manager()
            app_logger.info("✅ 任務管理器已關閉")
            
        except Exception as e:
            app_logger.error(f"❌ 關閉任務管理器時發生錯誤: {e}", exc_info=True)
        
        app_logger.info("👋 AI 網路運維助理 WEB 服務已關閉")

# =============================================================================
# FastAPI 應用程式初始化
# =============================================================================

app = FastAPI(
    title="AI 網路運維助理 WEB API",
    description="提供網路設備管理和 AI 智能分析功能，支援非同步任務處理",
    version="1.0.9",
    lifespan=lifespan
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# 核心端點 - 設備管理
# =============================================================================

@app.get("/devices", response_model=List[DeviceInfo])
async def get_devices():
    """取得可用設備列表"""
    try:
        devices = await get_available_devices()
        app_logger.info(f"已返回 {len(devices)} 個設備資訊")
        return devices
    except Exception as e:
        app_logger.error(f"取得設備列表失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"無法取得設備列表: {str(e)}")

@app.get("/groups", response_model=List[GroupInfo])
async def get_groups():
    """取得可用群組列表"""
    try:
        groups = await get_available_groups()
        app_logger.info(f"已返回 {len(groups)} 個群組資訊")
        return groups
    except Exception as e:
        app_logger.error(f"取得群組列表失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"無法取得群組列表: {str(e)}")

# =============================================================================
# 核心端點 - 指令執行
# =============================================================================

@app.post("/execute", response_model=CommandResponse)
async def execute_command(request: CommandRequest):
    """執行單一設備指令"""
    app_logger.info(f"執行單一設備指令", extra={
        "device_ip": request.device_ip,
        "command": request.command
    })
    
    try:
        # 驗證指令安全性
        if not CommandValidator.validate_command(request.command):
            raise HTTPException(
                status_code=400, 
                detail=f"不安全的指令: {request.command}"
            )
        
        # 執行指令
        result = await run_readonly_show_command(
            device_ip=request.device_ip, 
            command=request.command
        )
        
        app_logger.info(f"單一設備指令執行完成", extra={
            "device_ip": request.device_ip,
            "success": result["success"],
            "execution_time": result["execution_time"]
        })
        
        return CommandResponse(**result)
        
    except Exception as e:
        app_logger.error(f"單一設備指令執行失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-execute", response_model=BatchCommandResponse)
async def batch_execute_command(request: BatchCommandRequest):
    """執行批次設備指令"""
    app_logger.info(f"執行批次設備指令", extra={
        "device_count": len(request.device_ips),
        "command": request.command
    })
    
    try:
        # 驗證指令安全性
        if not CommandValidator.validate_command(request.command):
            raise HTTPException(
                status_code=400, 
                detail=f"不安全的指令: {request.command}"
            )
        
        # 執行批次指令
        results = await execute_command_on_devices(
            device_ips=request.device_ips,
            command=request.command
        )
        
        # 格式化結果
        formatted_results = format_execution_results(results)
        
        app_logger.info(f"批次設備指令執行完成", extra={
            "total_devices": formatted_results["total_devices"],
            "successful_devices": formatted_results["successful_devices"],
            "failed_devices": formatted_results["failed_devices"]
        })
        
        return BatchCommandResponse(**formatted_results)
        
    except Exception as e:
        app_logger.error(f"批次設備指令執行失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/group-execute", response_model=BatchCommandResponse)
async def group_execute_command(request: GroupCommandRequest):
    """執行群組設備指令"""
    app_logger.info(f"執行群組設備指令", extra={
        "group_name": request.group_name,
        "command": request.command
    })
    
    try:
        # 驗證指令安全性
        if not CommandValidator.validate_command(request.command):
            raise HTTPException(
                status_code=400, 
                detail=f"不安全的指令: {request.command}"
            )
        
        # 執行群組指令
        results = await execute_command_on_group(
            group_name=request.group_name,
            command=request.command
        )
        
        # 格式化結果
        formatted_results = format_execution_results(results)
        
        app_logger.info(f"群組設備指令執行完成", extra={
            "group_name": request.group_name,
            "total_devices": formatted_results["total_devices"],
            "successful_devices": formatted_results["successful_devices"],
            "failed_devices": formatted_results["failed_devices"]
        })
        
        return BatchCommandResponse(**formatted_results)
        
    except Exception as e:
        app_logger.error(f"群組設備指令執行失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# AI 查詢端點
# =============================================================================

@app.post("/ai-query")
async def ai_query(request: AIQueryRequest):
    """處理 AI 查詢請求"""
    app_logger.info(f"處理 AI 查詢", extra={
        "query_length": len(request.query),
        "mode": request.mode,
        "devices_count": len(request.devices) if request.devices else 0
    })
    
    try:
        ai_service = get_ai_service()
        
        # 處理 AI 查詢
        result = await ai_service.query_ai(
            query=request.query,
            mode=request.mode,
            devices=request.devices
        )
        
        app_logger.info(f"AI 查詢處理完成", extra={
            "result_length": len(str(result)) if result else 0
        })
        
        return {"result": result}
        
    except Exception as e:
        app_logger.error(f"AI 查詢處理失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# 非同步任務端點 (v1.0.9 新增)
# =============================================================================

@app.post("/tasks", response_model=TaskResponse)
async def create_task(request: TaskRequest):
    """建立新的非同步任務"""
    app_logger.info(f"建立非同步任務", extra={
        "task_type": request.task_type,
        "params_keys": list(request.params.keys())
    })
    
    try:
        task_manager = get_task_manager()
        
        # 根據任務類型建立對應的任務
        if request.task_type == "batch_execute":
            task_type_enum = TaskType.BATCH_EXECUTE
        elif request.task_type == "ai_query":
            task_type_enum = TaskType.AI_QUERY
        elif request.task_type == "health_check":
            task_type_enum = TaskType.HEALTH_CHECK
        else:
            raise HTTPException(status_code=400, detail=f"不支援的任務類型: {request.task_type}")
        
        # 建立任務
        task = await task_manager.create_task(task_type_enum, request.params)
        
        # 啟動背景工作函數
        if request.task_type == "batch_execute":
            asyncio.create_task(_execute_batch_task_worker(task.task_id))
        elif request.task_type == "ai_query":
            asyncio.create_task(_execute_ai_query_task_worker(task.task_id))
        # 可以根據需要添加更多任務類型
        
        app_logger.info(f"非同步任務已建立", extra={
            "task_id": task.task_id,
            "task_type": request.task_type
        })
        
        return TaskResponse(**task.to_dict())
        
    except Exception as e:
        app_logger.error(f"建立非同步任務失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """取得任務狀態"""
    try:
        task_manager = get_task_manager()
        task = await task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"任務 {task_id} 不存在")
        
        return TaskResponse(**task.to_dict())
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"取得任務狀態失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/tasks/{task_id}")
async def cancel_task(task_id: str):
    """取消任務"""
    try:
        task_manager = get_task_manager()
        success = await task_manager.cancel_task(task_id, "用戶取消")
        
        if not success:
            raise HTTPException(status_code=400, detail="無法取消任務")
        
        app_logger.info(f"任務已取消", extra={"task_id": task_id})
        return {"message": "任務已成功取消"}
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"取消任務失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = None,
    task_type: Optional[str] = None,
    limit: Optional[int] = 50
):
    """列出任務"""
    try:
        task_manager = get_task_manager()
        
        # 轉換篩選參數
        status_filter = TaskStatus(status) if status else None
        type_filter = TaskType(task_type) if task_type else None
        
        tasks = await task_manager.list_tasks(
            status_filter=status_filter,
            task_type_filter=type_filter,
            limit=limit
        )
        
        task_responses = [TaskResponse(**task.to_dict()) for task in tasks]
        
        return TaskListResponse(
            tasks=task_responses,
            total_count=len(task_responses)
        )
        
    except Exception as e:
        app_logger.error(f"列出任務失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/stats", response_model=TaskStatsResponse)
async def get_task_stats():
    """取得任務統計資訊"""
    try:
        task_manager = get_task_manager()
        stats = await task_manager.get_stats()
        
        return TaskStatsResponse(**stats)
        
    except Exception as e:
        app_logger.error(f"取得任務統計失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# 非同步任務工作函數 (v1.0.9 新增)
# =============================================================================

async def _execute_batch_task_worker(task_id: str):
    """批次執行任務的工作函數"""
    task_manager = get_task_manager()
    
    try:
        # 更新任務狀態為執行中
        await task_manager.update_task_status(task_id, TaskStatus.RUNNING)
        await task_manager.update_progress(task_id, 0, "準備執行批次指令...")
        
        # 取得任務參數
        task = await task_manager.get_task(task_id)
        if not task:
            raise Exception("任務不存在")
        
        device_ips = task.params.get("device_ips", [])
        command = task.params.get("command", "")
        
        # 驗證參數
        if not device_ips or not command:
            raise Exception("缺少必要參數: device_ips 和 command")
        
        # 驗證指令安全性
        if not CommandValidator.validate_command(command):
            raise Exception(f"不安全的指令: {command}")
        
        await task_manager.update_progress(task_id, 10, "開始執行指令...")
        
        # 執行批次指令
        results = await execute_command_on_devices(
            device_ips=device_ips,
            command=command
        )
        
        await task_manager.update_progress(task_id, 90, "格式化執行結果...")
        
        # 格式化結果
        formatted_results = format_execution_results(results)
        
        # 完成任務
        await task_manager.complete_task(task_id, formatted_results)
        
        app_logger.info(f"批次任務執行完成", extra={
            "task_id": task_id,
            "total_devices": formatted_results["total_devices"],
            "successful_devices": formatted_results["successful_devices"]
        })
        
    except Exception as e:
        app_logger.error(f"批次任務執行失敗: {e}", extra={"task_id": task_id}, exc_info=True)
        await task_manager.fail_task(task_id, str(e))

async def _execute_ai_query_task_worker(task_id: str):
    """AI 查詢任務的工作函數"""
    task_manager = get_task_manager()
    
    try:
        # 更新任務狀態為執行中
        await task_manager.update_task_status(task_id, TaskStatus.RUNNING)
        await task_manager.update_progress(task_id, 0, "準備處理 AI 查詢...")
        
        # 取得任務參數
        task = await task_manager.get_task(task_id)
        if not task:
            raise Exception("任務不存在")
        
        query = task.params.get("query", "")
        mode = task.params.get("mode", "ai")
        devices = task.params.get("devices")
        
        # 驗證參數
        if not query:
            raise Exception("缺少必要參數: query")
        
        await task_manager.update_progress(task_id, 20, "初始化 AI 服務...")
        
        # 取得 AI 服務並處理查詢
        ai_service = get_ai_service()
        
        await task_manager.update_progress(task_id, 40, "正在處理 AI 查詢...")
        
        result = await ai_service.query_ai(
            query=query,
            mode=mode,
            devices=devices
        )
        
        await task_manager.update_progress(task_id, 90, "完成 AI 查詢處理...")
        
        # 完成任務
        await task_manager.complete_task(task_id, {"result": result})
        
        app_logger.info(f"AI 查詢任務執行完成", extra={
            "task_id": task_id,
            "query_length": len(query)
        })
        
    except Exception as e:
        app_logger.error(f"AI 查詢任務執行失敗: {e}", extra={"task_id": task_id}, exc_info=True)
        await task_manager.fail_task(task_id, str(e))

# =============================================================================
# 健康檢查端點
# =============================================================================

@app.get("/health")
async def health_check():
    """健康檢查端點"""
    try:
        # 檢查各個服務的健康狀態
        task_manager = get_task_manager()
        config_manager = get_config_manager()
        ai_service = get_ai_service()
        
        # 取得系統統計資訊
        task_stats = await task_manager.get_stats()
        
        return {
            "status": "healthy",
            "version": "1.0.9",
            "services": {
                "task_manager": "running",
                "config_manager": "running",
                "ai_service": "running"
            },
            "task_stats": {
                "current_tasks": task_stats["current_tasks"],
                "active_tasks": task_stats["active_tasks"]
            }
        }
        
    except Exception as e:
        app_logger.error(f"健康檢查失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="服務不健康")

# =============================================================================
# 應用程式入口點
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    app_logger.info("🚀 啟動 AI 網路運維助理 WEB 服務...")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )