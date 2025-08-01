#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 服務模組 - 統一管理 AI 系統初始化、處理和工具整合
支援 Google Gemini 和 Claude AI 雙引擎，提供智能網路分析和批次操作
"""

import os
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple

# AI 服務相關導入
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_anthropic import ChatAnthropic
    from langchain.agents import AgentExecutor, create_react_agent
    from langchain_core.tools import Tool
    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.prompts import PromptTemplate
    from langchain import hub
    import warnings
    warnings.filterwarnings("ignore")
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False

try:
    from ddgs import DDGS
    SEARCH_AVAILABLE = True
except ImportError:
    SEARCH_AVAILABLE = False

from core.nornir_integration import batch_command_wrapper
from models.ai_response import NetworkAnalysisResponse

logger = logging.getLogger(__name__)

# 延遲導入以避免循環導入
def _get_few_shot_examples():
    """延遲導入思考鏈範例函數"""
    try:
        from utils import build_few_shot_examples
        return build_few_shot_examples()
    except ImportError:
        logger.warning("無法導入 build_few_shot_examples，跳過思考鏈範例")
        return ""

def get_ai_logger():
    """建立 AI 專用日誌記錄器（使用統一配置）"""
    from utils import create_ai_logger
    return create_ai_logger()

ai_logger = get_ai_logger()

class AIService:
    """AI 服務管理器 - 統一管理 AI 初始化、工具配置和查詢處理"""
    
    def __init__(self):
        self.agent_executor = None
        self.search_enabled = os.getenv("ENABLE_DOCUMENT_SEARCH", "false").lower() == "true"
        self.ai_initialized = False
        
        # 初始化 PydanticOutputParser
        self.parser = PydanticOutputParser(pydantic_object=NetworkAnalysisResponse)
        
        # 初始化 AI 系統
        self._initialize_ai()
    
    def _initialize_ai(self) -> bool:
        """初始化 AI 系統（支援 Gemini 和 Claude）
        
        Returns:
            bool: 初始化是否成功
        """
        if not AI_AVAILABLE:
            logger.warning("AI 功能不可用，跳過初始化")
            print("WARNING - AI 功能不可用，跳過初始化")
            return False
        
        try:
            # 檢查環境變數載入狀態
            google_api_key = os.getenv("GOOGLE_API_KEY")
            anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
            ai_provider = os.getenv("AI_PROVIDER", "gemini").lower()
            
            # 輸出調試資訊
            debug_msg = f"AI 初始化開始 - 提供者: {ai_provider}"
            logger.info(debug_msg)
            print(f"INFO - {debug_msg}")
            
            if ai_provider == "gemini":
                if google_api_key:
                    logger.info(f"Google API Key 已載入: {google_api_key[:10]}...")
                    print(f"INFO - Google API Key 已載入: {google_api_key[:10]}...")
                else:
                    error_msg = "Google API Key 未設定，無法初始化 Gemini"
                    logger.error(error_msg)
                    print(f"ERROR - {error_msg}")
                    return False
            elif ai_provider == "claude":
                if anthropic_api_key:
                    logger.info(f"Anthropic API Key 已載入: {anthropic_api_key[:10]}...")
                    print(f"INFO - Anthropic API Key 已載入: {anthropic_api_key[:10]}...")
                else:
                    error_msg = "Anthropic API Key 未設定，無法初始化 Claude"
                    logger.error(error_msg)
                    print(f"ERROR - {error_msg}")
                    return False
            
            # 根據提供者初始化對應的 LLM
            if ai_provider == "claude":
                llm = self._initialize_claude()
            else:
                llm = self._initialize_gemini()
            
            if llm is None:
                error_msg = f"{ai_provider.upper()} LLM 初始化失敗"
                logger.error(error_msg)
                print(f"ERROR - {error_msg}")
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
                handle_parsing_errors=True
            )
            
            search_status = "啟用" if SEARCH_AVAILABLE and self.search_enabled else "停用"
            # 輸出到控制台和日誌檔案
            init_success_message = f"AI system initialized successfully (提供者: {ai_provider.upper()}, 搜尋功能: {search_status})"
            logger.info(init_success_message)
            print(f"INFO - {init_success_message}")
            
            # 記錄到 AI 專用日誌
            ai_logger.info(f"[{ai_provider.upper()}] AI 系統初始化成功 - 模型: {llm.__class__.__name__}, 搜尋功能: {search_status}")
            
            self.ai_initialized = True
            return True
            
        except Exception as e:
            logger.error(f"AI system initialization failed: {e}")
            return False
    
    def _initialize_claude(self):
        """初始化 Claude AI"""
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logger.warning("ANTHROPIC_API_KEY not set, Claude AI features unavailable")
            return None
        
        try:
            # 從環境變數讀取 Claude 模型，預設為 claude-3-haiku-20240307
            claude_model = os.getenv("CLAUDE_MODEL", "claude-3-haiku-20240307")
            llm = ChatAnthropic(
                model=claude_model, 
                temperature=0,
                anthropic_api_key=api_key
            )
            # 輸出到控制台和日誌檔案
            init_message = f"使用 Claude AI 作為主要 AI 提供者 - 模型: {claude_model}"
            logger.info(init_message)
            print(f"INFO - {init_message}")
            return llm
        except Exception as e:
            logger.error(f"Claude AI 初始化失敗: {e}")
            return None
    
    def _initialize_gemini(self):
        """初始化 Gemini AI"""
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            error_msg = "GOOGLE_API_KEY 未設定，Gemini AI 功能不可用"
            logger.warning(error_msg)
            print(f"WARNING - {error_msg}")
            return None
        
        try:
            # 從環境變數讀取 Gemini 模型，預設為 gemini-1.5-flash-latest
            gemini_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-latest")
            
            # 輸出詳細初始化資訊
            init_start_msg = f"開始初始化 Gemini AI - 模型: {gemini_model}"
            logger.info(init_start_msg)
            print(f"INFO - {init_start_msg}")
            
            llm = ChatGoogleGenerativeAI(
                model=gemini_model, 
                temperature=0,
                google_api_key=api_key
            )
            
            # 輸出成功訊息
            success_msg = f"Gemini AI 初始化成功 - 模型: {gemini_model}"
            logger.info(success_msg)
            print(f"INFO - {success_msg}")
            return llm
            
        except Exception as e:
            error_msg = f"Gemini AI 初始化失敗: {type(e).__name__}: {str(e)}"
            logger.error(error_msg)
            print(f"ERROR - {error_msg}")
            
            # 輸出詳細的錯誤診斷
            if "429" in str(e) or "quota" in str(e).lower():
                quota_msg = "可能是 API 配額已用完或請求頻率過高"
                logger.error(quota_msg)
                print(f"ERROR - {quota_msg}")
            elif "401" in str(e) or "unauthorized" in str(e).lower():
                auth_msg = "API Key 可能無效或權限不足"
                logger.error(auth_msg)
                print(f"ERROR - {auth_msg}")
            elif "import" in str(e).lower() or "module" in str(e).lower():
                import_msg = "可能缺少必要的套件，請檢查 langchain-google-genai 是否正確安裝"
                logger.error(import_msg)
                print(f"ERROR - {import_msg}")
            
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
                """
            )
        ]
        
        # 如果搜尋功能可用且已啟用，新增網路搜尋工具
        if SEARCH_AVAILABLE and self.search_enabled:
            tools.append(
                Tool(
                    name="CiscoCommandSearch",
                    func=self._web_search_wrapper,
                    description="""
                    Cisco Network Command Search Tool
                    
                    Use this tool to search for the latest Cisco documentation and community 
                    recommendations when you're unsure which specific command to use for a function.
                    
                    **When to Use This Tool**:
                    - When user queries about functionality and you're unsure of the corresponding Cisco command
                    - Need to find specific hardware model's dedicated commands
                    - Want to confirm the latest syntax or parameters of a command
                    - Need to find troubleshooting or monitoring best practice commands
                    
                    **Input Format**:
                    Directly input what you want to search for, examples:
                    - "temperature monitoring commands"
                    - "ASR 1001-X environment status"
                    - "BGP troubleshooting commands"
                    - "interface utilization monitoring"
                    
                    **Usage Workflow**:
                    1. When encountering unfamiliar query requirements, use this tool to search first
                    2. Determine appropriate commands based on search results
                    3. Then use NetworkShowCommandRunner to execute commands
                    4. Provide professional advice combining searched best practices
                    """
                )
            )
        
        return tools
    
    def _create_custom_prompt_template(self) -> PromptTemplate:
        """建立自定義的 ReAct 提示詞模板，整合 PydanticOutputParser 格式指令
        
        Returns:
            PromptTemplate: 整合結構化輸出格式的提示詞模板
        """
        # 延遲導入以避免循環導入
        from utils import build_ai_system_prompt_for_pydantic
        
        # 獲取基礎系統提示詞
        base_prompt = build_ai_system_prompt_for_pydantic(search_enabled=self.search_enabled)
        
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
Final Answer: {{format_instructions}}

