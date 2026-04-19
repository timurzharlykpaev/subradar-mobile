import React from 'react';
import { useEffectiveAccess } from '../hooks/useEffectiveAccess';
import { BillingIssueBanner } from './BillingIssueBanner';
import { GraceBanner } from './GraceBanner';
import ExpirationBanner from './ExpirationBanner';
import { DoublePayBanner } from './DoublePayBanner';
import AnnualUpgradeBanner from './AnnualUpgradeBanner';
import WinBackBanner from './WinBackBanner';

/**
 * Single entry point for rendering the highest-priority banner for the current user.
 *
 * Reads `access.banner.priority` (resolved by the backend) and renders the
 * matching component with `payload` passed through. Each banner component
 * owns its own analytics + layout.
 *
 * - Returns `null` while `useEffectiveAccess()` is still loading (access == null)
 *   or when the backend resolver picked `'none'`.
 * - The banner components MUST NOT re-check visibility — BannerRenderer is
 *   the only gate.
 */
export function BannerRenderer() {
  const access = useEffectiveAccess();
  if (!access) return null;

  const { priority, payload } = access.banner;
  switch (priority) {
    case 'billing_issue':
      return <BillingIssueBanner payload={payload} />;
    case 'grace':
      return <GraceBanner payload={payload} />;
    case 'expiration':
      return <ExpirationBanner payload={payload} />;
    case 'double_pay':
      return <DoublePayBanner payload={payload} />;
    case 'annual_upgrade':
      return <AnnualUpgradeBanner payload={payload} />;
    case 'win_back':
      return <WinBackBanner payload={payload} />;
    case 'none':
    default:
      return null;
  }
}
