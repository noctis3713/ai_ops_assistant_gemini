/**
 * 統一服務層錯誤處理
 * 提供一致的錯誤分類、處理和用戶友善訊息轉換
 */

import { logError } from '@/errors';
import type { 
  ServiceErrorContext, 
  ServiceErrorLevel, 
  ServiceErrorCategory 
} from './ServiceTypes';

/**
 * 服務層統一錯誤類別
 */
export class ServiceError extends Error {
  public readonly category: ServiceErrorCategory;
  public readonly level: ServiceErrorLevel;
  public readonly code: string;
  public readonly context: ServiceErrorContext;
  public readonly timestamp: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    category: ServiceErrorCategory,
    level: ServiceErrorLevel,
    context: ServiceErrorContext,
    options: {
      code?: string;
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ServiceError';
    this.category = category;
    this.level = level;
    this.code = options.code || this.generateErrorCode();
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? this.isRetryableByDefault();
    
    if (options.cause) {
      this.cause = options.cause;
    }

    // 自動記錄錯誤
    this.logError();
  }

  /**
   * 從通用錯誤建立 ServiceError
   */
  static from(
    error: unknown, 
    context: ServiceErrorContext,
    defaultCategory: ServiceErrorCategory = ServiceErrorCategory.UNKNOWN
  ): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    if (error instanceof Error) {
      const category = ServiceError.categorizeError(error);
      const level = ServiceError.determineLevelFromCategory(category);
      
      return new ServiceError(
        error.message,
        category,
        level,
        context,
        {
          cause: error,
          retryable: ServiceError.isRetryableError(error)
        }
      );
    }

    // 處理非 Error 物件
    const message = typeof error === 'string' ? error : '未知錯誤';
    return new ServiceError(
      message,
      defaultCategory,
      ServiceErrorLevel.MEDIUM,
      context
    );
  }

  /**
   * 根據錯誤內容自動分類
   */
  private static categorizeError(error: Error): ServiceErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // 網路相關錯誤
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      name.includes('networkerror')
    ) {
      return ServiceErrorCategory.NETWORK;
    }

    // 超時錯誤
    if (
      message.includes('timeout') ||
      message.includes('time out') ||
      name.includes('timeout')
    ) {
      return ServiceErrorCategory.TIMEOUT;
    }

    // API 錯誤
    if (
      message.includes('api') ||
      message.includes('endpoint') ||
      message.includes('response')
    ) {
      return ServiceErrorCategory.API;
    }

    // 驗證錯誤
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return ServiceErrorCategory.VALIDATION;
    }

    // 權限錯誤
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('permission')
    ) {
      return ServiceErrorCategory.AUTHENTICATION;
    }

    return ServiceErrorCategory.UNKNOWN;
  }

  /**
   * 根據類別決定錯誤級別
   */
  private static determineLevelFromCategory(category: ServiceErrorCategory): ServiceErrorLevel {
    switch (category) {
      case ServiceErrorCategory.AUTHENTICATION:
      case ServiceErrorCategory.PERMISSION:
        return ServiceErrorLevel.HIGH;
      case ServiceErrorCategory.NETWORK:
      case ServiceErrorCategory.TIMEOUT:
        return ServiceErrorLevel.MEDIUM;
      case ServiceErrorCategory.VALIDATION:
        return ServiceErrorLevel.LOW;
      default:
        return ServiceErrorLevel.MEDIUM;
    }
  }

  /**
   * 判斷錯誤是否可重試
   */
  private static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // 明確不可重試的錯誤
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('validation')
    ) {
      return false;
    }

    // 網路和超時錯誤通常可重試
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return true;
    }

    return false;
  }

  /**
   * 根據類別決定預設重試性
   */
  private isRetryableByDefault(): boolean {
    switch (this.category) {
      case ServiceErrorCategory.NETWORK:
      case ServiceErrorCategory.TIMEOUT:
        return true;
      case ServiceErrorCategory.AUTHENTICATION:
      case ServiceErrorCategory.PERMISSION:
      case ServiceErrorCategory.VALIDATION:
        return false;
      default:
        return false;
    }
  }

  /**
   * 生成錯誤代碼
   */
  private generateErrorCode(): string {
    const categoryCode = this.category.toUpperCase().substring(0, 3);
    const timestamp = Date.now().toString().slice(-6);
    return `SVC_${categoryCode}_${timestamp}`;
  }

  /**
   * 記錄錯誤到日誌系統
   */
  private logError(): void {
    logError('服務層錯誤', {
      code: this.code,
      category: this.category,
      level: this.level,
      message: this.message,
      context: this.context,
      statusCode: this.statusCode,
      retryable: this.retryable,
      timestamp: this.timestamp
    });
  }

  /**
   * 轉換為用戶友善的錯誤訊息
   */
  toUserMessage(): string {
    switch (this.category) {
      case ServiceErrorCategory.NETWORK:
        return '網路連線發生問題，請檢查您的網路連線狀態';
      
      case ServiceErrorCategory.TIMEOUT:
        return '請求處理時間過長，請稍後再試';
      
      case ServiceErrorCategory.AUTHENTICATION:
        return '身份驗證失敗，請重新登入';
      
      case ServiceErrorCategory.PERMISSION:
        return '您沒有執行此操作的權限';
      
      case ServiceErrorCategory.VALIDATION:
        return '輸入的資料格式不正確，請檢查後重新輸入';
      
      case ServiceErrorCategory.API:
        return '伺服器處理請求時發生錯誤，請稍後再試';
      
      default:
        return '發生未知錯誤，請聯繫系統管理員';
    }
  }

  /**
   * 獲取錯誤的詳細資訊
   */
  getDetails() {
    return {
      code: this.code,
      category: this.category,
      level: this.level,
      message: this.message,
      userMessage: this.toUserMessage(),
      context: this.context,
      statusCode: this.statusCode,
      retryable: this.retryable,
      timestamp: this.timestamp,
      cause: this.cause
    };
  }

  /**
   * 檢查是否為特定類別的錯誤
   */
  isCategory(category: ServiceErrorCategory): boolean {
    return this.category === category;
  }

  /**
   * 檢查是否為特定級別以上的錯誤
   */
  isLevelOrAbove(level: ServiceErrorLevel): boolean {
    const levels = [
      ServiceErrorLevel.LOW,
      ServiceErrorLevel.MEDIUM,
      ServiceErrorLevel.HIGH,
      ServiceErrorLevel.CRITICAL
    ];
    
    const currentIndex = levels.indexOf(this.level);
    const targetIndex = levels.indexOf(level);
    
    return currentIndex >= targetIndex;
  }
}