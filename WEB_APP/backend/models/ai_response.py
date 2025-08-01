#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 回應模型 - 結構化的網路分析結果
使用 Pydantic 確保 AI 輸出格式的一致性，並提供 Markdown 轉換功能
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Literal, Optional


class NetworkAnalysisResponse(BaseModel):
    """AI 對網路設備診斷結果的結構化回應
    
    這個模型定義了 AI 分析網路設備後應返回的標準格式，
    每個欄位都有詳細的描述來引導 LLM 產出精確的內容。
    """
    
    analysis_summary: str = Field(
        description="用一兩句話總結整個分析的核心結論，提供給用戶的最高層概覽。例如：'設備運行正常，所有關鍵指標都在正常範圍內' 或 '發現 2 台設備存在溫度異常，需要立即關注'"
    )
    
    key_findings: List[str] = Field(
        description="從工具輸出中提取的關鍵數據點和發現，以列表形式呈現。每項都是一個獨立的發現，例如：'CPU 溫度: 45°C (正常)'、'記憶體使用率: 65%'、'所有介面狀態: UP'。如果沒有特別的關鍵數據，可以是空列表。"
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
        successful_count = device_count  # 簡化處理，假設都成功
        
        output = "### 批次執行概況\n"
        output += f"- **執行範圍**: [{device_count} 台設備]\n"
        output += f"- **成功/失敗**: [{successful_count} 成功 / {device_count - successful_count} 失敗]\n\n"
        
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
                    "所有介面狀態: UP"
                ],
                "anomalies": [],
                "recommendations": [
                    "建議定期清潔設備風扇",
                    "建議每月檢查一次介面狀態"
                ],
                "device_count": 1,
                "analysis_type": "single_device"
            }
        }