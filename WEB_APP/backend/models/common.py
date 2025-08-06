#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統一的通用資料模型 - 企業級回應格式和共用類型定義

此檔案提供所有 API 端點使用的統一回應格式，確保：
- 完整的型別安全支援
- 自動時間戳記產生  
- 標準化錯誤代碼
- IDE 智能提示支援

Created: 2025-08-06
Author: Claude Code Assistant
"""

from typing import Any, Dict, List, Literal, Optional, TypeVar, Generic
from pydantic import BaseModel, Field
from datetime import datetime


# 泛型類型變數
T = TypeVar("T")


class BaseResponse(BaseModel, Generic[T]):
    """統一的 API 回應格式 - 企業級 Generic[T] 實現
    
    所有 API 端點都應該使用此格式包裝回應資料，確保：
    - 統一的成功/失敗標識
    - 可選的資料載荷 (Generic[T] 型別安全)
    - 標準化的錯誤訊息和錯誤代碼
    - 自動時間戳記
    
    特色功能:
    - 完整的型別安全支援
    - 自動時間戳記產生  
    - 標準化錯誤代碼
    - IDE 智能提示支援
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: Optional[str] = None

    def __init__(self, **data):
        # 自動產生時間戳記，確保每個回應都有時間資訊
        if "timestamp" not in data or data["timestamp"] is None:
            data["timestamp"] = datetime.now().isoformat()
        super().__init__(**data)
    
    class Config:
        """Pydantic 配置類別"""
        arbitrary_types_allowed = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
        json_schema_extra = {
            "example": {
                "success": True,
                "data": "<Generic[T] type data>",
                "message": "操作成功完成",
                "error_code": None,
                "timestamp": "2025-08-06T10:30:15.123456"
            }
        }

    @classmethod
    def success_response(
        cls,
        data: Optional[T] = None,
        message: str = "操作成功完成"
    ) -> "BaseResponse[T]":
        """建立成功回應的便利方法
        
        Args:
            data: 回應資料
            message: 成功訊息
            
        Returns:
            BaseResponse[T]: 成功格式的回應
        """
        return cls(
            success=True,
            data=data,
            message=message
        )
    
    @classmethod
    def error_response(
        cls,
        message: str,
        error_code: Optional[str] = None,
        data: Optional[T] = None
    ) -> "BaseResponse[T]":
        """建立錯誤回應的便利方法
        
        Args:
            message: 錯誤訊息
            error_code: 標準化錯誤代碼
            data: 可選的錯誤詳細資料
            
        Returns:
            BaseResponse[T]: 錯誤格式的回應
        """
        return cls(
            success=False,
            data=data,
            message=message,
            error_code=error_code
        )