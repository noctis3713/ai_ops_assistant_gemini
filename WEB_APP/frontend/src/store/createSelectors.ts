// Zustand 選擇器自動生成工具
import { create } from 'zustand';

// 推斷類型，避免直接導入可能不存在的類型
type StoreApi<T> = ReturnType<typeof create<T>>['getState'] extends () => infer U ? { getState: () => U } : never;
type UseBoundStore<T extends StoreApi<object>> = T & ((selector?: any) => any);

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

/**
 * 為 Zustand store 自動生成選擇器
 * 這允許更細粒度的狀態訂閱，提高性能
 * 
 * @example
 * ```tsx
 * const useStoreBase = create<State>()((set) => ({ ... }))
 * const useStore = createSelectors(useStoreBase)
 * 
 * // 使用自動生成的選擇器
 * const count = useStore.use.count()
 * const increment = useStore.use.increment()
 * ```
 */
export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
): WithSelectors<S> => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  
  for (const k of Object.keys(store.getState())) {
    // 為每個狀態屬性創建獨立的選擇器
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }
  
  return store;
};

/**
 * 創建帶有自動選擇器的 store 包裝器
 * 提供更進階的選擇器功能，包括計算屬性和組合選擇器
 */
export const createSelectorsAdvanced = <T extends object>(
  store: UseBoundStore<StoreApi<T>>
) => {
  const selectorsMap = new Map<string, () => any>();
  
  // 創建基礎選擇器
  for (const key of Object.keys(store.getState())) {
    selectorsMap.set(key, () => store((state) => state[key as keyof T]));
  }
  
  // 返回包含選擇器和額外功能的對象
  return {
    use: new Proxy({} as { [K in keyof T]: () => T[K] }, {
      get: (_, prop: string) => {
        if (selectorsMap.has(prop)) {
          return selectorsMap.get(prop);
        }
        // 動態創建選擇器
        const selector = () => store((state) => state[prop as keyof T]);
        selectorsMap.set(prop, selector);
        return selector;
      }
    }),
    
    // 創建組合選擇器
    createCombinedSelector: <R>(
      keys: (keyof T)[],
      combiner: (...args: any[]) => R
    ) => {
      return () => {
        const values = keys.map(key => store((state) => state[key]));
        return combiner(...values);
      };
    },
    
    // 創建計算選擇器
    createComputedSelector: <R>(
      selector: (state: T) => R,
      equalityFn?: (a: R, b: R) => boolean
    ) => {
      let prevValue: R;
      return () => {
        const newValue = store(selector);
        if (equalityFn && prevValue !== undefined && equalityFn(prevValue, newValue)) {
          return prevValue;
        }
        prevValue = newValue;
        return newValue;
      };
    }
  };
};