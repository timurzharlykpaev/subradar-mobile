/**
 * SyncRetryModal — pure-function test.
 *
 * We exercise the component as a function so it can run under the node Jest
 * environment (no RN renderer needed). We replace the RN primitives and theme
 * with inert stubs, then inspect the returned React element tree.
 */
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

jest.mock('../../theme', () => ({
  useTheme: () => ({
    colors: { text: '#000', textSecondary: '#666', textMuted: '#999', primary: '#6C47FF' },
    isDark: false,
  }),
}));

jest.mock('react-native', () => {
  const React = require('react');
  const passthrough = (name: string) => {
    const C: React.FC<any> = ({ children, ...rest }) =>
      React.createElement(name, rest, children);
    C.displayName = name;
    return C;
  };
  return {
    Modal: passthrough('Modal'),
    View: passthrough('View'),
    Text: passthrough('Text'),
    TouchableOpacity: passthrough('TouchableOpacity'),
    ActivityIndicator: passthrough('ActivityIndicator'),
    StyleSheet: { create: (s: any) => s },
  };
});

import { SyncRetryModal } from '../SyncRetryModal';

function find(node: any, predicate: (n: any) => boolean): any | null {
  if (!node) return null;
  if (predicate(node)) return node;
  const children = node.props?.children ?? [];
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const found = find(c as any, predicate);
    if (found) return found;
  }
  return null;
}

function allText(node: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (typeof n === 'string' || typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (typeof n === 'object' && 'props' in n) {
      const children = (n.props?.children ?? []) as any;
      const list = Array.isArray(children) ? children : [children];
      list.forEach(walk);
    }
  };
  walk(node);
  return out;
}

describe('SyncRetryModal', () => {
  function render(overrides: Partial<any> = {}) {
    const onRetry = jest.fn();
    const onDismiss = jest.fn();
    const tree = SyncRetryModal({
      visible: true,
      loading: false,
      onRetry,
      onDismiss,
      ...overrides,
    }) as React.ReactElement;
    return { tree, onRetry, onDismiss };
  }

  it('renders title, message, retry CTA, later CTA in default state', () => {
    const { tree } = render();
    const texts = allText(tree);
    expect(texts).toContain('Sync delayed');
    expect(texts.some((t) => t.includes("server hasn't confirmed"))).toBe(true);
    expect(texts).toContain('Try again');
    expect(texts).toContain('Later');
  });

  it('shows ActivityIndicator instead of retry text when loading', () => {
    const { tree } = render({ loading: true });
    const spinner = find(tree, (n) => n.type?.displayName === 'ActivityIndicator');
    expect(spinner).toBeTruthy();
    const texts = allText(tree);
    expect(texts).not.toContain('Try again');
  });

  it('onRetry is invoked by the primary button press handler', () => {
    const { tree, onRetry } = render();
    const primary = find(tree, (n) => n.props?.accessibilityLabel === 'Try again');
    expect(primary).toBeTruthy();
    primary.props.onPress();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('onDismiss is invoked by the later button press handler', () => {
    const { tree, onDismiss } = render();
    const later = find(tree, (n) => n.props?.accessibilityLabel === 'Later');
    later.props.onPress();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons during loading', () => {
    const { tree } = render({ loading: true });
    const primary = find(tree, (n) => n.props?.accessibilityLabel === 'Try again');
    const later = find(tree, (n) => n.props?.accessibilityLabel === 'Later');
    expect(primary.props.disabled).toBe(true);
    expect(later.props.disabled).toBe(true);
  });

  it('Modal passes visible prop through', () => {
    const { tree } = render({ visible: false });
    expect((tree as any).props.visible).toBe(false);
  });
});
