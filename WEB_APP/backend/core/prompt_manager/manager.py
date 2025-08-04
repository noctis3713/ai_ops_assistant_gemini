#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提示詞管理器核心實現

統一的 Jinja2 提示詞管理系統，提供企業級的模板管理功能：
- Jinja2 模板渲染和快取
- YAML 配置載入和管理
- 多語言支援
- 熱重載機制
- 線程安全操作
"""

import logging
import os
import time
from functools import lru_cache
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional

try:
    import jinja2
    import yaml
except ImportError as e:
    raise ImportError(f"必要依賴缺失: {e}. 請執行: pip install Jinja2 PyYAML") from e

# 統一配置管理系統
from core.settings import settings

from .exceptions import PromptConfigError, PromptLanguageError, PromptTemplateError

# 設置日誌
logger = logging.getLogger(__name__)


class PromptManager:
    """統一的提示詞管理器 - 企業級實現

    這個類別是整個提示詞系統的核心，負責：
    1. 管理 Jinja2 模板環境
    2. 載入和快取 YAML 配置
    3. 提供模板渲染服務
    4. 支援熱重載和多語言

    使用範例：
    ```python
    manager = PromptManager()
    system_prompt = manager.render_system_prompt(search_enabled=True)
    react_examples = manager.render_react_examples()
    ```
    """

    def __init__(self, base_dir: Optional[Path] = None, language: str = None):
        """初始化提示詞管理器

        Args:
            base_dir: 模板基礎目錄，None 時自動偵測或從環境變數載入
            language: 語言代碼，None 時從環境變數載入
        """
        # 配置基礎設定（使用 Pydantic Settings）
        if base_dir:
            self.base_dir = base_dir
        else:
            # 自動偵測模板目錄路徑
            if settings.PROMPT_TEMPLATE_DIR:
                self.base_dir = Path(settings.PROMPT_TEMPLATE_DIR)
            else:
                # 自動偵測：從當前檔案位置推算模板目錄
                current_file = Path(__file__)
                backend_dir = current_file.parent.parent.parent  # 回到 backend 目錄
                self.base_dir = backend_dir / "templates" / "prompts"

        self.language = language or settings.PROMPT_LANGUAGE

        # 線程安全鎖
        self._lock = RLock()

        # 初始化時間戳（用於快取管理）
        self._init_time = time.time()

        # 初始化 Jinja2 環境
        self._init_jinja_env()

        # 配置快取
        self._config_cache = {}

        # 載入所有配置
        self._load_all_configs()

        logger.info(
            f"PromptManager 已初始化",
            extra={
                "base_dir": str(self.base_dir),
                "language": self.language,
                "available_languages": self._get_available_languages(),
            },
        )

    def _init_jinja_env(self):
        """初始化 Jinja2 環境"""
        try:
            # 檢查模板目錄是否存在
            if not self.base_dir.exists():
                raise PromptTemplateError(f"模板目錄不存在: {self.base_dir}")

            # 建立 Jinja2 環境
            self.env = jinja2.Environment(
                loader=jinja2.FileSystemLoader(str(self.base_dir)),
                autoescape=False,  # 關閉自動轉義（我們處理的是純文字）
                enable_async=False,  # 暫時不啟用非同步（可根據需要開啟）
                trim_blocks=True,  # 移除空白行
                lstrip_blocks=True,  # 移除行首空白
            )

            # 添加自定義過濾器（如需要）
            self.env.filters["truncate_safe"] = self._truncate_safe_filter

        except Exception as e:
            raise PromptTemplateError(f"Jinja2 環境初始化失敗: {e}")

    def _truncate_safe_filter(self, text: str, length: int = 100) -> str:
        """安全的文字截斷過濾器"""
        if not text or len(text) <= length:
            return text
        return text[:length] + "..."

    def _get_available_languages(self) -> List[str]:
        """取得可用的語言列表"""
        try:
            languages = []
            for item in self.base_dir.iterdir():
                if item.is_dir() and not item.name.startswith("."):
                    languages.append(item.name)
            return sorted(languages)
        except Exception:
            return []

    @lru_cache(maxsize=32)
    def _load_yaml(self, file_path: str) -> Dict[str, Any]:
        """快取的 YAML 載入器

        使用 LRU 快取避免重複讀取相同檔案

        Args:
            file_path: 相對於 base_dir 的檔案路徑

        Returns:
            Dict[str, Any]: 載入的 YAML 內容

        Raises:
            PromptConfigError: 當檔案載入失敗時
        """
        full_path = self.base_dir / file_path

        try:
            if not full_path.exists():
                logger.warning(f"配置檔案不存在: {full_path}")
                return {}

            with open(full_path, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f) or {}

            logger.debug(f"成功載入 YAML 配置: {file_path}")
            return content

        except yaml.YAMLError as e:
            raise PromptConfigError(
                f"YAML 解析失敗: {e}",
                str(full_path),
                getattr(e, "problem_mark", {}).get("line"),
            )
        except Exception as e:
            raise PromptConfigError(f"配置檔案載入失敗: {e}", str(full_path))

    def _load_all_configs(self):
        """載入所有配置檔案"""
        with self._lock:
            try:
                # 載入基礎配置
                self.variables = self._load_yaml("config/variables.yaml")
                self.tools_config = self._load_yaml("config/tools.yaml")
                self.examples = self._load_yaml("config/examples.yaml")

                logger.info(
                    "所有配置檔案載入完成",
                    extra={
                        "variables_count": len(self.variables),
                        "tools_count": len(self.tools_config.get("tools", [])),
                        "examples_count": len(self.examples.get("react_examples", [])),
                    },
                )

            except Exception as e:
                logger.error(f"配置載入失敗: {e}")
                # 設定預設值以避免完全失敗
                self.variables = {}
                self.tools_config = {"tools": []}
                self.examples = {"react_examples": []}

    def render(self, template_name: str, **kwargs) -> str:
        """渲染指定的模板

        Args:
            template_name: 模板檔案名稱（可含或不含語言目錄）
            **kwargs: 模板變數

        Returns:
            str: 渲染後的文字

        Raises:
            PromptTemplateError: 當模板渲染失敗時
        """
        # 智能路徑處理：如果已包含語言前綴，直接使用；否則添加語言前綴
        if template_name.startswith(f"{self.language}/"):
            template_path = template_name
        else:
            template_path = f"{self.language}/{template_name}"

        try:
            # 取得模板
            template = self.env.get_template(template_path)

            # 合併配置和動態變數
            context = {**self.variables, **kwargs}

            # 渲染模板
            result = template.render(context)

            logger.debug(
                f"成功渲染模板: {template_path}",
                extra={
                    "context_keys": list(context.keys()),
                    "output_length": len(result),
                },
            )

            return result

        except jinja2.TemplateNotFound:
            available_templates = self._get_available_templates()
            raise PromptTemplateError(
                f"模板檔案不存在: {template_path}",
                template_name,
                {"available_templates": available_templates},
            )
        except jinja2.TemplateError as e:
            raise PromptTemplateError(f"模板渲染失敗: {e}", template_name, kwargs)
        except Exception as e:
            raise PromptTemplateError(f"未預期的渲染錯誤: {e}", template_name, kwargs)

    def _get_available_templates(self) -> List[str]:
        """取得可用的模板列表"""
        try:
            template_dir = self.base_dir / self.language
            if not template_dir.exists():
                return []

            templates = []
            for file_path in template_dir.glob("*.j2"):
                templates.append(file_path.name)
            return sorted(templates)
        except Exception:
            return []

    def render_system_prompt(self, search_enabled: bool = False, **kwargs) -> str:
        """渲染系統提示詞 - 取代原有的 build_ai_system_prompt_for_pydantic

        Args:
            search_enabled: 是否啟用搜尋功能
            **kwargs: 其他模板變數

        Returns:
            str: 渲染後的系統提示詞
        """
        context = {
            "search_enabled": search_enabled,
            "tools": self._get_enabled_tools(search_enabled),
            **kwargs,
        }

        return self.render("system_prompt.j2", **context)

    def render_react_examples(self, **kwargs) -> str:
        """渲染 ReAct 範例 - 取代原有的 _get_react_examples

        Args:
            **kwargs: 其他模板變數

        Returns:
            str: 渲染後的 ReAct 範例
        """
        context = {"examples": self.examples.get("react_examples", []), **kwargs}

        return self.render("react_examples.j2", **context)

    def _get_enabled_tools(self, search_enabled: bool) -> List[Dict[str, Any]]:
        """取得啟用的工具列表

        Args:
            search_enabled: 是否啟用搜尋功能

        Returns:
            List[Dict[str, Any]]: 啟用的工具列表
        """
        all_tools = self.tools_config.get("tools", [])
        enabled_tools = []

        for tool in all_tools:
            # 檢查工具是否應該啟用
            if tool.get("name") == "CiscoCommandSearch" and not search_enabled:
                continue
            enabled_tools.append(tool)

        return enabled_tools

    def clear_cache(self):
        """清除所有快取 - 支援熱重載

        這個方法會：
        1. 清除 YAML 載入快取
        2. 重新載入所有配置
        3. 更新初始化時間戳
        """
        with self._lock:
            try:
                # 清除 LRU 快取
                self._load_yaml.cache_clear()

                # 清除配置快取
                self._config_cache.clear()

                # 重新載入所有配置
                self._load_all_configs()

                # 更新時間戳
                self._init_time = time.time()

                logger.info("提示詞管理器快取已清除，配置已重新載入")

            except Exception as e:
                logger.error(f"清除快取失敗: {e}")
                raise PromptConfigError(f"清除快取失敗: {e}")

    def get_stats(self) -> Dict[str, Any]:
        """取得管理器統計資訊

        Returns:
            Dict[str, Any]: 統計資訊
        """
        cache_info = self._load_yaml.cache_info()

        return {
            "base_dir": str(self.base_dir),
            "language": self.language,
            "available_languages": self._get_available_languages(),
            "available_templates": self._get_available_templates(),
            "init_time": self._init_time,
            "uptime_seconds": time.time() - self._init_time,
            "cache_stats": {
                "hits": cache_info.hits,
                "misses": cache_info.misses,
                "current_size": cache_info.currsize,
                "max_size": cache_info.maxsize,
            },
            "config_loaded": {
                "variables_count": len(self.variables),
                "tools_count": len(self.tools_config.get("tools", [])),
                "examples_count": len(self.examples.get("react_examples", [])),
            },
        }

    def validate_language(self, language: str) -> bool:
        """驗證語言代碼是否受支援

        Args:
            language: 語言代碼

        Returns:
            bool: 是否受支援
        """
        available_languages = self._get_available_languages()
        return language in available_languages

    def switch_language(self, language: str):
        """切換語言

        Args:
            language: 新的語言代碼

        Raises:
            PromptLanguageError: 當語言不受支援時
        """
        if not self.validate_language(language):
            available = self._get_available_languages()
            raise PromptLanguageError(
                f"不支援的語言代碼: {language}", language, available
            )

        with self._lock:
            old_language = self.language
            self.language = language
            logger.info(f"語言已切換: {old_language} -> {language}")
