#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ClickHouse 客戶端連接管理模組

提供 Akvorado ClickHouse 資料庫的連接和查詢功能：
- 自動連接管理和重試機制
- 查詢結果格式化處理
- 錯誤處理和日誌記錄
- 支援參數化查詢防止 SQL 注入

Created: 2025-08-30
Author: Claude Code Assistant
"""

import logging
from typing import Dict, List, Any, Optional, Union
import clickhouse_connect
from clickhouse_connect.driver.client import Client
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)


class ClickHouseConnectionError(Exception):
    """ClickHouse 連接錯誤"""
    pass


class ClickHouseQueryError(Exception):
    """ClickHouse 查詢錯誤"""
    pass


class ClickHouseClient:
    """
    ClickHouse 客戶端連接管理器
    
    負責管理與 Akvorado ClickHouse 實例的連接，
    提供查詢執行、結果格式化和錯誤處理功能。
    """
    
    def __init__(self):
        """初始化 ClickHouse 客戶端"""
        self._client: Optional[Client] = None
        self._connection_config = {
            'host': 'akvorado-clickhouse-1',
            'port': 8123,
            'database': 'default', 
            'username': 'default',
            'password': '',
            'connect_timeout': 30,
            'send_receive_timeout': 300
        }
        logger.info("ClickHouse 客戶端初始化完成")
    
    @property
    def client(self) -> Client:
        """
        獲取 ClickHouse 客戶端實例
        
        Returns:
            Client: ClickHouse 客戶端實例
            
        Raises:
            ClickHouseConnectionError: 連接失敗時拋出
        """
        if self._client is None:
            self._connect()
        return self._client
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((ConnectionError, TimeoutError)),
        reraise=True
    )
    def _connect(self) -> None:
        """
        建立 ClickHouse 連接
        
        使用重試機制確保連接穩定性，
        最多重試 3 次，指數退避策略。
        
        Raises:
            ClickHouseConnectionError: 連接失敗時拋出
        """
        try:
            logger.info(f"正在連接 ClickHouse: {self._connection_config['host']}:{self._connection_config['port']}")
            
            self._client = clickhouse_connect.get_client(**self._connection_config)
            
            # 測試連接
            self._client.command('SELECT 1')
            
            logger.info("ClickHouse 連接建立成功")
            
        except Exception as e:
            logger.error(f"ClickHouse 連接失敗: {e}")
            self._client = None
            raise ClickHouseConnectionError(f"無法連接到 ClickHouse: {e}")
    
    def execute_query(
        self, 
        query: str, 
        parameters: Optional[Dict[str, Any]] = None,
        with_column_types: bool = False
    ) -> List[Dict[str, Any]]:
        """
        執行 SQL 查詢並返回格式化結果
        
        Args:
            query: SQL 查詢語句
            parameters: 查詢參數字典
            with_column_types: 是否包含欄位類型資訊
            
        Returns:
            List[Dict[str, Any]]: 查詢結果列表，每一行為字典格式
            
        Raises:
            ClickHouseQueryError: 查詢執行失敗時拋出
        """
        try:
            logger.debug(f"執行查詢: {query[:100]}{'...' if len(query) > 100 else ''}")
            if parameters:
                logger.debug(f"查詢參數: {parameters}")
            
            result = self.client.query(query, parameters=parameters)
            formatted_result = self._format_result(result, with_column_types)
            
            logger.debug(f"查詢完成，返回 {len(formatted_result)} 行結果")
            return formatted_result
            
        except Exception as e:
            logger.error(f"查詢執行失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"查詢執行失敗: {e}")
    
    def execute_command(self, command: str) -> None:
        """
        執行 SQL 命令（不返回結果）
        
        Args:
            command: SQL 命令語句
            
        Raises:
            ClickHouseQueryError: 命令執行失敗時拋出
        """
        try:
            logger.debug(f"執行命令: {command[:100]}{'...' if len(command) > 100 else ''}")
            
            self.client.command(command)
            
            logger.debug("命令執行完成")
            
        except Exception as e:
            logger.error(f"命令執行失敗: {e}", exc_info=True)
            raise ClickHouseQueryError(f"命令執行失敗: {e}")
    
    def _format_result(
        self, 
        result, 
        with_column_types: bool = False
    ) -> List[Dict[str, Any]]:
        """
        格式化查詢結果為字典列表
        
        Args:
            result: ClickHouse 查詢結果物件
            with_column_types: 是否包含欄位類型資訊
            
        Returns:
            List[Dict[str, Any]]: 格式化的結果列表
        """
        if not hasattr(result, 'column_names') or not result.column_names:
            return []
        
        column_names = result.column_names
        
        # 如果需要欄位類型資訊
        if with_column_types:
            column_types = getattr(result, 'column_types', [None] * len(column_names))
            return [
                {
                    'data': dict(zip(column_names, row)),
                    'types': dict(zip(column_names, column_types))
                }
                for row in result.result_rows
            ]
        
        # 標準格式：只返回資料
        return [
            dict(zip(column_names, row))
            for row in result.result_rows
        ]
    
    def get_table_info(self, table_name: str) -> List[Dict[str, Any]]:
        """
        獲取資料表結構資訊
        
        Args:
            table_name: 資料表名稱
            
        Returns:
            List[Dict[str, Any]]: 表格欄位資訊列表
        """
        query = """
        SELECT 
            name,
            type,
            is_in_partition_key,
            is_in_sorting_key,
            is_in_primary_key,
            is_in_sampling_key
        FROM system.columns 
        WHERE database = {database:String} AND table = {table:String}
        ORDER BY position
        """
        
        parameters = {
            'database': self._connection_config['database'],
            'table': table_name
        }
        
        return self.execute_query(query, parameters)
    
    def test_connection(self) -> Dict[str, Any]:
        """
        測試資料庫連接並返回基本資訊
        
        Returns:
            Dict[str, Any]: 連接測試結果和資料庫資訊
        """
        try:
            # 基本連接測試
            version_result = self.execute_query("SELECT version() as version")
            uptime_result = self.execute_query("SELECT uptime() as uptime")
            
            # 取得 Akvorado 相關表格
            tables_result = self.execute_query("""
                SELECT name, engine, total_rows, total_bytes 
                FROM system.tables 
                WHERE database = 'default'
                ORDER BY total_rows DESC
            """)
            
            return {
                'status': 'connected',
                'version': version_result[0]['version'] if version_result else 'unknown',
                'uptime_seconds': uptime_result[0]['uptime'] if uptime_result else 0,
                'database': self._connection_config['database'],
                'tables': tables_result
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'database': self._connection_config['database'],
                'error': str(e)
            }
    
    def close(self) -> None:
        """關閉資料庫連接"""
        if self._client:
            try:
                self._client.close()
                logger.info("ClickHouse 連接已關閉")
            except Exception as e:
                logger.warning(f"關閉 ClickHouse 連接時出現警告: {e}")
            finally:
                self._client = None


# 全域客戶端實例
_clickhouse_client: Optional[ClickHouseClient] = None


def get_clickhouse_client() -> ClickHouseClient:
    """
    獲取全域 ClickHouse 客戶端實例
    
    使用單例模式確保整個應用程式共享同一個連接。
    
    Returns:
        ClickHouseClient: ClickHouse 客戶端實例
    """
    global _clickhouse_client
    if _clickhouse_client is None:
        _clickhouse_client = ClickHouseClient()
    return _clickhouse_client