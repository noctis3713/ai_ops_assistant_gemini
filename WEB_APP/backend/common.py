#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
統一的通用資料模型 - 企業級回應格式和共用類型定義

此檔案整合了：
- 統一 API 回應格式
- AI 分析結果模型
- 共用類型定義

確保：
- 完整的型別安全支援
- 自動時間戳記產生
- 標準化錯誤代碼
- IDE 智能提示支援

Created: 2025-08-06
Updated: 2025-08-23 (合併 ai_response.py)
Author: Claude Code Assistant
"""

from datetime import datetime
from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, Field

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
                "timestamp": "2025-08-06T10:30:15.123456",
            }
        }

    @classmethod
    def success_response(
        cls, data: Optional[T] = None, message: str = "操作成功完成"
    ) -> "BaseResponse[T]":
        """建立成功回應的便利方法

        Args:
            data: 回應資料
            message: 成功訊息

        Returns:
            BaseResponse[T]: 成功格式的回應
        """
        return cls(success=True, data=data, message=message)

    @classmethod
    def error_response(
        cls, message: str, error_code: Optional[str] = None, data: Optional[T] = None
    ) -> "BaseResponse[T]":
        """建立錯誤回應的便利方法

        Args:
            message: 錯誤訊息
            error_code: 標準化錯誤代碼
            data: 可選的錯誤詳細資料

        Returns:
            BaseResponse[T]: 錯誤格式的回應
        """
        return cls(success=False, data=data, message=message, error_code=error_code)


# =============================================================================
# AI 分析結果模型 (原 ai_response.py)
# =============================================================================


class NetworkAnalysisResponse(BaseModel):
    """AI 對網路設備診斷結果的結構化回應

    這個模型定義了 AI 分析網路設備後應返回的標準格式，
    每個欄位都有詳細的描述來引導 LLM 產出精確的內容。
    """

    analysis_summary: str = Field(
        description="""整體分析總結。
        應該是對所有細節的綜合判斷，而非取代細節。
        例如：'設備運行穩定，所有環境參數在正常範圍，無異常趨勢' 或 '發現效能瓶頸和溫度警告，需要關注'"""
    )

    key_findings: List[str] = Field(
        description="""從工具輸出中提取的關鍵數據點和發現。
        遵循「具體優於概括」原則：
        - 包含實際測量值和單位
        - 提供必要的上下文（如正常範圍、時間點等）
        - 涵蓋輸出中的所有重要資訊
        目標：讓讀者能完整了解設備狀態，而非只看到摘要。
        建議 5-10 項，視資訊豐富度而定。"""
    )

    anomalies: List[str] = Field(
        description="明確指出的異常或潛在問題點，每項描述一個具體的異常情況。例如：'溫度感測器顯示 85°C，超過正常範圍'、'介面 GigabitEthernet0/1 狀態為 DOWN'。如果沒有發現異常，此列表應為空陣列 []。"
    )

    recommendations: List[str] = Field(
        description="基於分析結果，提供給網路工程師的具體、可操作的後續步驟或建議。每項建議都應該是具體可執行的，例如：'建議檢查機房空調系統'、'建議更換故障的介面模組'、'建議升級韌體版本'。如果系統狀態良好，可以提供預防性維護建議。"
    )

    device_count: Optional[int] = Field(
        description="此次分析涉及的設備數量，用於區分單設備分析或多設備批次分析。單設備分析時為 1，多設備分析時為實際設備數量。"
    )

    successful_device_count: Optional[int] = Field(
        None,
        description="成功執行指令的設備數量，僅在多設備分析時使用。**重要**：必須從 BatchCommandRunner 回傳結果的 summary.successful_devices 中提取此數值，不可猜測或計算。",
    )

    failed_device_count: Optional[int] = Field(
        None,
        description="執行指令失敗的設備數量，僅在多設備分析時使用。**重要**：必須從 BatchCommandRunner 回傳結果的 summary.failed_devices 中提取此數值，不可猜測或計算。",
    )

    analysis_type: Literal["single_device", "multi_device"] = Field(
        description="分析類型，根據設備數量自動判斷：'single_device' 表示單一設備分析，'multi_device' 表示多設備批次分析"
    )

    def to_markdown(self) -> str:
        """將 Pydantic 物件轉換為格式化的 Markdown 字串

        這個方法將結構化的分析結果轉換回前端需要的 Markdown 格式，
        保持與現有用戶界面的完全相容性。

        Returns:
            str: 格式化的 Markdown 字串，符合現有前端顯示規範
        """
        # 根據分析類型選擇不同的 Markdown 模板
        if self.analysis_type == "multi_device":
            return self._to_multi_device_markdown()
        else:
            return self._to_single_device_markdown()

    def _to_single_device_markdown(self) -> str:
        """單一設備分析的 Markdown 格式"""
        output = "### 重點分析\n"
        output += f"- **狀態概況**: {self.analysis_summary}\n"

        output += "- **關鍵數據**:\n"
        if self.key_findings:
            for finding in self.key_findings:
                output += f"  - {finding}\n"
        else:
            output += "  - 未發現特別的關鍵數據\n"

        output += "- **異常發現**: "
        if self.anomalies:
            output += "\n"
            for anomaly in self.anomalies:
                output += f"  - ⚠️ {anomaly}\n"
        else:
            output += "無\n"

        output += "### 專業建議\n"
        if self.recommendations:
            for rec in self.recommendations:
                output += f"- {rec}\n"
        else:
            output += "- 系統狀態良好，暫無特別建議\n"

        return output

    def _to_multi_device_markdown(self) -> str:
        """多設備分析的 Markdown 格式"""
        device_count = self.device_count or 0
        successful_count = self.successful_device_count or 0
        failed_count = self.failed_device_count or 0

        output = "### 批次執行概況\n"
        output += f"- **執行範圍**: [{device_count} 台設備]\n"
        output += (
            f"- **成功/失敗**: [{successful_count} 成功 / {failed_count} 失敗]\n\n"
        )

        output += "### 關鍵對比分析\n"
        output += f"- **整體狀況**: {self.analysis_summary}\n"

        if self.key_findings:
            output += "- **重要發現**:\n"
            for finding in self.key_findings:
                output += f"  - {finding}\n"

        if self.anomalies:
            output += "- **異常設備**:\n"
            for anomaly in self.anomalies:
                output += f"  - ⚠️ {anomaly}\n"
        else:
            output += "- **異常設備**: 無，所有設備狀態正常\n"

        output += "### 維運建議\n"
        if self.recommendations:
            for rec in self.recommendations:
                output += f"- {rec}\n"
        else:
            output += "- 所有設備運行正常，建議繼續定期監控\n"

        return output

    class Config:
        """Pydantic 配置"""

        # 允許欄位別名，提供更好的 JSON Schema 生成
        validate_by_name = True
        # 生成更詳細的 JSON Schema，有助於 LLM 理解
        json_schema_extra = {
            "example": {
                "analysis_summary": "設備運行正常，所有關鍵指標都在正常範圍內",
                "key_findings": [
                    "CPU 溫度: 45°C (正常)",
                    "記憶體使用率: 65%",
                    "所有介面狀態: UP",
                ],
                "anomalies": [],
                "recommendations": ["建議定期清潔設備風扇", "建議每月檢查一次介面狀態"],
                "device_count": 1,
                "successful_device_count": None,
                "failed_device_count": None,
                "analysis_type": "single_device",
            }
        }
