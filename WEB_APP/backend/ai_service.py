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
        
        # 配置解析器版本: "original", "simplified", "balanced"
        self.parser_version = os.getenv("PARSER_VERSION", "original").lower()
        
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
            
            # 創建 agent
            prompt = hub.pull("hwchase17/react")
            agent = create_react_agent(llm, tools, prompt)
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
        """執行 AI 查詢，支援自動整合思考鏈範例
        
        Args:
            prompt: AI 查詢提示詞
            timeout: 查詢超時時間（秒）
            include_examples: 是否自動包含思考鏈範例（預設True）
            
        Returns:
            AI 回應結果
            
        Raises:
            Exception: 當 AI 服務未初始化或查詢失敗時
        """
        if not self.ai_initialized or not self.agent_executor:
            raise Exception("AI 服務未啟用或初始化失敗")
        
        # 智能地整合思考鏈範例
        enhanced_prompt = prompt
        if include_examples and "<examples>" not in prompt:
            # 如果 prompt 中還沒有範例，就添加思考鏈範例
            few_shot_examples = _get_few_shot_examples()
            if few_shot_examples:
                # 在 user_query 標籤之前插入範例
                if "<user_query>" in prompt:
                    enhanced_prompt = prompt.replace("<user_query>", f"{few_shot_examples}\n\n<user_query>")
                else:
                    # 如果沒有 user_query 標籤，就直接添加到末尾
                    enhanced_prompt = f"{prompt}\n\n{few_shot_examples}"
        
        try:
            # 設置超時執行 AI 查詢
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
            
            # 根據配置選擇解析器，加入異常恢復機制
            ai_response = None
            parsing_errors = []
            
            # 嘗試使用配置的解析器
            try:
                if self.parser_version == "simplified":
                    ai_response = self._parse_agent_result_simplified(result, None)
                    logger.debug("使用簡化版解析器成功")
                elif self.parser_version == "balanced":
                    ai_response = self._parse_agent_result_balanced(result, None)
                    logger.debug("使用平衡版解析器成功")
                else:
                    ai_response = self._parse_agent_result(result, None)
                    logger.debug("使用原版解析器成功")
            except Exception as parse_error:
                parsing_errors.append(f"{self.parser_version}解析器: {str(parse_error)}")
                ai_logger.warning(f"主解析器失敗: {parse_error}")
            
            # 如果主解析器失敗，嘗試其他解析器作為後備
            if not ai_response or ai_response == "AI回覆解析失敗":
                backup_parsers = [("balanced", self._parse_agent_result_balanced), 
                                ("simplified", self._parse_agent_result_simplified), 
                                ("original", self._parse_agent_result)]
                
                for parser_name, parser_func in backup_parsers:
                    if parser_name == self.parser_version:
                        continue  # 跳過已嘗試的解析器
                    
                    try:
                        ai_response = parser_func(result, None)
                        if ai_response and ai_response != "AI回覆解析失敗":
                            ai_logger.info(f"後備解析器 {parser_name} 成功")
                            break
                    except Exception as backup_error:
                        parsing_errors.append(f"{parser_name}後備解析器: {str(backup_error)}")
            
            # 最後的後備處理
            if not ai_response or ai_response == "AI回覆解析失敗":
                # 嘗試直接從結果提取基本內容
                if isinstance(result, str) and result.strip():
                    ai_response = result.strip()
                    ai_logger.warning("使用原始字串作為後備回應")
                elif isinstance(result, dict):
                    # 嘗試從任何可能的字串值中提取內容
                    for key, value in result.items():
                        if isinstance(value, str) and value.strip() and len(value.strip()) > 10:
                            ai_response = value.strip()
                            ai_logger.warning(f"使用 {key} 鍵值作為後備回應")
                            break
            
            # 如果所有解析嘗試都失敗，提供詳細錯誤訊息
            if not ai_response:
                error_details = "\n".join(parsing_errors) if parsing_errors else "無具體錯誤資訊"
                ai_logger.error(f"所有解析器都失敗: {error_details}")
                ai_response = f"AI 回應解析失敗，所有解析方法都失敗了。原始結果類型: {type(result)}。請稍後再試或聯繫系統管理員。"
            
            # 清理回應內容
            if "The final answer is" in ai_response:
                ai_response = ai_response.replace("The final answer is", "").strip()
            
            # 確保回應不為空
            if not ai_response.strip():
                ai_response = "AI 回應為空，請重新提問或簡化問題。"
            
            return ai_response
            
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
    
    def _parse_agent_result(self, result, default_message="AI回覆解析失敗"):
        """解析 agent_executor.invoke 結果的增強版健壯函式"""
        if not result:
            logger.debug("Agent result is None or empty")
            return default_message if default_message else "AI 回應為空，請重新提問"
        
        # 記錄結果類型和內容用於調試
        logger.debug(f"Agent result type: {type(result)}")
        logger.debug(f"Agent result content: {str(result)[:500]}...")
        
        # 處理直接字串回傳
        if isinstance(result, str):
            cleaned = result.strip()
            if cleaned:
                # 移除常見的LangChain格式標記
                if cleaned.startswith("The final answer is"):
                    cleaned = cleaned.replace("The final answer is", "").strip()
                logger.debug("Successfully parsed string result")
                return cleaned
            return default_message
        
        # 處理字典格式回傳 - 按優先順序嘗試多種 key
        if isinstance(result, dict):
            logger.debug(f"Agent result keys: {list(result.keys())}")
            
            # 主要的輸出欄位 - 擴展更多可能的欄位名稱
            for key in ["output", "final_output", "response", "answer", "result", "text", "content"]:
                if key in result and result[key]:
                    content = result[key]
                    if isinstance(content, str) and content.strip():
                        cleaned = content.strip()
                        # 移除常見的格式標記
                        if cleaned.startswith("The final answer is"):
                            cleaned = cleaned.replace("The final answer is", "").strip()
                        logger.debug(f"Successfully extracted content from key: {key}")
                        return cleaned
            
            # 嘗試從中間步驟提取最後的觀察結果
            intermediate_steps = result.get("intermediate_steps", [])
            if intermediate_steps:
                logger.debug(f"Found {len(intermediate_steps)} intermediate steps")
                
                # 從最後的步驟開始檢查
                for i, step in enumerate(reversed(intermediate_steps)):
                    try:
                        if isinstance(step, (list, tuple)) and len(step) >= 2:
                            # 格式: (action, observation)
                            observation = step[1]
                            if isinstance(observation, str) and observation.strip():
                                # 檢查觀察結果是否是工具的實際輸出
                                obs_lower = observation.lower()
                                skip_keywords = [
                                    "tool:", "action:", "thought:", "final answer is",
                                    "i need to", "let me", "based on", "according to",
                                    "the command", "執行指令", "executing"
                                ]
                                
                                # 如果觀察結果不包含這些跳過關鍵字，可能是真實的設備輸出
                                if not any(keyword in obs_lower for keyword in skip_keywords):
                                    # 進一步檢查是否看起來像設備輸出
                                    if any(indicator in obs_lower for indicator in [
                                        "cisco", "ios", "version", "interface", "up", "down",
                                        "protocol", "hardware", "software", "memory", "cpu"
                                    ]):
                                        logger.debug(f"Found device output in intermediate step {i}")
                                        return observation.strip()
                    except Exception as step_error:
                        logger.debug(f"Error processing step {i}: {step_error}")
                        continue
            
            # 嘗試從錯誤信息中提取有用內容
            if "error" in result:
                error_content = result["error"]
                if isinstance(error_content, str) and error_content.strip():
                    logger.debug("Found error content in result")
                    return f"處理過程中發生錯誤: {error_content.strip()}"
            
            # 最後嘗試：查找任何看起來像真實內容的字串值
            for key, value in result.items():
                if isinstance(value, str) and value.strip() and len(value.strip()) > 10:
                    # 避免系統消息和元數據
                    if not any(keyword in key.lower() for keyword in ["log", "debug", "trace", "meta"]):
                        logger.debug(f"Using fallback content from key: {key}")
                        return value.strip()
        
        # 處理其他類型 - 嘗試轉換成字串
        try:
            str_result = str(result).strip()
            if str_result and str_result not in ["None", "{}", "[]", "()", "null"]:
                logger.debug("Using string conversion of result")
                return str_result
        except Exception as e:
            logger.debug(f"String conversion failed: {e}")
        
        # 詳細記錄失敗情況以便調試
        logger.warning(f"All parsing attempts failed for result type {type(result)}")
        if isinstance(result, dict):
            logger.warning(f"Available keys were: {list(result.keys())}")
        
        return default_message if default_message else "AI 回應解析失敗，請稍後重試"
    
    def _parse_agent_result_simplified(self, result, default_message="AI回覆解析失敗"):
        """簡化版解析函數 - 專注於最常見的情況，代碼行數大幅減少"""
        # 優先處理標準格式 - 這應該是優化prompt後的主要情況
        if isinstance(result, dict) and "output" in result:
            output = result["output"].strip()
            if output:
                # 移除常見的格式標記
                if output.startswith("The final answer is"):
                    output = output.replace("The final answer is", "").strip()
                logger.debug("Successfully parsed from output key")
                return output
        
        # 處理直接字符串返回
        if isinstance(result, str) and result.strip():
            cleaned = result.strip()
            if cleaned.startswith("The final answer is"):
                cleaned = cleaned.replace("The final answer is", "").strip()
            logger.debug("Successfully parsed string result")
            return cleaned
        
        # 基本的後備機制 - 處理其他常見key
        if isinstance(result, dict):
            for key in ["final_output", "response", "answer", "result"]:
                if key in result and result[key]:
                    content = result[key]
                    if isinstance(content, str) and content.strip():
                        cleaned = content.strip()
                        if cleaned.startswith("The final answer is"):
                            cleaned = cleaned.replace("The final answer is", "").strip()
                        logger.debug(f"Successfully parsed from key: {key}")
                        return cleaned
        
        # 記錄解析失敗情況
        logger.warning(f"Simplified parser failed for result type {type(result)}")
        if isinstance(result, dict):
            logger.warning(f"Available keys: {list(result.keys())}")
        
        return default_message if default_message else "AI 回應解析失敗，請稍後重試"
    
    def _parse_agent_result_balanced(self, result, default_message="AI回覆解析失敗"):
        """平衡版解析函數 - 在簡化和功能完整性之間取得平衡"""
        # 優先處理標準格式 - 這應該是優化prompt後的主要情況
        if isinstance(result, dict) and "output" in result:
            output = result["output"]
            if output and isinstance(output, str) and output.strip():
                cleaned = output.strip()
                if cleaned.startswith("The final answer is"):
                    cleaned = cleaned.replace("The final answer is", "").strip()
                logger.debug("Successfully parsed from output key")
                return cleaned
        
        # 處理直接字符串返回
        if isinstance(result, str) and result.strip():
            cleaned = result.strip()
            if cleaned.startswith("The final answer is"):
                cleaned = cleaned.replace("The final answer is", "").strip()
            logger.debug("Successfully parsed string result")
            return cleaned
        
        # 處理其他常見key
        if isinstance(result, dict):
            for key in ["final_output", "response", "answer", "result"]:
                if key in result and result[key]:
                    content = result[key]
                    if isinstance(content, str) and content.strip():
                        cleaned = content.strip()
                        if cleaned.startswith("The final answer is"):
                            cleaned = cleaned.replace("The final answer is", "").strip()
                        logger.debug(f"Successfully parsed from key: {key}")
                        return cleaned
        
        # 簡化的 intermediate_steps 處理 - 只處理最明顯的設備輸出
        if isinstance(result, dict) and "intermediate_steps" in result:
            intermediate_steps = result.get("intermediate_steps", [])
            if intermediate_steps:
                # 只檢查最後一個步驟
                try:
                    last_step = intermediate_steps[-1]
                    if isinstance(last_step, (list, tuple)) and len(last_step) >= 2:
                        observation = last_step[1]
                        if isinstance(observation, str) and observation.strip():
                            obs_clean = observation.strip()
                            # 只接受明顯的設備輸出（包含Cisco關鍵字）
                            if any(keyword in obs_clean.lower() for keyword in [
                                "cisco", "ios", "version", "interface", "gigabitethernet", 
                                "software", "hardware", "protocol"
                            ]):
                                logger.debug("Found device output in last intermediate step")
                                return obs_clean
                except (IndexError, AttributeError):
                    pass
        
        logger.warning(f"Balanced parser failed for result type {type(result)}")
        if isinstance(result, dict):
            logger.warning(f"Available keys: {list(result.keys())}")
        
        return default_message if default_message else "AI 回應解析失敗，請稍後重試"
    
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
        
        return {
            "ai_available": AI_AVAILABLE,
            "ai_initialized": self.ai_initialized,
            "ai_provider": ai_provider,
            "parser_version": self.parser_version,
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