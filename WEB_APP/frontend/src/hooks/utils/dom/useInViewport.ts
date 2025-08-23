/**
 * useInViewport - 元素是否在視口中
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 使用 Intersection Observer API 檢測元素是否在視口中
 * 
 * @param target - 目標元素的 ref
 * @param options - Intersection Observer 配置選項
 * @returns [inViewport, ratio] - 是否在視口中和交集比例
 * 
 * @example
 * ```tsx
 * import { useInViewport } from '@/hooks/utils';
 * 
 * const LazyImage = ({ src, alt }) => {
 *   const ref = useRef<HTMLImageElement>(null);
 *   const [inViewport] = useInViewport(ref);
 *   
 *   return (
 *     <img
 *       ref={ref}
 *       src={inViewport ? src : 'placeholder.jpg'}
 *       alt={alt}
 *       style={{ opacity: inViewport ? 1 : 0.3 }}
 *     />
 *   );
 * };
 * ```
 * 
 * @example
 * // 監控交集比例
 * ```tsx
 * const ProgressIndicator = () => {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const [inViewport, ratio] = useInViewport(ref, {
 *     threshold: [0, 0.25, 0.5, 0.75, 1]
 *   });
 *   
 *   return (
 *     <div ref={ref}>
 *       <div>In viewport: {inViewport ? 'Yes' : 'No'}</div>
 *       <div>Visible ratio: {Math.round(ratio * 100)}%</div>
 *     </div>
 *   );
 * };
 * ```
 */
import { useState, useEffect } from 'react';

type Target = Element | (() => Element) | React.RefObject<Element>;

interface UseInViewportOptions {
  root?: Element | Document | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useInViewport(
  target: Target,
  options: UseInViewportOptions = {}
): [boolean, number] {
  const [inViewport, setInViewport] = useState(false);
  const [ratio, setRatio] = useState(0);

  useEffect(() => {
    const targetElement = 
      typeof target === 'function' 
        ? target() 
        : 'current' in target 
        ? target.current 
        : target;

    if (!targetElement) {
      return;
    }

    if (!window.IntersectionObserver) {
      // Fallback for browsers that don't support IntersectionObserver
      setInViewport(true);
      setRatio(1);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInViewport(entry.isIntersecting);
        setRatio(entry.intersectionRatio);
      },
      {
        root: options.root || null,
        rootMargin: options.rootMargin || '0px',
        threshold: options.threshold || 0,
      }
    );

    observer.observe(targetElement);

    return () => {
      observer.disconnect();
    };
  }, [target, options.root, options.rootMargin, options.threshold]);

  return [inViewport, ratio];
}