import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useDebouncedValue } from '../useDebouncedValue';

// Opt in to the concurrent act() environment so react-test-renderer
// doesn't log noisy "not configured to support act(...)" warnings.
// See https://reactjs.org/link/test-act-environment
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.useFakeTimers();

function renderHook<TProps, TResult>(
  hook: (props: TProps) => TResult,
  initialProps: TProps,
) {
  const result: { current: TResult | undefined } = { current: undefined };

  function HookProbe({ hookProps }: { hookProps: TProps }) {
    result.current = hook(hookProps);
    return null;
  }

  let root!: ReactTestRenderer;
  act(() => {
    root = TestRenderer.create(
      React.createElement(HookProbe, { hookProps: initialProps }),
    );
  });

  return {
    result,
    rerender: (nextProps: TProps) => {
      act(() => {
        root.update(
          React.createElement(HookProbe, { hookProps: nextProps }),
        );
      });
    },
    unmount: () =>
      act(() => {
        root.unmount();
      }),
  };
}

describe('useDebouncedValue', () => {
  it('returns the latest value after the delay', () => {
    const h = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { value: 'a', delay: 300 },
    );
    expect(h.result.current).toBe('a');

    h.rerender({ value: 'b', delay: 300 });
    expect(h.result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(h.result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(h.result.current).toBe('b');

    h.unmount();
  });

  it('resets the timer when the value changes again before the delay', () => {
    const h = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      { value: 'a', delay: 300 },
    );

    h.rerender({ value: 'b', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    h.rerender({ value: 'c', delay: 300 });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(h.result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(h.result.current).toBe('c');

    h.unmount();
  });
});
