/**
 * API 快取策略配置
 * 為不同類型的資料定義最適合的快取策略
 */

export interface CacheStrategy {
  /** 資料保持新鮮的時間（毫秒） */
  staleTime: number;
  /** 資料在記憶體中保留的時間（毫秒） */
  gcTime: number;
  /** 是否在視窗重新聚焦時重新獲取 */
  refetchOnWindowFocus: boolean;
  /** 是否在組件掛載時重新獲取 */
  refetchOnMount: boolean;
  /** 重試次數 */
  retry: number;
  /** 重試延遲策略 */
  retryDelay: (attemptIndex: number) => number;
}

/**
 * 預定義的快取策略
 */
export const CACHE_STRATEGIES = {
  // 靜態資料策略 - 適用於很少變化的資料（如設備清單、群組）
  STATIC_DATA: {
    staleTime: 15 * 60 * 1000, // 15分鐘
    gcTime: 30 * 60 * 1000,    // 30分鐘
    refetchOnWindowFocus: false,
    refetchOnMount: false, // 不自動重新載入，提升效能
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000)
  },

  // 半靜態資料策略 - 適用於偶爾變化的資料（如設備狀態）
  SEMI_STATIC_DATA: {
    staleTime: 5 * 60 * 1000,  // 5分鐘
    gcTime: 15 * 60 * 1000,    // 15分鐘
    refetchOnWindowFocus: true, // 重新聚焦時更新
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000)
  },

  // 動態資料策略 - 適用於經常變化的資料（如任務狀態）
  DYNAMIC_DATA: {
    staleTime: 30 * 1000,      // 30秒
    gcTime: 5 * 60 * 1000,     // 5分鐘
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 5000)
  },

  // 即時資料策略 - 適用於需要實時性的資料（如執行中的任務）
  REAL_TIME_DATA: {
    staleTime: 0,              // 立即過期
    gcTime: 1 * 60 * 1000,     // 1分鐘
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
    retryDelay: () => 1000 // 固定 1 秒延遲
  }
} as const satisfies Record<string, CacheStrategy>;

/**
 * 根據資料類型自動選擇快取策略
 */
export const getCacheStrategy = (dataType: keyof typeof CACHE_STRATEGIES): CacheStrategy => {
  return CACHE_STRATEGIES[dataType];
};

/**
 * 智能快取失效策略
 * 定義哪些查詢會使其他查詢失效
 */
export const INVALIDATION_RULES = {
  // 當設備清單更新時，相關的查詢也應該失效
  'devices': ['device-groups', 'device-status'],
  
  // 當執行指令後，設備狀態可能改變
  'command-execution': ['device-status'],
  
  // 當任務完成後，相關的任務清單需要更新
  'task-completion': ['tasks', 'task-stats']
} as const;

/**
 * 快取優先級配置
 * 當記憶體不足時，優先清除低優先級的快取
 */
export const CACHE_PRIORITY = {
  HIGH: ['devices', 'device-groups'],    // 核心資料，最後清除
  MEDIUM: ['device-status', 'tasks'],    // 重要但可重新獲取的資料
  LOW: ['task-stats', 'ai-status']       // 可隨時重新獲取的資料
} as const;