Question: {{input}}
{{agent_scratchpad}}"""
        
        return PromptTemplate(
            template=template,
            input_variables=["input", "agent_scratchpad"],
            partial_variables={
                "tools": "\n".join([f"{tool.name}: {tool.description}" for tool in self._create_tools()]),
                "tool_names": ", ".join([tool.name for tool in self._create_tools()]),
                "format_instructions": self.parser.get_format_instructions()
            }
        )
    
    def _web_search_wrapper(self, query: str) -> str:
        """Cisco 文檔搜尋工具包裝函式"""
        if not SEARCH_AVAILABLE or not self.search_enabled:
            reason = "套件未安裝" if not SEARCH_AVAILABLE else "環境變數 ENABLE_DOCUMENT_SEARCH 未啟用"
            return f"""搜尋功能目前不可用（{reason}）。

請依據以下常用指令類別選擇適當的 show 指令：

**系統狀態檢查**:
- `show version` - 系統版本和硬體資訊
- `show environment` - 溫度、電源、風扇狀態
- `show processes cpu` - CPU 使用率
- `show memory` - 記憶體使用狀況

**介面狀態檢查**:
- `show ip interface brief` - 介面 IP 和狀態概覽
- `show interface` - 詳細介面資訊
- `show interface status` - 介面連結狀態

