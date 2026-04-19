/**
 * BannerRenderer — priority routing test.
 *
 * We treat the component as a pure function: call it, inspect the returned
 * React element. No RN renderer required. The banner children are replaced
 * with stub components so we can assert the routing decision without pulling
 * in react-native.
 */
import React from 'react';

// Stub every banner child with a dumb component whose `displayName` encodes
// which banner was rendered. BannerRenderer only needs the components to be
// valid React nodes to place into the output tree.
const makeStub = (name: string) => {
  const Stub: React.FC<any> = () => null;
  Stub.displayName = name;
  return Stub;
};

jest.mock('../BillingIssueBanner', () => ({
  __esModule: true,
  BillingIssueBanner: makeStub('BillingIssueBanner'),
}));
jest.mock('../GraceBanner', () => ({
  __esModule: true,
  GraceBanner: makeStub('GraceBanner'),
}));
jest.mock('../ExpirationBanner', () => ({
  __esModule: true,
  default: makeStub('ExpirationBanner'),
}));
jest.mock('../DoublePayBanner', () => ({
  __esModule: true,
  DoublePayBanner: makeStub('DoublePayBanner'),
}));
jest.mock('../AnnualUpgradeBanner', () => ({
  __esModule: true,
  default: makeStub('AnnualUpgradeBanner'),
}));
jest.mock('../WinBackBanner', () => ({
  __esModule: true,
  default: makeStub('WinBackBanner'),
}));

const mockUseEffectiveAccess = jest.fn();
jest.mock('../../hooks/useEffectiveAccess', () => ({
  useEffectiveAccess: () => mockUseEffectiveAccess(),
}));

import { BannerRenderer } from '../BannerRenderer';

// Helper — shape a minimal EffectiveAccess with just the banner set
function accessWithBanner(priority: string, payload: Record<string, unknown> = {}) {
  return { banner: { priority, payload } };
}

// Returns the rendered React element's component name (or null if nothing rendered)
function renderedComponentName(element: React.ReactElement | null): string | null {
  if (!element) return null;
  const type: any = element.type;
  return type?.displayName ?? type?.name ?? null;
}

describe('BannerRenderer', () => {
  beforeEach(() => {
    mockUseEffectiveAccess.mockReset();
  });

  it('returns null when access is still loading (null)', () => {
    mockUseEffectiveAccess.mockReturnValue(null);
    const rendered = BannerRenderer() as React.ReactElement | null;
    expect(rendered).toBeNull();
  });

  it("returns null when banner priority is 'none'", () => {
    mockUseEffectiveAccess.mockReturnValue(accessWithBanner('none'));
    const rendered = BannerRenderer() as React.ReactElement | null;
    expect(rendered).toBeNull();
  });

  it("renders GraceBanner when priority is 'grace' and forwards payload", () => {
    const payload = { daysLeft: 3, reason: 'pro_expired' };
    mockUseEffectiveAccess.mockReturnValue(accessWithBanner('grace', payload));

    const rendered = BannerRenderer() as React.ReactElement<{ payload: unknown }>;
    expect(renderedComponentName(rendered)).toBe('GraceBanner');
    expect(rendered.props.payload).toEqual(payload);
  });

  it("renders BillingIssueBanner when priority is 'billing_issue'", () => {
    mockUseEffectiveAccess.mockReturnValue(
      accessWithBanner('billing_issue', { startedAt: '2026-04-15T00:00:00Z' }),
    );
    const rendered = BannerRenderer() as React.ReactElement;
    expect(renderedComponentName(rendered)).toBe('BillingIssueBanner');
  });

  it("renders ExpirationBanner when priority is 'expiration'", () => {
    mockUseEffectiveAccess.mockReturnValue(accessWithBanner('expiration', { endsAt: 'x' }));
    const rendered = BannerRenderer() as React.ReactElement;
    expect(renderedComponentName(rendered)).toBe('ExpirationBanner');
  });

  it("renders DoublePayBanner when priority is 'double_pay'", () => {
    mockUseEffectiveAccess.mockReturnValue(accessWithBanner('double_pay'));
    const rendered = BannerRenderer() as React.ReactElement;
    expect(renderedComponentName(rendered)).toBe('DoublePayBanner');
  });

  it("renders AnnualUpgradeBanner when priority is 'annual_upgrade'", () => {
    mockUseEffectiveAccess.mockReturnValue(
      accessWithBanner('annual_upgrade', { plan: 'pro' }),
    );
    const rendered = BannerRenderer() as React.ReactElement;
    expect(renderedComponentName(rendered)).toBe('AnnualUpgradeBanner');
  });

  it("renders WinBackBanner when priority is 'win_back'", () => {
    mockUseEffectiveAccess.mockReturnValue(accessWithBanner('win_back'));
    const rendered = BannerRenderer() as React.ReactElement;
    expect(renderedComponentName(rendered)).toBe('WinBackBanner');
  });

  it('returns null for an unknown priority value (defensive default)', () => {
    mockUseEffectiveAccess.mockReturnValue(accessWithBanner('something_new'));
    const rendered = BannerRenderer() as React.ReactElement | null;
    expect(rendered).toBeNull();
  });
});
