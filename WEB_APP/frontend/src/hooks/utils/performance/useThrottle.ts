/**
 * useThrottle - 節流值 hook
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 限制值更新的頻率，在指定時間內最多更新一次
 * 
 * @param value - 需要節流的值
 * @param delay - 節流延遲時間（毫秒）
 * @returns 節流後的值
 * 
 * @example
 * ```tsx
 * import { useThrottle } from '@/hooks/utils';
 * 
 * const ScrollTracker = () => {
 *   const [scrollY, setScrollY] = useState(0);
 *   const throttledScrollY = useThrottle(scrollY, 100);
 *   
 *   useEffect(() => {
 *     const handleScroll = () => setScrollY(window.scrollY);
 *     
 *     window.addEventListener('scroll', handleScroll);
 *     return () => window.removeEventListener('scroll', handleScroll);
 *   }, []);
 *   
 *   // 每 100ms 最多更新一次，避免頻繁渲染
 *   return <div>Scroll Y: {throttledScrollY}</div>;
 * };
 * ```
 */
import { useState, useEffect, useRef } from 'react';

export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecuted = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecuted.current;

      if (timeSinceLastExecution >= delay) {
        setThrottledValue(value);
        lastExecuted.current = now;
      }
    }, delay - (Date.now() - lastExecuted.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return throttledValue;
}