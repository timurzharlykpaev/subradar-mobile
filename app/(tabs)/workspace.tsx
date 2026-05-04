import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  Alert, ActivityIndicator, RefreshControl, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  TextInput,
} from 'react-native';
import { DoneAccessoryInput } from '../../src/components/primitives/DoneAccessoryInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../../src/utils/formatMoney';
import { workspaceApi } from '../../src/api/workspace';
import { useTheme } from '../../src/theme';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { InviteCodeSheet } from '../../src/components/InviteCodeSheet';
import { JoinTeamSheet } from '../../src/components/JoinTeamSheet';
import { TeamOverlaps } from '../../src/components/TeamOverlaps';
import { TeamSpendChart } from '../../src/components/TeamSpendChart';
import { MemberDetailSheet } from '../../src/components/MemberDetailSheet';
import { useWorkspaceAnalysisLatest } from '../../src/hooks/useWorkspaceAnalysis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useEffectiveAccess } from '../../src/hooks/useEffectiveAccess';
import { BannerRenderer } from '../../src/components/BannerRenderer';
import TeamExplainerModal from '../../src/components/TeamExplainerModal';
import { reconcileBillingDrift } from '../../src/utils/reconcileBillingDrift';
import { convertAmount } from '../../src/services/fxCache';
import { WorkspaceMembersSkeleton } from '../../src/components/skeletons';

