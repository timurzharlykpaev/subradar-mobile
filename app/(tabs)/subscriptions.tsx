import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { reportError } from '../../src/utils/errorReporter';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionsStore, FilterType } from '../../src/stores/subscriptionsStore';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { SubscriptionCard } from '../../src/components/SubscriptionCard';
import { CATEGORIES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { CategoryIcon } from '../../src/components/icons';
import { usePlanLimits } from '../../src/hooks/usePlanLimits';
import { useUIStore } from '../../src/stores/uiStore';

type SortType = 'next_date' | 'amount_high' | 'amount_low' | 'name' | 'recent';

export default function SubscriptionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { subsLimitReached, activeCount, maxSubscriptions, isPro } = usePlanLimits();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortType>('next_date');
  const [showSearch, setShowSearch] = useState(false);

  const fetchSubs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await subscriptionsApi.getAll();
      setSubscriptions(res.data || []);
    } catch (err: any) {
      reportError(`subscriptions.fetchSubs: ${err?.message ?? err}`, err?.stack);
    } finally { setRefreshing(false); }
  }, []);

  const addSheetVisible = useUIStore((s) => s.addSheetVisible);
  const prevSheetVisible = useRef(addSheetVisible);

  // Always fetch on mount
  useEffect(() => { fetchSubs(); }, []);

  // Always fetch when screen gains focus (back from detail, other tabs, etc.)
  useFocusEffect(
    useCallback(() => {
      fetchSubs(true); // silent — don't show spinner
    }, [fetchSubs])
  );

  // Refresh when AddSubscriptionSheet closes
  useEffect(() => {
    if (prevSheetVisible.current && !addSheetVisible) {
      fetchSubs(true);
    }
    prevSheetVisible.current = addSheetVisible;
  }, [addSheetVisible]);

  // Periodic refresh every 15 seconds while screen is visible
  useFocusEffect(
    useCallback(() => {
      const interval = setInterval(() => fetchSubs(true), 15000);
      return () => clearInterval(interval);
    }, [fetchSubs])
  );

  const FILTERS: { label: string; value: FilterType; icon: string }[] = [
    { label: t('common.all'), value: 'all', icon: 'apps-outline' },
    { label: t('subscriptions.active'), value: 'active', icon: 'checkmark-circle-outline' },
    { label: t('subscriptions.trial'), value: 'trial', icon: 'time-outline' },
    { label: t('subscriptions.cancelled'), value: 'cancelled', icon: 'close-circle-outline' },
    { label: t('add.category'), value: 'category', icon: 'grid-outline' },
  ];

  const SORTS: { label: string; value: SortType }[] = [
    { label: t('subscriptions.sort_date', 'Date'), value: 'next_date' },
    { label: t('subscriptions.sort_high', 'Price ↓'), value: 'amount_high' },
    { label: t('subscriptions.sort_low', 'Price ↑'), value: 'amount_low' },
    { label: t('subscriptions.sort_name', 'A-Z'), value: 'name' },
  ];

  const searchQuery = useSubscriptionsStore((s) => s.searchQuery);
  const filter = useSubscriptionsStore((s) => s.filter);
  const setFilter = useSubscriptionsStore((s) => s.setFilter);
  const setSearchQuery = useSubscriptionsStore((s) => s.setSearchQuery);
  const getFiltered = useSubscriptionsStore((s) => s.getFiltered);
  const removeSubscription = useSubscriptionsStore((s) => s.removeSubscription);
  const selectedCategory = useSubscriptionsStore((s) => s.selectedCategory);
  const setSelectedCategory = useSubscriptionsStore((s) => s.setSelectedCategory);
  const setSubscriptions = useSubscriptionsStore((s) => s.setSubscriptions);
  const subscriptions = useSubscriptionsStore((s) => s.subscriptions);

  const subs = useMemo(() => {
    const filtered = getFiltered();
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'amount_high': return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        case 'amount_low': return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'next_date':
        default:
          const da = a.nextPaymentDate ? new Date(a.nextPaymentDate).getTime() : Infinity;
          const db = b.nextPaymentDate ? new Date(b.nextPaymentDate).getTime() : Infinity;
          return da - db;
      }
    });
  }, [getFiltered, filter, searchQuery, selectedCategory, sortBy, subscriptions]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert(t('subscriptions.delete_title'), `${name}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try {
          await subscriptionsApi.delete(id);
          removeSubscription(id);
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.message || t('common.error');
          Alert.alert(t('common.error'), msg);
        }
      }},
    ]);
  };

  // Stats
  const totalActive = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL').length;
  const totalMonthly = subscriptions
    .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
    .reduce((sum, s) => {
      const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1 / 3 : s.billingPeriod === 'YEARLY' ? 1 / 12 : 1;
      return sum + (Number(s.amount) || 0) * mult;
    }, 0);

  return (
    <SafeAreaView testID="subscriptions-screen" edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>

        {/* ── Header ────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t('subscriptions.title')}</Text>
          </View>
          <TouchableOpacity
            testID="btn-toggle-search"
            style={[styles.headerBtn, { backgroundColor: colors.surface2 }]}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {subsLimitReached && (
            <TouchableOpacity
              testID="btn-upgrade-pro"
              style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/paywall')}
            >
              <Ionicons name="diamond" size={14} color="#FFF" />
              <Text style={styles.upgradeBtnText}>PRO</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Summary strip ──────────────────────────────────── */}
        <View testID="subscriptions-summary" style={styles.summaryStrip}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{totalActive}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('subscriptions.active')}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>${totalMonthly.toFixed(0)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>/{t('paywall.month', 'mo')}</Text>
          </View>
          {!isPro && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryValue, { color: activeCount >= maxSubscriptions ? colors.error : colors.text }]}>{activeCount}/{maxSubscriptions}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('subscription_plan.subs_used')}</Text>
            </View>
          )}
        </View>

        {/* ── Search ─────────────────────────────────────────── */}
        {showSearch && (
          <View style={[styles.searchContainer, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              testID="search-input"
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('subscriptions.search')}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity testID="btn-clear-search" onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* ── Filters ────────────────────────────────────────── */}
        <ScrollView testID="filter-chips" horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <TouchableOpacity
                testID={`filter-chip-${f.value}`}
                key={f.value}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.primary : colors.surface2, borderColor: active ? colors.primary : colors.border },
                ]}
                onPress={() => setFilter(f.value)}
              >
                <Ionicons name={f.icon as any} size={14} color={active ? '#FFF' : colors.textSecondary} />
                <Text style={[styles.filterText, { color: active ? '#FFF' : colors.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Sort row ───────────────────────────────────────── */}
        <ScrollView testID="sort-chips" horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll} contentContainerStyle={styles.filters}>
          {SORTS.map((s) => (
            <TouchableOpacity
              testID={`sort-chip-${s.value}`}
              key={s.value}
              onPress={() => setSortBy(s.value)}
              style={[styles.sortChip, sortBy === s.value && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.sortText, { color: sortBy === s.value ? colors.primary : colors.textMuted }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Category sub-filter ────────────────────────────── */}
        {filter === 'category' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filters}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  { backgroundColor: selectedCategory === cat.id ? cat.color : colors.surface2, borderColor: selectedCategory === cat.id ? cat.color : colors.border },
                ]}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CategoryIcon category={cat.id} size={13} />
                  <Text style={{ fontSize: 13, color: selectedCategory === cat.id ? '#FFF' : colors.text }}>{cat.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── List ───────────────────────────────────────────── */}
        <FlatList
          testID="subscription-list"
          data={subs}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchSubs()} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          windowSize={5}
          getItemLayout={(_data, index) => ({ length: 88, offset: 88 * index, index })}
          renderItem={({ item }) => (
            <SubscriptionCard subscription={item} onSwipeDelete={() => handleDelete(item.id, item.name)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={searchQuery ? 'search' : 'albums-outline'} size={36} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                {searchQuery ? t('subscriptions.no_results', 'No results') : t('subscriptions.empty')}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                {searchQuery ? t('subscriptions.try_different', 'Try a different search') : t('subscriptions.empty_hint')}
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 10 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.3 },
  headerBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  upgradeBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  // Summary
  summaryStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1 },
  summaryValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Search
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderWidth: 1, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  // Filters
  filtersScroll: { flexShrink: 0, marginBottom: 4 },
  filters: { paddingHorizontal: 20, gap: 8, paddingVertical: 4, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },

  // Sort
  sortScroll: { flexShrink: 0, marginBottom: 4 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 4, marginBottom: 4 },
  sortText: { fontSize: 12, fontWeight: '700' },

  // Category
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },

  // List
  list: { padding: 20, paddingTop: 4, paddingBottom: 100 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 18, fontWeight: '700' },
  emptyHint: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
});
