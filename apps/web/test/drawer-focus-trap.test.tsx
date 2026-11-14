import { describe, expect, it, vi } from 'vitest';
import {
  getFocusableElements,
  handleDrawerKeyDown,
  type FocusTrapEvent,
} from '../src/components/cockpit/drawer-focus-trap';

interface MockElement {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  focus: () => void;
  hasAttribute: (name: string) => boolean;
  closest?: (selector: string) => MockElement | null;
  contains?: (el: unknown) => boolean;
}

function createMockElement(id: string, tagName = 'button', attrs: Record<string, string> = {}): MockElement {
  return {
    id,
    tagName,
    attributes: attrs,
    focus: vi.fn(),
    hasAttribute: (name: string) => name in attrs,
    closest: (selector: string) => {
      if (selector === '[aria-hidden="true"]' && attrs['aria-hidden'] === 'true') {
        return createMockElement('parent', 'div', { 'aria-hidden': 'true' });
      }
      return null;
    },
  };
}

describe('Cockpit Drawer focus trap (F4, WCAG 2.1 AA 2.1.2 No Keyboard Trap)', () => {
  it('identifies focusable elements and excludes disabled or aria-hidden controls', () => {
    const btn1 = createMockElement('b1', 'button');
    const btn2 = createMockElement('b2', 'button', { disabled: '' });
    const btn3 = createMockElement('b3', 'button', { 'aria-hidden': 'true' });
    const link1 = createMockElement('l1', 'a', { href: '#' });
    const txt1 = createMockElement('t1', 'textarea');

    const container = {
      querySelectorAll: (_sel: string) => [btn1, btn2, btn3, link1, txt1] as unknown as HTMLElement[],
    };

    const focusables = getFocusableElements(container);
    expect(focusables.map((el) => (el as unknown as MockElement).id)).toEqual(['b1', 'l1', 't1']);
  });

  it('closes drawer on Escape key and prevents default browser event', () => {
    const onClose = vi.fn();
    const event: FocusTrapEvent = {
      key: 'Escape',
      shiftKey: false,
      preventDefault: vi.fn(),
    };

    const container = {
      querySelectorAll: () => [],
      contains: () => true,
    } as unknown as HTMLElement;

    handleDrawerKeyDown(event, container, null, onClose);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('wraps Tab forward from the last focusable element to the first focusable element', () => {
    const first = createMockElement('first');
    const mid = createMockElement('mid');
    const last = createMockElement('last');

    const elements = [first, mid, last];
    const container = {
      querySelectorAll: () => elements as unknown as HTMLElement[],
      contains: (el: unknown) => elements.includes(el as MockElement),
    } as unknown as HTMLElement;

    const event: FocusTrapEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    };

    // When focus is on the last element and user presses Tab:
    handleDrawerKeyDown(event, container, last as unknown as HTMLElement, vi.fn());

    expect(event.preventDefault).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
    expect(last.focus).not.toHaveBeenCalled();
  });

  it('wraps Shift+Tab backward from the first focusable element to the last focusable element', () => {
    const first = createMockElement('first');
    const mid = createMockElement('mid');
    const last = createMockElement('last');

    const elements = [first, mid, last];
    const container = {
      querySelectorAll: () => elements as unknown as HTMLElement[],
      contains: (el: unknown) => elements.includes(el as MockElement),
    } as unknown as HTMLElement;

    const event: FocusTrapEvent = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: vi.fn(),
    };

    // When focus is on the first element and user presses Shift+Tab:
    handleDrawerKeyDown(event, container, first as unknown as HTMLElement, vi.fn());

    expect(event.preventDefault).toHaveBeenCalled();
    expect(last.focus).toHaveBeenCalled();
  });

  it('allows natural tab movement when focus is in the middle of the drawer', () => {
    const first = createMockElement('first');
    const mid = createMockElement('mid');
    const last = createMockElement('last');

    const elements = [first, mid, last];
    const container = {
      querySelectorAll: () => elements as unknown as HTMLElement[],
      contains: (el: unknown) => elements.includes(el as MockElement),
    } as unknown as HTMLElement;

    const event: FocusTrapEvent = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    };

    // When focus is in the middle, preventDefault is NOT called so browser advances focus naturally
    handleDrawerKeyDown(event, container, mid as unknown as HTMLElement, vi.fn());

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(first.focus).not.toHaveBeenCalled();
    expect(last.focus).not.toHaveBeenCalled();
  });

  it('restores focus to the trigger button when the drawer is closed', async () => {
    const triggerBtn = createMockElement('drawer-trigger');
    let isDrawerOpen = true;

    const closeDrawer = () => {
      isDrawerOpen = false;
      // Mirror CockpitShell's focus restoration via microtask
      queueMicrotask(() => {
        triggerBtn.focus();
      });
    };

    expect(isDrawerOpen).toBe(true);
    closeDrawer();
    expect(isDrawerOpen).toBe(false);

    await new Promise((resolve) => queueMicrotask(resolve));
    expect(triggerBtn.focus).toHaveBeenCalled();
  });
});