**路由和網路**:
- `show ip route` - 路由表
- `show ip bgp summary` - BGP 鄰居狀態
- `show ip ospf neighbor` - OSPF 鄰居資訊

**安全和存取**:
- `show access-lists` - 存取控制清單
- `show crypto session` - VPN 會話狀態

請根據使用者需求選擇最合適的指令。"""
        
        try:
            # Use stable version of DuckDuckGo search
            with DDGS() as ddgs:
                # Enhance query with Cisco-specific keywords for better accuracy
                enhanced_query = f"Cisco IOS-XE {query} command documentation"
                results = list(ddgs.text(enhanced_query, max_results=3))
                
                if results:
                    formatted_results = "\n".join([
                        f"• {result['title']}\n  {result['body'][:200]}...\n  Link: {result['href']}\n"
                        for result in results
                    ])
                    return f"Search Results:\n{formatted_results}"
                else:
                    return """未找到相關搜尋結果。

請參考以下常用 Cisco IOS-XE 指令：
- `show version` - 系統版本資訊
- `show environment` - 環境狀態（溫度、電源、風扇）
- `show ip interface brief` - 介面狀態概覽
- `show interface` - 詳細介面資訊
- `show ip route` - 路由表
- `show processes cpu` - CPU 使用率

請根據需求選擇合適的 show 指令。"""
                    
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return f"""搜尋服務發生錯誤: {str(e)}

請使用標準 Cisco 指令繼續操作：
- 系統檢查: `show version`, `show environment`
- 介面檢查: `show ip interface brief`, `show interface`
- 網路檢查: `show ip route`, `show ip bgp summary`
- 效能檢查: `show processes cpu`, `show memory`

