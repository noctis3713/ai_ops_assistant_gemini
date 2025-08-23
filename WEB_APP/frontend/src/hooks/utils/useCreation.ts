import { useRef, type DependencyList } from 'react';

/**
 * useCreation - useMemo 的替代方案，避免依賴陣列的複雜管理
 * 參考 ahooks 實作，只有在依賴確實變更時才重新創建對象
 */
export function useCreation<T>(factory: () => T, deps: DependencyList): T {
  const { current } = useRef({
    deps,
    obj: undefined as undefined | T,
    initialized: false,
  });
  
  if (current.initialized === false || !depsAreSame(current.deps, deps)) {
    current.deps = deps;
    current.obj = factory();
    current.initialized = true;
  }
  
  return current.obj as T;
}

/**
 * 深度比較依賴陣列是否相同
 */
function depsAreSame(oldDeps: DependencyList, deps: DependencyList): boolean {
  if (oldDeps === deps) return true;
  
  if (oldDeps.length !== deps.length) return false;
  
  for (let i = 0; i < oldDeps.length; i++) {
    if (!Object.is(oldDeps[i], deps[i])) return false;
  }
  
  return true;
}