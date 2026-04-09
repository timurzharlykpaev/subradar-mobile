import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Image, Animated, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { apiClient } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.75;

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
  workspaceId?: string;
  analytics?: { monthlySpend?: number; totalMonthly?: number; subscriptionCount?: number; count?: number } | null;
  currency?: string;
  canManage?: boolean;
  onRemove?: () => void;
  onClose: () => void;
}

export function MemberDetailSheet({ visible, member, workspaceId, analytics, currency = 'USD', canManage, onRemove, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  const name = member?.user?.name || member?.user?.email?.split('@')[0] || member?.email?.split('@')[0] || '—';
  const email = member?.user?.email || member?.email || '';
  const avatar = member?.user?.avatarUrl;
  const spend = analytics?.monthlySpend ?? analytics?.totalMonthly ?? 0;
  const subCount = analytics?.subscriptionCount ?? analytics?.count ?? 0;
  const isOwnerMember = member?.role === 'OWNER';
  const sym = currency === 'USD' ? '$' : currency;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(SHEET_H);
      backdropOp.setValue(0);
    }
  }, [visible]);

  const close = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_H, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  // Swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          close();
        } else {
          Animated.spring(translateY, { toValue: 0, damping: 20, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  // Fetch member subscriptions via workspace endpoint
  useEffect(() => {
    if (!visible || !member?.userId || !workspaceId) { setSubs([]); return; }
    setLoading(true);
    apiClient.get(`/workspace/${workspaceId}/members/${member.userId}/subscriptions`)
      .then((res) => setSubs(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.warn('[MemberDetail] Failed to load subs:', err?.response?.status);
        setSubs([]);
      })
      .finally(() => setLoading(false));
  }, [visible, member?.userId, workspaceId]);

  if (!member) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={close}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOp }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, {
          backgroundColor: colors.background,
          height: SHEET_H,
          paddingBottom: insets.bottom || 20,
          transform: [{ translateY }],
        }]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Profile */}
          <View style={styles.profileHeader}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, {
                backgroundColor: isOwnerMember ? colors.primary + '18' : (isDark ? '#ffffff10' : '#00000008'),
                alignItems: 'center', justifyContent: 'center',
              }]}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: isOwnerMember ? colors.primary : colors.textSecondary }}>
                  {name[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            {email ? <Text style={{ fontSize: 13, color: colors.textMuted }} numberOfLines={1}>{email}</Text> : null}
            <View style={[styles.roleBadge, {
              backgroundColor: isOwnerMember ? colors.primary + '18' : member.role === 'ADMIN' ? '#F59E0B18' : (isDark ? '#ffffff0D' : '#0000000A'),
            }]}>
              <Text style={{
                fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
                color: isOwnerMember ? colors.primary : member.role === 'ADMIN' ? '#F59E0B' : colors.textSecondary,
              }}>
                {member.role}
              </Text>
            </View>
          </View>

          {/* Stats */}
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

          {/* Subscriptions */}
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 }}>
              {t('subscriptions.title', 'Subscriptions')}
            </Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : subs.length === 0 ? (
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 12 }}>
                {t('workspace.no_subs_data', 'No subscription data available')}
              </Text>
            ) : (
              <View style={[styles.subsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {subs.filter((s: any) => s.status === 'ACTIVE' || s.status === 'TRIAL').slice(0, 20).map((sub: any, i: number) => {
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

          {/* Remove */}
          {canManage && !isOwnerMember && (
            <TouchableOpacity
              style={[styles.removeBtn, { borderColor: '#EF444440' }]}
              onPress={() => { close(); setTimeout(() => onRemove?.(), 350); }}
              activeOpacity={0.7}
            >
              <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>{t('workspace.remove_btn', 'Remove from team')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },

  profileHeader: { alignItems: 'center', paddingHorizontal: 20, gap: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '800' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  subsList: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },

  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, backgroundColor: '#EF444408' },
});
