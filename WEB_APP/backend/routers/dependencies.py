#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
共用依賴注入模組

提供 FastAPI 路由模組間共用的依賴注入函數

Created: 2025-08-04
Author: Claude Code Assistant
"""

from fastapi import Request
from core.settings import Settings

def get_config_manager_dep(request: Request):
    """獲取配置管理器依賴

    Args:
        request: FastAPI 請求物件

    Returns:
        ConfigManager: 配置管理器實例
    """
    return request.app.state.config_manager

def get_ai_service_dep(request: Request):
    """獲取 AI 服務依賴

    Args:
        request: FastAPI 請求物件

    Returns:
        AIService: AI 服務實例
    """
    return request.app.state.ai_service

def get_task_manager_dep(request: Request):
    """獲取任務管理器依賴

    Args:
        request: FastAPI 請求物件

    Returns:
        TaskManager: 任務管理器實例
    """
    return request.app.state.task_manager

def get_settings_dep(request: Request) -> Settings:
    """獲取 Settings 配置依賴

    Args:
        request: FastAPI 請求物件

    Returns:
        Settings: 全域 Settings 實例
    """
    return request.app.state.settings
