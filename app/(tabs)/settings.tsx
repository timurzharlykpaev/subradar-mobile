import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { usePaymentCardsStore } from '../../src/stores/paymentCardsStore';
import { CURRENCIES, LANGUAGES } from '../../src/constants';
import { useTheme } from '../../src/theme';
import { Ionicons } from '@expo/vector-icons';
import { useBillingStatus, useStartTrial } from '../../src/hooks/useBilling';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
let RevenueCatUI: any = null;
try { RevenueCatUI = require('react-native-purchases-ui').default; } catch {}
import { useRevenueCat } from '../../src/hooks/useRevenueCat';
import { notificationsApi } from '../../src/api/notifications';
import { billingApi } from '../../src/api/billing';
import { exportSubscriptionsCsv } from '../../src/services/csvExport';
import ExpirationBanner from '../../src/components/ExpirationBanner';
import CancellationInterceptModal from '../../src/components/CancellationInterceptModal';

const DATE_FORMATS = ['DD/MM', 'MM/DD', 'YYYY-MM-DD'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();
  const { currency, setCurrency, language, setLanguage, reminderDays, setReminderDays, notificationsEnabled, setNotificationsEnabled, dateFormat, setDateFormat } = useSettingsStore();
  const { isDark, toggleTheme, colors } = useTheme();

  const { data: billing } = useBillingStatus();

  const startTrialMutation = useStartTrial();
  const { restorePurchases } = useRevenueCat();

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const version = Constants.expoConfig?.version || '1.0.0';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['billing'] });
    setRefreshing(false);
  }, [queryClient]);

  // Fetch notification settings on mount
  useEffect(() => {
    notificationsApi.getSettings().then((res: any) => {
      const data = res.data ?? res;
      setEmailNotifications(data.emailNotifications ?? true);
      setWeeklyDigest(data.weeklyDigestEnabled ?? true);
    }).catch(() => {});
  }, []);

  const isCancelled = billing?.status === 'cancelled' || (billing?.status === 'trialing' && billing?.cancelAtPeriodEnd);
  const isPro = (billing?.plan === 'pro' || billing?.plan === 'organization') && !isCancelled;
  const isTeam = billing?.plan === 'organization' && !isCancelled;
  const isTrialing = billing?.status === 'trialing' && !billing?.cancelAtPeriodEnd;
  const canTrial = billing && !billing.trialUsed && !isPro && !isTrialing;

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

  const syncNotifications = (enabled: boolean, days: number) => {
    notificationsApi.updateSettings({ enabled, daysBefore: days || 3 }).catch(() => {});
  };

  const handleReminderSelect = (day: number) => {
    const newVal = reminderDays === day ? 0 : day;
    setReminderDays(newVal);
    syncNotifications(notificationsEnabled, newVal);
  };

  const handleNotificationsToggle = (val: boolean) => {
    setNotificationsEnabled(val);
    syncNotifications(val, reminderDays);
  };

  const handleExport = async () => {
    const subs = useSubscriptionsStore.getState().subscriptions;
    try {
      await exportSubscriptionsCsv(subs);
    } catch {
      Alert.alert(t('common.error', 'Error'), t('settings.export_failed', 'Failed to export'));
    }
  };

  const handleReplayOnboarding = () => {
    Alert.alert(
      t('settings.reset_onboarding', 'Replay Onboarding'),
      t('settings.replay_onboarding_desc', 'Onboarding will replay next time you open the app.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.ok', 'OK'),
          onPress: async () => {
            await AsyncStorage.removeItem('subradar:add-onboarding-seen');
            const state = useAuthStore.getState();
            if ('isOnboarded' in state) {
              // Reset onboarding flag without logging out
              useAuthStore.setState({ isOnboarded: false } as any);
            }
            Alert.alert('', t('settings.onboarding_reset', 'Onboarding will show on next app open'));
          },
        },
      ],
    );
  };

  const handleDeleteAccount = async () => {
    try {
      const { authApi } = await import('../../src/api/auth');
      await authApi.deleteAccount();
    } catch (e) {
      console.warn('Delete account failed:', e);
    }
    logout();
    router.replace('/onboarding' as any);
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Dynamic styles
  const card = { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginHorizontal: 20, borderWidth: 1, borderColor: colors.border };

  // Section Header component
  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12, paddingHorizontal: 24 }}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{title}</Text>
    </View>
  );

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

  // Plan badge text
  const planBadgeText = isTeam ? 'TEAM' : isPro ? 'PRO' : 'FREE';
  const planBadgeColor = isPro ? colors.primary : '#64748B';
  const statusText = isTrialing ? t('settings.pro_trial') : billing?.status === 'active' ? t('settings.active', 'Active') : '';

  return (
    <SafeAreaView testID="settings-screen" edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
      <ScrollView
        testID="settings-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{t('settings.title')}</Text>
        </View>

        {/* ═══ 1. Profile Card ═══ */}
        <View style={[card, { padding: 16, marginTop: 12, overflow: 'hidden' }]}>
          <View style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, opacity: 0.06 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
              <Text style={{ fontSize: 22, color: '#FFF', fontWeight: '800' }}>{user?.name?.[0] || 'U'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{user?.name || 'User'}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 1 }}>{user?.email || ''}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: planBadgeColor + '20' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: planBadgeColor }}>{planBadgeText}</Text>
                </View>
                {statusText ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{statusText}</Text> : null}
              </View>
              {billing && (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
                  {billing.subscriptionCount} {t('settings.subs_count', 'subs')} · {billing.aiRequestsUsed}/{billing.aiRequestsLimit ?? '∞'} {t('settings.ai_used', 'AI used')}
                </Text>
              )}
            </View>
            <TouchableOpacity
              testID="btn-edit-profile"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary + '30', alignItems: 'center', justifyContent: 'center' }}
              onPress={() => router.push('/edit-profile' as any)}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ 2. Plan & Billing ═══ */}
        <SectionHeader icon="card-outline" title={t('settings.plan_billing', 'Plan & Billing')} />
        <View style={[card, { padding: 0 }]}>
          {/* Plan Details */}
          {renderSettingRow(
            'diamond-outline',
            isPro ? colors.primary : '#64748B',
            t('settings.plan_details', 'Plan Details'),
            isPro
              ? (isTrialing && billing?.trialDaysLeft != null
                ? t('settings.days_remaining', { count: billing.trialDaysLeft })
                : isTeam ? t('settings.subradar_team', 'SubRadar Team') : t('settings.subradar_pro'))
              : t('settings.subradar_free'),
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => router.push('/subscription-plan' as any),
            true,
          )}
          {/* Upgrade / Start Trial (only for free users) */}
          {!isPro && (
            <>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}
                onPress={canTrial ? handleStartTrial : handleUpgrade}
                disabled={startTrialMutation.isPending}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  {startTrialMutation.isPending
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Ionicons name="sparkles-outline" size={18} color="#FFF" />
                  }
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.primary }}>
                  {canTrial ? t('settings.start_trial') : t('settings.upgrade')}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64, marginRight: 16 }} />
            </>
          )}
          {/* Manage Subscription */}
          {renderSettingRow(
            'settings-outline',
            '#8B5CF6',
            t('settings.manage_subscription', 'Manage Subscription'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            async () => {
              if (isPro) {
                setShowCancelModal(true);
              } else {
                try {
                  await RevenueCatUI.presentCustomerCenter();
                } catch {
                  Alert.alert(t('settings.manage_sub_web', 'Visit the web app to manage your subscription.'));
                }
              }
            },
            true,
          )}
          {/* Restore Purchases */}
          {renderSettingRow(
            'refresh-outline',
            '#3B82F6',
            t('settings.restore_purchases', 'Restore Purchases'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            async () => {
              const { success, customerInfo: info } = await restorePurchases();
              if (success) {
                try {
                  const activeEntitlement = info?.entitlements?.active;
                  const productId = activeEntitlement?.['team']?.productIdentifier
                    || activeEntitlement?.['pro']?.productIdentifier;
                  if (productId) await billingApi.syncRevenueCat(productId);
                } catch (e) {
                  console.warn('RC restore sync failed:', e);
                }
                Alert.alert(t('paywall.restored', 'Restored!'), t('paywall.restored_msg', 'Your subscription has been restored.'));
              } else {
                Alert.alert(t('settings.no_purchases', 'No active subscriptions found to restore.'));
              }
            },
            true,
          )}
          {/* Payment Cards */}
          {renderSettingRow(
            'wallet-outline',
            colors.success,
            t('settings.payment_cards'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => router.push('/cards' as any),
            false,
          )}
        </View>

        {/* Expiration Banner */}
        {billing?.cancelAtPeriodEnd && billing?.currentPeriodEnd && (
          <ExpirationBanner currentPeriodEnd={billing.currentPeriodEnd} variant="full" />
        )}

        {/* ═══ 3. Preferences ═══ */}
        <SectionHeader icon="settings-outline" title={t('settings.preferences')} />
        <View style={[card, { padding: 0 }]}>
          {/* Currency */}
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
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 }} />

          {/* Language */}
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
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 16 }} />

          {/* Theme */}
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
            true,
          )}

          {/* Timezone */}
          {renderSettingRow(
            'globe-outline',
            '#0EA5E9',
            t('settings.timezone', 'Timezone'),
            timezone,
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />,
            undefined,
            true,
          )}

          {/* Date Format */}
          {renderSettingRow(
            'calendar-outline',
            '#F59E0B',
            t('settings.date_format', 'Date Format'),
            undefined,
            null,
            undefined,
            false,
          )}
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DATE_FORMATS.map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: dateFormat === fmt ? colors.primary : colors.surface2, borderWidth: 1, borderColor: dateFormat === fmt ? colors.primary : colors.border }}
                  onPress={() => setDateFormat(fmt)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: dateFormat === fmt ? '#FFF' : colors.text }}>{fmt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ 4. Notifications ═══ */}
        <SectionHeader icon="notifications-outline" title={t('settings.notifications')} />
        <View style={[card, { padding: 0 }]}>
          {/* Push Notifications */}
          {renderSettingRow(
            'notifications-outline',
            colors.warning,
            t('settings.push_notifications'),
            t('settings.push_desc', 'Upcoming charges, reminders'),
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

          {/* Email Notifications */}
          {renderSettingRow(
            'mail-outline',
            '#3B82F6',
            t('settings.email_notifications', 'Email Notifications'),
            t('settings.email_notifications_desc', 'Payment reminders by email'),
            <Switch
              value={emailNotifications}
              onValueChange={(val) => {
                setEmailNotifications(val);
                notificationsApi.updateSettings({ enabled: notificationsEnabled, daysBefore: reminderDays || 3 }).catch(() => {});
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />,
            undefined,
            true,
          )}

          {/* Weekly AI Digest */}
          {renderSettingRow(
            'sparkles-outline',
            '#8B5CF6',
            t('settings.weekly_digest', 'Weekly AI Digest'),
            t('settings.weekly_digest_desc', 'AI analysis summary every Monday'),
            isPro ? (
              <Switch
                value={weeklyDigest}
                onValueChange={(val) => {
                  setWeeklyDigest(val);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
            ),
            !isPro ? handleUpgrade : undefined,
            true,
          )}

          {/* Remind Before */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{t('settings.remind_before')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ day: 0, label: t('settings.off', 'Off') }, { day: 1, label: t('settings.days_before', { count: 1 }) }, { day: 3, label: t('settings.days_before', { count: 3 }) }, { day: 7, label: t('settings.days_before', { count: 7 }) }].map(({ day, label }) => (
                <TouchableOpacity
                  testID={`btn-reminder-${day}d`}
                  key={day}
                  style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: reminderDays === day ? colors.primary : colors.surface2, borderWidth: 1, borderColor: reminderDays === day ? colors.primary : colors.border }}
                  onPress={() => handleReminderSelect(day)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: reminderDays === day ? '#FFF' : colors.text }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ 5. Reports & Data ═══ */}
        <SectionHeader icon="document-text-outline" title={t('settings.reports', 'Reports & Data')} />
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
            'download-outline',
            colors.success,
            t('settings.export_data', 'Export Data (CSV)'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            handleExport,
            false,
          )}
        </View>

        {/* ═══ 6. Account ═══ */}
        <SectionHeader icon="person-circle-outline" title={t('settings.account')} />
        <View style={[card, { padding: 0 }]}>
          {/* Replay Onboarding */}
          {renderSettingRow(
            'refresh-outline',
            colors.warning,
            t('settings.reset_onboarding'),
            undefined,
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            handleReplayOnboarding,
            true,
          )}
          {/* Logout */}
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
            false,
          )}
        </View>

        {/* Delete Account */}
        <View style={{ marginHorizontal: 20, marginTop: 16 }}>
          {!showDeleteConfirm ? (
            <TouchableOpacity
              style={{ paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.error + '40', backgroundColor: colors.error + '08', alignItems: 'center' }}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.error }}>{t('settings.delete_account')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.error + '40', backgroundColor: colors.error + '08', padding: 16, gap: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.error, textAlign: 'center' }}>{t('settings.delete_account')}</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>{t('settings.delete_account_confirm')}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.error, alignItems: 'center' }}
                  onPress={handleDeleteAccount}
                >
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Version */}
        <Text style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted, paddingVertical: 28, letterSpacing: 0.3 }}>v{version} · Subradar</Text>
      </ScrollView>

      <CancellationInterceptModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirmCancel={async () => {
          setShowCancelModal(false);
          try {
            await RevenueCatUI.presentCustomerCenter();
          } catch {
            Alert.alert(t('settings.manage_sub_web', 'Visit the web app to manage your subscription.'));
          }
        }}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
