import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { apiClient } from '../api/client';

interface MemberData {
  id: string;
  userId: string;
  role: string;
  status: string;
  user?: { id?: string; name?: string; email?: string; avatarUrl?: string };
  email?: string;
}

interface Props {
  visible: boolean;
  member: MemberData | null;
  analytics?: { monthlySpend?: number; totalMonthly?: number; subscriptionCount?: number; count?: number } | null;
  currency?: string;
  canManage?: boolean;
  onRemove?: () => void;
  onClose: () => void;
}

export function MemberDetailSheet({ visible, member, analytics, currency = 'USD', canManage, onRemove, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const name = member?.user?.name || member?.user?.email?.split('@')[0] || member?.email?.split('@')[0] || '—';
  const email = member?.user?.email || member?.email || '';
  const avatar = member?.user?.avatarUrl;
  const spend = analytics?.monthlySpend ?? analytics?.totalMonthly ?? 0;
  const subCount = analytics?.subscriptionCount ?? analytics?.count ?? 0;
  const isOwnerMember = member?.role === 'OWNER';
  const sym = currency === 'USD' ? '$' : currency;

  // Fetch member subscriptions (owner can see)
  useEffect(() => {
    if (!visible || !member?.userId || !canManage) { setSubs([]); return; }
    setLoading(true);
    apiClient.get(`/subscriptions`, { params: { userId: member.userId } })
      .then((res) => setSubs(res.data || []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [visible, member?.userId, canManage]);

  if (!member) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Profile header */}
            <View style={styles.profileHeader}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: isOwnerMember ? colors.primary + '18' : (isDark ? '#ffffff10' : '#00000008'), alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: isOwnerMember ? colors.primary : colors.textSecondary }}>
                    {name[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              {email ? <Text style={[styles.email, { color: colors.textMuted }]} numberOfLines={1}>{email}</Text> : null}
              <View style={[styles.roleBadge, {
                backgroundColor: isOwnerMember ? colors.primary + '18' : member.role === 'ADMIN' ? '#F59E0B18' : (isDark ? '#ffffff0D' : '#0000000A'),
              }]}>
                <Text style={[styles.roleText, {
                  color: isOwnerMember ? colors.primary : member.role === 'ADMIN' ? '#F59E0B' : colors.textSecondary,
                }]}>
                  {member.role}
                </Text>
              </View>
            </View>

            {/* Stats cards */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{sym}{spend.toFixed(0)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>/{t('paywall.month', 'mo')}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{subCount || subs.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('subscriptions.title', 'Subs')}</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{sym}{(spend * 12).toFixed(0)}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>/{t('paywall.year', 'yr')}</Text>
              </View>
            </View>

            {/* Subscriptions list */}
            {canManage && (
              <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('subscriptions.title', 'Subscriptions')}
                </Text>
                {loading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
                ) : subs.length === 0 ? (
                  <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 16 }}>
                    {t('workspace.no_subs_data', 'No subscription data available')}
                  </Text>
                ) : (
                  <View style={[styles.subsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {subs.filter((s: any) => s.status === 'ACTIVE' || s.status === 'TRIAL').slice(0, 15).map((sub: any, i: number) => {
                      const monthly = sub.billingPeriod === 'YEARLY' ? Number(sub.amount) / 12
                        : sub.billingPeriod === 'WEEKLY' ? Number(sub.amount) * 4.33
                        : Number(sub.amount) || 0;
                      return (
                        <View key={sub.id} style={[styles.subRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                          {sub.iconUrl ? (
                            <Image source={{ uri: sub.iconUrl }} style={{ width: 32, height: 32, borderRadius: 8 }} />
                          ) : (
                            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>{(sub.name || '?')[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>{sub.name}</Text>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>{sub.category} · {sub.billingPeriod}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                            {sub.currency} {monthly.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Actions */}
            {canManage && !isOwnerMember && (
              <TouchableOpacity
                style={[styles.removeBtn, { borderColor: '#EF444440' }]}
                onPress={() => { onClose(); setTimeout(() => onRemove?.(), 300); }}
                activeOpacity={0.7}
              >
                <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
                <Text style={styles.removeBtnText}>{t('workspace.remove_btn', 'Remove from team')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  profileHeader: { alignItems: 'center', paddingHorizontal: 20, gap: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '800' },
  email: { fontSize: 13 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  roleText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  subsList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },

  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, backgroundColor: '#EF444408' },
  removeBtnText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});
