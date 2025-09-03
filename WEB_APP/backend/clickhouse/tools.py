#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse LLM 工具化介面模組

為 LLM 提供簡化的 ClickHouse 查詢工具：
- 字串輸入/輸出介面設計
- JSON 格式化回應
- 錯誤處理和友好提示
- 參考 batch_command_wrapper 設計模式

Created: 2025-08-31
Author: Claude Code Assistant  
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional, Union

from .service import get_clickhouse_service, ClickHouseService
from .models import PaginationParams

logger = logging.getLogger(__name__)

# 全域 ClickHouse 服務實例
_clickhouse_service: Optional[ClickHouseService] = None


def _get_service() -> ClickHouseService:
    """獲取 ClickHouse 服務實例"""
    global _clickhouse_service
    if _clickhouse_service is None:
        _clickhouse_service = get_clickhouse_service()
    return _clickhouse_service


def _parse_input_parameters(input_str: str) -> Dict[str, str]:
    """
    解析輸入參數字串
    
    支援格式：
    - "hours:24"
    - "limit:10,hours:1,field:bytes" 
    - "24" (單一數值參數)
    
    Args:
        input_str: 輸入參數字串
        
    Returns:
        Dict[str, str]: 解析後的參數字典
    """
    params = {}
    
    if not input_str or input_str.isspace():
        return params
    
    input_str = input_str.strip()
    
    # 如果是純數字，預設為 hours 參數
    if input_str.isdigit():
        params['hours'] = input_str
        return params
    
    # 解析 key:value 格式
    if ':' in input_str:
        pairs = input_str.split(',')
        for pair in pairs:
            pair = pair.strip()
            if ':' in pair:
                key, value = pair.split(':', 1)
                params[key.strip()] = value.strip()
    
    return params


def _format_llm_response(
    success: bool, 
    data: Any = None, 
    error: str = None,
    execution_time: float = 0.0,
    summary: Dict[str, Any] = None
) -> str:
    """
    格式化 LLM 友好的 JSON 回應
    
    Args:
        success: 執行是否成功
        data: 查詢結果資料
        error: 錯誤訊息
        execution_time: 執行時間（秒）
        summary: 統計摘要
        
    Returns:
        str: JSON 格式的回應字串
    """
    response = {
        "success": success,
        "execution_time_seconds": round(execution_time, 3),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    if success and data is not None:
        response["data"] = data
        
        # 處理空資料集的情況
        if summary is None:
            summary = {}
        
        # 檢查是否為空資料集
        if isinstance(data, list) and len(data) == 0:
            summary["message"] = "Query successful, but no records found for the given parameters."
            summary["is_empty"] = True
        elif isinstance(data, dict) and not data:
            summary["message"] = "Query successful, but no data available for the given parameters."
            summary["is_empty"] = True
        else:
            summary["is_empty"] = False
            
        response["summary"] = summary
    
    if not success and error:
        response["error"] = error
    
    return json.dumps(response, ensure_ascii=False, indent=2, default=str)


def _convert_pydantic_to_dict(obj) -> Any:
    """將 Pydantic 模型轉換為字典"""
    if hasattr(obj, 'dict'):
        return obj.dict()
    elif hasattr(obj, 'model_dump'):
        return obj.model_dump()
    elif isinstance(obj, list):
        return [_convert_pydantic_to_dict(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: _convert_pydantic_to_dict(v) for k, v in obj.items()}
    else:
        return obj


# =============================================================================
# LLM 工具包裝函數
# =============================================================================

def flow_summary_wrapper(hours_str: str = "24") -> str:
    """
    流量概覽統計工具
    
    Args:
        hours_str: 統計時間範圍（小時），預設 "24"
        
    Returns:
        str: JSON 格式的流量概覽統計
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(hours_str)
        hours = int(params.get('hours', '24'))
        
        service = _get_service()
        result = service.get_flow_summary(hours=hours, include_details=False)
        
        data = _convert_pydantic_to_dict(result)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "flow_summary",
                "time_range_hours": hours,
                "total_flows": data.get('total_flows', 0),
                "total_bytes": data.get('total_bytes', 0)
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"流量概覽統計失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"流量概覽統計失敗: {str(e)}",
            execution_time=execution_time
        )


def top_talkers_wrapper(input_str: str = "limit:10,hours:1,field:bytes,type:src") -> str:
    """
    Top N 流量來源/目的地分析工具
    
    Args:
        input_str: 參數字串，格式 "limit:10,hours:1,field:bytes,type:src"
        
    Returns:
        str: JSON 格式的 Top N 分析結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        limit = int(params.get('limit', '10'))
        hours = int(params.get('hours', '1'))
        by_field = params.get('field', 'bytes')
        src_or_dst = params.get('type', 'src')
        
        service = _get_service()
        results = service.get_top_talkers(
            limit=limit,
            hours=hours,
            by_field=by_field,
            src_or_dst=src_or_dst
        )
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        summary = {
            "query_type": "top_talkers",
            "limit": limit,
            "time_range_hours": hours,
            "sort_by": by_field,
            "analysis_type": src_or_dst,
            "result_count": len(results)
        }
        
        # 如果沒有結果，加入明確訊息
        if len(results) == 0:
            summary["context_message"] = f"No traffic data found for {src_or_dst} addresses in the last {hours} hour(s)"
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary=summary
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"Top Talkers 分析失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"Top Talkers 分析失敗: {str(e)}",
            execution_time=execution_time
        )


def protocol_stats_wrapper(input_str: str = "hours:1,limit:10") -> str:
    """
    協定分佈統計工具
    
    Args:
        input_str: 參數字串，格式 "hours:1,limit:10"
        
    Returns:
        str: JSON 格式的協定統計結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '1'))
        limit = int(params.get('limit', '10'))
        
        service = _get_service()
        results = service.get_protocol_distribution(hours=hours, limit=limit)
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        summary = {
            "query_type": "protocol_distribution",
            "time_range_hours": hours,
            "limit": limit,
            "result_count": len(results)
        }
        
        # 如果沒有結果，加入明確訊息
        if len(results) == 0:
            summary["context_message"] = f"No protocol traffic data found in the last {hours} hour(s)"
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary=summary
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"協定統計失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"協定統計失敗: {str(e)}",
            execution_time=execution_time
        )


def geo_location_wrapper(input_str: str = "hours:1,limit:10,country_only:true") -> str:
    """
    地理位置流量分析工具
    
    Args:
        input_str: 參數字串，格式 "hours:1,limit:10,country_only:true"
        
    Returns:
        str: JSON 格式的地理位置統計結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '1'))
        limit = int(params.get('limit', '10'))
        country_only = params.get('country_only', 'true').lower() == 'true'
        
        service = _get_service()
        results = service.get_geolocation_stats(
            hours=hours, 
            limit=limit, 
            by_country_only=country_only
        )
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        summary = {
            "query_type": "geolocation_stats",
            "time_range_hours": hours,
            "limit": limit,
            "country_only": country_only,
            "result_count": len(results)
        }
        
        # 如果沒有結果，加入明確訊息
        if len(results) == 0:
            geo_type = "country" if country_only else "city"
            summary["context_message"] = f"No {geo_type}-level geolocation data found in the last {hours} hour(s)"
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary=summary
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"地理位置統計失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"地理位置統計失敗: {str(e)}",
            execution_time=execution_time
        )