export default function WorkspaceScreen() {
  const { colors, isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const access = useEffectiveAccess();
  const isTeam = access?.plan === 'organization';
  const isPro = access?.isPro ?? false;
  const localDisplayCurrency = useSettingsStore((s) => s.displayCurrency || s.currency || 'USD');
  const locale = i18n.language;
  const currentUser = useAuthStore((s) => s.user);

  const [showCreate, setShowCreate] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [showTeamExplainer, setShowTeamExplainer] = useState(false);
  // Manual focus on the create-team field. Replaces TextInput's `autoFocus`,
  // which on iOS 18+ kicked in BEFORE the surrounding ScrollView had
  // settled `automaticallyAdjustKeyboardInsets`; the resulting layout shift
  // tore the keyboard's session and emitted a stream of
  // `RTIInputSystemClient … requires a valid sessionID` warnings — visually
  // observable as a flickering / laggy input.
  const wsNameRef = useRef<TextInput | null>(null);
  useEffect(() => {
    if (!showCreate) return;
    const t = setTimeout(() => wsNameRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [showCreate]);

  // Force billing refresh when workspace tab opens to get latest plan status
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['billing'] });
  }, []);
  const [wsName, setWsName] = useState('');

  const { data: workspace, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['workspace'],
    queryFn: () => workspaceApi.getMe().then(r => r.data),
    retry: false,
  });

  // Pull-to-refresh: re-fetch billing (plan + banner priority), workspace,
  // analytics, and AI analysis savings. Previously only `workspace` was
  // refetched — banner/spend numbers stayed stale after a sync change.
  //
  // Using `useIsFetching` to drive the spinner instead of a local flag —
  // the local-flag version flipped `refreshing` while RefreshControl was
  // still settling its own gesture state and produced
  // "Attempting to change the refresh control while it is not idle"
  // warnings on every pull.
  const fetchingCount = useIsFetching({
    predicate: (q) => {
      const key = q.queryKey?.[0];
      return (
        key === 'billing' ||
        key === 'workspace' ||
        key === 'workspace-analytics' ||
        key === 'workspace-analysis'
      );
    },
  });
  const handleRefresh = React.useCallback(async () => {
    // Run RC ↔ backend reconcile FIRST so subsequent refetches see the
    // corrected state. Critical here because the workspace screen is
    // the most visible place where the cancel-state drift surfaces (Team
    // banner / "ends in N days" while Apple says it'll renew).
    await reconcileBillingDrift().catch(() => undefined);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['billing'] }),
      queryClient.refetchQueries({ queryKey: ['workspace'] }),
      queryClient.refetchQueries({ queryKey: ['workspace-analytics'] }),
      queryClient.refetchQueries({ queryKey: ['workspace-analysis'] }),
    ]);
  }, [queryClient]);

  // Pass the user's chosen currency on every fetch so server-side conversion
  // matches what we render. Without this, /workspace/me/analytics fell back
  // to the user's persisted backend currency (often stale USD) and Team
  // totals showed wrong amounts for up to 5 min (analytics Redis TTL).
  const localUpper = localDisplayCurrency.toUpperCase();
  const { data: analytics } = useQuery({
    queryKey: ['workspace-analytics', localUpper],
    queryFn: () => workspaceApi.getAnalytics({ displayCurrency: localUpper }).then(r => r.data),
    enabled: !!workspace,
    retry: false,
  });

  // Always render in the user's chosen currency. The backend should respect
  // the displayCurrency query param above and pre-convert totals, but in
  // practice it sometimes returns amounts in a different currency (stale
  // user persisted value, cache, etc). We treat the local pick as the
  // source of truth for what the UI shows and client-convert anything the
  // backend gave us in a different unit. Falls back to the raw amount when
  // FX cache hasn't loaded yet — better stale than blank.
  const displayCurrency: string = localUpper;
  const serverCurrency: string = (((analytics as any)?.displayCurrency as string) || localUpper).toUpperCase();
  const toDisplay = (amount: number | undefined | null): number => {
    const n = Number(amount) || 0;
    if (serverCurrency === displayCurrency) return n;
    return convertAmount(n, serverCurrency, displayCurrency) ?? n;
  };
  const teamMonthly = toDisplay(analytics?.totalMonthly);
  const avgPerMember =
    analytics && (analytics as any).memberCount > 0
      ? teamMonthly / (analytics as any).memberCount
      : 0;

  const { data: analysisData } = useWorkspaceAnalysisLatest();
  const teamSavings = analysisData?.result?.teamSavings;
  const overlaps = analysisData?.result?.overlaps || [];

  const createMutation = useMutation({
    mutationFn: () => workspaceApi.create(wsName.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setShowCreate(false);
      setWsName('');
    },
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_create')),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspaceApi.removeMember(workspace.id, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_remove')),
  });

  const leaveMutation = useMutation({
    mutationFn: () => workspaceApi.leave(workspace.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-analytics'] });
    },
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_leave', 'Failed to leave team')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => workspaceApi.deleteWorkspace(workspace.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-analytics'] });
    },
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_delete', 'Failed to delete team')),
  });

  // ── No workspace yet ────────────────────────────────────────────────────
  if (!isLoading && !workspace) {
    return (
      <SafeAreaView testID="workspace-screen-empty" edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          // iOS: pass-through — ScrollView's `automaticallyAdjustKeyboardInsets`
          // already shifts content above the keyboard; layering KAV padding on
          // top double-counted the offset and pushed the create-team input
          // behind the keyboard. Android still needs `behavior="height"`.
          behavior={Platform.OS === 'android' ? 'height' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={0}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          testID="workspace-scroll-empty"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Icon + title */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, minHeight: 300 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.primary + '18',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="people-outline" size={40} color={colors.primary} />
            </View>
            <Text style={{
              fontSize: 24,
              fontWeight: '900',
              color: colors.text,
              textAlign: 'center',
              marginBottom: 10,
              letterSpacing: -0.5,
            }}>
              {t('workspace.title')}
            </Text>
            <Text style={{
              fontSize: 15,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              marginBottom: 24,
            }}>
              {t('workspace.empty_subtitle', 'Manage subscriptions as a team.\nTrack shared spending and reports.')}
            </Text>

            {/* Feature list teaser */}
            {!isTeam && (
              <View style={{ alignSelf: 'stretch', marginBottom: 24 }}>
                {[
                  { icon: 'eye-outline' as const, text: t('workspace.feature_see_who_pays', 'See who pays for what') },
                  { icon: 'copy-outline' as const, text: t('workspace.feature_find_duplicates', 'Find duplicate subscriptions') },
                  { icon: 'swap-horizontal-outline' as const, text: t('workspace.feature_family_plans', 'Switch to family plans & save') },
                  { icon: 'document-text-outline' as const, text: t('workspace.feature_weekly_report', 'Weekly team spending report') },
                ].map((item, i) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 10,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 10,
                      backgroundColor: colors.primary + '14',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={item.icon} size={16} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 }}>
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            {/* Join Team sheet */}
            {showJoinTeam && (
              <View style={{ marginBottom: 16 }}>
                <JoinTeamSheet
                  onSuccess={() => setShowJoinTeam(false)}
                  onClose={() => setShowJoinTeam(false)}
                />
              </View>
            )}

            {!isTeam ? (
              <>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    paddingVertical: 14,
                    borderRadius: 16,
                    marginBottom: 10,
                  }}
                  onPress={() => setShowTeamExplainer(true)}
                >
                  <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>
                    {t('workspace.how_team_works', 'How does Team work?')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="btn-workspace-upgrade"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 16,
                  }}
                  onPress={() => router.push('/paywall?prefill=org-yearly' as any)}
                >
                  <Ionicons name="star" size={18} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
                    {t('workspace.start_team', 'Start Team — $9.99/mo')}
                  </Text>
                </TouchableOpacity>

                {!showJoinTeam && (
                  <TouchableOpacity
                    testID="btn-join-team-empty"
                    style={{ alignItems: 'center', marginTop: 16, paddingVertical: 10 }}
                    onPress={() => setShowJoinTeam(true)}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                      {t('workspace.have_invite_code', 'Have an invite code? Join Team')}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : showCreate ? (
              <View style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 20,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
                  {t('workspace.team_name_label')}
                </Text>
                <DoneAccessoryInput
                  ref={wsNameRef}
                  testID="input-workspace-name"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    backgroundColor: colors.background,
                    color: colors.text,
                  }}
                  value={wsName}
                  onChangeText={setWsName}
                  placeholder={t('workspace.name_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (wsName.trim() && !createMutation.isPending) {
                      createMutation.mutate();
                    }
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="organizationName"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    testID="btn-cancel-create-workspace"
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    onPress={() => setShowCreate(false)}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="btn-confirm-create-workspace"
                    style={{
                      flex: 1.5,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: 'center',
                      backgroundColor: colors.primary,
                      opacity: (!wsName.trim() || createMutation.isPending) ? 0.5 : 1,
                    }}
                    onPress={() => createMutation.mutate()}
                    disabled={!wsName.trim() || createMutation.isPending}
                  >
                    {createMutation.isPending
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                          {t('workspace.create_team')}
                        </Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  testID="btn-create-workspace"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 16,
                  }}
                  onPress={() => setShowCreate(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>
                    {t('workspace.create_team')}
                  </Text>
                </TouchableOpacity>

                {!showJoinTeam && (
                  <TouchableOpacity
                    testID="btn-join-team-empty-team"
                    style={{ alignItems: 'center', marginTop: 16, paddingVertical: 10 }}
                    onPress={() => setShowJoinTeam(true)}
                  >
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
                      {t('workspace.have_invite_code', 'Have an invite code? Join Team')}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </ScrollView>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <TeamExplainerModal
          visible={showTeamExplainer}
          onClose={() => setShowTeamExplainer(false)}
          source="workspace_tab"
        />
      </SafeAreaView>
    );
  }

  // ── Workspace exists ──────────────────────────────────────────────────────
  const members = workspace?.members ?? [];
  const totalMembers = members.length;
  const myMember = members.find((m: any) => m.userId === currentUser?.id || m.user?.id === currentUser?.id);
  const myRole = myMember?.role;
  const isOwner = myRole === 'OWNER';
  const isAdmin = myRole === 'ADMIN';
  const canManage = isOwner || isAdmin;

  return (
    <SafeAreaView testID="workspace-screen" edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
      <ScrollView
        testID="workspace-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={fetchingCount > 0} onRefresh={handleRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Single banner chosen by backend-resolved priority — includes
            the grace_team state for expired team owners. */}
        <BannerRenderer />

        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 20,
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 28,
              fontWeight: '900',
              color: colors.text,
              letterSpacing: -0.5,
            }}>
              {workspace?.name ?? t('workspace.title')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                {totalMembers} {totalMembers === 1 ? t('workspace.members_one') : t('workspace.members_other')}
              </Text>
              <View style={{
                backgroundColor: colors.primary + '22',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>
                  {workspace?.plan ?? 'TEAM'}
                </Text>
              </View>
            </View>
          </View>
          {canManage && (
            <TouchableOpacity
              testID="btn-invite-code"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.primary,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 14,
              }}
              onPress={() => setShowInviteCode(!showInviteCode)}
            >
              <Ionicons name="person-add-outline" size={16} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                {t('workspace.invite_btn')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Invite Code Sheet ── */}
        {showInviteCode && workspace?.id && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <InviteCodeSheet
              workspaceId={workspace.id}
              onClose={() => setShowInviteCode(false)}
            />
          </View>
        )}

        {/* ── Hero Card — Team Spend ── */}
        <View style={{
          marginHorizontal: 20,
          marginBottom: 20,
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 36,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -1,
          }}>
            {formatMoney(teamMonthly, displayCurrency, locale)}
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textSecondary }}>
              {' /'}{t('add_flow.mo', 'mo')}
            </Text>
          </Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 4,
            fontWeight: '600',
          }}>
            {t('workspace.team_spend', 'Team Spend')}
          </Text>
          {teamSavings != null && teamSavings > 0 && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 12,
              backgroundColor: '#22C55E14',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
            }}>
              <Ionicons name="sparkles" size={14} color="#22C55E" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#22C55E' }}>
                {t('workspace.ai_savings_potential', 'AI potential savings')}: {formatMoney(teamSavings, displayCurrency, locale)}/{t('add_flow.mo', 'mo')}
              </Text>
            </View>
          )}
        </View>

        {/* ── Stats Row ── */}
        {analytics && (
          <View style={{
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: 20,
            marginBottom: 24,
          }}>
            {/* Total subs */}
            <View style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              gap: 6,
            }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#22C55E18',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="receipt-outline" size={18} color="#22C55E" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                {analytics.totalSubscriptions ?? 0}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('workspace.subs_label')}
              </Text>
            </View>

            {/* Avg per member */}
            <View style={{
              flex: 1,
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              gap: 6,
            }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F59E0B18',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="person-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                {formatMoney(avgPerMember, displayCurrency, locale)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('workspace.avg_per_member', 'Avg / member')}
              </Text>
            </View>
          </View>
        )}

        {/* ── Owner Actions: Report + Refresh ── */}
        {isOwner && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
              onPress={() => router.push('/reports' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFF" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>
                {t('workspace.team_report', 'Team Report')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}
              onPress={() => {
                queryClient.invalidateQueries({ queryKey: ['workspace-analysis'] });
                queryClient.invalidateQueries({ queryKey: ['workspace'] });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Subscription Overlaps ── */}
        {overlaps.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <TeamOverlaps overlaps={overlaps} currency={displayCurrency} />
          </View>
        )}

        {/* ── Spending by Member Chart ── */}
        {analytics?.members && analytics.members.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <TeamSpendChart
              members={analytics.members.map((m: any) => ({ name: m.name || m.email, amount: toDisplay(m.monthlySpend ?? m.totalMonthly) }))}
              currency={displayCurrency}
            />
          </View>
        )}

        {/* ── Members list ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{
            fontSize: 17,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 12,
          }}>
            {t('workspace.members_section_title')}
          </Text>

          {isLoading ? (
            <View style={{ marginTop: 12 }}>
              <WorkspaceMembersSkeleton rows={3} />
            </View>
          ) : members.length === 0 ? (
            <Text style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: colors.textMuted }}>
              {t('workspace.no_members_yet')}
            </Text>
          ) : (
            <View style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}>
              {members.map((m: any, idx: number) => {
                const memberName = m.user?.name || m.user?.email?.split('@')[0] || m.email?.split('@')[0] || t('workspace.members_one');
                const avatarUrl = m.user?.avatarUrl;
                const memberSpend = analytics?.members?.find((am: any) => am.userId === m.userId || am.name === memberName);
                const spendAmount = toDisplay(memberSpend?.monthlySpend ?? memberSpend?.totalMonthly);
                const subCount = memberSpend?.subscriptionCount ?? memberSpend?.count ?? 0;
                const isOwnerMember = m.role === 'OWNER';
                const isActive = m.status === 'ACTIVE';
                const roleColor = isOwnerMember ? colors.primary : m.role === 'ADMIN' ? '#F59E0B' : colors.textSecondary;
                const roleBg = isOwnerMember ? colors.primary + '18' : m.role === 'ADMIN' ? '#F59E0B18' : (isDark ? '#ffffff0D' : '#0000000A');

                return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.6}
                  onPress={() => setSelectedMember(m)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: 12,
                    borderBottomWidth: idx < members.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  {/* Avatar */}
                  {avatarUrl ? (
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: isOwnerMember ? colors.primary + '18' : (isDark ? '#ffffff10' : '#00000008'),
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 17, fontWeight: '800',
                        color: isOwnerMember ? colors.primary : colors.textSecondary,
                      }}>
                        {memberName[0].toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Name + role badge + status */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 }} numberOfLines={1}>
                        {memberName}
                      </Text>
                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: roleBg }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: roleColor, letterSpacing: 0.5 }}>
                          {m.role}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isActive ? '#22C55E' : colors.textMuted }} />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isActive ? '#22C55E' : colors.textMuted }} numberOfLines={1}>
                        {(m.user as any)?.hasOwnPro
                          ? t('team_logic.member_status_own_pro')
                          : (m.user as any)?.gracePeriodEnd
                          ? t('team_logic.member_status_grace')
                          : t('team_logic.member_status_team')}
                      </Text>
                    </View>
                  </View>

                  {/* Spend (right column) */}
                  {memberSpend && spendAmount > 0 ? (
                    <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                        {formatMoney(spendAmount, displayCurrency, locale)}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 2 }}>
                        {subCount > 0
                          ? `${subCount} · /${t('add_flow.mo', 'mo')}`
                          : `/${t('add_flow.mo', 'mo')}`}
                      </Text>
                    </View>
                  ) : null}

                  {/* Actions */}
                  {m.role !== 'OWNER' && canManage && (
                    <TouchableOpacity
                      testID={`btn-remove-member-${m.id}`}
                      onPress={() => Alert.alert(t('workspace.remove_confirm_title'), t('workspace.remove_member_confirm'), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('workspace.remove_btn'), style: 'destructive', onPress: () => removeMutation.mutate(m.id) },
                      ])}
                      style={{ padding: 10, borderRadius: 12, backgroundColor: '#EF444412' }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                  {!canManage && m.role !== 'OWNER' && (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Team Settings — Leave / Delete ── */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          {!isOwner && (
            <TouchableOpacity
              testID="btn-leave-team"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: colors.card,
                paddingVertical: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 12,
              }}
              onPress={() => Alert.alert(
                t('workspace.leave_confirm_title', 'Leave Team?'),
                t('workspace.leave_confirm_msg', 'You will lose access to shared analytics and team features.'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('workspace.leave_btn', 'Leave'),
                    style: 'destructive',
                    onPress: () => leaveMutation.mutate(),
                  },
                ],
              )}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 15 }}>
                {t('workspace.leave_team', 'Leave Team')}
              </Text>
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity
              testID="btn-delete-team"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#EF444412',
                paddingVertical: 16,
                borderRadius: 16,
              }}
              onPress={() => Alert.alert(
                t('workspace.delete_confirm_title', 'Delete Team?'),
                t('workspace.delete_confirm_msg', 'This will permanently delete the team and remove all members. This cannot be undone.'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('workspace.delete_btn', 'Delete'),
                    style: 'destructive',
                    onPress: () => deleteMutation.mutate(),
                  },
                ],
              )}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>
                {t('workspace.delete_team', 'Delete Team')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Member Detail Modal */}
      <MemberDetailSheet
        visible={!!selectedMember}
        member={selectedMember}
        workspaceId={workspace?.id}
        analytics={(() => {
          if (!selectedMember) return null;
          const raw = analytics?.members?.find(
            (am: any) =>
              am.userId === selectedMember.userId ||
              am.name === (selectedMember.user?.name || selectedMember.email),
          );
          if (!raw) return null;
          // Pre-convert per-member spend to displayCurrency so the sheet's
          // header card shows the user's chosen unit, not whatever the
          // backend stored.
          return {
            ...raw,
            monthlySpend: toDisplay(raw.monthlySpend ?? raw.totalMonthly),
            totalMonthly: toDisplay(raw.totalMonthly ?? raw.monthlySpend),
          };
        })()}
        currency={displayCurrency}
        canManage={canManage}
        onRemove={() => selectedMember && removeMutation.mutate(selectedMember.id)}
        onClose={() => setSelectedMember(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  memberStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
