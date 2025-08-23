#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 服務模組 - 統一管理 AI 系統初始化、處理和工具整合
支援 Google Gemini 和 Claude AI 雙引擎，提供智能網路分析和批次操作
"""

import asyncio
import logging
import os
import time
import uuid
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

# AI 服務相關導入
try:
    import warnings

    from langchain import hub
    from langchain.agents import AgentExecutor, create_react_agent
    from langchain_anthropic import ChatAnthropic
    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.prompts import PromptTemplate
    from langchain_core.tools import Tool
    from langchain_google_genai import ChatGoogleGenerativeAI

    warnings.filterwarnings("ignore")
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False


from common import NetworkAnalysisResponse
from exceptions import ExternalServiceError, ai_error
from network import batch_command_wrapper, set_device_scope_restriction
from prompt_manager import get_prompt_manager
from settings import settings

logger = logging.getLogger(__name__)


# AI 服務模組，使用 PromptManager 進行提示詞管理


def _get_few_shot_examples():
    """使用 PromptManager 獲取思考鏈範例（重構版）"""
    try:
        # 獲取 PromptManager 實例
        prompt_manager = get_prompt_manager()

        # 使用 PromptManager 渲染思考鏈範例
        return prompt_manager.render_react_examples()
    except Exception as e:
        logger.error(f"獲取思考鏈範例失敗: {e}")
        # 返回空字串作為後備，避免完全失敗
        return ""


def get_ai_logger():
    """建立 AI 專用日誌記錄器"""
    import logging

    ai_logger = logging.getLogger("ai_service")
    ai_logger.setLevel(logging.INFO)
    return ai_logger


ai_logger = get_ai_logger()


class OutputSummarizer:
    """AI 輸出摘要器 - 處理超長指令輸出"""

    def __init__(self, ai_provider: str = None, model_name: str = None):
        self.ai_provider = ai_provider or settings.AI_PROVIDER
        self.max_tokens = 2048
        self.llm = None

        if self.ai_provider == "claude":
            self.model_name = model_name or settings.CLAUDE_MODEL
        else:
            self.model_name = model_name or settings.GEMINI_MODEL

        self._initialize_ai_service()

    def _initialize_ai_service(self):
        """初始化 AI 服務"""
        if self.ai_provider == "claude":
            self._initialize_claude()
        else:
            self._initialize_gemini()

    def _initialize_claude(self):
        """初始化 Claude AI"""
        if not AI_AVAILABLE:
            logger.warning("未安裝 langchain_anthropic")
            return

        api_key = settings.CLAUDE_API_KEY
        if not api_key:
            logger.warning("未設定 CLAUDE_API_KEY")
            return

        try:
            self.llm = ChatAnthropic(
                model=self.model_name,
                temperature=0,
                max_tokens=self.max_tokens,
                anthropic_api_key=api_key,
            )
            logger.info("Claude 摘要器初始化成功")
            ai_logger.info(f"[CLAUDE] 摘要器初始化成功 - 模型: {self.model_name}")
        except Exception as e:
            logger.error(f"Claude 初始化失敗: {e}")
            self.llm = None

    def _initialize_gemini(self):
        """初始化 Gemini AI"""
        if not AI_AVAILABLE:
            logger.warning("未安裝 langchain_google_genai")
            return

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("未設定 GEMINI_API_KEY")
            return

        try:
            self.llm = ChatGoogleGenerativeAI(
                model=self.model_name, temperature=0, max_output_tokens=self.max_tokens
            )
            logger.info("Gemini 摘要器初始化成功")
            ai_logger.info(f"[GEMINI] 摘要器初始化成功 - 模型: {self.model_name}")
        except Exception as e:
            logger.error(f"Gemini 初始化失敗: {e}")
            self.llm = None

    def get_summary_prompt(self, command: str) -> str:
        """摘要提示詞"""
        return f"""請摘要以下網路指令輸出，保留關鍵診斷資訊，移除冗餘內容：

指令：{command}

要求：
1. 保留錯誤、警告、異常狀態、重要數值
2. 移除重複內容和無關細節
3. 維持技術術語準確性
4. 使用繁體中文
5. 開頭標註：「[AI摘要] 原輸出過長，以下為智能摘要：」