建議聯繫系統管理員檢查搜尋服務配置。"""
    
    async def query_ai(self, prompt: str, timeout: float = 30.0, include_examples: bool = True) -> str:
        """執行 AI 查詢，使用 PydanticOutputParser 異化輸出格式
        
        Args:
            prompt: AI 查詢提示詞
            timeout: 查詢超時時間（秒）
            include_examples: 是否自動包含思考鏈範例（預設True）
            
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
            few_shot_examples = _get_few_shot_examples()
            if few_shot_examples:
                if "<user_query>" in prompt:
                    enhanced_prompt = prompt.replace("<user_query>", f"{few_shot_examples}\n\n<user_query>")
                else:
                    enhanced_prompt = f"{prompt}\n\n{few_shot_examples}"
        
        try:
            # 執行 AI 查詢
            result = await asyncio.wait_for(
                asyncio.to_thread(
                    self.agent_executor.invoke,
                    {"input": enhanced_prompt}
                ),
                timeout=timeout
            )
            
            # 記錄原始結果用於調試
            ai_logger.debug(f"AI 回應原始結果類型: {type(result)}")
            if isinstance(result, dict):
                ai_logger.debug(f"AI 回應鍵值: {list(result.keys())}")
            
            # 取得 Agent 的最終回答
            final_answer_str = result.get("output", "") if isinstance(result, dict) else str(result)
            
            if not final_answer_str.strip():
                raise Exception("空的 AI 回應")
            
            try:
                # 使用 PydanticOutputParser 解析結構化輸出
                structured_response: NetworkAnalysisResponse = self.parser.parse(final_answer_str)
                
                # 記錄成功解析
                ai_logger.info(f"成功解析結構化回應: {structured_response.analysis_type}")
                
                # 轉換為 Markdown 格式返回前端
                return structured_response.to_markdown()
                
            except Exception as parse_error:
                # 如果結構化解析失敗，嘗試後備解析
                ai_logger.warning(f"PydanticOutputParser 解析失敗: {parse_error}")
                ai_logger.warning(f"原始輸出: {final_answer_str[:500]}...")
                
                # 後備策略：嘗試直接返回清理後的文本
                cleaned_response = final_answer_str.strip()
                if "Final Answer:" in cleaned_response:
                    cleaned_response = cleaned_response.split("Final Answer:")[-1].strip()
                if "The final answer is" in cleaned_response:
                    cleaned_response = cleaned_response.replace("The final answer is", "").strip()
                
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
            if "429" in error_str or "quota" in error_str.lower() or "rate limit" in error_str.lower():
                ai_logger.error("API 配額已用完")
                raise Exception("Google Gemini API 免費額度已用完（50次/日），請等待明天重置或升級付費方案")
            elif "401" in error_str or "unauthorized" in error_str.lower():
                ai_logger.error("API 認證失敗")
                raise Exception("AI API 認證失敗，請檢查 API Key 設定")
            else:
                raise Exception(f"AI 查詢執行失敗: {error_str}")
    
    def classify_ai_error(self, error_str: str) -> Tuple[str, int]:
        """分類 AI API 錯誤並返回錯誤訊息和狀態碼
        
        Args:
            error_str: 錯誤訊息字串
            
        Returns:
            (錯誤訊息, HTTP狀態碼)
        """
        ai_provider = os.getenv("AI_PROVIDER", "gemini").lower()
        
        error_lower = error_str.lower()
        
        # 配額和頻率限制錯誤 - 擴大檢查範圍
        if ("429" in error_str or "quota" in error_lower or "rate limit" in error_lower or 
            "exceeded" in error_lower or "limit" in error_lower or "已用完" in error_str or
            "resource_exhausted" in error_lower or "usage_limit" in error_lower):
            
            ai_logger.error(f"API 配額錯誤: {error_str}")
            
            if ai_provider == "claude":
                error_msg = "Claude API 請求頻率限制，請稍後再試（建議等待 1-2 分鐘）"
            else:
                error_msg = "Google Gemini API 免費額度已用完（50次/日），請等待明天重置或升級付費方案。或者嘗試使用 Claude AI。"
            return error_msg, 429
            
        elif "401" in error_str or "unauthorized" in error_str.lower() or "invalid api key" in error_str.lower():
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
            
        elif "network" in error_str.lower() or "connection" in error_str.lower() or "timeout" in error_str.lower():
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
        ai_provider = os.getenv("AI_PROVIDER", "gemini").lower()
        
        # 詳細的搜尋功能狀態分析
        search_status_detail = {
            "package_installed": SEARCH_AVAILABLE,
            "env_var_enabled": self.search_enabled,
            "fully_enabled": SEARCH_AVAILABLE and self.search_enabled,
            "status_message": ""
        }
        
        if not SEARCH_AVAILABLE:
            search_status_detail["status_message"] = "搜尋套件未安裝 (需要安裝 ddgs)"
        elif not self.search_enabled:
            search_status_detail["status_message"] = "搜尋功能未啟用 (ENABLE_DOCUMENT_SEARCH=false)"
        else:
            search_status_detail["status_message"] = "搜尋功能完全啟用"
        
        # 移除解析器版本配置，因為已使用 PydanticOutputParser
        return {
            "ai_available": AI_AVAILABLE,
            "ai_initialized": self.ai_initialized,
            "ai_provider": ai_provider,
            "pydantic_parser_enabled": True,
            "search_enabled": self.search_enabled and SEARCH_AVAILABLE,
            "search_available": SEARCH_AVAILABLE,
            "search_detail": search_status_detail,
            "environment_config": {
                "ENABLE_DOCUMENT_SEARCH": os.getenv("ENABLE_DOCUMENT_SEARCH", "false"),
                "PARSER_VERSION": os.getenv("PARSER_VERSION", "original")
            }
        }

# 全域 AI 服務實例
_ai_service = None

def get_ai_service() -> AIService:
    """取得全域 AI 服務實例
    
    Returns:
        AIService: AI 服務實例
    """
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service