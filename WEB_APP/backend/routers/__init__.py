#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI 路由模組套件
提供模組化的 API 端點組織和管理

本套件包含以下路由模組：
- device_routes: 設備管理相關 API
- execution_routes: 指令執行相關 API  
- task_routes: 任務管理相關 API
- admin_routes: 管理功能相關 API

Created: 2025-08-04
Author: Claude Code Assistant
"""

# 路由模組版本資訊
__version__ = "1.0.0"
__author__ = "Claude Code Assistant"
__description__ = "AI 網路運維助理 - 模組化路由系統"

# 導出主要路由模組
from . import device_routes
from . import execution_routes  
from . import task_routes
from . import admin_routes

# 路由模組註冊資訊
ROUTER_MODULES = [
    {
        "name": "device_routes",
        "description": "設備管理相關 API - 設備清單、群組、狀態查詢",
        "endpoints_count": 5,
        "prefix": "/api",
        "tags": ["設備管理"]
    },
    {
        "name": "execution_routes", 
        "description": "指令執行相關 API - 單一設備執行、批次執行、AI 查詢",
        "endpoints_count": 4,
        "prefix": "/api",
        "tags": ["指令執行"]
    },
    {
        "name": "task_routes",
        "description": "任務管理相關 API - 任務狀態、進度追蹤、任務管理",
        "endpoints_count": 4, 
        "prefix": "/api",
        "tags": ["任務管理"]
    },
    {
        "name": "admin_routes",
        "description": "管理功能相關 API - 配置重載、提示詞管理、日誌收集",
        "endpoints_count": 3,
        "prefix": "/api/admin",
        "tags": ["系統管理"]
    }
]

def get_router_info():
    """取得所有路由模組資訊
    
    Returns:
        dict: 路由模組統計和詳細資訊
    """
    return {
        "total_modules": len(ROUTER_MODULES),
        "total_endpoints": sum(module["endpoints_count"] for module in ROUTER_MODULES),
        "modules": ROUTER_MODULES,
        "version": __version__
    }