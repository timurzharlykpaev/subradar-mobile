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
    onError: (e: any) => Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось создать'),
  });

  const inviteMutation = useMutation({
    mutationFn: () => workspaceApi.invite(workspace.id, inviteEmail.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      setShowInvite(false);
      setInviteEmail('');
      Alert.alert('✅', 'Приглашение отправлено');
    },
    onError: (e: any) => Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось отправить'),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspaceApi.removeMember(workspace.id, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    onError: (e: any) => Alert.alert('Ошибка', e?.response?.data?.message || 'Не удалось удалить'),
  });

  const bg = colors.background;
  const card = isDark ? '#1C1C2E' : '#FFFFFF';
  const border = colors.border;

  // ── No workspace yet ────────────────────────────────────────────────────
  if (!isLoading && !workspace) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={90}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Командное пространство</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Управляйте подписками командой.{'\n'}Отслеживайте общие расходы и отчёты.
          </Text>

          {!isPro ? (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/paywall')}
            >
              <Ionicons name="star" size={18} color="#FFF" />
              <Text style={styles.ctaBtnText}>Нужен план Team</Text>
            </TouchableOpacity>
          ) : showCreate ? (
            <View style={[styles.createCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.createLabel, { color: colors.text }]}>Название команды</Text>
              <TextInput
                style={[styles.input, { backgroundColor: bg, color: colors.text, borderColor: border }]}
                value={wsName}
                onChangeText={setWsName}
                placeholder={t('workspace.name_placeholder', 'My Company')}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.surface, borderColor: border }]}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={() => createMutation.mutate()}
                  disabled={!wsName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={{ color: '#FFF', fontWeight: '700' }}>Создать</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreate(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFF" />
              <Text style={styles.ctaBtnText}>Создать команду</Text>
            </TouchableOpacity>
          )}
        </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Workspace exists ──────────────────────────────────────────────────────
  const members = workspace?.members ?? [];
  const totalMembers = members.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>{workspace?.name ?? 'Команда'}</Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {totalMembers} {totalMembers === 1 ? 'участник' : 'участников'} • {workspace?.plan ?? 'TEAM'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowInvite(true)}
          >
            <Ionicons name="person-add-outline" size={16} color="#FFF" />
            <Text style={styles.inviteBtnText}>Пригласить</Text>
          </TouchableOpacity>
        </View>

        {/* Analytics cards */}
        {analytics && (
          <View style={styles.analyticsRow}>
            <View style={[styles.analyticsCard, { backgroundColor: card, borderColor: border }]}>
              <Ionicons name="card-outline" size={22} color={colors.primary} />
              <Text style={[styles.analyticsValue, { color: colors.text }]}>
                ${analytics.totalMonthly?.toFixed(2) ?? '0.00'}
              </Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>в месяц</Text>
            </View>
            <View style={[styles.analyticsCard, { backgroundColor: card, borderColor: border }]}>
              <Ionicons name="receipt-outline" size={22} color="#22C55E" />
              <Text style={[styles.analyticsValue, { color: colors.text }]}>
                {analytics.totalSubscriptions ?? 0}
              </Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>подписок</Text>
            </View>
            <View style={[styles.analyticsCard, { backgroundColor: card, borderColor: border }]}>
              <Ionicons name="people-outline" size={22} color="#F59E0B" />
              <Text style={[styles.analyticsValue, { color: colors.text }]}>{totalMembers}</Text>
              <Text style={[styles.analyticsLabel, { color: colors.textSecondary }]}>участников</Text>
            </View>
          </View>
        )}

        {/* Per-member breakdown */}
        {analytics?.members && analytics.members.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Расходы участников</Text>
            {analytics.members.map((m: any) => (
              <View key={m.userId} style={[styles.memberRow, { backgroundColor: card, borderColor: border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(m.name ?? m.email ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{m.name ?? m.email}</Text>
                  <Text style={[styles.memberSubs, { color: colors.textSecondary }]}>
                    {m.subscriptionCount ?? 0} подписок
                  </Text>
                </View>
                <Text style={[styles.memberAmount, { color: colors.text }]}>
                  ${m.totalMonthly?.toFixed(2) ?? '0.00'}/мес
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Members list */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Участники</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : members.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Пока нет участников</Text>
          ) : (
            members.map((m: any) => (
              <View key={m.id} style={[styles.memberRow, { backgroundColor: card, borderColor: border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(m.user?.name ?? m.email ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: colors.text }]}>
                    {m.user?.name ?? m.email ?? 'Участник'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[styles.roleBadge, {
                      backgroundColor: m.role === 'OWNER' ? colors.primary + '22' : colors.surface,
                    }]}>
                      <Text style={[styles.roleText, {
                        color: m.role === 'OWNER' ? colors.primary : colors.textSecondary,
                      }]}>{m.role}</Text>
                    </View>
                    <Text style={[styles.memberStatus, {
                      color: m.status === 'ACTIVE' ? '#22C55E' : colors.textMuted,
                    }]}>{m.status}</Text>
                  </View>
                </View>
                {m.role !== 'OWNER' && (
                  <TouchableOpacity
                    onPress={() => Alert.alert('Удалить?', `Убрать ${m.user?.name ?? m.email} из команды?`, [
                      { text: 'Отмена', style: 'cancel' },
                      { text: 'Удалить', style: 'destructive', onPress: () => removeMutation.mutate(m.id) },
                    ])}
                    style={{ padding: 8 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Invite modal inline */}
        {showInvite && (
          <View style={[styles.inviteCard, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.createLabel, { color: colors.text }]}>Email участника</Text>
            <TextInput
              style={[styles.input, { backgroundColor: bg, color: colors.text, borderColor: border }]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder={t("workspace.email_placeholder")}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surface, borderColor: border }]}
                onPress={() => { setShowInvite(false); setInviteEmail(''); }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={() => inviteMutation.mutate()}
                disabled={!inviteEmail.includes('@') || inviteMutation.isPending}
              >
                {inviteMutation.isPending
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={{ color: '#FFF', fontWeight: '700' }}>Отправить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  screenTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 13, marginTop: 2 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  inviteBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  analyticsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  analyticsCard: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, alignItems: 'center', gap: 4 },
  analyticsValue: { fontSize: 20, fontWeight: '900' },
  analyticsLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  memberName: { fontSize: 15, fontWeight: '700' },
  memberSubs: { fontSize: 12, marginTop: 1 },
  memberAmount: { fontSize: 14, fontWeight: '700' },
  memberStatus: { fontSize: 11, fontWeight: '600' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 14 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  ctaBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  createCard: { margin: 20, borderRadius: 16, padding: 16, borderWidth: 1 },
  inviteCard: { margin: 20, borderRadius: 16, padding: 16, borderWidth: 1 },
  createLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
});
