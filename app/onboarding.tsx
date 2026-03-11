import React, { useState, useRef, useEffect } from 'react';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  Dimensions,
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
import { useTheme } from '../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

// Web client ID
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '140914936328-chm3nq215c14dlj25i9pghhsuc3pif9i.apps.googleusercontent.com';
// iOS client ID (bundle: io.subradar.mobile)
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '140914936328-hftqahkh20bdie089g2mfdcnuuker4cm.apps.googleusercontent.com';

// ─── Feature SVG Icons ───────────────────────────────────────────────────────
function IconVoice() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" fill="#8B5CF6" />
      <Path d="M5 10a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V19h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 10Z" fill="#8B5CF6" />
    </Svg>
  );
}

function IconCamera() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3H15L17 5H21C21.55 5 22 5.45 22 6V18C22 18.55 21.55 19 21 19H3C2.45 19 2 18.55 2 18V6C2 5.45 2.45 5 3 5H7L9 3Z" fill="#8B5CF6" opacity="0.2" />
      <Path d="M9 3H15L17 5H21C21.55 5 22 5.45 22 6V18C22 18.55 21.55 19 21 19H3C2.45 19 2 18.55 2 18V6C2 5.45 2.45 5 3 5H7L9 3Z" stroke="#8B5CF6" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <Path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8Z" fill="#8B5CF6" />
      <Path d="M19 8H18" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function IconBell() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2C8.13 2 5 5.13 5 9V13L3 15V16H21V15L19 13V9C19 5.13 15.87 2 12 2Z" fill="#8B5CF6" opacity="0.2" />
      <Path d="M12 2C8.13 2 5 5.13 5 9V13L3 15V16H21V15L19 13V9C19 5.13 15.87 2 12 2Z" stroke="#8B5CF6" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <Path d="M10 16C10 17.1 10.9 18 12 18C13.1 18 14 17.1 14 16" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M12 2V1" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function IconChart() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20H20" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M4 14H7V20H4V14Z" fill="#8B5CF6" opacity="0.4" />
      <Path d="M4 14H7V20H4V14Z" stroke="#8B5CF6" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <Path d="M10 9H13V20H10V9Z" fill="#8B5CF6" opacity="0.65" />
      <Path d="M10 9H13V20H10V9Z" stroke="#8B5CF6" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <Path d="M16 4H19V20H16V4Z" fill="#8B5CF6" />
      <Path d="M16 4H19V20H16V4Z" stroke="#8B5CF6" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const FEATURES = [
  { icon: IconVoice, key: 'voice' },
  { icon: IconCamera, key: 'screenshot' },
  { icon: IconBell, key: 'reminders' },
  { icon: IconChart, key: 'reports' },
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

// ─── Service SVG Icons ──────────────────────────────────────────────────────
// Simple guaranteed-to-render brand icons
function NetflixIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M4 2h3.5l5.5 14.5V2H16v16h-3.5L7 3.5V18H4V2z" fill="white" />
    </Svg>
  );
}
function SpotifyIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M16 7.5C12.5 5.8 7.5 5.5 4 6.8l-.5-1.8C8 3.2 13.5 3.5 17.5 5.5L16 7.5z" fill="white" />
      <Path d="M15.5 11C12.5 9.5 8 9.2 5 10.2l-.4-1.6c3.5-1.1 8.5-.8 12 1L15.5 11z" fill="white" />
      <Path d="M14.5 14.5C12 13.2 8.5 13 6 13.8l-.3-1.4c3-1 7-.8 10 .8l-1.2 1.3z" fill="white" />
    </Svg>
  );
}
function ICloudIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M15.5 8.1A5 5 0 0010 4a5 5 0 00-4.8 3.6A4 4 0 005 15h10a4 4 0 00.5-6.9z" fill="white" />
    </Svg>
  );
}
function YoutubeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Rect x="1" y="4" width="18" height="12" rx="3" fill="white" opacity="0.9" />
      <Path d="M8 7.5l5 2.5-5 2.5V7.5z" fill="#FF0000" />
    </Svg>
  );
}
function OpenAIIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5" fill="none" />
      <Path d="M10 3l1.8 5.5H17l-4.5 3.3 1.7 5.2L10 14l-4.2 3 1.7-5.2L3 8.5h5.2L10 3z" fill="white" opacity="0.9" />
    </Svg>
  );
}

