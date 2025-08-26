#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 智能分析服務模組

提供網路設備的 AI 智能分析和查詢功能：
- Google Gemini 和 Anthropic Claude 雙 AI 引擎支援
- 網路設備指令執行和結果分析
- 自動化的輸出摘要和長文本處理
- ReAct 代理和工具串接
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
    from langchain_core.callbacks import UsageMetadataCallbackHandler
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
    """獲取 AI 思考鏈示範範例

    透過提示詞管理器載入預定義的 ReAct 範例，
    幫助 AI 理解如何逐步分析網路問題。
    """
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
    """建立 AI 模組專用的日誌記錄器

    獨立的日誌通道，用於追蹤 AI 服務的執行狀態。
    只輸出到控制台，不寫入檔案。
    """
    import logging

    ai_logger = logging.getLogger("ai_service")
    # 使用 DEBUG 級別以顯示更多診斷資訊
    ai_logger.setLevel(logging.DEBUG)

    # 確保 ai_logger 不會重複添加 handler
    if not ai_logger.handlers:
        # 創建控制台處理器，用於 token 使用量的特殊顯示
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)

        # 創建自定義格式器，突出顯示 TOKEN_USAGE 信息
        class TokenUsageFormatter(logging.Formatter):
            def format(self, record):
                if "TOKEN_USAGE_ESTIMATED:" in record.getMessage():
                    # 為 token 估算值創建特殊格式
                    return f"📊 [TOKEN-估算] {record.getMessage().replace('TOKEN_USAGE_ESTIMATED: ', '')}"
                elif "TOKEN_USAGE:" in record.getMessage():
                    # 為 token 使用量創建特殊格式
                    return f"💰 [TOKEN] {record.getMessage()}"
                else:
                    # 使用統一標準格式
                    return f"🤖 [AI] {record.levelname}: {record.getMessage()}"

        formatter = TokenUsageFormatter()
        console_handler.setFormatter(formatter)
        ai_logger.addHandler(console_handler)

        # 防止日誌消息傳播到根日誌記錄器（避免重複）
        ai_logger.propagate = False

    return ai_logger


ai_logger = get_ai_logger()


class OutputSummarizer:
    """設備輸出內容的智能摘要服務

    當網路設備輸出過長時，使用 AI 進行摘要和總結，
    保留關鍵資訊同時減少冗餘內容。
    """

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
        """根據配置初始化對應的 AI 服務

        根據 ai_provider 設定選擇 Gemini 或 Claude 進行初始化。
        """
        if self.ai_provider == "claude":
            self._initialize_claude()
        else:
            self._initialize_gemini()

    def _initialize_claude(self):
        """配置 Anthropic Claude 摘要服務

        使用 Claude API 金鑰和指定模型初始化摘要器。
        """
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
        """配置 Google Gemini 摘要服務

        使用 Gemini API 金鑰和指定模型初始化摘要器。
        """
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
        """產生設備輸出摘要的提示詞

        建立結構化的提示，指導 AI 保留關鍵訊息。
        """
        return f"""請摘要以下網路指令輸出，保留關鍵診斷資訊：

指令：{command}

要求：
1. 保留錯誤、警告、異常狀態、重要數值
2. 排除重複內容和無關細節
3. 維持技術術語準確性
4. 使用繁體中文
5. 開頭標註：「[AI摘要] 原輸出過長，以下為智能摘要：」

請直接輸出摘要結果。"""

    def summarize_output(self, command: str, output: str) -> str:
        """使用 AI 摘要設備輸出內容

        將超長的設備輸出透過 AI 進行摘要，保留關鍵資訊。
        """
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
        """當 AI 摘要失敗時的後備處理

        簡單地截斷輸出內容並附上警告訊息。
        """
        return (
            output[:max_chars] + f"\n\n--- [警告] 指令 '{command}' 輸出過長已截斷 ---"
        )


