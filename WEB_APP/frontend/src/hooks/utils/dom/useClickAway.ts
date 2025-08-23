/**
 * useClickAway - 點擊外部區域檢測
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 檢測用戶是否點擊了指定元素外部區域
 * 
 * @param ref - 目標元素的 ref
 * @param onClickAway - 點擊外部時的回調函數
 * @param events - 要監聽的事件類型
 * 
 * @example
 * ```tsx
 * import { useClickAway } from '@/hooks/utils';
 * 
 * const Dropdown = () => {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const ref = useRef<HTMLDivElement>(null);
 *   
 *   useClickAway(ref, () => {
 *     setIsOpen(false);
 *   });
 *   
 *   return (
 *     <div ref={ref}>
 *       <button onClick={() => setIsOpen(!isOpen)}>
 *         Toggle Dropdown
 *       </button>
 *       {isOpen && (
 *         <div className="dropdown-menu">
 *           <div>Option 1</div>
 *           <div>Option 2</div>
 *         </div>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 * 
 * @example
 * // 監聽多種事件類型
 * ```tsx
 * const Modal = () => {
 *   const [isVisible, setIsVisible] = useState(false);
 *   const ref = useRef<HTMLDivElement>(null);
 *   
 *   useClickAway(ref, () => {
 *     setIsVisible(false);
 *   }, ['mousedown', 'touchstart']);
 *   
 *   return isVisible ? (
 *     <div className="modal-overlay">
 *       <div ref={ref} className="modal-content">
 *         Modal Content
 *       </div>
 *     </div>
 *   ) : null;
 * };
 * ```
 */
import { useEffect } from 'react';
import { useLatest } from '@/hooks';

type Target = Element | (() => Element) | React.RefObject<Element>;
type EventType = 'click' | 'mousedown' | 'mouseup' | 'touchstart' | 'touchend';

export function useClickAway(
  target: Target | Target[],
  onClickAway: (event: Event) => void,
  eventName: EventType | EventType[] = 'click'
): void {
  const onClickAwayRef = useLatest(onClickAway);

  useEffect(() => {
    const handler = (event: Event) => {
      const targets = Array.isArray(target) ? target : [target];
      
      if (
        targets.some((item) => {
          const targetElement = typeof item === 'function' ? item() : item && 'current' in item ? item.current : item;
          
          return !targetElement || targetElement.contains(event.target as Node);
        })
      ) {
        return;
      }
      
      onClickAwayRef.current(event);
    };

    const events = Array.isArray(eventName) ? eventName : [eventName];

    events.forEach((event) => {
      document.addEventListener(event, handler);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handler);
      });
    };
  }, [target, eventName, onClickAwayRef]);
}