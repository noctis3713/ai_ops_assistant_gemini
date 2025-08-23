/**
 * useHover - hover 狀態檢測
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 檢測元素的 hover 狀態
 * 
 * @param target - 目標元素的 ref
 * @param options - 配置選項
 * @returns 是否處於 hover 狀態
 * 
 * @example
 * ```tsx
 * import { useHover } from '@/hooks/utils';
 * 
 * const HoverCard = () => {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const isHovering = useHover(ref);
 *   
 *   return (
 *     <div 
 *       ref={ref}
 *       style={{
 *         backgroundColor: isHovering ? '#f0f0f0' : 'white',
 *         padding: '20px',
 *         border: '1px solid #ccc'
 *       }}
 *     >
 *       {isHovering ? 'Hovering!' : 'Not hovering'}
 *     </div>
 *   );
 * };
 * ```
 * 
 * @example
 * // 使用回調函數
 * ```tsx
 * const Demo = () => {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const isHovering = useHover(ref, {
 *     onEnter: () => console.log('Mouse entered'),
 *     onLeave: () => console.log('Mouse left')
 *   });
 *   
 *   return (
 *     <div ref={ref}>
 *       Hover me! {isHovering ? '🔥' : '❄️'}
 *     </div>
 *   );
 * };
 * ```
 */
import { useState } from 'react';
import { useEventListener } from './useEventListener';

type Target = Element | (() => Element) | React.RefObject<Element>;

interface UseHoverOptions {
  onEnter?: () => void;
  onLeave?: () => void;
}

export function useHover(
  target: Target,
  options: UseHoverOptions = {}
): boolean {
  const [isHovering, setIsHovering] = useState(false);
  const { onEnter, onLeave } = options;

  const handleMouseEnter = () => {
    setIsHovering(true);
    onEnter?.();
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    onLeave?.();
  };

  useEventListener('mouseenter', handleMouseEnter, target);
  useEventListener('mouseleave', handleMouseLeave, target);

  return isHovering;
}