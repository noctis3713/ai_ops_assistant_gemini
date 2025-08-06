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

# 移除外部搜尋功能 - ddgs 套件不再需要

from core.nornir_integration import batch_command_wrapper, set_device_scope_restriction
from core.prompt_manager import get_prompt_manager
from core.settings import settings
from models.ai_response import NetworkAnalysisResponse

logger = logging.getLogger(__name__)


# 移除 build_ai_system_prompt_for_pydantic 函數 - 已由 PromptManager.render_system_prompt() 取代


# 內部思考鏈範例函數
def _get_react_examples() -> str:
    """建立思考鏈 (Chain-of-Thought) 範例

    提供完整的思考過程範例，幫助 AI 更穩定地遵循指示和工具選擇邏輯

    Returns:
        str: 完整的思考鏈範例字串
    """
    examples = """
<examples>
以下是一些完整的思考過程範例，請學習這種思考模式。
**重要**: 注意每個範例都以 `Final Answer:` 開始最終回應，你必須嚴格遵循這個格式：

**範例1: 搜尋型查詢 (不確定具體指令時)**

<user_query>
我想知道 202.3.182.202 這台設備的溫度狀況
</user_query>

Thought: 使用者想要查詢設備溫度。根據我的 Cisco 知識，我知道可以使用 `show environment all` 或 `show environment temperature` 來查看設備溫度狀態。我將使用 BatchCommandRunner 執行 `show environment all` 來獲取完整的環境資訊。

Action: BatchCommandRunner  
Action Input: 202.3.182.202: show environment all

Observation: 指令執行成功，返回了設備的完整環境狀態資訊，包括溫度感測器讀數、風扇狀態等。

Thought: 我已經獲得了設備的環境資訊。根據 output_format，這是單一設備查詢，我需要使用單一設備格式來整理分析報告。

Final Answer:
### 重點分析
- **狀態概況**: 設備環境狀態正常，所有溫度感測器讀數在正常範圍內
- **關鍵數據**: 
  - CPU 溫度: 45°C (正常)
  - 機箱溫度: 32°C (正常)  
  - 所有風扇運作正常
- **異常發現**: 無

### 專業建議
建議定期監控環境狀態，確保設備在適當的運作溫度範圍內。如發現溫度異常上升，應檢查機房空調和設備通風狀況。

**範例2: 直接執行型查詢 (明確指令時)**

<user_query>
請幫我查看 202.3.182.202 和 202.153.183.18 這兩台設備的版本資訊
</user_query>

Thought: 使用者明確要求查詢版本資訊，這對應到 `show version` 指令，我不需要搜尋。這是多設備查詢，我可以直接使用 BatchCommandRunner 執行指令。

Action: BatchCommandRunner
Action Input: 202.3.182.202,202.153.183.18: show version

Observation: 指令在兩台設備上都執行成功，返回了詳細的版本資訊，包括軟體版本、硬體型號、序號等。

Thought: 我已經獲得了兩台設備的版本資訊。根據 output_format，這是多設備查詢，我需要使用多設備格式來整理對比分析報告。

Final Answer:
{
  "analysis_summary": "兩台設備版本一致且狀態良好，所有設備均運行 Cisco IOS XE 軟體",
  "key_findings": [
    "202.3.182.202: ASR1001-X, 序號 FXS1836Q2T6",
    "202.153.183.18: ASR1001-X, 序號 FXS1836Q2T7",
    "兩台設備均運行相同版本的 IOS XE 軟體"
  ],
  "anomalies": [],
  "recommendations": [
    "建議保持當前配置以維持環境一致性",
    "如需進行軟體更新，建議制定統一的更新計劃",
    "建議定期檢查軟體版本確保安全性"
  ],
  "device_count": 2,
  "successful_device_count": 2,
  "failed_device_count": 0,
  "analysis_type": "multi_device"
}

**範例3: 錯誤處理範例**

<user_query>
檢查設備的 BGP 狀態
</user_query>

Thought: 使用者要求檢查 BGP 狀態，但沒有指定設備。根據我的 Cisco 知識，`show ip bgp summary` 是查看 BGP 狀態摘要的標準指令。我將對所有可用設備執行此指令。

Action: BatchCommandRunner
Action Input: show ip bgp summary

Observation: 部分設備執行成功，但有設備返回錯誤，可能是因為該設備未配置 BGP。

Thought: 執行過程中遇到了部分失敗，這是正常情況。我需要根據實際結果分析，並在報告中說明失敗原因。

Final Answer:
{
  "analysis_summary": "設備 BGP 配置不一致，部分設備未配置 BGP 功能",
  "key_findings": [
    "202.3.182.202: BGP 狀態正常，有 3 個鄰居連接",
    "202.153.183.18: 未配置 BGP 功能"
  ],
  "anomalies": [
    "202.153.183.18 未配置 BGP 功能，指令執行失敗"
  ],
  "recommendations": [
    "建議檢查網路架構設計，確認是否所有設備都需要配置 BGP",
    "對於需要 BGP 的設備，建議完善配置",
    "對於不需要 BGP 的設備，此錯誤可忽略",
    "建議統一網路設備的路由協定配置策略"
  ],
  "device_count": 2,
  "successful_device_count": 1,
  "failed_device_count": 1,
  "analysis_type": "multi_device"
}

</examples>
"""

    return examples


