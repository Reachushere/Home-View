import { useEffect, RefObject } from 'react';

const INTERACTIVE_SELECTOR = 'input,textarea,select,button,a,[role="button"],[contenteditable="true"],label';

function findScrollableAncestor(start: HTMLElement, root: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el && el !== root.parentElement) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const ox = style.overflowX;
    const scrollableY = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    const scrollableX = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    if (scrollableY || scrollableX) return el;
    el = el.parentElement;
  }
  return null;
}

export function useDragPan(rootRef: RefObject<HTMLElement>, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    let scroller: HTMLElement | null = null;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let dragging = false;
    let moved = false;
    let prevUserSelect = '';
    let prevCursor = '';

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(INTERACTIVE_SELECTOR)) return;
      const sel = window.getSelection?.();
      if (sel && sel.toString().length > 0) return;

      const sc = findScrollableAncestor(target, root);
      if (!sc) return;

      scroller = sc;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = sc.scrollLeft;
      startTop = sc.scrollTop;
      dragging = true;
      moved = false;
      prevUserSelect = document.body.style.userSelect;
      prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || !scroller) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      scroller.scrollLeft = startLeft - dx;
      scroller.scrollTop = startTop - dy;
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      scroller = null;
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    root.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    root.addEventListener('click', onClickCapture, true);

    return () => {
      root.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      root.removeEventListener('click', onClickCapture, true);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [rootRef, enabled]);
}
