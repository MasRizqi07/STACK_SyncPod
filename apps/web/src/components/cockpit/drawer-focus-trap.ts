export function getFocusableElements(container: {
  querySelectorAll: (selector: string) => NodeListOf<Element> | HTMLElement[];
}): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const nodes = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  return nodes.filter((el) => {
    if (el.hasAttribute?.('aria-hidden') || el.closest?.('[aria-hidden="true"]')) return false;
    if (el.hasAttribute?.('disabled')) return false;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  });
}

export interface FocusTrapEvent {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
}

export function handleDrawerKeyDown(
  event: FocusTrapEvent,
  container: HTMLElement,
  activeElement: HTMLElement | null,
  onClose: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }

  if (event.key === 'Tab') {
    const items = getFocusableElements(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }

    const first = items[0]!;
    const last = items[items.length - 1]!;

    if (event.shiftKey) {
      if (!activeElement || activeElement === first || !container.contains?.(activeElement)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (!activeElement || activeElement === last || !container.contains?.(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
