/**
 * useEventListener - 事件監聽器管理
 * 參考 react-use 和 ahooks 最佳實踐實現
 * 自動處理事件監聽器的添加和清理
 * 
 * @param eventName - 事件名稱
 * @param handler - 事件處理函數
 * @param element - 目標元素，默認為 window
 * @param options - 事件監聽選項
 * 
 * @example
 * ```tsx
 * import { useEventListener } from '@/hooks/utils';
 * 
 * const Demo = () => {
 *   const [position, setPosition] = useState({ x: 0, y: 0 });
 *   
 *   useEventListener('mousemove', (event) => {
 *     setPosition({ x: event.clientX, y: event.clientY });
 *   });
 *   
 *   return <div>Mouse: {position.x}, {position.y}</div>;
 * };
 * ```
 * 
 * @example
 * // 監聽特定元素的事件
 * ```tsx
 * const Demo = () => {
 *   const ref = useRef<HTMLDivElement>(null);
 *   
 *   useEventListener('click', () => {
 *     console.log('Div clicked!');
 *   }, ref);
 *   
 *   return <div ref={ref}>Click me</div>;
 * };
 * ```
 */
import { useEffect } from 'react';
import { useLatest } from '@/hooks';

type Target = EventTarget | (() => EventTarget) | React.RefObject<EventTarget>;

export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element?: undefined,
  options?: boolean | AddEventListenerOptions
): void;

export function useEventListener<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  element: Document,
  options?: boolean | AddEventListenerOptions
): void;

export function useEventListener<K extends keyof HTMLElementEventMap>(
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  element: Target,
  options?: boolean | AddEventListenerOptions
): void;

export function useEventListener(
  eventName: string,
  handler: (event: Event) => void,
  element?: Target,
  options?: boolean | AddEventListenerOptions
): void {
  const savedHandler = useLatest(handler);

  useEffect(() => {
    const targetElement = 
      !element 
        ? window
        : typeof element === 'function'
        ? element()
        : 'current' in element
        ? element.current
        : element;

    if (!(targetElement && targetElement.addEventListener)) {
      return;
    }

    const eventListener = (event: Event) => {
      savedHandler.current(event);
    };

    targetElement.addEventListener(eventName, eventListener, options);

    return () => {
      targetElement.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options, savedHandler]);
}