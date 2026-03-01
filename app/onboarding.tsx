import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { COLORS, CURRENCIES } from '../src/constants';

const { width } = Dimensions.get('window');

const FEATURES = [
  { emoji: '🎙', title: 'Voice Add', desc: 'Say "Add Netflix $15 monthly" and done' },
  { emoji: '📸', title: 'Screenshot AI', desc: 'Snap your invoice and AI extracts the details' },
  { emoji: '🔔', title: 'Smart Reminders', desc: 'Get reminded before renewals' },
  { emoji: '📊', title: 'Tax Reports', desc: 'Generate expense reports in one tap' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');

  const router = useRouter();
  const { setUser, setOnboarded } = useAuthStore();
  const { setCurrency } = useSettingsStore();

  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);

  React.useEffect(() => {
    logoScale.value = withSpring(1, { damping: 8 });
    logoOpacity.value = withTiming(1, { duration: 600 });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const handleEmailLogin = () => {
    if (!email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    Alert.alert('Magic Link Sent', `Check your inbox at ${email}`, [
      {
        text: 'Demo Login',
        onPress: () => completeAuth(),
      },
    ]);
  };

  const completeAuth = () => {
    setCurrency(selectedCurrency);
    setUser(
      { id: '1', name: 'Timur', email: email || 'demo@subradar.ai' },
      'demo-token'
    );
    setOnboarded();
    router.replace('/(tabs)');
  };

  const steps = [
    // Step 0: Welcome
    <View key="welcome" style={styles.step}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.logo}>
          <Text style={styles.logoEmoji}>📡</Text>
        </View>
        <Text style={styles.logoTitle}>SubRadar</Text>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </Animated.View>
      <Text style={styles.headline}>Track all your subscriptions{'\n'}with AI</Text>
      <Text style={styles.subheadline}>
        SubRadar automatically tracks, reminds, and analyzes all your recurring payments in one place.
      </Text>
    </View>,

    // Step 1: Features
    <View key="features" style={styles.step}>
      <Text style={styles.sectionTitle}>Everything you need</Text>
      {FEATURES.map((f) => (
        <View key={f.title} style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        </View>
      ))}
    </View>,

    // Step 2: Currency
    <View key="currency" style={styles.step}>
      <Text style={styles.sectionTitle}>Your region & currency</Text>
      <Text style={styles.subheadline}>Choose your default currency for tracking</Text>
      <View style={styles.currencyGrid}>
        {CURRENCIES.map((cur) => (
          <TouchableOpacity
            key={cur}
            style={[
              styles.currencyChip,
              selectedCurrency === cur && styles.currencyChipActive,
            ]}
            onPress={() => setSelectedCurrency(cur)}
          >
            <Text style={[styles.currencyText, selectedCurrency === cur && styles.currencyTextActive]}>
              {cur}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 3: Auth
    <View key="auth" style={styles.step}>
      <Text style={styles.sectionTitle}>Get started</Text>

      <TouchableOpacity style={styles.socialBtn} onPress={completeAuth}>
        <Text style={styles.socialIcon}>🍎</Text>
        <Text style={styles.socialText}>Continue with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.socialBtn, styles.googleBtn]} onPress={completeAuth}>
        <Text style={styles.socialIcon}>G</Text>
        <Text style={styles.socialText}>Continue with Google</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.emailInput}
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        placeholderTextColor={COLORS.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.emailBtn} onPress={handleEmailLogin}>
        <Text style={styles.emailBtnText}>Send Magic Link ✨</Text>
      </TouchableOpacity>

      <Text style={styles.terms}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </Text>
    </View>,
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>{steps[step]}</View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, step === i && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.footerBtns}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < steps.length - 1 && (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(step + 1)}>
              <Text style={styles.nextBtnText}>
                {step === 0 ? 'Get Started →' : 'Next →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  step: { gap: 16 },
  logoContainer: { alignItems: 'center', gap: 8, marginBottom: 24 },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 48 },
  logoTitle: { fontSize: 36, fontWeight: '900', color: COLORS.text, letterSpacing: -1 },
  aiBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  headline: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subheadline: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  sectionTitle: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: { fontSize: 24 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  featureDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currencyChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  currencyChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  currencyText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  currencyTextActive: { color: COLORS.primary },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 16,
  },
  googleBtn: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  socialIcon: { fontSize: 20, color: '#FFF' },
  socialText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textSecondary },
  emailInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emailBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emailBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  terms: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16 },
  footer: { padding: 24, paddingBottom: 40, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { width: 20, backgroundColor: COLORS.primary },
  footerBtns: { flexDirection: 'row', gap: 10 },
  backBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  nextBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
