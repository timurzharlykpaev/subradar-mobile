import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { usePaymentCardsStore, PaymentCard } from '../../src/stores/paymentCardsStore';
import { COLORS, CURRENCIES, CARD_BRANDS } from '../../src/constants';
import { useBillingStatus, useCheckout, useStartTrial } from '../../src/hooks/useBilling';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { currency, setCurrency, reminderDays, setReminderDays, notificationsEnabled, setNotificationsEnabled } = useSettingsStore();
  const { cards, addCard, removeCard } = usePaymentCardsStore();

  const { data: billing } = useBillingStatus();
  const checkoutMutation = useCheckout();
  const startTrialMutation = useStartTrial();

  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState({ nickname: '', last4: '', brand: 'Visa' as PaymentCard['brand'], color: '#6C47FF' });

  const isPro = billing?.plan === 'pro' || billing?.plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro;

  const handleStartTrial = async () => {
    try {
      await startTrialMutation.mutateAsync();
      Alert.alert('Trial Started!', '7 days of Pro access begins now. Enjoy all features.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start trial.';
      Alert.alert('Error', msg);
    }
  };

  const handleUpgrade = () => {
    checkoutMutation.mutate('pro-monthly');
  };

  const handleAddCard = () => {
    if (!cardForm.nickname || cardForm.last4.length !== 4) {
      Alert.alert('Invalid', 'Enter nickname and 4-digit last digits');
      return;
    }
    addCard({
      id: Date.now().toString(),
      ...cardForm,
    });
    setCardForm({ nickname: '', last4: '', brand: 'Visa', color: '#6C47FF' });
    setShowAddCard(false);
  };

  const toggleReminderDay = (day: number) => {
    if (reminderDays.includes(day)) {
      setReminderDays(reminderDays.filter((d) => d !== day));
    } else {
      setReminderDays([...reminderDays, day].sort());
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile */}
        <Section title="Profile">
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0] || 'U'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* Currency */}
        <Section title="Default Currency">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {CURRENCIES.map((cur) => (
                <TouchableOpacity
                  key={cur}
                  style={[styles.chip, currency === cur && styles.chipActive]}
                  onPress={() => setCurrency(cur)}
                >
                  <Text style={[styles.chipText, currency === cur && styles.chipTextActive]}>{cur}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <SettingRow
            label="Push Notifications"
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
              />
            }
          />
          <Text style={styles.sectionSubtitle}>Remind me before renewal</Text>
          <View style={styles.chips}>
            {[1, 3, 7].map((day) => (
              <TouchableOpacity
                key={day}
                style={[styles.chip, reminderDays.includes(day) && styles.chipActive]}
                onPress={() => toggleReminderDay(day)}
              >
                <Text style={[styles.chipText, reminderDays.includes(day) && styles.chipTextActive]}>
                  {day}d before
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Payment Cards */}
        <Section title="Payment Cards">
          {cards.map((card) => (
            <View key={card.id} style={styles.cardRow}>
              <View style={[styles.cardDot, { backgroundColor: card.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardNickname}>{card.nickname}</Text>
                <Text style={styles.cardInfo}>••••{card.last4} · {card.brand}</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Delete', `Remove ${card.nickname}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => removeCard(card.id) },
                ])}
              >
                <Text style={styles.deleteBtn}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addCardBtn} onPress={() => setShowAddCard(true)}>
            <Text style={styles.addCardBtnText}>+ Add Payment Card</Text>
          </TouchableOpacity>
        </Section>

        {/* Reports */}
        <Section title="Reports">
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/reports' as any)}>
            <Text style={styles.menuItemText}>📄 Generate Report</Text>
            <Text style={styles.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </Section>

        {/* Plan Card */}
        <View style={styles.proCard}>
          {isPro ? (
            <>
              <Text style={styles.proTitle}>
                {isTrialing ? '⏳ Pro Trial' : '✨ SubRadar Pro'}
              </Text>
              {isTrialing && billing?.trialDaysLeft !== null && (
                <Text style={styles.proDesc}>{billing?.trialDaysLeft} days remaining in trial</Text>
              )}
              {billing && (
                <View style={styles.usageRow}>
                  <Text style={styles.usageText}>
                    AI: {billing.aiRequestsUsed}/{billing.aiRequestsLimit ?? '∞'} this month
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.proTitle}>✨ SubRadar Pro</Text>
              <Text style={styles.proDesc}>
                Unlimited subscriptions · 200 AI/month · Analytics
              </Text>
              {billing && (
                <View style={styles.usageRow}>
                  <Text style={styles.usageText}>
                    Subscriptions: {billing.subscriptionCount}/{billing.subscriptionLimit ?? '∞'}
                  </Text>
                  <Text style={styles.usageText}>
                    AI: {billing.aiRequestsUsed}/{billing.aiRequestsLimit ?? '∞'} this month
                  </Text>
                </View>
              )}
              {canTrial ? (
                <TouchableOpacity
                  style={styles.proBtn}
                  onPress={handleStartTrial}
                  disabled={startTrialMutation.isPending}
                >
                  {startTrialMutation.isPending ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Text style={styles.proBtnText}>Start 7-day Free Trial</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.proBtn}
                  onPress={handleUpgrade}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <Text style={styles.proBtnText}>Upgrade — $2.99/mo</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Danger zone */}
        <Section title="Account">
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Export', 'Data exported (demo)')}
          >
            <Text style={styles.menuItemText}>📤 Export Data</Text>
            <Text style={styles.menuItemChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: COLORS.border }]}
            onPress={() => Alert.alert('Logout', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: logout },
            ])}
          >
            <Text style={[styles.menuItemText, { color: COLORS.error }]}>🚪 Sign Out</Text>
            <Text style={styles.menuItemChevron}>›</Text>
          </TouchableOpacity>
        </Section>

        <Text style={styles.version}>SubRadar AI v1.0.0</Text>
      </ScrollView>

      {/* Add Card Modal */}
      <Modal visible={showAddCard} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Payment Card</Text>

            <TextInput
              style={styles.input}
              value={cardForm.nickname}
              onChangeText={(v) => setCardForm((f) => ({ ...f, nickname: v }))}
              placeholder="Nickname (e.g. My Visa)"
              placeholderTextColor={COLORS.textMuted}
            />
            <TextInput
              style={styles.input}
              value={cardForm.last4}
              onChangeText={(v) => setCardForm((f) => ({ ...f, last4: v.slice(0, 4) }))}
              placeholder="Last 4 digits"
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.label}>Brand</Text>
            <View style={styles.chips}>
              {CARD_BRANDS.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={[styles.chip, cardForm.brand === brand && styles.chipActive]}
                  onPress={() => setCardForm((f) => ({ ...f, brand: brand as PaymentCard['brand'] }))}
                >
                  <Text style={[styles.chipText, cardForm.brand === brand && styles.chipTextActive]}>
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddCard(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddCard}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.content}>{children}</View>
    </View>
  );
}

function SettingRow({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.rowLabel}>{label}</Text>
      {right}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 8 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 16,
  },
  content: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, color: '#FFF', fontWeight: '800' },
  profileName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: 13, color: COLORS.textSecondary },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
  },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#FFF' },
  sectionSubtitle: { fontSize: 13, color: COLORS.textSecondary },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardDot: { width: 12, height: 12, borderRadius: 6 },
  cardNickname: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardInfo: { fontSize: 12, color: COLORS.textSecondary },
  deleteBtn: { fontSize: 18, padding: 4 },
  addCardBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
  },
  addCardBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  menuItemText: { fontSize: 15, color: COLORS.text },
  menuItemChevron: { fontSize: 20, color: COLORS.textMuted },
  proCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    gap: 8,
    marginBottom: 8,
    marginTop: 8,
  },
  proTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  proDesc: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  usageRow: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  usageText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  proBtn: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  proBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    paddingVertical: 24,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
