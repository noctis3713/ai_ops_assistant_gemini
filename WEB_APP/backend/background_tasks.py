#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
背景任務模組

提供非同步背景任務的執行函數

Created: 2025-08-04
Author: Claude Code Assistant
"""

import asyncio
import logging
from typing import List

from ai_service import get_ai_service
from async_task_manager import TaskStatus, get_task_manager
from core.nornir_integration import BatchResult, get_nornir_manager

logger = logging.getLogger(__name__)

async def _handle_ai_request(
    ai_service, query: str, device_ips: List[str] = None
) -> str:
    """統一處理所有 AI 相關請求的輔助函數
    
    Args:
        ai_service: AI 服務實例
        query: 用戶查詢內容
        device_ips: 目標設備 IP 列表（可選）
        
    Returns:
        str: AI 分析結果
        
    Raises:
        Exception: 當 AI 處理失敗時
    """
    try:
        logger.info(f"AI 請求處理開始: query='{query[:50]}...', devices={device_ips}")
        
        # 檢查 AI 服務可用性
        if not ai_service.ai_initialized:
            logger.error("AI 服務未初始化")
            raise Exception("AI 服務未啟用或初始化失敗，請檢查 API 金鑰配置")
        
        # 執行 AI 查詢
        ai_response = await ai_service.query_ai(
            prompt=query,
            device_ips=device_ips
        )
        
        logger.info(f"AI 請求處理完成: response_length={len(ai_response)}")
        return ai_response

    except Exception as e:
        # 使用 AIService 的錯誤分類機制
        error_msg, status_code = ai_service.classify_ai_error(str(e))
        logger.error(f"AI 請求處理失敗: {error_msg} (Query: {query[:50]}...)")
        raise Exception(error_msg)

async def run_batch_task_worker(
    task_id: str, devices: List[str], command: str, mode: str
):
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

        logger.info(
            f"開始執行背景批次任務",
            extra={
                "task_id": task_id,
                "mode": mode,
                "devices_count": len(devices),
                "command": command[:50] + "..." if len(command) > 50 else command,
            },
        )

        if mode == "ai":
            # AI 模式執行
            await task_manager.update_progress(task_id, 10.0, "AI 正在分析需求...")

            try:
                # 直接呼叫 _handle_ai_request
                ai_service = get_ai_service()
                result = await _handle_ai_request(ai_service, query=command, device_ips=devices)
                await task_manager.update_progress(task_id, 90.0, "AI 分析完成")

                # 使用統一的格式化函數處理 AI 結果
                from formatters import format_ai_results

                final_result = format_ai_results(devices, result, execution_time=2.0)

            except Exception as ai_error:
                logger.error(f"AI 模式執行失敗: {ai_error}")
                raise ai_error

        else:
            # 指令模式執行
            await task_manager.update_progress(
                task_id, 20.0, "Nornir 正在執行批次指令..."
            )

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

        logger.info(
            f"背景批次任務執行完成",
            extra={
                "task_id": task_id,
                "successful_devices": final_result["summary"]["successful"],
                "failed_devices": final_result["summary"]["failed"],
                "total_time": final_result["summary"]["totalTime"],
            },
        )

    except Exception as e:
        # 標記任務失敗
        error_msg = str(e)
        await task_manager.fail_task(task_id, error_msg)

        logger.error(
            f"背景批次任務執行失敗",
            extra={"task_id": task_id, "error": error_msg},
            exc_info=True,
        )