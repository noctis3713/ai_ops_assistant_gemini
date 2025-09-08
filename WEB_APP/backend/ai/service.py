#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 智能分析服務模組

提供網路設備的 AI 智能分析和查詢功能：
- 使用 LLMFactory 管理 LLM 初始化
- 使用 TokenCalculator 和 TokenLogger 處理 Token
- 專注於核心 AI 查詢功能
- 簡化的架構設計

Created: 2025-08-22
Refactored: 2025-09-03
Author: Claude Code Assistant
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

# AI 服務相關導入
try:
    import warnings

    from langchain.agents import AgentExecutor, create_tool_calling_agent
    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_core.tools import Tool

    warnings.filterwarnings("ignore")
    AI_AVAILABLE = True
except ImportError as e:
    import sys

    if "default credentials" not in str(e).lower():
        print(f"AI 套件導入失敗: {e}", file=sys.stderr)
    AI_AVAILABLE = False

from common import NetworkAnalysisResponse
from exceptions import ExternalServiceError, ai_error
from network import batch_command_wrapper, set_device_scope_restriction
from settings import settings

from .llm_factory import LLMFactory
from .prompt_manager import get_prompt_manager
from .token_calculator import TokenCalculator, TokenLogger

logger = logging.getLogger(__name__)


class AIService:
    """主要的 AI 智能分析服務管理器

    專注於核心 AI 查詢處理，使用簡化的架構：
    - 使用 LLMFactory 管理 LLM 初始化
    - 使用 TokenCalculator 處理 Token 計算
    - 使用 TokenLogger 記錄使用量
    - 只保留核心查詢功能
    """

    def __init__(self):
        """初始化 AI 智能分析服務"""
        self.agent_executor = None
        self.ai_initialized = False
        self.llm = None

        # 初始化工具實例
        self.token_calculator = TokenCalculator()
        self.token_logger = TokenLogger()
        self.parser = PydanticOutputParser(pydantic_object=NetworkAnalysisResponse)
        self.prompt_manager = get_prompt_manager()

        # 使用工廠模式初始化
        self._initialize_ai()

    def _initialize_ai(self) -> bool:
        """使用 LLMFactory 初始化 AI 系統"""
        if not AI_AVAILABLE:
            logger.warning("AI 功能不可用，跳過初始化")
            return False

        try:
            # 驗證配置
            is_valid, error_msg = LLMFactory.validate_provider_config(settings)
            if not is_valid:
                logger.error(f"AI 配置無效: {error_msg}")
                return False

            # 建立 Token 使用量回調
            usage_callback = LLMFactory.create_usage_callback()

            # 使用工廠模式建立 LLM
            self.llm = LLMFactory.create_llm(settings, usage_callback)
            if not self.llm:
                logger.error("LLM 初始化失敗")
                return False

            # 儲存 callback 以便後續使用
            self.usage_callback = usage_callback

            # 建立 Agent
            tools = self._create_tools()
            base_prompt_template = self._create_custom_prompt_template()
            agent = create_tool_calling_agent(self.llm, tools, base_prompt_template)

            self.agent_executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=False,
                handle_parsing_errors=True,
                return_intermediate_steps=True,
            )

            logger.info(f"AI 系統初始化成功 - 提供者: {settings.AI_PROVIDER.upper()}")
            self.ai_initialized = True
            return True

        except Exception as e:
            logger.error(f"AI 系統初始化失敗: {e}")
            return False

    def _create_tools(self) -> List[Tool]:
        """建立 AI 工具清單"""
        tools = [
            Tool(
                name="BatchCommandRunner",
                func=batch_command_wrapper,
                description="""
            **思考協議 (Thought Protocol)**：
            1. **識別 (Identify)**：從使用者查詢中，提取所有需要執行的 `show` 指令列表。
            2. **拆分 (Decompose)**：將多指令查詢拆解為一系列單一指令的工具呼叫。
            3. **執行 (Execute)**：依序、獨立地呼叫 `BatchCommandRunner` 執行每一個指令。
            4. **觀察 (Observe)**：仔細檢查每一次工具回傳的 JSON，特別是 `successful_results` 和 `failed_results`。
            5. **驗證與修正 (Verify & Correct)**：如果出現 `failed_results`，分析 `error_details`。如果 `suggestion` 提示可以修正指令，則再次呼叫工具進行重試。
            6. **整合 (Synthesize)**：在 **所有** 指令都成功執行（或已嘗試修正）後，整合所有 `Observation` 的資訊，產生最終分析。

            **功能說明**：
            - 網路設備指令執行工具 - 自動執行安全的 show 類指令並返回結構化結果
            - 工具會自動驗證指令安全性，只執行允許的唯讀指令
            - 支援所有標準的 show 指令（如 show version, show interface, show environment, show platform 等）

            **重要限制**：
            - 每次調用只能執行一個指令
            - 多個指令必須分別調用此工具多次
            - 絕對禁止在沒有執行的情況下虛構結果

            **輸入格式**：
            - `"device_ip: command"`（單一設備執行單一指令）
            - `"device_ip1,device_ip2: command"`（多設備執行同一指令）
            - `"command"`（所有設備執行同一指令）
            
            **回傳 JSON 結構**：
            ```json
            {
              "summary": {
                "command": "執行的指令",
                "total_devices": 總設備數,
                "successful_devices": 成功設備數,
                ...
              },
              "successful_results": [
                {"device_ip": "設備IP", "output": "設備輸出內容"}
              ],
              "failed_results": [
                {
                  "device_ip": "設備IP",
                  "error_message": "錯誤訊息",
                  "error_details": {
                    "type": "錯誤類型",
                    "category": "錯誤分類", 
                    "suggestion": "解決建議"
                  }
                }
              ]
            }
            ```
                """,
            )
        ]
        return tools

    def _create_custom_prompt_template(self, **kwargs) -> ChatPromptTemplate:
        """建立適用於 tool calling agent 的提示詞模板"""
        # 建立基礎模板
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", "{system_prompt}"),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        # 渲染系統提示詞內容
        system_prompt_content = self.prompt_manager.render_system_prompt(
            search_enabled=False,
            format_instructions=self.parser.get_format_instructions(),
            **kwargs,
        )

        # 使用 partial 方法填充系統提示詞
        prompt = prompt.partial(system_prompt=system_prompt_content)
        return prompt

    async def query_ai(
        self,
        prompt: str,
        task_id: str,
        timeout: float = 120.0,
        device_ips: List[str] = None,
    ) -> Dict[str, Any]:
        """執行 AI 智能分析查詢

        Args:
            prompt: 用戶的分析查詢請求
            task_id: 任務 ID
            timeout: 查詢超時時間（秒）
            device_ips: 限制分析的設備 IP 範圍

        Returns:
            Dict: 包含 response 和 token_cost 的結果

        Raises:
            ExternalServiceError: AI 服務不可用或查詢失敗
        """
        if not self.ai_initialized or not self.agent_executor:
            raise ai_error("AI", "AI 服務未啟用或初始化失敗", "AI_NOT_AVAILABLE")

        # 構建系統上下文
        system_context = f"""【查詢上下文】
查詢 ID: {task_id}
時間戳記: {time.time()}
設備範圍: {device_ips or '所有設備'}
回應語言: 繁體中文 (zh_TW)

【強制要求】
0. **語言要求**: 必須使用繁體中文回應，專業術語可保留英文但需加中文說明
1. 必須提供 5-8 項詳細的 key_findings，格式："[指標]: [值] (正常範圍: [範圍])"
2. 必須提供 3-5 項具體建議，涵蓋立即行動、預防性維護、監控建議等層面
3. 必須執行工具獲取真實數據，不可憑空編造
4. 每個數據點都要包含實際測量值和狀態評估

【用戶查詢】"""

        enhanced_prompt = f"{system_context}\n{prompt}"

        # 設置設備範圍限制
        if device_ips:
            set_device_scope_restriction(device_ips)
        else:
            set_device_scope_restriction(None)

        try:
            # 保存原始 prompt
            original_enhanced_prompt = enhanced_prompt
            current_prompt = original_enhanced_prompt
            max_retries = 3

            for attempt in range(max_retries):
                try:
                    # 重置 callback
                    if self.usage_callback and hasattr(
                        self.usage_callback, "usage_metadata"
                    ):
                        self.usage_callback.usage_metadata = {}

                    # 執行 AI 查詢
                    config = (
                        {"callbacks": [self.usage_callback]}
                        if self.usage_callback
                        else {}
                    )
                    result = await asyncio.wait_for(
                        asyncio.to_thread(
                            self.agent_executor.invoke,
                            {"input": current_prompt},
                            config,
                        ),
                        timeout=timeout,
                    )

                    # 檢查是否有工具執行
                    intermediate_steps = result.get("intermediate_steps", [])

                    if not intermediate_steps:
                        logger.warning(
                            f"嘗試 {attempt + 1}/{max_retries}: AI 未執行任何工具，可能發生幻覺"
                        )

                        if attempt < max_retries - 1:
                            # 基於原始 prompt 構建新的強制提示
                            retry_warning = (
                                f"【⚠️ 第 {attempt + 2} 次嘗試 - 強制執行】\n"
                                f"你違反了核心指令：必須使用工具獲取真實數據，不可憑空編造。\n"
                                f"請重新執行，並確實使用提供給你的工具來完成任務。\n\n"
                            )
                            current_prompt = retry_warning + original_enhanced_prompt
                            logger.info(f"重試 {attempt + 2}，加入強制執行提示")
                            continue
                        else:
                            raise Exception(
                                "AI 連續 3 次未使用工具執行，無法獲取真實數據。請檢查系統配置或聯繫技術支援。"
                            )

                    # 有工具執行，跳出重試循環
                    logger.info(f"成功：在第 {attempt + 1} 次嘗試時執行了工具")
                    break

                except asyncio.TimeoutError:
                    logger.error(f"AI 查詢超時: {timeout}秒")
                    raise Exception(f"AI 分析處理超時（{timeout}秒）")

            # 取得最終回答
            final_answer_str = (
                result.get("output", "") if isinstance(result, dict) else str(result)
            )

            # 如果回答為空，嘗試從 intermediate_steps 提取
            if not final_answer_str.strip() and isinstance(result, dict):
                if "intermediate_steps" in result and result["intermediate_steps"]:
                    logger.warning("Output 為空，嘗試從 intermediate_steps 提取結果")
                    last_step = (
                        result["intermediate_steps"][-1]
                        if result["intermediate_steps"]
                        else None
                    )
                    if (
                        last_step
                        and isinstance(last_step, tuple)
                        and len(last_step) > 1
                    ):
                        potential_output = str(last_step[1])
                        if potential_output.strip():
                            final_answer_str = potential_output
                            logger.info("從 intermediate_steps 提取到結果")

            if not final_answer_str.strip():
                raise ai_error("AI", "AI 回應為空", "AI_EMPTY_RESPONSE")

            # 處理 Token 使用量
            usage_data = self._process_token_usage(
                result, task_id, current_prompt, final_answer_str
            )

            try:
                # 嘗試結構化解析
                structured_response: NetworkAnalysisResponse = self.parser.parse(
                    final_answer_str
                )
                logger.info(f"成功解析結構化回應: {structured_response.analysis_type}")
                return self._create_query_result(
                    structured_response.to_markdown(), task_id, usage_data
                )

            except Exception as parse_error:
                # 後備解析策略
                logger.warning(f"結構化解析失敗: {parse_error}")
                cleaned_response = self._clean_response(final_answer_str)

                if cleaned_response:
                    logger.info("使用後備解析策略")
                    return self._create_query_result(
                        cleaned_response, task_id, usage_data
                    )
                else:
                    raise Exception(f"結構化解析和後備解析都失敗: {parse_error}")

        except asyncio.TimeoutError:
            logger.error(f"AI 查詢超時: {timeout}秒")
            raise Exception(f"AI 分析處理超時（{timeout}秒）- 請縮短查詢內容或稍後重試")
        except Exception as e:
            error_str = str(e)
            logger.error(f"AI 查詢執行失敗: {error_str}")
            error_msg, status_code = self.classify_ai_error(error_str)
            raise Exception(error_msg)
        finally:
            # 清除設備範圍限制
            set_device_scope_restriction(None)

    def _process_token_usage(
        self, result: Any, task_id: str, input_text: str, output_text: str
    ) -> Dict[str, Any]:
        """處理 Token 使用量計算和記錄"""
        usage_data = self.token_calculator.extract_token_usage(result)

        # 如果無法提取精確數據，使用估算
        if not usage_data:
            usage_data = self.token_calculator.estimate_token_usage(
                input_text, output_text
            )

        if usage_data:
            model = (
                settings.CLAUDE_MODEL
                if settings.AI_PROVIDER == "claude"
                else settings.GEMINI_MODEL
            )
            cost = self.token_calculator.calculate_cost(
                settings.AI_PROVIDER,
                model,
                usage_data.get("input_tokens", 0),
                usage_data.get("output_tokens", 0),
            )
            self.token_logger.log_usage(
                task_id, settings.AI_PROVIDER, model, usage_data, cost
            )

        return usage_data or {}

    def _clean_response(self, response: str) -> str:
        """清理 AI 回應文本"""
        cleaned = response.strip()

        # 清理常見的標記
        markers = ["Final Answer:", "The final answer is"]
        for marker in markers:
            if marker in cleaned:
                cleaned = cleaned.split(marker)[-1].strip()

        # 清理 markdown 代碼塊
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # 移除殘留標記
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        return cleaned

    def _create_query_result(
        self, response_text: str, task_id: str, usage_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """建立查詢結果"""
        token_cost = None

        if usage_data:
            provider = settings.AI_PROVIDER
            model = (
                settings.CLAUDE_MODEL if provider == "claude" else settings.GEMINI_MODEL
            )

            token_cost = {
                "input_tokens": usage_data.get("input_tokens", 0),
                "output_tokens": usage_data.get("output_tokens", 0),
                "total_tokens": usage_data.get("total_tokens", 0),
                "estimated_cost_usd": self.token_calculator.calculate_cost(
                    provider,
                    model,
                    usage_data.get("input_tokens", 0),
                    usage_data.get("output_tokens", 0),
                ),
                "provider": provider,
                "model": model,
                "is_estimated": usage_data.get("estimated", False),
            }

        return {"response": response_text, "token_cost": token_cost}

    def classify_ai_error(self, error_str: str) -> Tuple[str, int]:
        """分類 AI API 錯誤並返回錯誤訊息和狀態碼"""
        ai_provider = settings.AI_PROVIDER
        error_lower = error_str.lower()

        # 配額和頻率限制錯誤
        if any(
            keyword in error_lower
            for keyword in [
                "429",
                "quota",
                "rate limit",
                "exceeded",
                "limit",
                "已用完",
                "resource_exhausted",
            ]
        ):
            if ai_provider == "claude":
                return "Claude API 請求頻率限制，請稍後再試（建議等待 1-2 分鐘）", 429
            else:
                return (
                    "Google Gemini API 免費額度已用完（50次/日），請等待明天重置或升級付費方案。或者嘗試使用 Claude AI。",
                    429,
                )

        # 認證錯誤
        elif any(
            keyword in error_lower
            for keyword in ["401", "unauthorized", "invalid api key"]
        ):
            return f"{ai_provider.upper()} API 認證失敗，請檢查 API Key 設定", 401

        # 權限錯誤
        elif "403" in error_str or "forbidden" in error_lower:
            return f"{ai_provider.upper()} API 權限不足，請檢查 API Key 權限設定", 403

        # 服務器錯誤
        elif "500" in error_str or "internal server error" in error_lower:
            service_name = "Claude AI" if ai_provider == "claude" else "Google AI"
            return f"{service_name} 服務暫時不可用，請稍後再試", 502

        # 網路錯誤
        elif any(
            keyword in error_lower for keyword in ["network", "connection", "timeout"]
        ):
            return "網路連接問題，請檢查網路連接後重試", 503

        else:
            return f"{ai_provider.upper()} AI 查詢執行失敗: {error_str}", 500

    def get_ai_status(self) -> Dict[str, Any]:
        """獲取 AI 智能分析服務的狀態資訊"""
        return {
            "ai_available": AI_AVAILABLE,
            "ai_initialized": self.ai_initialized,
            "ai_provider": settings.AI_PROVIDER,
            "pydantic_parser_enabled": True,
            "environment_config": {
                "PARSER_VERSION": settings.PARSER_VERSION,
            },
        }


# 全域 AI 服務實例
_ai_service = None


def get_ai_service() -> AIService:
    """獲取全域 AI 智能分析服務實例

    單例模式的 AI 服務，確保在應用程式中
    使用相同的 AI 配置和狀態。
    """
    global _ai_service
    if _ai_service is None:
        logger.info("建立 AI 服務實例")
        _ai_service = AIService()
    return _ai_service
