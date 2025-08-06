#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Models 模組 - AI 回應和數據結構定義
提供結構化的 Pydantic 模型，確保 AI 輸出格式的一致性和可靠性
"""

from .ai_response import NetworkAnalysisResponse
from .common import BaseResponse

__all__ = ["NetworkAnalysisResponse", "BaseResponse"]
