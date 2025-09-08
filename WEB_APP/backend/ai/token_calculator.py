#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Token 計算和成本估算模組

專責處理 AI 服務的 Token 計算、成本估算和使用記錄：
- 統一的 Token 使用量提取介面
- 精確和估算兩種計算模式
- 成本計算和日誌記錄
- 支援 Claude 和 Gemini 雙引擎

Created: 2025-09-03
Author: Claude Code Assistant
"""

import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class TokenCalculator:
    """Token 計算和成本估算核心類別

    提供統一的 Token 計算介面，支援精確提取和文本估算兩種模式。
    """

    # Claude 定價（每 1,000 tokens）
    CLAUDE_PRICING = {
        "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
        "claude-3-5-haiku-20241022": {"input": 0.00025, "output": 0.00125},
        "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015},
        "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
        "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
    }

    # Gemini 定價（每 1,000 tokens）
    GEMINI_PRICING = {
        "gemini-1.5-flash": {"input": 0.00015, "output": 0.0006},
        "gemini-1.5-flash-latest": {"input": 0.00015, "output": 0.0006},
        "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
        "gemini-1.5-pro-latest": {"input": 0.00125, "output": 0.005},
        "gemini-pro": {"input": 0.000125, "output": 0.000375},
    }

    def extract_token_usage(self, result: Any) -> Dict[str, Any]:
        """統一的 Token 使用量提取介面

        智能提取 AI 查詢結果中的 Token 使用量資訊，
        支援多種資料來源和格式。

        Args:
            result: AI 查詢結果物件

        Returns:
            Dict: 包含 input_tokens, output_tokens, total_tokens 的字典
        """
        usage_data = {}

        # 方法1: 從 callback handler 取得（優先）
        if hasattr(result, "usage_callback") and result.usage_callback:
            callback_data = getattr(result.usage_callback, "usage_metadata", {})
            if callback_data:
                usage_data.update(self._parse_callback_data(callback_data))
                logger.debug(f"從 callback 取得 token 數據: {usage_data}")

        # 方法2: 從結果 metadata 中提取
        if not usage_data and isinstance(result, dict):
            if "usage_metadata" in result:
                usage_data.update(result["usage_metadata"])
                logger.debug(f"從結果 metadata 取得 token 數據: {usage_data}")

            # 檢查 Gemini 特殊格式
            gemini_tokens = self._extract_gemini_usage(result)
            if gemini_tokens:
                usage_data.update(gemini_tokens)

        # 確保包含 total_tokens
        if usage_data and "total_tokens" not in usage_data:
            input_tokens = usage_data.get("input_tokens", 0)
            output_tokens = usage_data.get("output_tokens", 0)
            if input_tokens > 0 or output_tokens > 0:
                usage_data["total_tokens"] = input_tokens + output_tokens

        return usage_data

    def estimate_token_usage(self, input_text: str, output_text: str) -> Dict[str, Any]:
        """基於文本估算 Token 使用量

        當無法從 API 回應中取得精確 Token 數據時使用。

        Args:
            input_text: 輸入文本
            output_text: 輸出文本

        Returns:
            Dict: 包含估算的 token 使用量，標記為估算值
        """
        try:
            input_tokens = self._estimate_tokens(input_text)
            output_tokens = self._estimate_tokens(output_text)
            total_tokens = input_tokens + output_tokens

            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "estimated": True,
                "method": "char_based_estimation",
            }
        except Exception as e:
            logger.debug(f"Token 估算失敗: {e}")
            return {}

    def calculate_cost(
        self, provider: str, model: str, input_tokens: int, output_tokens: int
    ) -> float:
        """計算 Token 使用成本

        Args:
            provider: AI 提供者 (claude/gemini)
            model: 模型名稱
            input_tokens: 輸入 token 數量
            output_tokens: 輸出 token 數量

        Returns:
            float: 估算成本（美元）
        """
        try:
            if provider == "claude":
                pricing = self.CLAUDE_PRICING.get(model)
                if not pricing:
                    # 使用 Sonnet 作為預設定價
                    pricing = self.CLAUDE_PRICING["claude-3-5-sonnet-20241022"]
            elif provider == "gemini":
                pricing = self.GEMINI_PRICING.get(model)
                if not pricing:
                    # 使用 Pro 作為預設定價
                    pricing = self.GEMINI_PRICING["gemini-1.5-pro"]
            else:
                return 0.0

            # 計算成本：(tokens / 1000) * price_per_1000
            input_cost = (input_tokens / 1000.0) * pricing["input"]
            output_cost = (output_tokens / 1000.0) * pricing["output"]
            total_cost = input_cost + output_cost

            return round(total_cost, 6)  # 保留 6 位小數

        except Exception as e:
            logger.warning(f"成本計算失敗: {e}")
            return 0.0

    def _parse_callback_data(self, callback_data: Dict) -> Dict[str, int]:
        """解析 callback 數據結構"""
        if isinstance(callback_data, dict):
            # 處理嵌套的 callback 數據結構
            for key, value in callback_data.items():
                if isinstance(value, dict) and "input_tokens" in value:
                    return value
            # 如果沒有嵌套結構，直接使用原始數據
            if "input_tokens" in callback_data:
                return callback_data
        return {}

    def _extract_gemini_usage(self, result: Dict) -> Dict[str, int]:
        """提取 Gemini 特定的 token 使用量格式"""
        try:
            # 檢查 response_metadata
            if "response_metadata" in result:
                metadata = result["response_metadata"]
                return self._parse_gemini_metadata(metadata)

            # 檢查其他可能的位置
            if "output" in result and hasattr(result["output"], "response_metadata"):
                return self._parse_gemini_metadata(result["output"].response_metadata)

        except Exception as e:
            logger.debug(f"提取 Gemini token 使用量時發生錯誤: {e}")

        return {}

    def _parse_gemini_metadata(self, metadata: Dict) -> Dict[str, int]:
        """解析 Gemini 的 metadata 格式"""
        try:
            usage_keys = ["usage_metadata", "token_count", "usage"]

            for key in usage_keys:
                if key in metadata:
                    usage_info = metadata[key]
                    if isinstance(usage_info, dict):
                        # 標準格式
                        if (
                            "input_tokens" in usage_info
                            and "output_tokens" in usage_info
                        ):
                            return usage_info

                        # Gemini 特定格式
                        input_tokens = usage_info.get(
                            "promptTokenCount", usage_info.get("prompt_token_count", 0)
                        )
                        output_tokens = usage_info.get(
                            "candidatesTokenCount",
                            usage_info.get("candidates_token_count", 0),
                        )
                        total_tokens = usage_info.get(
                            "totalTokenCount", usage_info.get("total_token_count", 0)
                        )

                        if input_tokens > 0 or output_tokens > 0:
                            return {
                                "input_tokens": input_tokens,
                                "output_tokens": output_tokens,
                                "total_tokens": total_tokens
                                or (input_tokens + output_tokens),
                            }

        except Exception as e:
            logger.debug(f"解析 Gemini metadata 時發生錯誤: {e}")

        return {}

    def _estimate_tokens(self, text: str) -> int:
        """估算文本的 token 數量

        基於經驗公式：
        - 英文：約 4 字符 = 1 token
        - 中文：約 2 字符 = 1 token

        Args:
            text: 要估算的文本

        Returns:
            int: 估算的 token 數量
        """
        if not text:
            return 0

        char_count = len(text)

        # 統計中文字符數量
        chinese_chars = sum(1 for char in text if "\u4e00" <= char <= "\u9fff")
        english_chars = char_count - chinese_chars

        # 中文：2 字符 = 1 token，英文：4 字符 = 1 token
        estimated_tokens = (chinese_chars / 2.0) + (english_chars / 4.0)

        return max(1, int(estimated_tokens)) if text.strip() else 0


class TokenLogger:
    """Token 使用記錄和顯示類別

    專責處理 Token 使用量的日誌記錄和控制台顯示。
    """

    def __init__(self):
        self.ai_logger = self._get_ai_logger()

    def log_usage(
        self,
        task_id: str,
        provider: str,
        model: str,
        usage_data: Dict[str, Any],
        cost: float,
    ):
        """記錄 Token 使用量到日誌

        Args:
            task_id: 任務 ID
            provider: AI 提供者
            model: 模型名稱
            usage_data: Token 使用量資料
            cost: 估算成本
        """
        input_tokens = usage_data.get("input_tokens", 0)
        output_tokens = usage_data.get("output_tokens", 0)
        total_tokens = usage_data.get("total_tokens", 0)
        is_estimated = usage_data.get("estimated", False)

        # 建立 Token 使用資訊
        token_info = {
            "task_id": task_id,
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": cost,
            "is_estimated": is_estimated,
        }

        # 格式化日誌訊息
        formatted_usage = (
            f"Task: {task_id[:8]}... | "
            f"Provider: {provider.upper()} ({model}) | "
            f"Tokens: {input_tokens}→{output_tokens} (Total: {total_tokens})"
        )

        if is_estimated:
            formatted_usage += f" 📊估算值 | Cost: ~${cost:.6f} USD (估算)"
            self.ai_logger.info(f"TOKEN_USAGE_ESTIMATED: {formatted_usage}")
        else:
            formatted_usage += f" | Cost: ${cost:.6f} USD"
            self.ai_logger.info(f"TOKEN_USAGE: {formatted_usage}")

        # 記錄原始 JSON 供 API 解析
        self.ai_logger.debug(f"TOKEN_USAGE_RAW: {token_info}")

        # 顯示控制台摘要
        self.display_summary(provider, total_tokens, cost, is_estimated)

    def display_summary(
        self, provider: str, total_tokens: int, cost: float, is_estimated: bool = False
    ):
        """在控制台顯示 Token 使用量摘要

        Args:
            provider: AI 提供者
            total_tokens: 總 Token 數
            cost: 估算成本
            is_estimated: 是否為估算值
        """
        if is_estimated:
            if cost > 0.01:
                logger.warning(
                    f"🔥 高成本查詢 - {provider.upper()}: ~{total_tokens} tokens (~${cost:.4f}) 📊估算"
                )
            else:
                logger.info(
                    f"📊 AI 查詢完成 - {provider.upper()}: ~{total_tokens} tokens (~${cost:.4f}) 估算"
                )
        else:
            if cost > 0.01:
                logger.warning(
                    f"🔥 高成本查詢 - {provider.upper()}: {total_tokens} tokens (${cost:.4f})"
                )
            else:
                logger.info(
                    f"💡 AI 查詢完成 - {provider.upper()}: {total_tokens} tokens (${cost:.4f})"
                )

    def _get_ai_logger(self):
        """建立 AI 模組專用的日誌記錄器"""
        ai_logger = logging.getLogger("ai_service")
        ai_logger.setLevel(logging.DEBUG)

        if not ai_logger.handlers:
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.DEBUG)

            class TokenUsageFormatter(logging.Formatter):
                def format(self, record):
                    if "TOKEN_USAGE_ESTIMATED:" in record.getMessage():
                        return f"📊 [TOKEN-估算] {record.getMessage().replace('TOKEN_USAGE_ESTIMATED: ', '')}"
                    elif "TOKEN_USAGE:" in record.getMessage():
                        return f"💰 [TOKEN] {record.getMessage()}"
                    else:
                        return f"🤖 [AI] {record.levelname}: {record.getMessage()}"

            formatter = TokenUsageFormatter()
            console_handler.setFormatter(formatter)
            ai_logger.addHandler(console_handler)
            ai_logger.propagate = False

        return ai_logger
