#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM 工廠模組

統一管理不同 AI 提供者的初始化：
- Claude 與 Gemini 支援
- 統一初始化介面
- 配置驗證

Created: 2025-09-03
Author: Claude Code Assistant
"""

import logging
import os
from typing import Any, Optional

from settings import Settings

logger = logging.getLogger(__name__)

# 簡化的 Gemini 輸出 Token 配置
GEMINI_OUTPUT_TOKENS = {
    "gemini-1.5-pro-latest": 8192,
    "gemini-1.5-pro": 8192,
    "gemini-1.5-flash-latest": 4096,
    "gemini-1.5-flash": 4096,
    "gemini-pro": 2048,
}

# 檢查 AI 套件可用性
try:
    from langchain_anthropic import ChatAnthropic
    from langchain_core.callbacks import UsageMetadataCallbackHandler
    from langchain_google_genai import ChatGoogleGenerativeAI

    AI_AVAILABLE = True
except ImportError as e:
    AI_AVAILABLE = False
    logger.warning(f"AI 套件導入失敗: {e}")


class LLMFactory:
    """LLM 工廠類別
    
    統一 AI 模型初始化與管理
    """

    @staticmethod
    def create_llm(
        settings: Settings, usage_callback: Optional[Any] = None
    ) -> Optional[Any]:
        """建立 LLM 實例

        根據設定檔中的 AI_PROVIDER 和對應 API 金鑰，
        自動初始化對應的 LLM 引擎。

        Args:
            settings: 系統設定物件
            usage_callback: Token 使用量回調處理器

        Returns:
            LLM 實例或 None（初始化失敗時）
        """
        if not AI_AVAILABLE:
            logger.error("AI 套件不可用，無法初始化 LLM")
            return None

        provider = settings.AI_PROVIDER.lower()

        logger.info(f"開始初始化 {provider.upper()} LLM")

        try:
            if provider == "claude":
                return LLMFactory._create_claude(settings, usage_callback)
            elif provider == "gemini":
                return LLMFactory._create_gemini(settings, usage_callback)
            else:
                logger.error(f"不支援的 AI 提供者: {provider}")
                return None

        except Exception as e:
            logger.error(f"{provider.upper()} LLM 初始化失敗: {e}")
            return None

    @staticmethod
    def _create_claude(
        settings: Settings, usage_callback: Optional[Any] = None
    ) -> Optional[Any]:
        """初始化 Claude AI

        Args:
            settings: 系統設定
            usage_callback: Token 使用量回調

        Returns:
            Claude LLM 實例或 None
        """
        api_key = settings.CLAUDE_API_KEY
        if not api_key:
            logger.error("CLAUDE_API_KEY 未設定，Claude AI 功能不可用")
            return None

        try:
            model = settings.CLAUDE_MODEL
            callbacks = [usage_callback] if usage_callback else []

            llm = ChatAnthropic(
                model=model,
                temperature=0.1,
                anthropic_api_key=api_key,
                callbacks=callbacks,
            )

            logger.info(f"Claude AI 初始化成功 - 模型: {model}")
            return llm

        except Exception as e:
            logger.error(f"Claude AI 初始化失敗: {e}")
            LLMFactory._log_claude_error(str(e))
            return None

    @staticmethod
    def _create_gemini(
        settings: Settings, usage_callback: Optional[Any] = None
    ) -> Optional[Any]:
        """初始化 Gemini AI

        Args:
            settings: 系統設定
            usage_callback: Token 使用量回調

        Returns:
            Gemini LLM 實例或 None
        """
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.error("GEMINI_API_KEY 未設定，Gemini AI 功能不可用")
            return None

        try:
            model = settings.GEMINI_MODEL

            # 設定環境變數確保 LangChain 能正確識別 API 金鑰
            os.environ["GOOGLE_API_KEY"] = api_key
            os.environ["GOOGLE_GENERATIVE_AI_API_KEY"] = api_key

            # 從簡化配置中取得輸出 token 限制
            max_output_tokens = GEMINI_OUTPUT_TOKENS.get(model, 2048)
            callbacks = [usage_callback] if usage_callback else []

            logger.debug(
                f"Gemini 模型 {model} 配置: max_output_tokens={max_output_tokens}"
            )

            llm = ChatGoogleGenerativeAI(
                model=model,
                temperature=0.1,
                max_output_tokens=max_output_tokens,
                google_api_key=api_key,
                callbacks=callbacks,
            )

            logger.info(f"Gemini AI 初始化成功 - 模型: {model}")
            return llm

        except Exception as e:
            logger.error(f"Gemini AI 初始化失敗: {e}")
            LLMFactory._log_gemini_error(str(e))
            return None

    @staticmethod
    def _log_claude_error(error_str: str):
        """記錄 Claude 特定錯誤資訊"""
        if "401" in error_str or "unauthorized" in error_str.lower():
            logger.error("Claude API Key 可能無效或權限不足")
        elif "429" in error_str or "quota" in error_str.lower():
            logger.error("Claude API 請求頻率限制，請稍後再試")
        elif "500" in error_str:
            logger.error("Claude AI 服務暫時不可用")

    @staticmethod
    def _log_gemini_error(error_str: str):
        """記錄 Gemini 特定錯誤資訊和解決建議"""
        if "default credentials" in error_str.lower() or "adc" in error_str.lower():
            logger.error("偵測到 Application Default Credentials 錯誤")
            logger.info("建議檢查 GEMINI_API_KEY 在 .env 檔案中是否正確設定")
        elif "429" in error_str or "quota" in error_str.lower():
            logger.error("Gemini API 免費額度已用完（50次/日）")
            logger.info("請等待明天重置、升級付費方案或考慮改用 Claude AI")
        elif "401" in error_str or "unauthorized" in error_str.lower():
            logger.error("Gemini API Key 可能無效或權限不足")
            logger.info("請檢查 Google AI Studio 中 API 金鑰是否有效")
        elif "500" in error_str:
            logger.error("Google AI 服務暫時不可用")
        elif "import" in error_str.lower() or "module" in error_str.lower():
            logger.error(
                "可能缺少必要的套件，請檢查 langchain-google-genai 是否正確安裝"
            )

    @staticmethod
    def create_usage_callback() -> Optional[Any]:
        """建立 Token 使用量回調處理器

        Returns:
            UsageMetadataCallbackHandler 實例或 None
        """
        if not AI_AVAILABLE:
            return None

        try:
            return UsageMetadataCallbackHandler()
        except Exception as e:
            logger.debug(f"UsageMetadataCallbackHandler 建立失敗: {e}")
            return None

    @staticmethod
    def validate_provider_config(settings: Settings) -> tuple[bool, str]:
        """驗證 AI 提供者配置

        Args:
            settings: 系統設定

        Returns:
            tuple: (是否有效, 錯誤訊息)
        """
        provider = settings.AI_PROVIDER.lower()

        if provider == "claude":
            if not settings.CLAUDE_API_KEY:
                return False, "Claude API Key 未設定"
            return True, ""
        elif provider == "gemini":
            if not settings.GEMINI_API_KEY:
                return False, "Gemini API Key 未設定"
            return True, ""
        else:
            return False, f"不支援的 AI 提供者: {provider}"