class AIService:
    """主要的 AI 智能分析服務管理器

    管理 AI 服務的初始化、工具配置和查詢處理：
    - 支援 Gemini 和 Claude 雙引擎自動切換
    - ReAct Agent 模式的思考鏈分析
    - 網路設備指令工具介接
    - 結構化輸出和格式化管理
    """

    def __init__(self):
        """初始化 AI 智能分析服務

        設定 AI 代理、輸出解析器和提示詞管理器。
        """
        self.agent_executor = None
        self.ai_initialized = False

        # 初始化 PydanticOutputParser
        self.parser = PydanticOutputParser(pydantic_object=NetworkAnalysisResponse)

        # 初始化提示詞管理器
        self.prompt_manager = get_prompt_manager()

        # 初始化 Token 使用量追蹤
        self.usage_callback = UsageMetadataCallbackHandler() if AI_AVAILABLE else None
        ai_logger.debug(
            f"UsageMetadataCallbackHandler 初始化: {self.usage_callback is not None}"
        )

        # 初始化 AI 系統
        self._initialize_ai()

    def _initialize_ai(self) -> bool:
        """初始化和配置 AI 智能分析引擎

        檢查 API 金鑰可用性，初始化選擇的 AI 提供者，
        建立 ReAct 代理和工具連接。

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
                agent=agent,
                tools=tools,
                verbose=False,
                handle_parsing_errors=True,
                return_intermediate_steps=True,  # 啟用中間步驟返回以便提取 token 使用量
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
                model=claude_model,
                temperature=0,
                anthropic_api_key=api_key,
                callbacks=[self.usage_callback] if self.usage_callback else [],
            )
            # 記錄初始化資訊
            init_message = f"使用 Claude AI 作為主要 AI 提供者 - 模型: {claude_model}"
            logger.info(init_message)
            ai_logger.debug(
                f"Claude LLM 初始化完成，callback 已配置: {self.usage_callback is not None}"
            )
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
                model=gemini_model,
                temperature=0,
                google_api_key=api_key,
                callbacks=[self.usage_callback] if self.usage_callback else [],
            )

            # 記錄成功訊息
            success_msg = f"Gemini AI 初始化成功 - 模型: {gemini_model}"
            logger.info(success_msg)
            ai_logger.debug(
                f"Gemini LLM 初始化完成，callback 已配置: {self.usage_callback is not None}"
            )
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
                3. 綜合兩次結果進行分析

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
        """建立自定義的 ReAct 提示詞模板，包含 PydanticOutputParser 格式指令

        Returns:
            PromptTemplate: 包含結構化輸出格式的提示詞模板
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
        task_id: str,
        timeout: float = 120.0,
        include_examples: bool = True,
        device_ips: List[str] = None,
    ) -> str:
        """執行 AI 智能分析查詢

        使用 ReAct 代理模式進行網路設備分析，產生結構化的
        Markdown 格式分析報告。

        Args:
            prompt: 用戶的分析查詢請求
            timeout: 查詢超時時間（秒）
            include_examples: 是否包含思考鏈示範範例
            device_ips: 限制分析的設備 IP 範圍

        Returns:
            str: Markdown 格式的分析報告

        Raises:
            ExternalServiceError: AI 服務不可用或查詢失敗
        """
        if not self.ai_initialized or not self.agent_executor:
            raise ai_error("Gemini", "AI 服務未啟用或初始化失敗", "AI_NOT_AVAILABLE")

        # 使用 PromptManager 處理提示詞構建
        enhanced_prompt = self.prompt_manager.render_query_prompt(
            user_query=prompt,
            include_examples=include_examples,
            enable_guardrails=True,
            query_uuid=task_id,
            timestamp=time.time(),
            device_scope_restriction=device_ips,
        )

        # 設置線程本地設備範圍限制（保留原有機制）
        if device_ips:
            set_device_scope_restriction(device_ips)
        else:
            set_device_scope_restriction(None)

        try:
            # 重置 callback 以便收集新的使用量數據
            if self.usage_callback:
                # 清空現有的使用量數據，而不是重新創建 callback
                if hasattr(self.usage_callback, "usage_metadata"):
                    self.usage_callback.usage_metadata = {}
                ai_logger.debug("清空 UsageMetadataCallbackHandler 準備收集新數據")

            # 執行 AI 查詢 - 同時在 LLM 和 Agent 層級設置 callback
            config = {"callbacks": [self.usage_callback]} if self.usage_callback else {}
            ai_logger.debug(f"AgentExecutor 配置: {config}")

            result = await asyncio.wait_for(
                asyncio.to_thread(
                    self.agent_executor.invoke, {"input": enhanced_prompt}, config
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

                # 記錄 Token 使用量
                self._log_token_usage(task_id, result)

                # 轉換為 Markdown 格式並包含成本資訊返回前端
                return self._create_query_result(
                    structured_response.to_markdown(), task_id, result
                )

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
                    # 記錄 Token 使用量
                    self._log_token_usage(task_id, result)
                    return self._create_query_result(cleaned_response, task_id, result)
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

    def _calculate_token_cost(
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
        # Claude 定價（每 1,000 tokens）
        claude_pricing = {
            "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
            "claude-3-5-haiku-20241022": {"input": 0.00025, "output": 0.00125},
            "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015},
            "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
            "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
        }

        # Gemini 定價（每 1,000 tokens）
        gemini_pricing = {
            "gemini-1.5-flash": {"input": 0.00015, "output": 0.0006},
            "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
            "gemini-pro": {"input": 0.00125, "output": 0.005},  # 向後相容
        }

        try:
            if provider == "claude":
                pricing = claude_pricing.get(model)
                if not pricing:
                    # 使用 Sonnet 作為預設定價
                    pricing = claude_pricing["claude-3-5-sonnet-20241022"]
            elif provider == "gemini":
                pricing = gemini_pricing.get(model)
                if not pricing:
                    # 使用 Flash 作為預設定價
                    pricing = gemini_pricing["gemini-1.5-flash"]
            else:
                return 0.0

            # 計算成本：(tokens / 1000) * price_per_1000
            input_cost = (input_tokens / 1000.0) * pricing["input"]
            output_cost = (output_tokens / 1000.0) * pricing["output"]
            total_cost = input_cost + output_cost

            return round(total_cost, 6)  # 保留 6 位小數

        except Exception as e:
            ai_logger.warning(f"成本計算失敗: {e}")
            return 0.0

    def _extract_token_usage(self, result: Any) -> Dict[str, int]:
        """從結果中提取 Token 使用量

        Args:
            result: AI 查詢的結果

        Returns:
            Dict: 包含 token 使用量的字典
        """
        usage_data = {}

        # 方法1: 從 callback handler 取得
        if self.usage_callback and hasattr(self.usage_callback, "usage_metadata"):
            callback_data = self.usage_callback.usage_metadata
            if callback_data:
                ai_logger.debug(f"從 callback 取得 token 數據: {callback_data}")

                # 處理嵌套的 callback 數據結構 (按模型名稱分組的格式)
                if isinstance(callback_data, dict):
                    for key, value in callback_data.items():
                        if isinstance(value, dict) and "input_tokens" in value:
                            # 這是按模型名稱嵌套的結構，提取內層的 token 數據
                            ai_logger.debug(f"從模型 {key} 提取 token 數據: {value}")
                            usage_data.update(value)
                            break  # 只需要第一個模型的數據
                    else:
                        # 如果沒有嵌套結構，直接使用原始數據
                        usage_data.update(callback_data)

        # 方法2: 從 AgentExecutor 結果的 intermediate_steps 提取
        if isinstance(result, dict) and "intermediate_steps" in result:
            ai_logger.debug(
                "檢測到 AgentExecutor 結果，嘗試從 intermediate_steps 提取 token 資訊"
            )
            intermediate_steps = result["intermediate_steps"]
            accumulated_tokens = self._extract_from_intermediate_steps(
                intermediate_steps
            )
            if accumulated_tokens:
                ai_logger.debug(
                    f"從 intermediate_steps 取得累積 token 數據: {accumulated_tokens}"
                )
                usage_data.update(accumulated_tokens)

        # 方法3: 從結果 metadata 中提取（適用於直接 LLM 調用）
        if isinstance(result, dict):
            # 檢查是否有 usage_metadata
            if "usage_metadata" in result:
                metadata = result["usage_metadata"]
                ai_logger.debug(f"從結果 metadata 取得 token 數據: {metadata}")
                usage_data.update(metadata)

            # 檢查 Agent 結果中的 LLM 調用記錄
            if "output" in result:
                output = result["output"]
                if hasattr(output, "usage_metadata"):
                    ai_logger.debug(
                        f"從 output usage_metadata 取得 token 數據: {output.usage_metadata}"
                    )
                    usage_data.update(output.usage_metadata)

        # 方法4: 檢查結果物件的屬性
        if hasattr(result, "usage_metadata") and result.usage_metadata:
            ai_logger.debug(f"從結果物件屬性取得 token 數據: {result.usage_metadata}")
            usage_data.update(result.usage_metadata)

        # 方法5: 從 Gemini response_metadata 提取（特殊處理）
        gemini_tokens = self._extract_gemini_token_usage(result)
        if gemini_tokens:
            ai_logger.debug(
                f"從 Gemini response_metadata 取得 token 數據: {gemini_tokens}"
            )
            usage_data.update(gemini_tokens)

        # 方法6: 如果是 Gemini 但沒有原生數據，則使用文本估算
        if settings.AI_PROVIDER == "gemini" and not usage_data:
            ai_logger.debug("Gemini 無原生 token 數據，嘗試文本估算")
            estimated_tokens = self._extract_gemini_tokens_from_texts(result)
            if estimated_tokens:
                usage_data.update(estimated_tokens)
                ai_logger.debug(f"使用文本估算 Gemini tokens: {estimated_tokens}")

        # 確保 total_tokens 計算正確
        if usage_data and "total_tokens" not in usage_data:
            input_tokens = usage_data.get("input_tokens", 0)
            output_tokens = usage_data.get("output_tokens", 0)
            if input_tokens > 0 or output_tokens > 0:
                usage_data["total_tokens"] = input_tokens + output_tokens

        return usage_data

    def _extract_from_intermediate_steps(
        self, intermediate_steps: List
    ) -> Dict[str, int]:
        """從 AgentExecutor 的 intermediate_steps 提取 Token 使用量

        Args:
            intermediate_steps: AgentExecutor 的中間執行步驟

        Returns:
            Dict: 累積的 token 使用量
        """
        total_input_tokens = 0
        total_output_tokens = 0

        for step in intermediate_steps:
            try:
                if isinstance(step, tuple) and len(step) >= 2:
                    action, observation = step[0], step[1]

                    # 檢查 action 是否有 usage 資訊
                    if hasattr(action, "usage_metadata") and action.usage_metadata:
                        usage = action.usage_metadata
                        total_input_tokens += usage.get("input_tokens", 0)
                        total_output_tokens += usage.get("output_tokens", 0)
                        ai_logger.debug(f"從 action 提取 tokens: {usage}")

                    # 檢查 observation 是否有 usage 資訊
                    if (
                        hasattr(observation, "usage_metadata")
                        and observation.usage_metadata
                    ):
                        usage = observation.usage_metadata
                        total_input_tokens += usage.get("input_tokens", 0)
                        total_output_tokens += usage.get("output_tokens", 0)
                        ai_logger.debug(f"從 observation 提取 tokens: {usage}")

                    # 檢查 observation 字串中是否包含 usage 資訊
                    if isinstance(observation, str) and "usage_metadata" in observation:
                        ai_logger.debug(
                            f"觀察到 observation 包含 usage_metadata: {observation[:200]}"
                        )

            except Exception as e:
                ai_logger.debug(f"處理 intermediate_step 時發生錯誤: {e}")
                continue

        if total_input_tokens > 0 or total_output_tokens > 0:
            return {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "total_tokens": total_input_tokens + total_output_tokens,
            }
        return {}

    def _extract_gemini_token_usage(self, result: Any) -> Dict[str, int]:
        """從 Gemini 特定的 response_metadata 提取 Token 使用量

        Args:
            result: AI 查詢結果

        Returns:
            Dict: Gemini token 使用量
        """
        try:
            # 檢查是否是 Gemini 提供者
            if settings.AI_PROVIDER != "gemini":
                return {}

            # 嘗試從不同層級的 response_metadata 提取
            if isinstance(result, dict):
                # 檢查頂層 response_metadata
                if "response_metadata" in result:
                    metadata = result["response_metadata"]
                    if isinstance(metadata, dict):
                        tokens = self._parse_gemini_metadata(metadata)
                        if tokens:
                            return tokens

                # 檢查 output 的 response_metadata
                if "output" in result:
                    output = result["output"]
                    if hasattr(output, "response_metadata"):
                        tokens = self._parse_gemini_metadata(output.response_metadata)
                        if tokens:
                            return tokens

            # 檢查結果物件的 response_metadata
            if hasattr(result, "response_metadata"):
                tokens = self._parse_gemini_metadata(result.response_metadata)
                if tokens:
                    return tokens

        except Exception as e:
            ai_logger.debug(f"提取 Gemini token 使用量時發生錯誤: {e}")

        return {}

    def _parse_gemini_metadata(self, metadata: Dict) -> Dict[str, int]:
        """解析 Gemini 的 metadata 格式

        Args:
            metadata: Gemini 的 response metadata

        Returns:
            Dict: 解析後的 token 使用量
        """
        try:
            # Gemini 的 token 使用量可能在不同的鍵中
            possible_keys = [
                "usage_metadata",
                "token_count",
                "usage",
                "promptTokenCount",
                "candidatesTokenCount",
                "totalTokenCount",
            ]

            for key in possible_keys:
                if key in metadata:
                    usage_info = metadata[key]
                    ai_logger.debug(f"發現 Gemini metadata 中的 {key}: {usage_info}")

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
            ai_logger.debug(f"解析 Gemini metadata 時發生錯誤: {e}")

        return {}

    def _estimate_tokens(self, text: str) -> int:
        """估算文本的 token 數量

        基於經驗公式：
        - 英文：約 4 字符 = 1 token
        - 中文：約 2 字符 = 1 token
        - 混合文本：使用加權平均

        Args:
            text: 要估算的文本

        Returns:
            int: 估算的 token 數量
        """
        if not text:
            return 0

        # 計算字符數
        char_count = len(text)

        # 統計中文字符數量 (Unicode 範圍)
        chinese_chars = 0
        for char in text:
            if "\u4e00" <= char <= "\u9fff":  # 中文字符範圍
                chinese_chars += 1

        # 估算邏輯
        english_chars = char_count - chinese_chars

        # 中文：2 字符 = 1 token，英文：4 字符 = 1 token
        estimated_tokens = (chinese_chars / 2.0) + (english_chars / 4.0)

        # 至少返回 1 個 token（如果有文本內容）
        return max(1, int(estimated_tokens)) if text.strip() else 0

    def _extract_token_usage_for_gemini(
        self, prompt: str, response: str
    ) -> Dict[str, any]:
        """為 Gemini 估算 token 使用量

        Args:
            prompt: 輸入提示文本
            response: 輸出回應文本

        Returns:
            Dict: 包含估算 token 使用量的字典，標記為估算值
        """
        try:
            input_tokens = self._estimate_tokens(prompt)
            output_tokens = self._estimate_tokens(response)
            total_tokens = input_tokens + output_tokens

            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "estimated": True,  # 標記為估算值
                "method": "char_based_estimation",
            }

        except Exception as e:
            ai_logger.debug(f"Gemini token 估算失敗: {e}")
            return {}

    def _extract_gemini_tokens_from_texts(self, result: Any) -> Dict[str, int]:
        """從 AgentExecutor 結果中提取文本並估算 Gemini token

        Args:
            result: AgentExecutor 的結果

        Returns:
            Dict: 估算的 token 使用量
        """
        try:
            if not isinstance(result, dict):
                return {}

            # 提取輸入文本
            input_text = result.get("input", "")

            # 提取輸出文本
            output_text = result.get("output", "")
            if not output_text and hasattr(result.get("output"), "content"):
                output_text = result.get("output").content

            if input_text or output_text:
                estimated_usage = self._extract_token_usage_for_gemini(
                    input_text, output_text
                )
                if estimated_usage:
                    ai_logger.debug(
                        f"基於文本估算 Gemini tokens: 輸入={input_text[:50]}..., 輸出={output_text[:50]}..."
                    )
                    return estimated_usage

        except Exception as e:
            ai_logger.debug(f"從文本估算 Gemini token 時發生錯誤: {e}")

        return {}

    def _log_token_usage(self, task_id: str, result: Any = None):
        """記錄 Token 使用量到日誌

        Args:
            task_id: 任務的唯一識別碼
            result: AI 查詢結果（可選，用於提取額外的 token 資訊）
        """
        # 從多個來源提取 token 使用量
        usage_data = self._extract_token_usage(result)

        ai_logger.debug(
            f"Token 日誌檢查 - callback 存在: {self.usage_callback is not None}"
        )
        ai_logger.debug(f"提取到的 usage 數據: {usage_data}")

        if not usage_data:
            ai_logger.warning("無 Token 使用量數據可記錄")
            return

        provider = settings.AI_PROVIDER
        model = settings.CLAUDE_MODEL if provider == "claude" else settings.GEMINI_MODEL
        input_tokens = usage_data.get("input_tokens", 0)
        output_tokens = usage_data.get("output_tokens", 0)
        total_tokens = usage_data.get("total_tokens", 0)

        ai_logger.debug(
            f"Token 數據提取 - 輸入: {input_tokens}, 輸出: {output_tokens}, 總計: {total_tokens}"
        )

        # 檢查是否為估算值
        is_estimated = usage_data.get("estimated", False)

        # 計算成本
        estimated_cost = self._calculate_token_cost(
            provider, model, input_tokens, output_tokens
        )

        # 記錄詳細的 Token 使用量和成本
        token_info = {
            "task_id": task_id,
            "provider": provider,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": estimated_cost,
            "is_estimated": is_estimated,
            "estimation_method": usage_data.get("method", "") if is_estimated else None,
        }

        # 格式化 TOKEN_USAGE 日誌以便於閱讀
        if is_estimated:
            # Gemini 估算值的特殊格式
            formatted_usage = (
                f"Task: {task_id[:8]}... | "
                f"Provider: {provider.upper()} ({model}) | "
                f"Tokens: {input_tokens}→{output_tokens} (Total: {total_tokens}) 📊估算值 | "
                f"Cost: ~${estimated_cost:.6f} USD (估算)"
            )
            # 使用特殊的估算日誌格式
            ai_logger.info(f"TOKEN_USAGE_ESTIMATED: {formatted_usage}")
        else:
            # 正常的精確值格式
            formatted_usage = (
                f"Task: {task_id[:8]}... | "
                f"Provider: {provider.upper()} ({model}) | "
                f"Tokens: {input_tokens}→{output_tokens} (Total: {total_tokens}) | "
                f"Cost: ${estimated_cost:.6f} USD"
            )
            ai_logger.info(f"TOKEN_USAGE: {formatted_usage}")

        # 同時記錄原始 JSON 格式供 API 解析使用
        ai_logger.debug(f"TOKEN_USAGE_RAW: {token_info}")

        # 實時控制台摘要顯示
        self._display_token_summary(
            provider, total_tokens, estimated_cost, is_estimated
        )

    def _create_query_result(
        self, response_text: str, task_id: str, result: Any = None
    ) -> Dict[str, Any]:
        """建立包含成本資訊的查詢結果

        Args:
            response_text: AI 回應文本
            task_id: 任務 ID
            result: 原始 AI 結果（用於提取成本資訊）

        Returns:
            Dict: 包含 response 和 token_cost 的結果
        """
        # 提取成本資訊
        token_cost = None
        usage_data = self._extract_token_usage(result)

        if usage_data:
            provider = settings.AI_PROVIDER
            model = (
                settings.CLAUDE_MODEL if provider == "claude" else settings.GEMINI_MODEL
            )
            input_tokens = usage_data.get("input_tokens", 0)
            output_tokens = usage_data.get("output_tokens", 0)
            total_tokens = usage_data.get("total_tokens", 0)
            is_estimated = usage_data.get("estimated", False)
            estimated_cost = self._calculate_token_cost(
                provider, model, input_tokens, output_tokens
            )

            token_cost = {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "estimated_cost_usd": estimated_cost,
                "provider": provider,
                "model": model,
                "is_estimated": is_estimated,
            }

        return {"response": response_text, "token_cost": token_cost}

    def _display_token_summary(
        self, provider: str, total_tokens: int, cost: float, is_estimated: bool = False
    ):
        """在控制台顯示 Token 使用量摘要

        Args:
            provider: AI 提供者
            total_tokens: 總 Token 數
            cost: 估算成本
            is_estimated: 是否為估算值
        """
        # 根據是否為估算值選擇不同的顯示格式
        if is_estimated:
            if cost > 0.01:  # 成本超過 1 美分時特別標記
                logger.warning(
                    f"🔥 高成本查詢 - {provider.upper()}: ~{total_tokens} tokens (~${cost:.4f}) 📊估算"
                )
            else:
                logger.info(
                    f"📊 AI 查詢完成 - {provider.upper()}: ~{total_tokens} tokens (~${cost:.4f}) 估算"
                )
        else:
            if cost > 0.01:  # 成本超過 1 美分時特別標記
                logger.warning(
                    f"🔥 高成本查詢 - {provider.upper()}: {total_tokens} tokens (${cost:.4f})"
                )
            else:
                logger.info(
                    f"💡 AI 查詢完成 - {provider.upper()}: {total_tokens} tokens (${cost:.4f})"
                )

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
        """獲取 AI 智能分析服務的狀態資訊

        提供 AI 可用性、初始化狀態和配置資訊。

        Returns:
            Dict: 包含 AI 服務狀態的詳細資訊
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
    """獲取全域 AI 智能分析服務實例

    單例模式的 AI 服務，確保在應用程式中
    使用相同的 AI 配置和狀態。
    """
    global _ai_service
    if _ai_service is None:
        logger.info("建立 AI 服務實例")
        _ai_service = AIService()
    return _ai_service


# AI 摘要服務實例（用於超長輸出處理）
output_summarizer = OutputSummarizer()
