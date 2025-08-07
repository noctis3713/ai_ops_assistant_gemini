#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
結果格式化模組 - 統一管理 API 回應格式化邏輯
提供批次執行結果的格式化功能，支援 AI 模式和指令模式的統一處理
"""

from typing import Any, Dict, List, Optional

from config_manager import get_config_manager


def format_ai_results(
    devices: List[str], ai_result: str, execution_time: float = 2.0
) -> Dict[str, Any]:
    """
    格式化 AI 查詢模式的執行結果

    Args:
        devices: 設備 IP 列表
        ai_result: AI 分析結果
        execution_time: 執行時間（預設值）

    Returns:
        格式化的 API 回應字典
    """
    config_manager = get_config_manager()
    results = []

    for device_ip in devices:
        device_name = config_manager.get_device_name_by_ip(device_ip)

        results.append(
            {
                "deviceName": device_name,
                "deviceIp": device_ip,
                "success": True,
                "output": ai_result,
                "error": None,
                "executionTime": execution_time,
            }
        )

    return {
        "results": results,
        "summary": {
            "total": len(devices),
            "successful": len(devices),
            "failed": 0,
            "totalTime": execution_time * len(devices),
        },
    }


def format_command_results(batch_result) -> Dict[str, Any]:
    """
    格式化指令執行模式的批次結果

    Args:
        batch_result: BatchResult 物件，包含執行結果和錯誤資訊

    Returns:
        格式化的 API 回應字典
    """
    config_manager = get_config_manager()
    results = []

    # 處理成功的設備
    for device_ip, device_output in batch_result.results.items():
        device_name = config_manager.get_device_name_by_ip(device_ip)

        results.append(
            {
                "deviceName": device_name,
                "deviceIp": device_ip,
                "success": True,
                "output": device_output,
                "error": None,
                "executionTime": batch_result.execution_time
                / max(batch_result.total_devices, 1),
            }
        )

    # 處理失敗的設備
    for device_ip, error_msg in batch_result.errors.items():
        device_name = config_manager.get_device_name_by_ip(device_ip)

        # 格式化錯誤詳細資訊
        formatted_error = format_error_details(
            error_msg, batch_result.error_details.get(device_ip, {})
        )

        results.append(
            {
                "deviceName": device_name,
                "deviceIp": device_ip,
                "success": False,
                "output": None,
                "error": formatted_error,
                "executionTime": 0.0,
            }
        )

    # 計算統計資訊
    successful = sum(1 for r in results if r["success"])
    failed = len(results) - successful
    total_time = sum(r["executionTime"] for r in results)

    return {
        "results": results,
        "summary": {
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "totalTime": total_time,
            # 移除快取統計 - 已不再使用快取功能
        },
    }


def format_error_details(error_msg: str, error_detail: Dict[str, Any]) -> str:
    """
    格式化錯誤詳細資訊

    Args:
        error_msg: 基本錯誤訊息
        error_detail: 詳細錯誤分類資訊

    Returns:
        格式化的錯誤字串
    """
    formatted_error = f"{error_msg}"

    if error_detail:
        formatted_error += f"\n分類: {error_detail.get('category', '未知')} ({error_detail.get('type', 'unknown')})"
        formatted_error += f"\n嚴重性: {error_detail.get('severity', 'unknown')}"
        formatted_error += f"\n建議: {error_detail.get('suggestion', '請檢查設備狀態')}"

    return formatted_error

# 移除 _format_cache_stats 函數 - 已不再使用快取功能


def create_unified_api_response(
    results: List[Dict[str, Any]], execution_stats: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    創建統一的 API 回應格式

    這是一個通用函數，可用於任何需要標準化 API 回應格式的場景

    Args:
        results: 設備執行結果列表
        execution_stats: 額外的執行統計資訊

    Returns:
        標準化的 API 回應字典
    """
    successful = sum(1 for r in results if r.get("success", False))
    failed = len(results) - successful
    total_time = sum(r.get("executionTime", 0.0) for r in results)

    summary = {
        "total": len(results),
        "successful": successful,
        "failed": failed,
        "totalTime": total_time,
    }

    # 如果有額外的執行統計，合併進去
    if execution_stats:
        summary.update(execution_stats)

    return {"results": results, "summary": summary}