def _get_few_shot_examples():
    """延遲導入思考鏈範例函數（重構版）"""
    return _get_react_examples()


def get_ai_logger():
    """建立 AI 專用日誌記錄器（使用統一配置）"""
    from utils import create_ai_logger

    return create_ai_logger()


ai_logger = get_ai_logger()


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
            google_api_key = settings.GOOGLE_API_KEY
            anthropic_api_key = settings.ANTHROPIC_API_KEY
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
            init_success_message = f"AI system initialized successfully (提供者: {ai_provider.upper()})"
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
        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            logger.warning("ANTHROPIC_API_KEY not set, Claude AI features unavailable")
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
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            error_msg = "GOOGLE_API_KEY 未設定，Gemini AI 功能不可用"
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
                
                **重要說明**：
                - 工具會自動驗證指令安全性，只執行允許的唯讀指令
                - 支援所有標準的 show 指令（如 show version, show interface, show environment 等）
                - 執行成功時會返回完整的設備輸出資料
                - 執行失敗時會提供詳細的錯誤分析和建議
                
                **輸入格式**: 
                - "device_ip1,device_ip2: command" (多設備執行)
                - "device_ip: command" (單一設備執行)
                - "command" (所有設備執行)
                
                **使用例子**: 
                - "202.3.182.202: show environment" (查詢單一設備環境狀態)
                - "202.3.182.202,202.153.183.18: show version" (查詢多設備版本)
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

        # 移除外部搜尋工具 - AI 將只使用自身的 Cisco 知識

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

        # 使用新的提示詞管理器獲取系統提示詞（移除搜尋功能）
        base_prompt = self.prompt_manager.render_system_prompt(
            search_enabled=False,
            format_instructions=escaped_format_instructions,
        )

        # 建立 ReAct 工作流程模板
        template = f"""{base_prompt}

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

    # 移除 _web_search_wrapper 方法 - 不再需要外部搜尋功能

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
            Exception: 當 AI 服務未初始化或查詢失敗時
        """
        if not self.ai_initialized or not self.agent_executor:
            raise Exception("AI 服務未啟用或初始化失敗")

        # 智能地整合思考鏈範例
        enhanced_prompt = prompt
        if include_examples and "<examples>" not in prompt:
            few_shot_examples = self.prompt_manager.render_react_examples()
            if few_shot_examples:
                if "<user_query>" in prompt:
                    enhanced_prompt = prompt.replace(
                        "<user_query>", f"{few_shot_examples}\n\n<user_query>"
                    )
                else:
                    enhanced_prompt = f"{prompt}\n\n{few_shot_examples}"

        # 添加即時執行強制要求
        unique_id = uuid.uuid4()
        real_time_enforcement = "\n\n🚨 **強制執行要求**：\n"
        real_time_enforcement += f"- 查詢唯一標識：{unique_id}\n"
        real_time_enforcement += (
            "- 這是一個實時查詢，你必須執行實際的工具調用獲取當前設備資料\n"
        )
        real_time_enforcement += "- 絕對禁止使用上述範例的回答作為最終答案\n"
        real_time_enforcement += (
            "- 必須基於當前執行的 BatchCommandRunner 工具結果進行分析\n"
        )
        real_time_enforcement += f"- 當前時間戳記：{time.time()}\n"
        enhanced_prompt = enhanced_prompt + real_time_enforcement

        # 添加設備範圍限制上下文
        if device_ips:
            device_context = f"\n\n<device_scope_restriction>\n**重要限制**: 只能在以下指定設備上執行指令，不可擴展到其他設備:\n"
            for ip in device_ips:
                device_context += f"- {ip}\n"
            device_context += "</device_scope_restriction>"
            enhanced_prompt = enhanced_prompt + device_context

            # 設置線程本地設備範圍限制
            set_device_scope_restriction(device_ips)
        else:
            # 清除設備範圍限制
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
                raise Exception("空的 AI 回應")

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
                if "Final Answer:" in cleaned_response:
                    cleaned_response = cleaned_response.split("Final Answer:")[
                        -1
                    ].strip()
                if "The final answer is" in cleaned_response:
                    cleaned_response = cleaned_response.replace(
                        "The final answer is", ""
                    ).strip()

                if cleaned_response:
                    ai_logger.info("使用後備解析策略")
                    return cleaned_response
                else:
                    raise Exception(f"結構化解析和後備解析都失敗: {parse_error}")

        except asyncio.TimeoutError:
            ai_logger.error(f"AI 查詢超時: {timeout}秒")
            raise Exception(f"AI 分析處理超時（{timeout}秒）- 請簡化查詢內容或稍後重試")
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

    async def handle_ai_request(
        self, query: str, device_ips: List[str] = None
    ) -> str:
        """統一處理所有 AI 相關請求的公共方法
        
        這個方法將原本分散在 execution_routes.py 和 background_tasks.py 中的
        _handle_ai_request 邏輯統一整合到 AIService 中，消除程式碼重複。
        
        Args:
            query: 用戶查詢內容
            device_ips: 目標設備 IP 列表（可選）
            
        Returns:
            str: AI 分析結果
            
        Raises:
            Exception: 當 AI 處理失敗時
        """
        try:
            logger.info(f"AI 請求處理開始: query='{query[:50]}...', devices={device_ips}")
            
            # 檢查 AI 服務可用性
            if not self.ai_initialized:
                logger.error("AI 服務未初始化")
                raise Exception("AI 服務未啟用或初始化失敗，請檢查 API 金鑰配置")
            
            # 執行 AI 查詢
            ai_response = await self.query_ai(
                prompt=query,
                device_ips=device_ips
            )
            
            logger.info(f"AI 請求處理完成: response_length={len(ai_response)}")
            return ai_response

        except Exception as e:
            # 使用 AIService 的錯誤分類機制
            error_msg, status_code = self.classify_ai_error(str(e))
            logger.error(f"AI 請求處理失敗: {error_msg} (Query: {query[:50]}...)")
            # 重新拋出異常，但包含分類後的錯誤訊息和狀態碼資訊
            raise Exception(f"{error_msg}|{status_code}")

    def get_ai_status(self) -> Dict[str, Any]:
        """取得 AI 服務狀態

        Returns:
            AI 服務狀態字典
        """
        ai_provider = settings.AI_PROVIDER

        # 簡化狀態回傳，移除所有搜尋相關配置
        return {
            "ai_available": AI_AVAILABLE,
            "ai_initialized": self.ai_initialized,
            "ai_provider": ai_provider,
            "pydantic_parser_enabled": True,
            "environment_config": {
                "PARSER_VERSION": settings.PARSER_VERSION,
            },
        }


@lru_cache(maxsize=1)
def get_ai_service() -> AIService:
    """取得全域 AI 服務實例（使用快取確保單例）

    Returns:
        AIService: AI 服務實例
    """
    return AIService()
