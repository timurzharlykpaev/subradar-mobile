declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestRenderer {
    update(element: ReactElement): void;
    unmount(): void;
    toJSON(): unknown;
  }

  export function act(callback: () => void | Promise<void>): void;

  const TestRenderer: {
    create(element: ReactElement, options?: unknown): ReactTestRenderer;
    act: typeof act;
  };

  export default TestRenderer;
}