def asn_analysis_wrapper(input_str: str = "hours:1,limit:10,type:src") -> str:
    """
    ASN 自治系統分析工具
    
    Args:
        input_str: 參數字串，格式 "hours:1,limit:10,type:src"
        
    Returns:
        str: JSON 格式的 ASN 分析結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '1'))
        limit = int(params.get('limit', '10'))
        src_or_dst = params.get('type', 'src')
        
        service = _get_service()
        results = service.get_asn_analysis(
            hours=hours, 
            limit=limit, 
            src_or_dst=src_or_dst
        )
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "asn_analysis",
                "time_range_hours": hours,
                "limit": limit,
                "analysis_type": src_or_dst,
                "result_count": len(results)
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"ASN 分析失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"ASN 分析失敗: {str(e)}",
            execution_time=execution_time
        )


def port_stats_wrapper(input_str: str = "hours:1,limit:10,type:dst") -> str:
    """
    埠號流量統計工具
    
    Args:
        input_str: 參數字串，格式 "hours:1,limit:10,type:dst"
        
    Returns:
        str: JSON 格式的埠號統計結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '1'))
        limit = int(params.get('limit', '10'))
        src_or_dst = params.get('type', 'dst')
        
        service = _get_service()
        results = service.get_port_statistics(
            hours=hours, 
            limit=limit, 
            src_or_dst=src_or_dst
        )
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "port_statistics",
                "time_range_hours": hours,
                "limit": limit,
                "analysis_type": src_or_dst,
                "result_count": len(results)
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"埠號統計失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"埠號統計失敗: {str(e)}",
            execution_time=execution_time
        )


