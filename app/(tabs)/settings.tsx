import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { cardsApi } from '../../src/api/cards';
import { usePaymentCardsStore } from '../../src/stores/paymentCardsStore';
import { PaymentCard } from '../../src/types';
import { CURRENCIES, CARD_BRANDS, LANGUAGES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { Ionicons } from '@expo/vector-icons';
import { useBillingStatus, useCheckout, useStartTrial } from '../../src/hooks/useBilling';
import { useTranslation } from 'react-i18next';
import { notificationsApi } from '../../src/api/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { currency, setCurrency, language, setLanguage, reminderDays, setReminderDays, notificationsEnabled, setNotificationsEnabled } = useSettingsStore();
  const { isDark, toggleTheme, colors } = useTheme();
  const { cards, addCard, removeCard } = usePaymentCardsStore();

  const { data: billing } = useBillingStatus();
  const checkoutMutation = useCheckout();
  const startTrialMutation = useStartTrial();

  const [showAddCard, setShowAddCard] = useState(false);
  const [cardForm, setCardForm] = useState({ nickname: '', last4: '', brand: 'VISA' as PaymentCard['brand'], color: '#6C47FF' });

  const isPro = billing?.plan === 'pro' || billing?.plan === 'organization';
  const isTrialing = billing?.status === 'trialing';
  const canTrial = billing && !billing.trialUsed && !isPro;

  const handleStartTrial = async () => {
    try {
      await startTrialMutation.mutateAsync();
      Alert.alert(t('settings.trial_started'), t('settings.trial_started_desc'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('settings.failed_trial');
      Alert.alert(t('common.error'), msg);
    }
  };

  const handleUpgrade = () => { checkoutMutation.mutate('pro-monthly'); };

  const handleAddCard = async () => {
    if (!cardForm.nickname || cardForm.last4.length !== 4) {
      Alert.alert(t('common.error'), t('settings.invalid_card'));
      return;
    }
    try {
      const res = await cardsApi.create(cardForm);
      addCard(res.data);
    } catch { addCard({ id: Date.now().toString(), isDefault: false, ...cardForm }); }
    setCardForm({ nickname: '', last4: '', brand: 'VISA', color: '#6C47FF' });
    setShowAddCard(false);
  };

  const syncNotifications = (enabled: boolean, days: number[]) => {
    notificationsApi.updateSettings({ enabled, daysBefore: days[0] ?? 3 }).catch(() => {});
  };

  const toggleReminderDay = (day: number) => {
    const newDays = reminderDays.includes(day)
      ? reminderDays.filter((d) => d !== day)
      : [...reminderDays, day].sort();
    setReminderDays(newDays);
    syncNotifications(notificationsEnabled, newDays);
  };

  const handleNotificationsToggle = (val: boolean) => {
    setNotificationsEnabled(val);
    syncNotifications(val, reminderDays);
  };

  // Dynamic styles based on current theme
  const card = { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginHorizontal: 20, borderWidth: 1, borderColor: colors.border };
  const sectionLabel = { fontSize: 12, fontWeight: '700' as const, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 16 };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{t('settings.title')}</Text>
        </View>

        {/* Profile */}
        <Text style={sectionLabel}>{t('settings.profile')}</Text>
        <View style={[card, { gap: 0, padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22, color: '#FFF', fontWeight: '800' }}>{user?.name?.[0] || 'U'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user?.name || 'User'}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>{user?.email || ''}</Text>
            </View>
            <TouchableOpacity
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.primaryLight }}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>{t('common.edit')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Currency */}
        <Text style={sectionLabel}>{t('settings.default_currency')}</Text>
        <View style={[card, { padding: 12 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CURRENCIES.map((cur) => (
                <TouchableOpacity
                  key={cur}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: currency === cur ? colors.primary : colors.surface2, borderWidth: 1, borderColor: currency === cur ? colors.primary : colors.border }}
                  onPress={() => setCurrency(cur)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: currency === cur ? '#FFF' : colors.text }}>{cur}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Language */}
        <Text style={sectionLabel}>{t('settings.language')}</Text>
        <View style={[card, { gap: 8 }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: language === lang.code ? colors.primaryLight : colors.surface2, borderWidth: 1.5, borderColor: language === lang.code ? colors.primary : colors.border }}
                onPress={() => setLanguage(lang.code)}
              >
                <Text style={{ fontSize: 16 }}>{lang.flag}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: language === lang.code ? colors.primary : colors.textSecondary }}>{lang.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Theme */}
        <Text style={sectionLabel}>{t('settings.theme')}</Text>
        <View style={[card, { padding: 0 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                {isDark ? t('settings.dark_mode') : t('settings.light_mode')}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Notifications */}
        <Text style={sectionLabel}>{t('settings.notifications')}</Text>
        <View style={[card, { gap: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, color: colors.text, fontWeight: '500' }}>{t('settings.push_notifications')}</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>{t('settings.remind_before')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 3, 7].map((day) => (
              <TouchableOpacity
                key={day}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: reminderDays.includes(day) ? colors.primary : colors.surface2, borderWidth: 1, borderColor: reminderDays.includes(day) ? colors.primary : colors.border }}
                onPress={() => toggleReminderDay(day)}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: reminderDays.includes(day) ? '#FFF' : colors.text }}>
                  {t('settings.days_before', { count: day })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Cards */}
        <Text style={sectionLabel}>{t('settings.payment_cards')}</Text>
        <View style={[card, { gap: 10 }]}>
          {cards.map((card_item) => (
            <View key={card_item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: card_item.color }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{card_item.nickname}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>••••{card_item.last4} · {card_item.brand}</Text>
              </View>
              <TouchableOpacity onPress={() => Alert.alert(t('common.delete'), t('settings.remove_card', { name: card_item.nickname }), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: async () => {
                  try { await cardsApi.delete(card_item.id); } catch {}
                  removeCard(card_item.id);
                }},
              ])}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={{ paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center' }}
            onPress={() => setShowAddCard(true)}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{t('settings.add_payment_card')}</Text>
          </TouchableOpacity>
        </View>

        {/* Reports */}
        <Text style={sectionLabel}>{t('settings.reports')}</Text>
        <View style={[card, { padding: 0 }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            onPress={() => router.push('/reports' as any)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={{ fontSize: 15, color: colors.text }}>{t('settings.generate_report')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Plan Card */}
        <View style={{ marginHorizontal: 20, backgroundColor: colors.primary, borderRadius: 20, padding: 20, gap: 8, marginBottom: 8, marginTop: 16, shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
          {isPro ? (
            <>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>
                {isTrialing ? `⏳ ${t('settings.pro_trial')}` : `✨ ${t('settings.subradar_pro')}`}
              </Text>
              {isTrialing && billing?.trialDaysLeft != null && (
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{t('settings.days_remaining', { count: billing.trialDaysLeft })}</Text>
              )}
              {billing && (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
                    {t('settings.ai_usage', { used: billing.aiRequestsUsed, limit: billing.aiRequestsLimit ?? '∞' })}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>✨ {t('settings.subradar_pro')}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 }}>{t('settings.pro_features')}</Text>
              {billing && (
                <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 10, gap: 4 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
                    {t('settings.sub_usage', { used: billing.subscriptionCount, limit: billing.subscriptionLimit ?? '∞' })}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>
                    {t('settings.ai_usage', { used: billing.aiRequestsUsed, limit: billing.aiRequestsLimit ?? '∞' })}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={{ backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
                onPress={canTrial ? handleStartTrial : handleUpgrade}
                disabled={startTrialMutation.isPending || checkoutMutation.isPending}
              >
                {startTrialMutation.isPending || checkoutMutation.isPending ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>
                    {canTrial ? t('settings.start_trial') : t('settings.upgrade')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Account */}
        <Text style={sectionLabel}>{t('settings.account')}</Text>
        <View style={[card, { padding: 0, gap: 0 }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            onPress={() => Alert.alert(t('settings.export_data'), t('settings.data_exported'))}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="share-outline" size={18} color={colors.primary} />
              <Text style={{ fontSize: 15, color: colors.text }}>{t('settings.export_data')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
            onPress={() => Alert.alert(t('settings.logout'), t('common.are_you_sure'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('settings.logout'), style: 'destructive', onPress: () => { logout(); router.replace('/onboarding'); } },
            ])}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={{ fontSize: 15, color: colors.error, fontWeight: '600' }}>{t('settings.logout')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', fontSize: 12, color: colors.textMuted, paddingVertical: 24 }}>{t('settings.version')}</Text>
      </ScrollView>

      {/* Add Card Modal */}
      <Modal visible={showAddCard} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, paddingBottom: 40 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{t('settings.add_card_title')}</Text>

            <TextInput
              style={{ backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              value={cardForm.nickname}
              onChangeText={(v) => setCardForm((f) => ({ ...f, nickname: v }))}
              placeholder={t('settings.card_nickname_placeholder')}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={{ backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              value={cardForm.last4}
              onChangeText={(v) => setCardForm((f) => ({ ...f, last4: v.slice(0, 4) }))}
              placeholder={t('settings.card_last4_placeholder')}
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>{t('settings.card_brand')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CARD_BRANDS.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: cardForm.brand === brand ? colors.primary : colors.surface2, borderWidth: 1, borderColor: cardForm.brand === brand ? colors.primary : colors.border }}
                  onPress={() => setCardForm((f) => ({ ...f, brand: brand as PaymentCard['brand'] }))}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: cardForm.brand === brand ? '#FFF' : colors.textSecondary }}>{brand}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowAddCard(false)}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                onPress={handleAddCard}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Keep StyleSheet for non-themed utilities
const styles = StyleSheet.create({
  container: { flex: 1 },
});
