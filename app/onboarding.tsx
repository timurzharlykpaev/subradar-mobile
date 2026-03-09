import React, { useState, useRef, useEffect } from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { authApi } from '../src/api/auth';
import { COLORS, CURRENCIES, LANGUAGES } from '../src/constants';

WebBrowser.maybeCompleteAuthSession();

// Web client ID (for proxy/web fallback)
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '140914936328-chm3nq215c14dlj25i9pghhsuc3pif9i.apps.googleusercontent.com';
// iOS client ID — create at console.cloud.google.com → iOS app → bundle: io.subradar.mobile
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;

const FEATURES = [
  { emoji: '🎙', key: 'voice' },
  { emoji: '📸', key: 'screenshot' },
  { emoji: '🔔', key: 'reminders' },
  { emoji: '📊', key: 'reports' },
];

function AppleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 384 512">
      <Path
        fill="#ffffff"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { setUser, setOnboarded } = useAuthStore();
  const { setLanguage, language, setCurrency } = useSettingsStore();

  // Google OAuth
  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const accessToken = googleResponse.authentication?.accessToken;
      if (accessToken) handleGoogleToken(accessToken);
    } else if (googleResponse?.type === 'error') {
      Alert.alert(
        'Google Sign-In Error',
        'Please set up iOS Client ID in Google Cloud Console (bundle: io.subradar.mobile). Use email sign-in for now.',
      );
    }
  }, [googleResponse]);

  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, damping: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const logoStyle = { transform: [{ scale: logoScale }], opacity: logoOpacity };

  const finishAuth = (user: any, token: string) => {
    setCurrency(selectedCurrency);
    setUser(user, token);
    setOnboarded();
    router.replace('/(tabs)');
  };

  const handleGoogleToken = async (accessToken: string) => {
    setLoading(true);
    try {
      const res = await authApi.loginWithGoogleMobile(accessToken);
      const { user, accessToken: jwt, refreshToken } = res.data;
      if (refreshToken) {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }
      finishAuth(user, jwt);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const res = await authApi.loginWithApple(credential.identityToken!);
      const { user, accessToken: jwt, refreshToken } = res.data;
      if (refreshToken) {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }
      finishAuth(user, jwt);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', e?.response?.data?.message || 'Apple login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.includes('@')) {
      Alert.alert('', t('onboarding.invalid_email'));
      return;
    }
    setLoading(true);
    try {
      await authApi.sendMagicLink(email);
      setMagicSent(true);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send link');
    } finally {
      setLoading(false);
    }
  };

  // Feature Showcase animations
  const showcaseOpacity = useRef(new Animated.Value(0)).current;
  const showcaseTranslateY = useRef(new Animated.Value(30)).current;
  const card1Scale = useRef(new Animated.Value(0.85)).current;
  const card2Scale = useRef(new Animated.Value(0.85)).current;
  const card3Scale = useRef(new Animated.Value(0.85)).current;
  const card4Scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (step === 0) {
      Animated.parallel([
        Animated.timing(showcaseOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(showcaseTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.sequence([
          Animated.spring(card1Scale, { toValue: 1, damping: 10, delay: 100, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(150),
          Animated.spring(card2Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(250),
          Animated.spring(card3Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(350),
          Animated.spring(card4Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [step]);

  const SHOWCASE_FEATURES = [
    { emoji: '🤖', title: 'AI автодобавление', desc: 'Просто скажи название — AI найдёт цену, иконку и ссылку', scale: card1Scale },
    { emoji: '🔔', title: 'Умные уведомления', desc: 'Письмо и push за 3 дня до списания', scale: card2Scale },
    { emoji: '📊', title: 'Аналитика Pro', desc: 'Прогноз расходов, дубликаты, экономия', scale: card3Scale },
    { emoji: '👥', title: 'Командный план', desc: 'Управляй подписками вместе с командой', scale: card4Scale },
  ];

  const steps = [
    // Step 0: Feature Showcase
    <Animated.View
      key="showcase"
      style={[styles.step, { opacity: showcaseOpacity, transform: [{ translateY: showcaseTranslateY }] }]}
    >
      <View style={styles.logoContainer}>
        <Image source={require('../assets/images/icon.png')} style={styles.logoImage} />
        <Text style={styles.logoTitle}>SubRadar</Text>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
      </View>
      <Text style={styles.showcaseTitle}>Всё что нужно для контроля подписок</Text>
      <View style={styles.showcaseGrid}>
        {SHOWCASE_FEATURES.map((f) => (
          <Animated.View
            key={f.title}
            style={[styles.showcaseCard, { transform: [{ scale: f.scale }] }]}
          >
            <Text style={styles.showcaseEmoji}>{f.emoji}</Text>
            <Text style={styles.showcaseCardTitle}>{f.title}</Text>
            <Text style={styles.showcaseCardDesc}>{f.desc}</Text>
          </Animated.View>
        ))}
      </View>
      <TouchableOpacity style={styles.showcaseBtn} onPress={() => setStep(1)}>
        <Text style={styles.showcaseBtnText}>Начать — это бесплатно →</Text>
      </TouchableOpacity>
    </Animated.View>,

    // Step 1: Language (was Step 0)
    <View key="language" style={styles.step}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image source={require('../assets/images/icon.png')} style={styles.logoImage} />
        <Text style={styles.logoTitle}>SubRadar</Text>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
      </Animated.View>
      <Text style={styles.sectionTitle}>{t('onboarding.choose_language')}</Text>
      <View style={styles.langGrid}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langChip, language === lang.code && styles.langChipActive]}
            onPress={() => handleLanguageSelect(lang.code)}
          >
            <Text style={styles.langFlag}>{lang.flag}</Text>
            <Text style={[styles.langLabel, language === lang.code && styles.langLabelActive]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 2: Welcome
    <View key="welcome" style={styles.step}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image source={require('../assets/images/icon.png')} style={styles.logoImageLarge} />
        <Text style={styles.logoTitle}>SubRadar</Text>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
      </Animated.View>
      <Text style={styles.headline}>{t('landing.hero_title')}</Text>
      <Text style={styles.subheadline}>{t('landing.hero_sub')}</Text>
    </View>,

    // Step 3: Features
    <View key="features" style={styles.step}>
      <Text style={styles.sectionTitle}>{t('landing.features')}</Text>
      {FEATURES.map((f) => (
        <View key={f.key} style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t(`features.${f.key}_title`)}</Text>
            <Text style={styles.featureDesc}>{t(`features.${f.key}_desc`)}</Text>
          </View>
        </View>
      ))}
    </View>,

    // Step 4: Currency
    <View key="currency" style={styles.step}>
      <Text style={styles.sectionTitle}>{t('settings.currency')}</Text>
      <Text style={styles.subheadline}>{t('onboarding.choose_currency')}</Text>
      <View style={styles.currencyGrid}>
        {CURRENCIES.map((cur) => (
          <TouchableOpacity
            key={cur}
            style={[styles.currencyChip, selectedCurrency === cur && styles.currencyChipActive]}
            onPress={() => setSelectedCurrency(cur)}
          >
            <Text style={[styles.currencyText, selectedCurrency === cur && styles.currencyTextActive]}>
              {cur}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 5: Auth
    <View key="auth" style={styles.step}>
      <Text style={styles.sectionTitle}>{t('auth.welcome')}</Text>
      <Text style={styles.subheadline}>{t('auth.sign_in')}</Text>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.socialBtn} onPress={handleAppleLogin} disabled={loading}>
          <AppleIcon />
          <Text style={styles.socialText}>{t('onboarding.continue_apple')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.socialBtn, styles.googleBtn]}
        onPress={() => googlePromptAsync()}
        disabled={loading}
      >
        <GoogleIcon />
        <Text style={[styles.socialText, { color: COLORS.text }]}>{t('onboarding.continue_google')}</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('common.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {magicSent ? (
        <View style={styles.magicSentBox}>
          <Text style={styles.magicSentEmoji}>✉️</Text>
          <Text style={styles.magicSentTitle}>{t('auth.sent')}</Text>
          <Text style={styles.magicSentSub}>{t('auth.sent_sub')} {email}</Text>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.emailInput}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email_placeholder')}
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.emailBtn} onPress={handleMagicLink} disabled={loading}>
            <Text style={styles.emailBtnText}>{t('auth.send_link')} ✨</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.terms}>{t('onboarding.terms')}</Text>
    </View>,
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>{steps[step]}</View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
          ))}
        </View>

        {step > 0 && (
          <View style={styles.footerBtns}>
            {step > 1 && (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
                <Text style={styles.backBtnText}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}
            {step < steps.length - 1 && (
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
                <Text style={styles.nextBtnText}>
                  {step === 2 ? t('onboarding.get_started') : t('onboarding.next')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  step: { gap: 16 },
  logoContainer: { alignItems: 'center', gap: 8, marginBottom: 16 },
  logoImage: { width: 80, height: 80, borderRadius: 20 },
  logoImageLarge: { width: 110, height: 110, borderRadius: 28 },
  logoTitle: { fontSize: 34, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  aiBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  aiBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  headline: { fontSize: 30, fontWeight: '900', color: COLORS.text, textAlign: 'center', lineHeight: 38, letterSpacing: -0.5 },
  subheadline: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  sectionTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  langChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border },
  langChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  langFlag: { fontSize: 18 },
  langLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  langLabelActive: { color: COLORS.primary },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surface, borderRadius: 16, padding: 14 },
  featureIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  featureEmoji: { fontSize: 24 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  featureDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currencyChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border },
  currencyChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  currencyText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  currencyTextActive: { color: COLORS.primary },
  loadingOverlay: { alignItems: 'center', paddingVertical: 8 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#000', borderRadius: 14, paddingVertical: 16 },
  googleBtn: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  socialText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textSecondary },
  emailInput: { backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  emailBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  emailBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  magicSentBox: { alignItems: 'center', gap: 8, padding: 20, backgroundColor: COLORS.surface, borderRadius: 16 },
  magicSentEmoji: { fontSize: 40 },
  magicSentTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  magicSentSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  terms: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16 },
  footer: { padding: 24, paddingBottom: 40, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { width: 20, backgroundColor: COLORS.primary },
  footerBtns: { flexDirection: 'row', gap: 10 },
  backBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  backBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  nextBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.primary },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  showcaseTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center', lineHeight: 26, letterSpacing: -0.3, marginBottom: 4 },
  showcaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  showcaseCard: { width: '47%', backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', padding: 14, gap: 6 },
  showcaseEmoji: { fontSize: 28 },
  showcaseCardTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  showcaseCardDesc: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 15 },
  showcaseBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  showcaseBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