def interface_stats_wrapper(input_str: str = "hours:1,limit:10,direction:input") -> str:
    """
    網路介面流量統計工具
    
    Args:
        input_str: 參數字串，格式 "hours:1,limit:10,direction:input"
        
    Returns:
        str: JSON 格式的介面統計結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '1'))
        limit = int(params.get('limit', '10'))
        direction = params.get('direction', 'input')
        
        service = _get_service()
        results = service.get_interface_statistics(
            hours=hours, 
            limit=limit, 
            direction=direction
        )
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "interface_statistics",
                "time_range_hours": hours,
                "limit": limit,
                "direction": direction,
                "result_count": len(results)
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"介面統計失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"介面統計失敗: {str(e)}",
            execution_time=execution_time
        )


def time_series_wrapper(input_str: str = "hours:24,interval:5") -> str:
    """
    時間序列流量資料工具
    
    Args:
        input_str: 參數字串，格式 "hours:24,interval:5"
        
    Returns:
        str: JSON 格式的時間序列資料
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '24'))
        interval_minutes = int(params.get('interval', '5'))
        
        service = _get_service()
        results = service.get_time_series_data(
            hours=hours, 
            interval_minutes=interval_minutes
        )
        
        data = _convert_pydantic_to_dict(results)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "time_series",
                "time_range_hours": hours,
                "interval_minutes": interval_minutes,
                "data_points": len(results)
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"時間序列資料獲取失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"時間序列資料獲取失敗: {str(e)}",
            execution_time=execution_time
        )


def search_flows_wrapper(input_str: str = "hours:1,limit:50,offset:0") -> str:
    """
    流量記錄搜尋工具
    
    Args:
        input_str: 參數字串，支援格式：
                  "hours:1,limit:50,offset:0,src_addr:192.168.1.1,dst_port:80,protocol:6"
        
    Returns:
        str: JSON 格式的搜尋結果
    """
    start_time = time.time()
    
    try:
        params = _parse_input_parameters(input_str)
        hours = int(params.get('hours', '1'))
        limit = int(params.get('limit', '50'))
        offset = int(params.get('offset', '0'))
        
        # 可選的搜尋條件
        src_addr = params.get('src_addr')
        dst_addr = params.get('dst_addr')
        protocol = int(params.get('protocol')) if params.get('protocol') else None
        src_port = int(params.get('src_port')) if params.get('src_port') else None
        dst_port = int(params.get('dst_port')) if params.get('dst_port') else None
        
        service = _get_service()
        pagination = PaginationParams(limit=limit, offset=offset)
        
        result = service.search_flows(
            src_addr=src_addr,
            dst_addr=dst_addr,
            protocol=protocol,
            src_port=src_port,
            dst_port=dst_port,
            hours=hours,
            pagination=pagination
        )
        
        data = _convert_pydantic_to_dict(result)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "flow_search",
                "time_range_hours": hours,
                "total_records": result.total_records if hasattr(result, 'total_records') else 0,
                "returned_records": len(result.data) if hasattr(result, 'data') else 0,
                "search_conditions": {k: v for k, v in params.items() 
                                    if k in ['src_addr', 'dst_addr', 'protocol', 'src_port', 'dst_port'] 
                                    and v is not None}
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"流量搜尋失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"流量搜尋失敗: {str(e)}",
            execution_time=execution_time
        )


def health_check_wrapper(input_str: str = "") -> str:
    """
    ClickHouse 健康檢查工具
    
    Args:
        input_str: 未使用的參數（保持一致的介面）
        
    Returns:
        str: JSON 格式的健康檢查結果
    """
    start_time = time.time()
    
    try:
        service = _get_service()
        result = service.get_health_status()
        
        data = _convert_pydantic_to_dict(result)
        execution_time = time.time() - start_time
        
        return _format_llm_response(
            success=True,
            data=data,
            execution_time=execution_time,
            summary={
                "query_type": "health_check",
                "status": data.get('status', 'unknown')
            }
        )
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"健康檢查失敗: {e}")
        return _format_llm_response(
            success=False,
            error=f"健康檢查失敗: {str(e)}",
            execution_time=execution_time
        )


# =============================================================================
# 輔助函數
# =============================================================================

def get_available_tools() -> Dict[str, str]:
    """
    獲取可用的 ClickHouse LLM 工具清單
    
    Returns:
        Dict[str, str]: 工具名稱到描述的映射
    """
    return {
        "flow_summary_wrapper": "流量概覽統計 - 參數: hours (預設24)",
        "top_talkers_wrapper": "Top N 流量分析 - 參數: limit,hours,field,type",
        "protocol_stats_wrapper": "協定分佈統計 - 參數: hours,limit",
        "geo_location_wrapper": "地理位置流量分析 - 參數: hours,limit,country_only",
        "asn_analysis_wrapper": "ASN 自治系統分析 - 參數: hours,limit,type",
        "port_stats_wrapper": "埠號流量統計 - 參數: hours,limit,type",
        "interface_stats_wrapper": "網路介面統計 - 參數: hours,limit,direction",
        "time_series_wrapper": "時間序列資料 - 參數: hours,interval",
        "search_flows_wrapper": "流量記錄搜尋 - 參數: hours,limit,offset,src_addr,dst_addr,protocol,src_port,dst_port",
        "health_check_wrapper": "ClickHouse 健康檢查 - 無參數"
    }