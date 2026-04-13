import { useBillingStatus } from './useBilling';
import { useSubscriptionsStore } from '../stores/subscriptionsStore';

export interface EffectiveAccess {
  plan: 'free' | 'pro' | 'organization';
  isPro: boolean;
  isTeam: boolean;
  isTeamOwner: boolean;
  isTeamMember: boolean;
  hasOwnPro: boolean;
  source: 'own' | 'team' | 'grace_team' | 'grace_pro' | 'free';
  graceDaysLeft: number | null;
  graceReason: 'team_expired' | 'pro_expired' | null;
  workspaceExpiringDays: number | null;
  // UI helpers
  shouldShowDoublePay: boolean;
  shouldShowGraceBanner: boolean;
  shouldShowOwnerExpiredAlert: boolean;
  isInDegradedMode: boolean;
  visibleSubsCount: number;
  hiddenSubsCount: number;
}

export function useEffectiveAccess(): EffectiveAccess {
  const { data: billing } = useBillingStatus();
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);

  const plan = (billing?.plan ?? 'free') as 'free' | 'pro' | 'organization';
  const isPro = plan === 'pro' || plan === 'organization';
  const isTeam = plan === 'organization';
  const isTeamOwner = billing?.isTeamOwner ?? false;
  const isTeamMember = billing?.isTeamMember ?? false;
  const hasOwnPro = billing?.hasOwnPro ?? false;
  const source = (billing?.source ?? 'free') as EffectiveAccess['source'];
  const graceDaysLeft = billing?.graceDaysLeft ?? null;
  const graceReason: EffectiveAccess['graceReason'] =
    source === 'grace_team' ? 'team_expired' : source === 'grace_pro' ? 'pro_expired' : null;

  const workspaceExpiringDays = billing?.workspaceExpiringAt
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(billing.workspaceExpiringAt).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  const activeSubsCount = subscriptions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'TRIAL'
  ).length;

  const isInDegradedMode = plan === 'free' && activeSubsCount > 3;
  const visibleSubsCount = isInDegradedMode ? 3 : activeSubsCount;
  const hiddenSubsCount = isInDegradedMode ? activeSubsCount - 3 : 0;

  return {
    plan,
    isPro,
    isTeam,
    isTeamOwner,
    isTeamMember,
    hasOwnPro,
    source,
    graceDaysLeft,
    graceReason,
    workspaceExpiringDays,
    shouldShowDoublePay: hasOwnPro && isTeamMember && !isTeamOwner,
    shouldShowGraceBanner: graceDaysLeft !== null && graceDaysLeft > 0,
    shouldShowOwnerExpiredAlert: isTeamOwner && workspaceExpiringDays !== null && workspaceExpiringDays > 0,
    isInDegradedMode,
    visibleSubsCount,
    hiddenSubsCount,
  };
}