請直接輸出摘要結果。"""

    def summarize_output(self, command: str, output: str) -> str:
        """AI 摘要超長輸出"""
        if not self.llm:
            logger.warning(f"AI 摘要器不可用: {command}")
            return self._fallback_truncate(command, output)

        try:
            logger.info(f"開始 AI 摘要: {command}")
            ai_logger.info(
                f"[{self.ai_provider.upper()}] 摘要開始 - 指令: {command}, 長度: {len(output)}"
            )

            prompt = self.get_summary_prompt(command)
            response = self.llm.invoke(f"{prompt}\n\n輸出內容：\n{output}")

            if response and hasattr(response, "content"):
                summary = response.content.strip()
                compression = round((1 - len(summary) / len(output)) * 100, 1)
                logger.info(f"摘要完成: {command}, 壓縮率: {compression}%")
                ai_logger.info(
                    f"[{self.ai_provider.upper()}] 摘要完成 - 壓縮率: {compression}%"
                )
                return summary

            logger.warning(f"AI 摘要失敗: {command}")
            return self._fallback_truncate(command, output)

        except Exception as e:
            logger.error(f"AI 摘要錯誤: {e}")
            ai_logger.error(
                f"[{self.ai_provider.upper()}] 摘要失敗 - {command}: {str(e)[:100]}"
            )
            return self._fallback_truncate(command, output)

    def _fallback_truncate(
        self, command: str, output: str, max_chars: int = 10000
    ) -> str:
        """備援截斷"""
        return (
            output[:max_chars] + f"\n\n--- [警告] 指令 '{command}' 輸出過長已截斷 ---"
        )


class AIService:
    """AI 服務管理器 - 統一管理 AI 初始化、工具配置和查詢處理"""

    def __init__(self):
        self.agent_executor = None
        self.ai_initialized = False

        # 初始化 PydanticOutputParser
        self.parser = PydanticOutputParser(pydantic_object=NetworkAnalysisResponse)

        # 初始化提示詞管理器
        self.prompt_manager = get_prompt_manager()

        # 初始化 AI 系統
        self._initialize_ai()

    def _initialize_ai(self) -> bool:
        """初始化 AI 系統（支援 Gemini 和 Claude）

        Returns:
            bool: 初始化是否成功
        """
        if not AI_AVAILABLE:
            logger.warning("AI 功能不可用，跳過初始化")
            return False

        try:
            # 檢查環境變數載入狀態 (使用 Settings)
            google_api_key = settings.GEMINI_API_KEY
            anthropic_api_key = settings.CLAUDE_API_KEY
            ai_provider = settings.AI_PROVIDER

            # 記錄初始化資訊
            debug_msg = f"AI 初始化開始 - 提供者: {ai_provider}"
            logger.info(debug_msg)

            if ai_provider == "gemini":
                if google_api_key:
                    logger.info("Google API Key 已載入")
                else:
                    error_msg = "Google API Key 未設定，無法初始化 Gemini"
                    logger.error(error_msg)
                    return False
            elif ai_provider == "claude":
                if anthropic_api_key:
                    logger.info("Anthropic API Key 已載入")
                else:
                    error_msg = "Anthropic API Key 未設定，無法初始化 Claude"
                    logger.error(error_msg)
                    return False

            # 根據提供者初始化對應的 LLM
            if ai_provider == "claude":
                llm = self._initialize_claude()
            else:
                llm = self._initialize_gemini()

            if llm is None:
                error_msg = f"{ai_provider.upper()} LLM 初始化失敗"
                logger.error(error_msg)
                return False

            # 建立工具清單
            tools = self._create_tools()

            # 創建包含結構化輸出格式指令的自定義提示詞
            prompt_template = self._create_custom_prompt_template()
            agent = create_react_agent(llm, tools, prompt_template)
            self.agent_executor = AgentExecutor(
                agent=agent, tools=tools, verbose=False, handle_parsing_errors=True
            )

            # 記錄初始化成功
            init_success_message = (
                f"AI system initialized successfully (提供者: {ai_provider.upper()})"
            )
            logger.info(init_success_message)

            # 記錄到 AI 專用日誌
            ai_logger.info(
                f"[{ai_provider.upper()}] AI 系統初始化成功 - 模型: {llm.__class__.__name__}"
            )

            self.ai_initialized = True
            return True

        except Exception as e:
            logger.error(f"AI system initialization failed: {e}")
            return False

    def _initialize_claude(self):
        """初始化 Claude AI"""
        api_key = settings.CLAUDE_API_KEY
        if not api_key:
            logger.warning("CLAUDE_API_KEY not set, Claude AI features unavailable")
            return None

        try:
            # 從 Settings 讀取 Claude 模型
            claude_model = settings.CLAUDE_MODEL
            llm = ChatAnthropic(
                model=claude_model, temperature=0, anthropic_api_key=api_key
            )
            # 記錄初始化資訊
            init_message = f"使用 Claude AI 作為主要 AI 提供者 - 模型: {claude_model}"
            logger.info(init_message)
            return llm
        except Exception as e:
            logger.error(f"Claude AI 初始化失敗: {e}")
            return None

    def _initialize_gemini(self):
        """初始化 Gemini AI"""
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            error_msg = "GEMINI_API_KEY 未設定，Gemini AI 功能不可用"
            logger.warning(error_msg)
            return None

        try:
            # 從 Settings 讀取 Gemini 模型
            gemini_model = settings.GEMINI_MODEL

            # 記錄初始化資訊
            init_start_msg = f"開始初始化 Gemini AI - 模型: {gemini_model}"
            logger.info(init_start_msg)

            llm = ChatGoogleGenerativeAI(
                model=gemini_model, temperature=0, google_api_key=api_key
            )

            # 記錄成功訊息
            success_msg = f"Gemini AI 初始化成功 - 模型: {gemini_model}"
            logger.info(success_msg)
            return llm

        except Exception as e:
            error_msg = f"Gemini AI 初始化失敗: {type(e).__name__}: {str(e)}"
            logger.error(error_msg)

            # 詳細的錯誤診斷
            if "429" in str(e) or "quota" in str(e).lower():
                quota_msg = "可能是 API 配額已用完或請求頻率過高"
                logger.error(quota_msg)
            elif "401" in str(e) or "unauthorized" in str(e).lower():
                auth_msg = "API Key 可能無效或權限不足"
                logger.error(auth_msg)
            elif "import" in str(e).lower() or "module" in str(e).lower():
                import_msg = (
                    "可能缺少必要的套件，請檢查 langchain-google-genai 是否正確安裝"
                )
                logger.error(import_msg)

            return None

    def _create_tools(self) -> List[Tool]:
        """建立 AI 工具清單"""
        tools = [
            Tool(
                name="BatchCommandRunner",
                func=batch_command_wrapper,
                description="""
                網路設備指令執行工具 - 自動執行安全的 show 類指令並返回結構化結果。

                **關鍵限制**：
                - 每次調用只能執行一個指令
                - 多個指令必須分別調用此工具多次
                - 絕對禁止在沒有執行的情況下虛構結果

                **重要說明**：
                - 工具會自動驗證指令安全性，只執行允許的唯讀指令
                - 支援所有標準的 show 指令（如 show version, show interface, show environment, show platform 等）
                - 執行成功時會返回完整的設備輸出資料
                - 執行失敗時會提供詳細的錯誤分析和建議

                **輸入格式**: 
                - "device_ip: command" (單一設備執行單一指令)
                - "device_ip1,device_ip2: command" (多設備執行同一指令)
                - "command" (所有設備執行同一指令)

                **多指令執行範例**:
                錯誤方式：
                - "202.153.183.18: show clock; show platform" ❌ (不支援分號分隔)
                - "202.153.183.18: show clock and show platform" ❌ (不支援 and 連接)

                正確方式：
                1. 第一次調用："202.153.183.18: show clock"
                2. 第二次調用："202.153.183.18: show platform"
                3. 整合兩次結果進行分析

                **使用例子**: 
                - "203.0.113.20: show environment" (查詢單一設備環境狀態)
                - "203.0.113.20,203.0.113.21: show version" (查詢多設備版本)
                - "show interface status" (查詢所有設備介面狀態)

                **執行結果格式**：
                工具會返回一個 JSON 格式的字串，包含以下結構：
                {
                  "summary": {
                    "command": "執行的指令",
                    "total_devices": 總設備數,
                    "successful_devices": 成功設備數,
                    "failed_devices": 失敗設備數,
                    "execution_time_seconds": 執行時間(秒),
                    "cache_stats": {"hits": 快取命中次數, "misses": 快取未命中次數}
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

                **重要**：你必須解析這個 JSON 結果來獲取設備的輸出和錯誤資訊，然後提供專業的分析和建議。
                """,
            )
        ]

        return tools

    def _create_custom_prompt_template(self) -> PromptTemplate:
        """建立自定義的 ReAct 提示詞模板，整合 PydanticOutputParser 格式指令

        Returns:
            PromptTemplate: 整合結構化輸出格式的提示詞模板
        """
        # 獲取格式指令並處理特殊字符，避免 LangChain 變數衝突
        format_instructions = self.parser.get_format_instructions()
        # 將 format_instructions 中的花括號轉義，避免被當作 LangChain 變數
        escaped_format_instructions = format_instructions.replace("{", "{{").replace(
            "}", "}}"
        )

        # 使用提示詞管理器獲取系統提示詞
        base_prompt = self.prompt_manager.render_system_prompt(
            search_enabled=False,
            format_instructions=escaped_format_instructions,
        )

        # 對 base_prompt 中的花括號進行轉義，避免 LangChain PromptTemplate 將其視為變數
        escaped_base_prompt = base_prompt.replace("{", "{{").replace("}", "}}")

        # 建立 ReAct 工作流程模板
        template = f"""{escaped_base_prompt}

Answer the following questions as best you can. You have access to the following tools:

{{tools}}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{{tool_names}}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: 請按照上面 output_format 部分指定的 JSON 格式回應

Question: {{input}}
{{agent_scratchpad}}"""

        return PromptTemplate(
            template=template,
            input_variables=["input", "agent_scratchpad"],
            partial_variables={
                "tools": "\n".join(
                    [
                        f"{tool.name}: {tool.description}"
                        for tool in self._create_tools()
                    ]
                ),
                "tool_names": ", ".join([tool.name for tool in self._create_tools()]),
            },
        )

    async def query_ai(
        self,
        prompt: str,
        timeout: float = 60.0,
        include_examples: bool = True,
        device_ips: List[str] = None,
    ) -> str:
        """執行 AI 查詢，使用 PydanticOutputParser 異化輸出格式

        Args:
            prompt: AI 查詢提示詞
            timeout: 查詢超時時間（秒）
            include_examples: 是否自動包含思考鏈範例（預設True）
            device_ips: 限制執行的設備 IP 列表（可選）

        Returns:
            str: 格式化的 Markdown 結果

        Raises:
            ExternalServiceError: 當 AI 服務未初始化或查詢失敗時
        """
        if not self.ai_initialized or not self.agent_executor:
            raise ai_error("Gemini", "AI 服務未啟用或初始化失敗", "AI_NOT_AVAILABLE")

        # 使用 PromptManager 統一處理提示詞構建
        unique_id = uuid.uuid4()
        enhanced_prompt = self.prompt_manager.render_query_prompt(
            user_query=prompt,
            include_examples=include_examples,
            enable_guardrails=True,
            query_uuid=str(unique_id),
            timestamp=time.time(),
            device_scope_restriction=device_ips,
        )

        # 設置線程本地設備範圍限制（保留原有機制）
        if device_ips:
            set_device_scope_restriction(device_ips)
        else:
            set_device_scope_restriction(None)

        try:
            # 執行 AI 查詢
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    self.agent_executor.invoke, {"input": enhanced_prompt}
                ),
                timeout=timeout,
            )

            # 記錄原始結果用於調試
            ai_logger.debug(f"AI 回應原始結果類型: {type(result)}")
            if isinstance(result, dict):
                ai_logger.debug(f"AI 回應鍵值: {list(result.keys())}")

            # 取得 Agent 的最終回答
            final_answer_str = (
                result.get("output", "") if isinstance(result, dict) else str(result)
            )

            if not final_answer_str.strip():
                raise ai_error("Gemini", "AI 回應為空", "AI_EMPTY_RESPONSE")

            try:
                # 使用 PydanticOutputParser 解析結構化輸出
                structured_response: NetworkAnalysisResponse = self.parser.parse(
                    final_answer_str
                )

                # 記錄成功解析
                ai_logger.info(
                    f"成功解析結構化回應: {structured_response.analysis_type}"
                )

                # 轉換為 Markdown 格式返回前端
                return structured_response.to_markdown()

            except Exception as parse_error:
                # 如果結構化解析失敗，嘗試後備解析
                ai_logger.warning(f"PydanticOutputParser 解析失敗: {parse_error}")
                ai_logger.warning(f"原始輸出: {final_answer_str[:500]}...")

                # 後備策略：嘗試直接返回清理後的文本
                cleaned_response = final_answer_str.strip()

                # 清理 Final Answer 標記
                if "Final Answer:" in cleaned_response:
                    cleaned_response = cleaned_response.split("Final Answer:")[
                        -1
                    ].strip()
                if "The final answer is" in cleaned_response:
                    cleaned_response = cleaned_response.replace(
                        "The final answer is", ""
                    ).strip()

                # 清理 markdown 代碼塊標記
                if cleaned_response.startswith("```"):
                    # 移除開頭的 ```json 或 ```
                    lines = cleaned_response.split("\n")
                    if lines[0].startswith("```"):
                        lines = lines[1:]  # 移除第一行
                    if lines and lines[-1].strip() == "```":
                        lines = lines[:-1]  # 移除最後一行
                    cleaned_response = "\n".join(lines).strip()

                # 如果還有殘留的 ``` 標記，嘗試直接移除
                cleaned_response = (
                    cleaned_response.replace("```json", "").replace("```", "").strip()
                )

                if cleaned_response:
                    ai_logger.info("使用後備解析策略")
                    return cleaned_response
                else:
                    raise Exception(f"結構化解析和後備解析都失敗: {parse_error}")

        except asyncio.TimeoutError:
            ai_logger.error(f"AI 查詢超時: {timeout}秒")
            raise Exception(f"AI 分析處理超時（{timeout}秒）- 請縮短查詢內容或稍後重試")
        except Exception as e:
            error_str = str(e)
            ai_logger.error(f"AI 查詢執行失敗: {error_str}")

            # 檢查是否是 API 配額錯誤
            if (
                "429" in error_str
                or "quota" in error_str.lower()
                or "rate limit" in error_str.lower()
            ):
                ai_logger.error("API 配額已用完")
                raise Exception(
                    "Google Gemini API 免費額度已用完（50次/日），請等待明天重置或升級付費方案"
                )
            elif "401" in error_str or "unauthorized" in error_str.lower():
                ai_logger.error("API 認證失敗")
                raise Exception("AI API 認證失敗，請檢查 API Key 設定")
            else:
                raise Exception(f"AI 查詢執行失敗: {error_str}")
        finally:
            # 清除線程本地設備範圍限制，確保不會影響後續查詢
            set_device_scope_restriction(None)

    def classify_ai_error(self, error_str: str) -> Tuple[str, int]:
        """分類 AI API 錯誤並返回錯誤訊息和狀態碼

        Args:
            error_str: 錯誤訊息字串

        Returns:
            (錯誤訊息, HTTP狀態碼)
        """
        ai_provider = settings.AI_PROVIDER

        error_lower = error_str.lower()

        # 配額和頻率限制錯誤 - 擴大檢查範圍
        if (
            "429" in error_str
            or "quota" in error_lower
            or "rate limit" in error_lower
            or "exceeded" in error_lower
            or "limit" in error_lower
            or "已用完" in error_str
            or "resource_exhausted" in error_lower
            or "usage_limit" in error_lower
        ):

            ai_logger.error(f"API 配額錯誤: {error_str}")

            if ai_provider == "claude":
                error_msg = "Claude API 請求頻率限制，請稍後再試（建議等待 1-2 分鐘）"
            else:
                error_msg = "Google Gemini API 免費額度已用完（50次/日），請等待明天重置或升級付費方案。或者嘗試使用 Claude AI。"
            return error_msg, 429

        elif (
            "401" in error_str
            or "unauthorized" in error_str.lower()
            or "invalid api key" in error_str.lower()
        ):
            error_msg = f"{ai_provider.upper()} API 認證失敗，請檢查 API Key 設定"
            return error_msg, 401

        elif "403" in error_str or "forbidden" in error_str.lower():
            error_msg = f"{ai_provider.upper()} API 權限不足，請檢查 API Key 權限設定"
            return error_msg, 403

        elif "500" in error_str or "internal server error" in error_str.lower():
            if ai_provider == "claude":
                error_msg = "Claude AI 服務暫時不可用，請稍後再試"
            else:
                error_msg = "Google AI 服務暫時不可用，請稍後再試"
            return error_msg, 502

        elif (
            "network" in error_str.lower()
            or "connection" in error_str.lower()
            or "timeout" in error_str.lower()
        ):
            error_msg = "網路連接問題，請檢查網路連接後重試"
            return error_msg, 503

        else:
            error_msg = f"{ai_provider.upper()} AI 查詢執行失敗: {error_str}"
            return error_msg, 500

    def get_ai_status(self) -> Dict[str, Any]:
        """取得 AI 服務狀態

        Returns:
            AI 服務狀態字典
        """
        ai_provider = settings.AI_PROVIDER

        # 返回 AI 服務狀態資訊
        return {
            "ai_available": AI_AVAILABLE,
            "ai_initialized": self.ai_initialized,
            "ai_provider": ai_provider,
            "pydantic_parser_enabled": True,
            "environment_config": {
                "PARSER_VERSION": settings.PARSER_VERSION,
            },
        }


# 全域 AI 服務實例
_ai_service = None


def get_ai_service() -> AIService:
    """取得 AI 服務實例（簡化版本）"""
    global _ai_service
    if _ai_service is None:
        logger.info("建立 AI 服務實例")
        _ai_service = AIService()
    return _ai_service


# AI 摘要服務實例（用於超長輸出處理）
output_summarizer = OutputSummarizer()
