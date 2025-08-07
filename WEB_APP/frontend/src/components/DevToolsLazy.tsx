/**
 * React Query DevTools 懶載入封裝組件
 * 僅在開發環境載入，減少生產環境 bundle 大小
 */
import { lazy, Suspense } from 'react';

// 僅在開發環境懶載入 DevTools
const ReactQueryDevtools = import.meta.env.DEV 
  ? lazy(() => 
      import('@tanstack/react-query-devtools').then(d => ({
        default: d.ReactQueryDevtools,
      }))
    )
  : null;

const DevToolsLazy: React.FC = () => {
  // 生產環境不渲染任何內容
  if (!import.meta.env.DEV || !ReactQueryDevtools) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} />
    </Suspense>
  );
};

export default DevToolsLazy;