import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, StyleSheet, RefreshControl,
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

export default function WorkspaceScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: billing } = useBillingStatus();
  const isPro = billing?.plan === 'pro' || billing?.plan === 'organization';

  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [wsName, setWsName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

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

  const createMutation = useMutation({
    mutationFn: () => workspaceApi.create(wsName.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setShowCreate(false);
      setWsName('');
    },
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_create')),
  });

  const inviteMutation = useMutation({
    mutationFn: () => workspaceApi.invite(workspace.id, inviteEmail.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setShowInvite(false);
      setInviteEmail('');
      Alert.alert('✅', t('workspace.invite_sent'));
    },
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_invite')),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspaceApi.removeMember(workspace.id, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    onError: (e: any) => Alert.alert(t('workspace.error_title'), e?.response?.data?.message || t('workspace.error_remove')),
  });

  // ── No workspace yet ────────────────────────────────────────────────────
  if (!isLoading && !workspace) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={90}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
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
              marginBottom: 32,
            }}>
              {t('workspace.empty_subtitle', 'Manage subscriptions as a team.\nTrack shared spending and reports.')}
            </Text>
          </View>

          {/* Actions */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            {!isPro ? (
              <TouchableOpacity
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
                  {t('workspace.need_team_plan')}
                </Text>
              </TouchableOpacity>
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
              <TouchableOpacity
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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
      <ScrollView
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
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 14,
            }}
            onPress={() => setShowInvite(!showInvite)}
          >
            <Ionicons name="person-add-outline" size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
              {t('workspace.invite_btn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Analytics cards ── */}
        {analytics && (
          <View style={{
            flexDirection: 'row',
            gap: 10,
            paddingHorizontal: 20,
            marginBottom: 24,
          }}>
            {/* Monthly spend */}
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
                backgroundColor: colors.primary + '18',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="card-outline" size={18} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                ${analytics.totalMonthly?.toFixed(2) ?? '0.00'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('workspace.per_month_label')}
              </Text>
            </View>

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

            {/* Members */}
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
                <Ionicons name="people-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>
                {totalMembers}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                {t('workspace.members_label')}
              </Text>
            </View>
          </View>
        )}

        {/* ── Invite card (inline) ── */}
        {showInvite && (
          <View style={{
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>
              {t('workspace.invite_member_email')}
            </Text>
            <TextInput
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
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder={t('workspace.email_placeholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => { setShowInvite(false); setInviteEmail(''); }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 15 }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1.5,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  backgroundColor: colors.primary,
                  opacity: (!inviteEmail.includes('@') || inviteMutation.isPending) ? 0.5 : 1,
                }}
                onPress={() => inviteMutation.mutate()}
                disabled={!inviteEmail.includes('@') || inviteMutation.isPending}
              >
                {inviteMutation.isPending
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                      {t('workspace.send_invite')}
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Member spending ── */}
        {analytics?.members && analytics.members.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <Text style={{
              fontSize: 17,
              fontWeight: '800',
              color: colors.text,
              marginBottom: 12,
            }}>
              {t('workspace.member_spending_title')}
            </Text>
            <View style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}>
              {analytics.members.map((m: any, idx: number) => (
                <View
                  key={m.userId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    gap: 12,
                    borderBottomWidth: idx < analytics.members.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: colors.primary + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: colors.primary }}>
                      {(m.name ?? m.email ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {m.name ?? m.email}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {t('workspace.member_subs_count', { count: m.subscriptionCount ?? 0 })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    ${m.totalMonthly?.toFixed(2) ?? '0.00'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {t('workspace.per_month_label')}
                  </Text>
                </View>
              ))}
            </View>
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
              {members.map((m: any, idx: number) => (
                <View
                  key={m.id}
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
                  <View style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: m.role === 'OWNER'
                      ? colors.primary + '18'
                      : (isDark ? '#ffffff10' : '#00000008'),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      fontSize: 17,
                      fontWeight: '800',
                      color: m.role === 'OWNER' ? colors.primary : colors.textSecondary,
                    }}>
                      {(m.user?.name ?? m.email ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {m.user?.name ?? m.email ?? t('workspace.members_one')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: m.role === 'OWNER'
                          ? colors.primary + '18'
                          : (isDark ? '#ffffff0D' : '#0000000A'),
                      }}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: m.role === 'OWNER' ? colors.primary : colors.textSecondary,
                          letterSpacing: 0.5,
                        }}>
                          {m.role}
                        </Text>
                      </View>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <View style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: m.status === 'ACTIVE' ? '#22C55E' : colors.textMuted,
                        }} />
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: m.status === 'ACTIVE' ? '#22C55E' : colors.textMuted,
                        }}>
                          {m.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {m.role !== 'OWNER' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert(t('workspace.remove_confirm_title'), t('workspace.remove_member_confirm'), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('workspace.remove_btn'), style: 'destructive', onPress: () => removeMutation.mutate(m.id) },
                      ])}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: '#EF444412',
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
