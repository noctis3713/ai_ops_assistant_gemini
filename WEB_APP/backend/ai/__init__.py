#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 套件初始化模組

提供 AI 相關功能的統一入口點：
- AI 服務核心功能
- LLM 工廠模式管理
- 提示詞模板管理
- Token 計算與成本估算

Created: 2025-09-03
Author: Claude Code Assistant
"""

# 匯出核心 AI 服務
from .service import AIService, get_ai_service

# 匯出 LLM 工廠
from .llm_factory import LLMFactory

# 匯出提示詞管理器
from .prompt_manager import PromptManager, get_prompt_manager

# 匯出 Token 計算器
from .token_calculator import TokenCalculator, TokenLogger

__all__ = [
    "AIService",
    "get_ai_service",
    "LLMFactory", 
    "PromptManager",
    "get_prompt_manager",
    "TokenCalculator",
    "TokenLogger"
]