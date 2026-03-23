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
  KeyboardAvoidingView,
  Platform,
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
import { useBillingStatus, useStartTrial } from '../../src/hooks/useBilling';
import { useTranslation } from 'react-i18next';
let RevenueCatUI: any = null;
try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}
import { useRevenueCat } from '../../src/hooks/useRevenueCat';
import { HourglassIcon, SparklesIcon } from '../../src/components/icons';
import { notificationsApi } from '../../src/api/notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { currency, setCurrency, language, setLanguage, reminderDays, setReminderDays, notificationsEnabled, setNotificationsEnabled } = useSettingsStore();
  const { isDark, toggleTheme, colors } = useTheme();
  const { cards, addCard, removeCard } = usePaymentCardsStore();

  const { data: billing } = useBillingStatus();

  const startTrialMutation = useStartTrial();
  const { restorePurchases } = useRevenueCat();

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

  const handleUpgrade = () => {
    router.push('/paywall' as any);
  };

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
  const sectionLabel = { fontSize: 12, fontWeight: '700' as const, color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 20 };

  // Progress bar helper
  const renderProgressBar = (used: number, limit: number | string, label: string) => {
    const numLimit = typeof limit === 'string' ? 999 : limit;
    const progress = numLimit > 0 ? Math.min(used / numLimit, 1) : 0;
    return (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{label}</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.95)' }}>{used}/{limit}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: progress > 0.85 ? '#FF6B6B' : 'rgba(255,255,255,0.85)', width: `${progress * 100}%` }} />
        </View>
      </View>
    );
  };

  // Setting row helper
  const renderSettingRow = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    iconBg: string,
    label: string,
    description: string | undefined,
    right: React.ReactNode,
    onPress?: () => void,
    showDivider = true,
  ) => (
    <>
      <TouchableOpacity
        activeOpacity={onPress ? 0.6 : 1}
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{label}</Text>
          {description ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{description}</Text> : null}
        </View>
        {right}
      </TouchableOpacity>
      {showDivider && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64, marginRight: 16 }} />}
    </>
  );

  return (
    <SafeAreaView testID="settings-screen" edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <ScrollView testID="settings-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{t('settings.title')}</Text>
        </View>

        {/* Profile */}
        <Text style={sectionLabel}>{t('settings.profile')}</Text>
        <View style={[card, { padding: 16, overflow: 'hidden' }]}>
          {/* Subtle decorative circles */}
          <View style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, opacity: 0.06 }} />
          <View style={{ position: 'absolute', bottom: -30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, opacity: 0.04 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
              <Text style={{ fontSize: 24, color: '#FFF', fontWeight: '800' }}>{user?.name?.[0] || 'U'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{user?.name || 'User'}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{user?.email || ''}</Text>
            </View>
            <TouchableOpacity
              testID="btn-edit-profile"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30', alignItems: 'center', justifyContent: 'center' }}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan Card */}
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity
            testID="btn-plan-card"
            activeOpacity={0.9}
            onPress={() => router.push('/subscription-plan' as any)}
            style={{ marginHorizontal: 20, backgroundColor: colors.primary, borderRadius: 20, padding: 20, gap: 10, overflow: 'hidden', shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
          >
            {/* Decorative circles */}
            <View style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <View style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <View style={{ position: 'absolute', top: 20, right: 40, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' }} />

            {isPro ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isTrialing ? <HourglassIcon size={20} color="#FFF" /> : <SparklesIcon size={20} color="#FFF" />}
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>
                    {isTrialing ? t('settings.pro_trial') : t('settings.subradar_pro')}
                  </Text>
                </View>
                {isTrialing && billing?.trialDaysLeft != null && (
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{t('settings.days_remaining', { count: billing.trialDaysLeft })}</Text>
                )}
                {billing && (
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, gap: 10 }}>
                    {renderProgressBar(
                      billing.subscriptionCount,
                      billing.subscriptionLimit ?? '∞',
                      t('settings.sub_usage', { used: billing.subscriptionCount, limit: billing.subscriptionLimit ?? '∞' }),
                    )}
                    {renderProgressBar(
                      billing.aiRequestsUsed,
                      billing.aiRequestsLimit ?? '∞',
                      t('settings.ai_usage', { used: billing.aiRequestsUsed, limit: billing.aiRequestsLimit ?? '∞' }),
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <SparklesIcon size={20} color="#FFF" />
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>{t('settings.subradar_pro')}</Text>
                </View>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 }}>{t('settings.pro_features')}</Text>
                {billing && (
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 12, gap: 10 }}>
                    {renderProgressBar(
                      billing.subscriptionCount,
                      billing.subscriptionLimit ?? '∞',
                      t('settings.sub_usage', { used: billing.subscriptionCount, limit: billing.subscriptionLimit ?? '∞' }),
                    )}
                    {renderProgressBar(
                      billing.aiRequestsUsed,
                      billing.aiRequestsLimit ?? '∞',
                      t('settings.ai_usage', { used: billing.aiRequestsUsed, limit: billing.aiRequestsLimit ?? '∞' }),
                    )}
                  </View>
                )}
                <TouchableOpacity
                  style={{ backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
                  onPress={canTrial ? handleStartTrial : handleUpgrade}
                  disabled={startTrialMutation.isPending}
                >
                  {startTrialMutation.isPending ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>
                      {canTrial ? t('settings.start_trial') : t('settings.upgrade')}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
            {/* Tap hint */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('settings.manage_subscription')}</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Manage Subscription & Restore Purchases */}
        <View style={[card, { padding: 0, marginTop: 12 }]}>
          {/* Manage Subscription */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}
            onPress={async () => {
              try {
                await RevenueCatUI.presentCustomerCenter();
              } catch {
                Alert.alert(t('settings.manage_sub_web', 'Visit the web app to manage your subscription.'));
              }
            }}
          >
            <Ionicons name="card-outline" size={20} color={colors.text} />
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, marginLeft: 0 }}>
              {t('settings.manage_subscription', 'Manage Subscription')}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 48, marginRight: 16 }} />
          {/* Restore Purchases */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}
            onPress={async () => {
              const restored = await restorePurchases();
              if (restored) {
                Alert.alert(t('paywall.restored', 'Restored!'), t('paywall.restored_msg', 'Your subscription has been restored.'));
              } else {
                Alert.alert(t('settings.no_purchases', 'No active subscriptions found to restore.'));
              }
            }}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
            <Text style={{ flex: 1, fontSize: 15, color: colors.text, marginLeft: 0 }}>
              {t('settings.restore_purchases', 'Restore Purchases')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <Text style={sectionLabel}>{t('settings.default_currency')}</Text>
        <View style={[card, { padding: 0 }]}>
          {renderSettingRow(
            'cash-outline',
            colors.success,
            t('settings.default_currency'),
            undefined,
            null,
            undefined,
            false,
          )}
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CURRENCIES.map((cur) => (
                  <TouchableOpacity
                    testID={`btn-currency-${cur}`}
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
        </View>

        {/* Language */}
        <Text style={sectionLabel}>{t('settings.language')}</Text>
        <View style={[card, { padding: 0 }]}>
          {renderSettingRow(
            'language-outline',
            '#3B82F6',
            t('settings.language'),
            undefined,
            null,
            undefined,
            false,
          )}
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  testID={`btn-language-${lang.code}`}
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
        </View>

        {/* Appearance & Notifications */}
        <Text style={sectionLabel}>{t('settings.theme')}</Text>
        <View style={[card, { padding: 0 }]}>
          {renderSettingRow(
            isDark ? 'moon' : 'sunny-outline',
            '#8B5CF6',
            isDark ? t('settings.dark_mode') : t('settings.light_mode'),
            undefined,
            <Switch
              testID="btn-theme-toggle"
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />,
            undefined,
            false,
          )}
        </View>

        {/* Notifications */}
        <Text style={sectionLabel}>{t('settings.notifications')}</Text>
        <View style={[card, { padding: 0 }]}>
          {renderSettingRow(
            'notifications-outline',
            colors.warning,
            t('settings.push_notifications'),
            undefined,
            <Switch
              testID="btn-notifications-toggle"
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />,
            undefined,
            true,
          )}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{t('settings.remind_before')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 3, 7].map((day) => (
                <TouchableOpacity
                  testID={`btn-reminder-${day}d`}
                  key={day}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: reminderDays.includes(day) ? colors.primary : colors.surface2, borderWidth: 1, borderColor: reminderDays.includes(day) ? colors.primary : colors.border }}
                  onPress={() => toggleReminderDay(day)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: reminderDays.includes(day) ? '#FFF' : colors.text }}>
                    {t('settings.days_before', { count: day })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Payment Cards */}
        <Text style={sectionLabel}>{t('settings.payment_cards')}</Text>
        <View style={[card, { padding: 0 }]}>
          {cards.map((card_item, index) => (
            <React.Fragment key={card_item.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: card_item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: card_item.color }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{card_item.nickname}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                    ••••{card_item.last4} · {card_item.brand}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.error + '15', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => Alert.alert(t('common.delete'), t('settings.remove_card', { name: card_item.nickname }), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.delete'), style: 'destructive', onPress: async () => {
                      try { await cardsApi.delete(card_item.id); } catch {}
                      removeCard(card_item.id);
                    }},
                  ])}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                </TouchableOpacity>
              </View>
              {index < cards.length - 1 && (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64, marginRight: 16 }} />
              )}
            </React.Fragment>
          ))}
          {cards.length > 0 && (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 }} />
          )}
          <TouchableOpacity
            testID="btn-add-card"
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 }}
            onPress={() => setShowAddCard(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{t('settings.add_payment_card')}</Text>
          </TouchableOpacity>
        </View>

        {/* Reports & Data */}
        <Text style={sectionLabel}>{t('settings.reports')}</Text>
        <View style={[card, { padding: 0 }]}>
          {renderSettingRow(
            'document-text-outline',
            '#3B82F6',
            t('settings.generate_report'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => router.push('/reports' as any),
            true,
          )}
          {renderSettingRow(
            'share-outline',
            colors.success,
            t('settings.export_data'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => Alert.alert(t('settings.export_data'), t('settings.data_exported')),
            false,
          )}
        </View>

        {/* Account */}
        <Text style={sectionLabel}>{t('settings.account')}</Text>
        <View style={[card, { padding: 0, backgroundColor: colors.error + '08', borderColor: colors.error + '20' }]}>
          {renderSettingRow(
            'log-out-outline',
            colors.error,
            t('settings.logout'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => Alert.alert(t('settings.logout'), t('common.are_you_sure'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('settings.logout'), style: 'destructive', onPress: () => { logout(); router.replace('/onboarding'); } },
            ]),
            true,
          )}
          {renderSettingRow(
            'refresh-outline',
            colors.warning,
            t('settings.reset_onboarding'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => Alert.alert(t('settings.reset_onboarding'), t('settings.reset_onboarding_confirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('settings.reset_onboarding'), style: 'destructive', onPress: () => {
                logout();
                router.replace('/onboarding' as any);
              }},
            ]),
            true,
          )}
          {renderSettingRow(
            'trash-outline',
            colors.error,
            t('settings.delete_account'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => Alert.alert(t('settings.delete_account'), t('settings.delete_account_confirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('settings.delete_account'), style: 'destructive', onPress: async () => {
                try {
                  const { authApi } = await import('../../src/api/auth');
                  await authApi.deleteAccount();
                } catch (e) {
                  console.warn('Delete account failed:', e);
                }
                // Always logout even if API call fails
                logout();
                router.replace('/onboarding' as any);
              }},
            ]),
            false,
          )}
        </View>

        {/* Version */}
        <Text style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted, paddingVertical: 28, letterSpacing: 0.3 }}>{t('settings.version')}</Text>
      </ScrollView>

      {/* Add Card Modal */}
      <Modal visible={showAddCard} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, paddingBottom: 40 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{t('settings.add_card_title')}</Text>

            <TextInput
              testID="input-card-nickname"
              style={{ backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              value={cardForm.nickname}
              onChangeText={(v) => setCardForm((f) => ({ ...f, nickname: v }))}
              placeholder={t('settings.card_nickname_placeholder')}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              testID="input-card-last4"
              style={{ backgroundColor: colors.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border }}
              value={cardForm.last4}
              onChangeText={(v) => setCardForm((f) => ({ ...f, last4: v.slice(0, 4) }))}
              placeholder={t('settings.card_last4_placeholder')}
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{t('settings.card_brand')}</Text>
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                testID="btn-cancel-add-card"
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                onPress={() => setShowAddCard(false)}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="btn-save-card"
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                onPress={handleAddCard}
              >
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Keep StyleSheet for non-themed utilities
const styles = StyleSheet.create({
  container: { flex: 1 },
});