const FLOAT_CARDS = [
  { name: 'Netflix',  amount: '$15.99', bg: '#FFEAEA', iconBg: '#E50914', IconComponent: NetflixIcon,  x: -120, delay: 0,   duration: 3200, yPos: 10  },
  { name: 'Spotify',  amount: '$9.99',  bg: '#EAFAF1', iconBg: '#1DB954', IconComponent: SpotifyIcon,  x: 70,   delay: 400,  duration: 2900, yPos: 50  },
  { name: 'iCloud',   amount: '$2.99',  bg: '#EAF2FF', iconBg: '#0071E3', IconComponent: ICloudIcon,   x: -85,  delay: 700,  duration: 3500, yPos: 95  },
  { name: 'YouTube',  amount: '$13.99', bg: '#FFEAEA', iconBg: '#FF0000', IconComponent: YoutubeIcon,  x: 100,  delay: 200,  duration: 3000, yPos: 130 },
  { name: 'ChatGPT',  amount: '$20.00', bg: '#EAF7F4', iconBg: '#10A37F', IconComponent: OpenAIIcon,   x: -130, delay: 550,  duration: 3300, yPos: 165 },
];

function FloatingCard({ name, amount, bg, iconBg, IconComponent, x, delay, duration, yPos, topOffset = 0 }: {
  name: string; amount: string; bg: string; iconBg: string; IconComponent: React.FC;
  x: number; delay: number; duration: number; yPos: number; topOffset?: number;
}) {
  const entryY = useRef(new Animated.Value(30)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  // Linear 0→1 progress mapped to sine — no jump at loop boundary
  const progress = useRef(new Animated.Value(0)).current;

  const floatY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -8, 0, 8, 0],
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0, duration: 650, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1, duration: 650, delay,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ]).start(() => {
      // Perfect loop: 0→1, outputRange[0]===outputRange[4] → no jump ever
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1, duration,
          easing: Easing.linear, useNativeDriver: true,
        })
      ).start();
    });
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      top: yPos + topOffset,
      transform: [{ translateX: x }, { translateY: Animated.add(entryY, floatY) }],
      opacity: entryOpacity,
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: bg,
        borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8,
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 }, elevation: 6,
      }}>
        <View style={{
          width: 30, height: 30, borderRadius: 9,
          backgroundColor: iconBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <IconComponent />
        </View>
        <View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1a1a2e', letterSpacing: -0.2 }}>{name}</Text>
          <Text style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{amount}/mo</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AuthHero() {
  const insets = useSafeAreaInsets();
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.4)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    // Logo entry
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    // Ring 1 pulse
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1Scale, { toValue: 1.5, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ring1Opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Ring 2 pulse (offset)
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ring2Scale, { toValue: 1.5, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(ring2Scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(ring2Opacity, { toValue: 0.25, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, 1000);
  }, []);

  return (
    <View style={{ width: '100%', height: 260 + insets.top, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' }}>
      {/* Glow blob */}
      <View style={{
        position: 'absolute', width: 180, height: 180, borderRadius: 90,
        backgroundColor: 'rgba(139,92,246,0.12)',
      }} />
      {/* Pulse rings */}
      <Animated.View style={{
        position: 'absolute', width: 120, height: 120, borderRadius: 60,
        borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.6)',
        transform: [{ scale: ring1Scale }], opacity: ring1Opacity,
      }} />
      <Animated.View style={{
        position: 'absolute', width: 120, height: 120, borderRadius: 60,
        borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.6)',
        transform: [{ scale: ring2Scale }], opacity: ring2Opacity,
      }} />
      {/* Floating cards — behind logo */}
      {FLOAT_CARDS.map((card) => (
        <FloatingCard key={card.name} {...card} topOffset={insets.top} />
      ))}

      {/* Logo — SubRadar SVG brand mark — on top of cards */}
      <Animated.View style={{
        width: 72, height: 72, borderRadius: 18,
        shadowColor: '#8B5CF6', shadowOpacity: 0.45, shadowRadius: 20,
        shadowOffset: { width: 0, height: 4 }, elevation: 14,
        transform: [{ scale: logoScale }], opacity: logoOpacity,
        zIndex: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#6C3BDB',
      }}>
        <Svg width={44} height={44} viewBox="0 0 56 56" fill="none">
          <Circle cx="28" cy="28" r="22" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <Circle cx="28" cy="28" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <Circle cx="28" cy="28" r="6" fill="white" opacity="0.9" />
          <Path d="M28 28 L46 20" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          <Path d="M28 18v20M23 22.5c0-2.5 2-4 5-4s5 1.5 5 3.5-2 3-5 3.5-5 2-5 4 2 4 5 4 5-1.5 5-4" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─── Showcase card icons ────────────────────────────────────────────────────
function ShowcaseAIIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Rect width="36" height="36" rx="10" fill="#EDE9FF" />
      <Path d="M18 8C14.13 8 11 11.13 11 15v2l-2 2v1h18v-1l-2-2v-2c0-3.87-3.13-7-7-7z" fill="#8B5CF6" opacity="0.9"/>
      <Circle cx="18" cy="26" r="2" fill="#8B5CF6" />
      <Path d="M23 12.5c1.38.9 2.3 2.46 2.3 4.25" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <Circle cx="14" cy="15" r="1.5" fill="white" />
      <Circle cx="18" cy="13.5" r="1.5" fill="white" />
      <Circle cx="22" cy="15" r="1.5" fill="white" />
      <Path d="M14 15l4-1.5 4 1.5" stroke="white" strokeWidth="1" opacity="0.6"/>
    </Svg>
  );
}

function ShowcaseBellIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Rect width="36" height="36" rx="10" fill="#FEF3C7" />
      <Path d="M18 8a7 7 0 00-7 7v4l-2 2v1h18v-1l-2-2v-4a7 7 0 00-7-7z" fill="#F59E0B" opacity="0.85"/>
      <Path d="M15.5 22c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <Circle cx="24" cy="11" r="4" fill="#EF4444" />
      <Path d="M22.5 11h3M24 9.5v3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </Svg>
  );
}

function ShowcaseChartIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Rect width="36" height="36" rx="10" fill="#ECFDF5" />
      <Rect x="9" y="19" width="5" height="9" rx="2" fill="#10B981" opacity="0.5"/>
      <Rect x="15.5" y="14" width="5" height="14" rx="2" fill="#10B981" opacity="0.75"/>
      <Rect x="22" y="9" width="5" height="19" rx="2" fill="#10B981"/>
      <Path d="M9 26h18" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <Path d="M10 19l6-7 6 4 5-6" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
      <Circle cx="22" cy="12" r="2" fill="white" />
    </Svg>
  );
}

function ShowcaseTeamIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 36 36" fill="none">
      <Rect width="36" height="36" rx="10" fill="#EFF6FF" />
      <Circle cx="14" cy="14" r="4" fill="#3B82F6" opacity="0.7"/>
      <Circle cx="22" cy="14" r="4" fill="#3B82F6" opacity="0.9"/>
      <Path d="M6 26c0-3.31 3.58-6 8-6" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
      <Path d="M30 26c0-3.31-3.58-6-8-6" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" opacity="0.8"/>
      <Path d="M18 21c-2.76 0-5 1.57-5 3.5h10c0-1.93-2.24-3.5-5-3.5z" fill="#3B82F6" opacity="0.5"/>
    </Svg>
  );
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const otpInputRefs = useRef<Array<TextInput | null>>([]);

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { setUser, setOnboarded } = useAuthStore();
  const { setLanguage, language, setCurrency } = useSettingsStore();
  const { colors, isDark, toggleTheme } = useTheme();
  const safeInsets = useSafeAreaInsets();

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
        t('auth.google_signin_error'),
        t('auth.google_setup_hint'),
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

  const navigateToApp = () => {
    router.replace('/(tabs)');
  };

  const finishAuth = (user: any, token: string) => {
    setCurrency(selectedCurrency);
    setUser(user, token);
    setOnboarded();
    // Go to "add first subscription" step (step 6)
    setStep(6);
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
      Alert.alert(t('auth.error_title'), e?.response?.data?.message || t('auth.google_login_failed'));
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
        Alert.alert(t('auth.error_title'), e?.response?.data?.message || t('auth.apple_login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // OTP countdown timer
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOtp = async () => {
    if (!email.includes('@')) {
      Alert.alert('', t('onboarding.invalid_email'));
      return;
    }
    setLoading(true);
    try {
      await authApi.sendOtp(email);
      setOtpSent(true);
      setOtpTimer(60);
      setOtpCode('');
    } catch (e: any) {
      Alert.alert(t('auth.error_title'), e?.response?.data?.message || t('auth.failed_send_code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otpCode);
      const { user, accessToken: jwt, refreshToken } = res.data;
      if (refreshToken) {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('refresh_token', refreshToken);
      }
      finishAuth(user, jwt);
    } catch (e: any) {
      Alert.alert(t('auth.error_title'), e?.response?.data?.message || t('auth.invalid_code'));
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '');
    const newCode = otpCode.split('');
    newCode[index] = digit;
    const joined = newCode.join('').slice(0, 6);
    setOtpCode(joined);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
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
      Alert.alert(t('auth.error_title'), e?.response?.data?.message || t('auth.failed_send_link'));
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
    { Icon: ShowcaseAIIcon,    title: t('onboarding.showcase_ai_title'),        desc: t('onboarding.showcase_ai_desc'),        scale: card1Scale },
    { Icon: ShowcaseBellIcon,  title: t('onboarding.showcase_notify_title'),    desc: t('onboarding.showcase_notify_desc'),    scale: card2Scale },
    { Icon: ShowcaseChartIcon, title: t('onboarding.showcase_analytics_title'), desc: t('onboarding.showcase_analytics_desc'), scale: card3Scale },
    { Icon: ShowcaseTeamIcon,  title: t('onboarding.showcase_team_title'),      desc: t('onboarding.showcase_team_desc'),      scale: card4Scale },
  ];

  const steps = [
    // Step 0: Feature Showcase
    <Animated.View
      key="showcase"
      style={[styles.step, { opacity: showcaseOpacity, transform: [{ translateY: showcaseTranslateY }] }]}
    >
      <View style={styles.logoContainer}>
        <Image source={require('../assets/images/icon.png')} style={styles.logoImage} />
        <Text style={[styles.logoTitle, { color: colors.text }]}>SubRadar</Text>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
      </View>
      <Text style={[styles.showcaseTitle, { color: colors.text }]}>{t('onboarding.showcase_title')}</Text>
      <View style={styles.showcaseGrid}>
        {SHOWCASE_FEATURES.map((f) => (
          <Animated.View
            key={f.title}
            style={[styles.showcaseCard, {
              transform: [{ scale: f.scale }],
              backgroundColor: colors.card,
              borderColor: colors.border,
            }]}
          >
            <f.Icon />
            <Text style={[styles.showcaseCardTitle, { color: colors.text }]}>{f.title}</Text>
            <Text style={[styles.showcaseCardDesc, { color: colors.textSecondary }]}>{f.desc}</Text>
          </Animated.View>
        ))}
      </View>
      <TouchableOpacity style={styles.showcaseBtn} onPress={() => setStep(1)}>
        <Text style={styles.showcaseBtnText}>{t('onboarding.showcase_start')}</Text>
      </TouchableOpacity>
    </Animated.View>,

    // Step 1: Language (was Step 0)
    <View key="language" style={styles.step}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image source={require('../assets/images/icon.png')} style={styles.logoImage} />
        <Text style={[styles.logoTitle, { color: colors.text }]}>SubRadar</Text>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
      </Animated.View>
      <Text style={styles.sectionTitle}>{t('onboarding.choose_language')}</Text>
      <View style={styles.langGrid}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.langChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              language === lang.code && { backgroundColor: colors.primary + '22', borderColor: colors.primary },
            ]}
            onPress={() => handleLanguageSelect(lang.code)}
          >
            <Text style={styles.langFlag}>{lang.flag}</Text>
            <Text style={[styles.langLabel, { color: colors.text }, language === lang.code && { color: colors.primary, fontWeight: '700' }]}>
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
        <Text style={[styles.logoTitle, { color: colors.text }]}>SubRadar</Text>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
      </Animated.View>
      <Text style={[styles.headline, { color: colors.text }]}>{t('landing.hero_title')}</Text>
      <Text style={[styles.subheadline, { color: colors.textSecondary }]}>{t('landing.hero_sub')}</Text>
    </View>,

    // Step 3: Features
    <View key="features" style={styles.step}>
      <Text style={styles.sectionTitle}>{t('landing.features')}</Text>
      {FEATURES.map((f) => (
        <View key={f.key} style={[styles.featureRow, { backgroundColor: colors.surface }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.primary + '18' }]}>
            <f.icon />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>{t(`features.${f.key}_title`)}</Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{t(`features.${f.key}_desc`)}</Text>
          </View>
        </View>
      ))}
    </View>,

    // Step 4: Currency
    <View key="currency" style={styles.step}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Svg width={140} height={140} viewBox="0 0 140 140">
          {/* Background circle */}
          <Circle cx="70" cy="70" r="70" fill="rgba(139,92,246,0.1)" />
          <Circle cx="70" cy="70" r="52" fill="rgba(139,92,246,0.15)" />
          {/* Center coin */}
          <Circle cx="70" cy="70" r="34" fill="#8B5CF6" />
          <Circle cx="70" cy="70" r="28" fill="#7C3AED" />
          {/* Dollar sign */}
          <SvgText x="70" y="78" textAnchor="middle" fontSize="30" fontWeight="bold" fill="#FFFFFF">$</SvgText>
          {/* Orbiting coins */}
          <Circle cx="70" cy="18" r="14" fill="#8B5CF6" opacity="0.9" />
          <SvgText x="70" y="23" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#FFF">€</SvgText>
          <Circle cx="122" cy="70" r="12" fill="#8B5CF6" opacity="0.75" />
          <SvgText x="122" y="75" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#FFF">£</SvgText>
          <Circle cx="18" cy="70" r="12" fill="#8B5CF6" opacity="0.75" />
          <SvgText x="18" y="75" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#FFF">¥</SvgText>
          <Circle cx="70" cy="122" r="11" fill="#8B5CF6" opacity="0.6" />
          <SvgText x="70" y="127" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#FFF">₸</SvgText>
        </Svg>
      </View>
      <Text style={styles.sectionTitle}>{t('settings.currency')}</Text>
      <Text style={[styles.subheadline, { color: colors.textSecondary }]}>{t('onboarding.choose_currency')}</Text>
      <View style={styles.currencyGrid}>
        {CURRENCIES.map((cur) => (
          <TouchableOpacity
            key={cur}
            style={[styles.currencyChip, { backgroundColor: colors.surface, borderColor: colors.border }, selectedCurrency === cur && { backgroundColor: colors.primary + "22", borderColor: colors.primary }]}
            onPress={() => setSelectedCurrency(cur)}
          >
            <Text style={[styles.currencyText, { color: colors.text }, selectedCurrency === cur && { color: colors.primary, fontWeight: '800' }]}>
              {cur}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>,

    // Step 5: Auth
    <View key="auth" style={[styles.step, { justifyContent: 'flex-end', paddingBottom: 8 }]}>
      {/* Theme toggle top-right — use insets to stay below status bar */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={{ position: 'absolute', top: (safeInsets.top || 0) + 8, right: 16, zIndex: 100, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 18 }}>{isDark ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>
      <AuthHero />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {!otpMode ? (
        <>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 28, letterSpacing: -0.5 }}>
            SubRadar
          </Text>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtn} onPress={handleAppleLogin} disabled={loading}>
              <AppleIcon />
              <Text style={styles.socialText}>{t('onboarding.continue_apple')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.socialBtn, styles.googleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => googlePromptAsync()}
            disabled={loading}
          >
            <GoogleIcon />
            <Text style={[styles.socialText, { color: colors.text }]}>{t('onboarding.continue_google')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialBtn, styles.emailOtpBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setOtpMode(true)}
            disabled={loading}
          >
            <Text style={styles.emailOtpIcon}>✉️</Text>
            <Text style={[styles.socialText, { color: colors.text }]}>{t('auth.continue_email')}</Text>
          </TouchableOpacity>
        </>
      ) : otpSent ? (
        <View style={styles.otpContainer}>
          <Text style={styles.otpSubtitle}>{t('auth.enter_code')}</Text>
          <Text style={styles.otpEmail}>{email}</Text>

          <View style={styles.otpInputRow}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => { otpInputRefs.current[index] = ref; }}
                testID={`otp-input-${index}`}
                style={[styles.otpDigitInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, otpCode[index] ? styles.otpDigitFilled : null]}
                value={otpCode[index] || ''}
                onChangeText={(text) => {
                  // Support paste of full 6-digit code
                  if (text.length === 6 && /^\d{6}$/.test(text)) {
                    setOtpCode(text);
                    otpInputRefs.current[5]?.focus();
                    return;
                  }
                  handleOtpDigitChange(text, index);
                }}
                onKeyPress={(e) => handleOtpKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.emailBtn, otpCode.length < 6 && styles.emailBtnDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otpCode.length < 6}
          >
            <Text style={styles.emailBtnText}>{t('auth.verify')}</Text>
          </TouchableOpacity>

          {otpTimer > 0 ? (
            <Text style={styles.otpTimerText}>
              {t('auth.resend_in', { seconds: otpTimer })}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
              <Text style={styles.otpResendText}>{t('auth.resend_code')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => { setOtpMode(false); setOtpSent(false); setOtpCode(''); }}>
            <Text style={styles.otpBackText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.otpContainer}>
          <TextInput
            style={[styles.emailInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email_placeholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.emailBtn} onPress={handleSendOtp} disabled={loading}>
            <Text style={styles.emailBtnText}>{t('auth.send_code')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setOtpMode(false)}>
            <Text style={styles.otpBackText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.terms}>
        {t('onboarding.terms_prefix')}{' '}
        <Text
          style={[styles.terms, { color: colors.primary, textDecorationLine: 'underline' }]}
          onPress={() => WebBrowser.openBrowserAsync('https://subradar.ai/legal/terms')}
        >
          {t('onboarding.terms_link')}
        </Text>
        {' '}{t('onboarding.terms_and')}{' '}
        <Text
          style={[styles.terms, { color: colors.primary, textDecorationLine: 'underline' }]}
          onPress={() => WebBrowser.openBrowserAsync('https://subradar.ai/legal/privacy')}
        >
          {t('onboarding.privacy_link')}
        </Text>
      </Text>
    </View>,

    // Step 6: Add first subscription
    <View key="first_sub" style={[styles.step, { alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 24 }]}>
      {/* Icon */}
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Ionicons name="add-circle" size={52} color={colors.primary} />
      </View>
      <Text style={[styles.headline, { textAlign: 'center', color: colors.text }]}>{t('onboarding.first_sub_title')}</Text>
      <Text style={[styles.subheadline, { textAlign: 'center', marginBottom: 8, color: colors.textSecondary }]}>{t('onboarding.first_sub_subtitle')}</Text>

      {/* Add manually */}
      <TouchableOpacity
        style={{ width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        onPress={() => { router.replace('/(tabs)'); }}
      >
        <Ionicons name="create-outline" size={20} color="#FFF" />
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>{t('onboarding.add_manually')}</Text>
      </TouchableOpacity>

      {/* Add with AI */}
      <TouchableOpacity
        style={{ width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: '#2D2060', borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
        onPress={() => { router.replace('/(tabs)'); }}
      >
        <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.primary }}>{t('onboarding.add_with_ai')}</Text>
      </TouchableOpacity>

      {/* Skip */}
      <TouchableOpacity onPress={() => navigateToApp()} style={{ paddingVertical: 8 }}>
        <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: '600' }}>{t('onboarding.skip_for_now')}</Text>
      </TouchableOpacity>
    </View>,
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
              <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setStep(step - 1)}>
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
  emailOtpBtn: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  emailOtpIcon: { fontSize: 18 },
  otpContainer: { gap: 14, alignItems: 'center' },
  otpSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  otpEmail: { fontSize: 15, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  otpInputRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  otpDigitInput: { width: 48, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, textAlign: 'center', fontSize: 22, fontWeight: '700', color: COLORS.text },
  otpDigitFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  emailBtnDisabled: { opacity: 0.5 },
  otpTimerText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  otpResendText: { fontSize: 14, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  otpBackText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
});
