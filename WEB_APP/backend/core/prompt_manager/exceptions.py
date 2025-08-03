#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
提示詞管理器異常定義

定義所有與提示詞管理相關的自定義異常類別，
提供清晰的錯誤分類和診斷資訊。
"""


class PromptManagerError(Exception):
    """提示詞管理器基礎異常類別

    所有提示詞管理相關的異常都應該繼承這個基礎類別
    """

    pass


class PromptConfigError(PromptManagerError):
    """提示詞配置錯誤

    當 YAML 配置檔案載入失敗、格式錯誤或內容無效時拋出

    常見情況：
    - YAML 語法錯誤
    - 配置檔案不存在
    - 必要配置項缺失
    - 配置值類型不匹配
    """

    def __init__(self, message: str, file_path: str = None, line_number: int = None):
        """初始化配置錯誤

        Args:
            message: 錯誤訊息
            file_path: 出錯的配置檔案路徑
            line_number: 出錯的行號（如果可知）
        """
        self.file_path = file_path
        self.line_number = line_number

        if file_path:
            if line_number:
                full_message = f"{message} (檔案: {file_path}, 行號: {line_number})"
            else:
                full_message = f"{message} (檔案: {file_path})"
        else:
            full_message = message

        super().__init__(full_message)


class PromptTemplateError(PromptManagerError):
    """提示詞模板錯誤

    當 Jinja2 模板載入失敗、語法錯誤或渲染失敗時拋出

    常見情況：
    - 模板檔案不存在
    - Jinja2 語法錯誤
    - 模板變數未定義
    - 模板邏輯錯誤
    """

    def __init__(self, message: str, template_name: str = None, context: dict = None):
        """初始化模板錯誤

        Args:
            message: 錯誤訊息
            template_name: 出錯的模板名稱
            context: 渲染時使用的上下文（可能包含敏感資訊，僅用於除錯）
        """
        self.template_name = template_name
        self.context_keys = list(context.keys()) if context else []

        if template_name:
            full_message = f"{message} (模板: {template_name})"
            if self.context_keys:
                full_message += f" (可用變數: {', '.join(self.context_keys)})"
        else:
            full_message = message

        super().__init__(full_message)


class PromptLanguageError(PromptManagerError):
    """提示詞語言錯誤

    當指定的語言不受支援或語言相關的資源不存在時拋出

    常見情況：
    - 指定的語言目錄不存在
    - 語言相關的模板檔案缺失
    - 語言代碼格式錯誤
    """

    def __init__(
        self, message: str, language: str = None, available_languages: list = None
    ):
        """初始化語言錯誤

        Args:
            message: 錯誤訊息
            language: 請求的語言代碼
            available_languages: 可用的語言列表
        """
        self.language = language
        self.available_languages = available_languages or []

        if language:
            full_message = f"{message} (請求語言: {language})"
            if self.available_languages:
                full_message += f" (可用語言: {', '.join(self.available_languages)})"
        else:
            full_message = message

        super().__init__(full_message)


class PromptCacheError(PromptManagerError):
    """提示詞快取錯誤

    當快取操作失敗或快取資料無效時拋出

    常見情況：
    - 快取清理失敗
    - 快取資料損壞
    - 記憶體不足導致快取失敗
    """

    pass
