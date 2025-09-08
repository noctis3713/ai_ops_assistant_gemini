#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提示詞模板管理模組

提供 AI 系統的提示詞模板管理功能：
- Jinja2 模板渲染
- 動態提示詞生成
- 快取機制和效能優化
"""

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import jinja2
    import yaml
except ImportError as e:
    raise ImportError(f"必要依賴缺失: {e}. 請執行: pip install Jinja2 PyYAML") from e

from exceptions import ServiceError, config_error
from settings import settings

logger = logging.getLogger(__name__)


class PromptManager:
    """提示詞管理器

    提供基本的模板管理功能：
    - Jinja2 模板渲染
    - YAML 配置載入
    - 多語言支援
    """

    def __init__(self, base_dir: Optional[Path] = None, language: str = None):
        """初始化提示詞管理器"""
        # 設定模板目錄
        if base_dir:
            self.base_dir = base_dir
        elif settings.PROMPT_TEMPLATE_DIR:
            self.base_dir = Path(settings.PROMPT_TEMPLATE_DIR)
        else:
            # 自動偵測模板目錄 - 從當前工作目錄計算
            current_working_dir = Path.cwd()
            # 如果當前目錄是 backend，直接使用
            if current_working_dir.name == "backend":
                self.base_dir = current_working_dir / "ai" / "prompts"
            else:
                # 否則從檔案位置計算
                current_file = Path(__file__)
                backend_dir = current_file.parent.parent
                self.base_dir = backend_dir / "ai" / "prompts"

            # 確保路徑是絕對路徑
            self.base_dir = self.base_dir.resolve()

        self.language = language or settings.PROMPT_LANGUAGE
        self._init_time = time.time()

        # 初始化 Jinja2 環境
        self._init_jinja_env()

        # 載入配置
        self._load_configs()

        logger.info(
            f"PromptManager 已初始化 - 目錄: {self.base_dir}, 語言: {self.language}"
        )

    def _init_jinja_env(self):
        """初始化 Jinja2 環境"""
        if not self.base_dir.exists():
            logger.warning(f"模板目錄不存在: {self.base_dir}")
            # 嘗試創建一個虛擬的環境，避免完全失敗
            self.env = jinja2.Environment(
                loader=jinja2.DictLoader({}),  # 空的字典載入器
                autoescape=False,
                trim_blocks=True,
                lstrip_blocks=True,
            )
            return

        self.env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(self.base_dir)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def _load_configs(self):
        """載入配置檔案"""
        try:
            self.variables = self._load_yaml("config/variables.yaml")

            logger.info(f"配置載入完成 - 變數: {len(self.variables)}")

        except Exception as e:
            logger.error(f"配置載入失敗: {e}")
            # 設定預設值
            self.variables = {}

    def _load_yaml(self, file_path: str) -> Dict[str, Any]:
        """載入 YAML 檔案"""
        full_path = self.base_dir / file_path

        if not full_path.exists():
            logger.warning(f"配置檔案不存在: {full_path}")
            return {}

        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f) or {}
            return content

        except yaml.YAMLError as e:
            raise config_error(f"YAML 解析失敗: {e}", str(full_path))
        except Exception as e:
            raise config_error(f"配置檔案載入失敗: {e}", str(full_path))

    def render(self, template_name: str, **kwargs) -> str:
        """渲染模板"""
        # 加入語言前綴
        if not template_name.startswith(f"{self.language}/"):
            template_path = f"{self.language}/{template_name}"
        else:
            template_path = template_name

        try:
            template = self.env.get_template(template_path)
            context = {**self.variables, **kwargs}
            return template.render(context)

        except jinja2.TemplateNotFound:
            available_templates = self._get_available_templates()
            raise ServiceError(
                f"提示詞模板檔案不存在: {template_path}",
                "PROMPT_TEMPLATE_NOT_FOUND",
                500,
            )
        except jinja2.TemplateError as e:
            raise ServiceError(
                f"提示詞模板渲染失敗: {e}", "PROMPT_TEMPLATE_RENDER_ERROR", 500
            )

    def render_system_prompt(self, **kwargs) -> str:
        """渲染系統提示詞"""
        context = {
            "search_enabled": False,
            "enable_guardrails": kwargs.get("enable_guardrails", True),
            "query_uuid": kwargs.get("query_uuid"),
            "timestamp": kwargs.get("timestamp"),
            "device_scope_restriction": kwargs.get("device_scope_restriction"),
            "response_language": "繁體中文",
            "language_code": self.language,
            **kwargs,
        }
        return self.render("system_prompt.j2", **context)

    def render_query_prompt(self, user_query: str, **kwargs) -> str:
        """渲染完整的查詢提示詞"""
        enhanced_prompt = user_query
        include_examples = kwargs.get("include_examples", True)

        # ReAct 範例已移除，不再加入範例

        # 加入安全規則
        if kwargs.get("enable_guardrails", True):
            guardrails_context = self._build_guardrails_context(**kwargs)
            enhanced_prompt += guardrails_context

        return enhanced_prompt

    def _get_available_templates(self) -> List[str]:
        """取得可用的模板列表"""
        template_dir = self.base_dir / self.language
        if not template_dir.exists():
            return []

        return [f.name for f in template_dir.glob("*.j2")]

    def _build_guardrails_context(self, **kwargs) -> str:
        """建構安全防護內容"""
        guardrails_context = "\\n\\n🚨 **強制執行要求（最高優先級）**：\\n"

        if kwargs.get("query_uuid"):
            guardrails_context += f"- 查詢唯一標識：{kwargs['query_uuid']}\\n"
        if kwargs.get("timestamp"):
            guardrails_context += f"- 當前時間戳記：{kwargs['timestamp']}\\n"

        guardrails_context += "⚠️ **優先級 1**: 執行所有提到的指令\\n"
        guardrails_context += "⚠️ **優先級 2**: 分析執行結果\\n"
        guardrails_context += "- 你必須優先使用工具取得「當前真實輸出」，嚴禁憑空編造任何數據或設備狀態\\n"

        # 設備範圍限制
        device_scope_restriction = kwargs.get("device_scope_restriction")
        if device_scope_restriction:
            guardrails_context += f"\\n<device_scope_restriction>\\n**重要限制**: 只能在以下指定設備上執行指令:\\n"
            for ip in device_scope_restriction:
                guardrails_context += f"- {ip}\\n"
            guardrails_context += "</device_scope_restriction>"

        return guardrails_context

    def get_stats(self) -> Dict[str, Any]:
        """取得管理器統計資訊"""
        return {
            "base_dir": str(self.base_dir),
            "language": self.language,
            "available_templates": self._get_available_templates(),
            "init_time": self._init_time,
            "uptime_seconds": time.time() - self._init_time,
            "config_loaded": {
                "variables_count": len(self.variables),
            },
        }


# 全域實例
_prompt_manager = None


def get_prompt_manager() -> PromptManager:
    """取得全域提示詞管理器實例"""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager


__all__ = ["PromptManager", "get_prompt_manager"]
