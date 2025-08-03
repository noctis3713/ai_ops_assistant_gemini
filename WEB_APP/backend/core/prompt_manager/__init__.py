#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提示詞管理模組 - 統一的 Jinja2 提示詞管理系統

這個模組提供企業級的提示詞管理功能，包括：
- Jinja2 模板渲染
- YAML 配置載入和快取
- 熱重載支援
- 多語言支援

主要類別：
- PromptManager: 核心提示詞管理器
- PromptConfigError: 配置錯誤異常

使用方式：
```python
from core.prompt_manager import get_prompt_manager

prompt_manager = get_prompt_manager()
system_prompt = prompt_manager.render_system_prompt(search_enabled=True)
```
"""

from .exceptions import PromptConfigError, PromptTemplateError
from .manager import PromptManager

# 全域單例實例
_prompt_manager_instance = None


def get_prompt_manager() -> PromptManager:
    """取得全域提示詞管理器實例

    使用單例模式確保整個應用程式中只有一個提示詞管理器實例

    Returns:
        PromptManager: 提示詞管理器實例
    """
    global _prompt_manager_instance

    if _prompt_manager_instance is None:
        _prompt_manager_instance = PromptManager()

    return _prompt_manager_instance


def reload_prompt_manager():
    """重新建立提示詞管理器實例

    用於熱重載功能，強制重新載入所有配置和模板
    """
    global _prompt_manager_instance
    _prompt_manager_instance = None
    return get_prompt_manager()


__all__ = [
    "PromptManager",
    "PromptConfigError",
    "PromptTemplateError",
    "get_prompt_manager",
    "reload_prompt_manager",
]
