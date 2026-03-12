import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSubscriptionsStore, FilterType } from '../../src/stores/subscriptionsStore';
import { subscriptionsApi } from '../../src/api/subscriptions';
import { SubscriptionCard } from '../../src/components/SubscriptionCard';
import { COLORS, CATEGORIES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { usePlanLimits } from '../../src/hooks/usePlanLimits';

export default function SubscriptionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { subsLimitReached } = usePlanLimits();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubs = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await subscriptionsApi.getAll();
      setSubscriptions(res.data || []);
    } catch {}
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { fetchSubs(); }, []);

  const FILTERS: { label: string; value: FilterType }[] = [
    { label: t('common.all'), value: 'all' },
    { label: t('subscriptions.active'), value: 'ACTIVE' },
    { label: t('subscriptions.trial'), value: 'TRIAL' },
    { label: t('subscriptions.cancelled'), value: 'CANCELLED' },
    { label: t('add.category'), value: 'category' },
  ];
  const {
    searchQuery,
    filter,
    setFilter,
    setSearchQuery,
    getFiltered,
    removeSubscription,
    updateSubscription,
    selectedCategory,
    setSelectedCategory,
    setSubscriptions,
  } = useSubscriptionsStore();

  const subs = getFiltered();

  const handleDelete = (id: string, name: string) => {
    Alert.alert(t('subscriptions.delete_title'), `${name}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try {
          await subscriptionsApi.delete(id);
          removeSubscription(id);
        } catch { removeSubscription(id); }
      }},
    ]);
  };

  const handleCancel = (id: string, name: string) => {
    Alert.alert(t('subscriptions.cancel_title'), `${name}?`, [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.yes'), onPress: async () => {
        try {
          await subscriptionsApi.cancel(id);
          updateSubscription(id, { status: 'CANCELLED' });
        } catch { updateSubscription(id, { status: 'CANCELLED' }); }
      }},
    ]);
  };

  const handleAdd = () => {
    if (subsLimitReached) {
      router.push('/paywall');
    }
    // If not limit reached, FAB in _layout.tsx handles adding
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('subscriptions.title')}</Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>{subs.length} {t('subscriptions.total')}</Text>
        {subsLimitReached && (
          <TouchableOpacity onPress={handleAdd} style={[styles.upgradeChip, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <Text style={[styles.upgradeChipText, { color: colors.primary }]}>⭐ Upgrade</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          {...{placeholder: t('subscriptions.search')}}
          placeholderTextColor={colors.textMuted}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={[styles.clearIcon, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface2, borderColor: colors.border },
              filter === f.value && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === f.value && styles.filterTextActive,
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category sub-filter */}
      {filter === 'category' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filters}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catChip,
                { backgroundColor: colors.surface2, borderColor: colors.border },
                selectedCategory === cat.id && { backgroundColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              <Text style={{ color: selectedCategory === cat.id ? '#FFF' : colors.text }}>{cat.emoji} {cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List */}
      <FlatList
        data={subs}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchSubs} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <SubscriptionCard
            subscription={item}
            onSwipeDelete={() => handleDelete(item.id, item.name)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('subscriptions.empty')}</Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t('subscriptions.empty_hint')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  count: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  clearIcon: { fontSize: 14, color: COLORS.textMuted, padding: 4 },
  filtersScroll: { maxHeight: 48 },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: '#FFF' },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  list: { padding: 20, paddingTop: 8, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  emptyHint: { fontSize: 14, color: COLORS.textSecondary },
  upgradeChip: {
    marginLeft: 'auto',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  upgradeChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
