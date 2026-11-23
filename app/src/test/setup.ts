import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Без globals: true RTL не регистрирует автоочистку сам,
// поэтому размонтируем дерево после каждого теста вручную.
afterEach(() => {
  cleanup();
});

// В jsdom нет ResizeObserver, а CategoryChips на него опирается,
// чтобы понимать, помещаются ли категории в строку.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub
  });
}
