import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  Alert, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { workspaceApi } from '../../src/api/workspace';
import { useBillingStatus } from '../../src/hooks/useBilling';
import { useTheme } from '../../src/theme';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { InviteCodeSheet } from '../../src/components/InviteCodeSheet';
import { JoinTeamSheet } from '../../src/components/JoinTeamSheet';
import { TeamOverlaps } from '../../src/components/TeamOverlaps';
import { TeamSpendChart } from '../../src/components/TeamSpendChart';
import { MemberDetailSheet } from '../../src/components/MemberDetailSheet';
import { useWorkspaceAnalysisLatest } from '../../src/hooks/useWorkspaceAnalysis';

export default function WorkspaceScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: billing } = useBillingStatus();
  const isTeam = billing?.plan === 'organization';
  const isPro = billing?.plan === 'pro' || isTeam;
  const currentUser = useAuthStore((s) => s.user);

  const [showCreate, setShowCreate] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showJoinTeam, setShowJoinTeam] = useState(false);

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

  const { data: analytics } = useQuery({
    queryKey: ['workspace-analytics'],
    queryFn: () => workspaceApi.getAnalytics().then(r => r.data),
    enabled: !!workspace,
    retry: false,
  });

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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={90}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView testID="workspace-scroll-empty" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
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
                  onPress={() => router.push('/paywall')}
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
                <TextInput
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
                  autoFocus
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
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
            ${analytics?.totalMonthly?.toFixed(0) || 0}/mo
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
                {t('workspace.ai_savings_potential', 'AI potential savings')}: ${teamSavings.toFixed(0)}/mo
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
                ${analytics.memberCount > 0 ? (analytics.totalMonthly / analytics.memberCount).toFixed(0) : '0'}
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
            <TeamOverlaps overlaps={overlaps} currency={billing?.currency || 'USD'} />
          </View>
        )}

        {/* ── Spending by Member Chart ── */}
        {analytics?.members && analytics.members.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <TeamSpendChart
              members={analytics.members.map((m: any) => ({ name: m.name || m.email, amount: m.monthlySpend ?? m.totalMonthly ?? 0 }))}
              currency={billing?.currency || 'USD'}
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
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
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
                const isOwnerMember = m.role === 'OWNER';
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
                      style={{ width: 42, height: 42, borderRadius: 21 }}
                    />
                  ) : (
                    <View style={{
                      width: 42, height: 42, borderRadius: 21,
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

                  {/* Info */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                      {memberName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: roleBg }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: roleColor, letterSpacing: 0.5 }}>
                          {m.role}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.status === 'ACTIVE' ? '#22C55E' : colors.textMuted }} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: m.status === 'ACTIVE' ? '#22C55E' : colors.textMuted }}>
                          {m.status}
                        </Text>
                      </View>
                      {memberSpend && (
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                          ${(memberSpend.monthlySpend ?? memberSpend.totalMonthly ?? 0).toFixed(0)}/{t('paywall.month', 'mo')}
                        </Text>
                      )}
                    </View>
                  </View>

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
        analytics={selectedMember ? analytics?.members?.find((am: any) => am.userId === selectedMember.userId || am.name === (selectedMember.user?.name || selectedMember.email)) : null}
        currency={billing?.currency || 'USD'}
        canManage={canManage}
        onRemove={() => selectedMember && removeMutation.mutate(selectedMember.id)}
        onClose={() => setSelectedMember(null)}
      />
    </SafeAreaView>
  );
}
