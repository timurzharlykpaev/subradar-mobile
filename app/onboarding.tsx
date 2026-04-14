import React, { useState, useRef, useEffect, useCallback } from 'react';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { analytics } from '../src/services/analytics';
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
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
// expo-auth-session/providers/google removed (requires native build)
let AppleAuthentication: any = null;
if (Platform.OS === 'ios') {
  try {
    AppleAuthentication = require('expo-apple-authentication');
  } catch {}
}
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useUIStore } from '../src/stores/uiStore';
import { authApi } from '../src/api/auth';
import { COLORS, CURRENCIES, LANGUAGES } from '../src/constants';
import { useTheme, fonts } from '../src/theme';
import { SunIcon, MoonIcon, MailIcon } from '../src/components/icons';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

// Web client ID
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '1026598677430-a59lmlfdo7r0ug1f6lafl52aean648i9.apps.googleusercontent.com';
// iOS client ID (bundle: com.goalin.subradar)
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '1026598677430-8qjldmtstvjo9a9gjsabipo05mo7ci5u.apps.googleusercontent.com';

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

const FLOAT_CARDS_LIGHT = [
  { name: 'Netflix',  amount: '$15.99', bg: '#FFEAEA', iconBg: '#E50914', IconComponent: NetflixIcon,  x: -120, delay: 0,   duration: 3200, yPos: 10  },
  { name: 'Spotify',  amount: '$9.99',  bg: '#EAFAF1', iconBg: '#1DB954', IconComponent: SpotifyIcon,  x: 70,   delay: 400,  duration: 2900, yPos: 50  },
  { name: 'iCloud',   amount: '$2.99',  bg: '#EAF2FF', iconBg: '#0071E3', IconComponent: ICloudIcon,   x: -85,  delay: 700,  duration: 3500, yPos: 95  },
  { name: 'YouTube',  amount: '$13.99', bg: '#FFEAEA', iconBg: '#FF0000', IconComponent: YoutubeIcon,  x: 100,  delay: 200,  duration: 3000, yPos: 130 },
  { name: 'ChatGPT',  amount: '$20.00', bg: '#EAF7F4', iconBg: '#10A37F', IconComponent: OpenAIIcon,   x: -130, delay: 550,  duration: 3300, yPos: 165 },
];
const FLOAT_CARDS_DARK = [
  { name: 'Netflix',  amount: '$15.99', bg: '#2A1520', iconBg: '#E50914', IconComponent: NetflixIcon,  x: -120, delay: 0,   duration: 3200, yPos: 10  },
  { name: 'Spotify',  amount: '$9.99',  bg: '#152A20', iconBg: '#1DB954', IconComponent: SpotifyIcon,  x: 70,   delay: 400,  duration: 2900, yPos: 50  },
  { name: 'iCloud',   amount: '$2.99',  bg: '#152030', iconBg: '#0071E3', IconComponent: ICloudIcon,   x: -85,  delay: 700,  duration: 3500, yPos: 95  },
  { name: 'YouTube',  amount: '$13.99', bg: '#2A1520', iconBg: '#FF0000', IconComponent: YoutubeIcon,  x: 100,  delay: 200,  duration: 3000, yPos: 130 },
  { name: 'ChatGPT',  amount: '$20.00', bg: '#152A25', iconBg: '#10A37F', IconComponent: OpenAIIcon,   x: -130, delay: 550,  duration: 3300, yPos: 165 },
];

function FloatingCard({ name, amount, bg, iconBg, IconComponent, x, delay, duration, yPos, topOffset = 0, textColor, subColor }: {
  name: string; amount: string; bg: string; iconBg: string; IconComponent: React.FC;
  x: number; delay: number; duration: number; yPos: number; topOffset?: number;
  textColor: string; subColor: string;
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
    let floatLoop: ReturnType<typeof Animated.loop> | null = null;
    const entry = Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0, duration: 650, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(entryOpacity, {
        toValue: 1, duration: 650, delay,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
    ]);
    entry.start(() => {
      floatLoop = Animated.loop(
        Animated.timing(progress, {
          toValue: 1, duration,
          easing: Easing.linear, useNativeDriver: true,
        })
      );
      floatLoop.start();
    });
    return () => { entry.stop(); floatLoop?.stop(); };
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
          <Text style={{ fontSize: 12, fontWeight: '700', color: textColor, letterSpacing: -0.2 }}>{name}</Text>
          <Text style={{ fontSize: 10, color: subColor, marginTop: 1 }}>{amount}/mo</Text>
        </View>
      </View>
    </Animated.View>
  );
}

function AuthHero() {
  const { isDark, colors } = useTheme();
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
    const loop1 = Animated.loop(
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
    );
    loop1.start();

    // Ring 2 pulse (offset)
    let loop2: ReturnType<typeof Animated.loop> | null = null;
    const t2 = setTimeout(() => {
      loop2 = Animated.loop(
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
      );
      loop2.start();
    }, 1000);
    return () => { loop1.stop(); loop2?.stop(); clearTimeout(t2); };
  }, []);

  return (
    <View style={{ width: '100%', height: 260 + insets.top, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' }}>
      {/* Floating cards — за лого */}
      {(isDark ? FLOAT_CARDS_DARK : FLOAT_CARDS_LIGHT).map((card) => (
        <FloatingCard key={card.name} {...card} topOffset={insets.top} textColor={colors.text} subColor={colors.textSecondary} />
      ))}

      {/* Центральный блок: кольца + иконка — всё вместе через flexbox */}
      <Animated.View style={{
        alignItems: 'center', justifyContent: 'center',
        width: 180, height: 180,
        transform: [{ scale: logoScale }], opacity: logoOpacity,
        zIndex: 20,
      }}>
        {/* Glow */}
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(139,92,246,0.12)' }} />
        {/* Pulse ring 1 */}
        <Animated.View style={{
          position: 'absolute', width: 130, height: 130, borderRadius: 65,
          borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.5)',
          transform: [{ scale: ring1Scale }], opacity: ring1Opacity,
        }} />
        {/* Pulse ring 2 */}
        <Animated.View style={{
          position: 'absolute', width: 130, height: 130, borderRadius: 65,
          borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.5)',
          transform: [{ scale: ring2Scale }], opacity: ring2Opacity,
        }} />
        {/* Иконка */}
        <View style={{
          shadowColor: '#8B5CF6', shadowOpacity: 0.4, shadowRadius: 18,
          shadowOffset: { width: 0, height: 4 }, elevation: 14,
        }}>
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 76, height: 76, borderRadius: 18 }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Showcase card icons ────────────────────────────────────────────────────
function ShowcaseAIIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Rect width="48" height="48" rx="14" fill="#7C3AED" />
      {/* Sparkle stars */}
      <Path d="M16 14l1.5 3 3 1.5-3 1.5L16 23l-1.5-3-3-1.5 3-1.5z" fill="white" opacity="0.9"/>
      <Path d="M30 10l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="white" opacity="0.6"/>
      {/* AI circuit */}
      <Circle cx="24" cy="26" r="9" fill="white" opacity="0.15"/>
      <Circle cx="24" cy="26" r="6" stroke="white" strokeWidth="1.8" fill="none" opacity="0.9"/>
      <Circle cx="24" cy="26" r="2.5" fill="white"/>
      <Path d="M24 20v-2M24 34v-2M18 26h-2M32 26h-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
      <Path d="M20.2 22.2l-1.4-1.4M29.2 31.2l-1.4-1.4M27.8 22.2l1.4-1.4M18.8 31.2l1.4-1.4" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
    </Svg>
  );
}

function ShowcaseBellIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Rect width="48" height="48" rx="14" fill="#F59E0B" />
      {/* Bell body */}
      <Path d="M24 12a8 8 0 00-8 8v5l-2.5 2.5V29h21v-1.5L32 25v-5a8 8 0 00-8-8z" fill="white" opacity="0.95"/>
      {/* Clapper */}
      <Path d="M21 29.5c0 1.66 1.34 3 3 3s3-1.34 3-3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Ring line */}
      <Path d="M24 10v2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      {/* Alert badge */}
      <Circle cx="32" cy="15" r="5" fill="#EF4444" />
      <Path d="M32 12v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <Circle cx="32" cy="18.5" r="1" fill="white"/>
    </Svg>
  );
}

function ShowcaseChartIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Rect width="48" height="48" rx="14" fill="#10B981" />
      {/* Bars */}
      <Rect x="11" y="27" width="6" height="10" rx="2" fill="white" opacity="0.5"/>
      <Rect x="21" y="20" width="6" height="17" rx="2" fill="white" opacity="0.75"/>
      <Rect x="31" y="13" width="6" height="24" rx="2" fill="white" opacity="0.95"/>
      {/* Trend line */}
      <Path d="M13 27l10-8 6 4 8-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Arrow tip */}
      <Path d="M35 11l2 2M37 13l-2 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </Svg>
  );
}

function ShowcaseTeamIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
      <Rect width="48" height="48" rx="14" fill="#3B82F6" />
      {/* Center person */}
      <Circle cx="24" cy="18" r="5" fill="white" opacity="0.95"/>
      <Path d="M15 35c0-4.97 4.03-9 9-9s9 4.03 9 9" fill="white" opacity="0.3"/>
      <Path d="M17 33c0-3.87 3.13-7 7-7s7 3.13 7 7" fill="white" opacity="0.6"/>
      {/* Left person */}
      <Circle cx="12" cy="21" r="3.5" fill="white" opacity="0.6"/>
      <Path d="M6 33c0-3.31 2.69-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      {/* Right person */}
      <Circle cx="36" cy="21" r="3.5" fill="white" opacity="0.6"/>
      <Path d="M42 33c0-3.31-2.69-6-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
    </Svg>
  );
}

// ─── Quick-add services for Step 0 (use icon.horse for real logos) ───────────
const QUICK_ADD_SERVICES = [
  { name: 'Netflix',    amount: 15.99, color: '#E50914', iconUrl: 'https://icon.horse/icon/netflix.com'     },
  { name: 'Spotify',   amount: 9.99,  color: '#1DB954', iconUrl: 'https://icon.horse/icon/spotify.com'    },
  { name: 'iCloud+',   amount: 2.99,  color: '#0071E3', iconUrl: 'https://icon.horse/icon/icloud.com'    },
  { name: 'YouTube',   amount: 13.99, color: '#FF0000', iconUrl: 'https://icon.horse/icon/youtube.com'   },
  { name: 'ChatGPT',   amount: 20.00, color: '#10A37F', iconUrl: 'https://icon.horse/icon/openai.com'    },
  { name: 'Other',     amount: 0,     color: '#8B5CF6', iconUrl: ''                                       },
] as const;

export default function OnboardingScreen() {
  const { isOnboarded, setUser, setOnboarded } = useAuthStore();
  // Returning user (logged out but already onboarded) → skip to auth step
  const [step, setStep] = useState(isOnboarded ? 3 : 0);
  const [email, setEmail] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [quickAddSelected, setQuickAddSelected] = useState<Set<string>>(new Set());
  const counterAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const otpInputRefs = useRef<Array<TextInput | null>>([]);

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { setLanguage, language, setCurrency } = useSettingsStore();
  const { colors, isDark, toggleTheme } = useTheme();
  const safeInsets = useSafeAreaInsets();

  // Google OAuth via web browser redirect (works without native build)
  const googlePromptAsync = async () => {
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';
      const redirectUri = `${apiBase}/auth/google/callback`;
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${GOOGLE_WEB_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=openid%20email%20profile` +
        `&state=mobile`;
      const isIPad = Platform.OS === 'ios' && (Platform as any).isPad;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'subradar://', {
        ...(isIPad ? {} : { preferEphemeralSession: true }),
      });
      console.log('[GoogleAuth] WebBrowser result:', JSON.stringify(result));
      if (result.type === 'success' && result.url) {
        // Backend already authenticated — callback contains our JWT
        const tokenMatch = result.url.match(/[?&#]token=([^&]+)/);
        const refreshMatch = result.url.match(/[?&#]refreshToken=([^&]+)/);
        console.log('[GoogleAuth] token found:', !!tokenMatch?.[1], 'refresh found:', !!refreshMatch?.[1]);
        if (tokenMatch?.[1]) {
          const jwt = decodeURIComponent(tokenMatch[1]);
          const refresh = refreshMatch?.[1] ? decodeURIComponent(refreshMatch[1]) : undefined;
          // Fetch user profile with the JWT
          setLoading(true);
          try {
            const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
            if (refresh) await AsyncStorage.setItem('refresh_token', refresh);
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.subradar.ai/api/v1';
            console.log('[GoogleAuth] Fetching /auth/me from:', apiUrl);
            const controller2 = new AbortController();
            const fetchTimeout = setTimeout(() => controller2.abort(), 15000);
            const res = await fetch(`${apiUrl}/auth/me`, {
              headers: { Authorization: `Bearer ${jwt}` },
              signal: controller2.signal,
            });
            clearTimeout(fetchTimeout);
            console.log('[GoogleAuth] /auth/me status:', res.status);
            const userData = await res.json();
            console.log('[GoogleAuth] userData:', JSON.stringify(userData).slice(0, 200));
            if (userData?.id || userData?.email) {
              console.log('[GoogleAuth] Calling finishAuth');
              finishAuth(userData, jwt);
            } else {
              console.warn('[GoogleAuth] No id/email in response, skipping finishAuth');
              Alert.alert(t('auth.google_signin_error'), 'Invalid user data received');
            }
          } catch (err) {
            console.error('[GoogleAuth] Error:', err);
            Alert.alert(t('auth.google_signin_error'), String(err));
          } finally {
            setLoading(false);
          }
        }
      }
    } catch (e: any) {
      Alert.alert(t('auth.google_signin_error'), t('auth.google_setup_hint'));
    }
  };

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
    analytics.track('onboarding_completed');
    setOnboarded();
    router.replace('/(tabs)');
  };

  // Counter animation for money hook (0 → 624)
  const counterDisplayValue = useRef(0);
  const [counterDisplay, setCounterDisplay] = useState(0);
  useEffect(() => {
    if (step !== 0) return;
    analytics.track('onboarding_money_hook_viewed');
    Animated.timing(counterAnim, {
      toValue: 624,
      duration: 2200,
      useNativeDriver: false,
    }).start();
    const listener = counterAnim.addListener(({ value }) => {
      const rounded = Math.round(value);
      if (rounded !== counterDisplayValue.current) {
        counterDisplayValue.current = rounded;
        setCounterDisplay(rounded);
      }
    });
    return () => counterAnim.removeListener(listener);
  }, [step]);

  const finishAuth = (user: any, token: string) => {
    if (!user || (!user.id && !user.email)) {
      console.error('[Auth] Invalid user object:', user);
      Alert.alert(t('auth.error_title'), t('auth.invalid_user', 'Invalid account data received. Please try again.'));
      setLoading(false);
      return;
    }
    setCurrency(selectedCurrency);
    setUser(user, token);
    setOnboarded();
    try {
      analytics.identify(user.id, { plan: (user as any).plan, currency: selectedCurrency });
      analytics.track('auth_completed', { method: 'unknown', is_new_user: !user.createdAt || (Date.now() - new Date(user.createdAt).getTime() < 60_000) });
    } catch {}
    // Returning user → straight to Dashboard; new user → notifications step
    if (isOnboarded) {
      router.replace('/(tabs)');
    } else {
      setStep(4);
    }
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
    if (!AppleAuthentication) return;
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        Alert.alert(t('auth.error_title'), t('auth.apple_no_token', 'No identity token received from Apple. Please try again.'));
        setLoading(false);
        return;
      }
      const res = await authApi.loginWithApple(credential.identityToken);
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
      console.log('[OTP] Sending to:', email);
      await authApi.sendOtp(email);
      setOtpSent(true);
      setOtpTimer(60);
      setOtpCode('');
    } catch (e: any) {
      console.error('[OTP] Send error:', e?.response?.status, e?.response?.data, e?.message);
      Alert.alert(
        t('auth.error_title'),
        e?.response?.data?.message || e?.message || t('auth.failed_send_code'),
      );
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
    // Step 0: Money Loss Hook + Quick-Add
    <Animated.View
      key="money_hook"
      style={[styles.step, { opacity: showcaseOpacity, transform: [{ translateY: showcaseTranslateY }] }]}
    >
      {/* Header */}
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF444415', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32 }}>💸</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', letterSpacing: 1, textTransform: 'uppercase' }}>
          {t('onboarding.hook_eyebrow', 'The average person wastes')}
        </Text>
        {/* Animated counter */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: 64, fontWeight: '900', color: colors.text, letterSpacing: -1, fontFamily: 'Inter-ExtraBold' }}>
            ${counterDisplay}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textSecondary, paddingBottom: 12 }}>
            /{t('paywall.year', 'yr')}
          </Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          {t('onboarding.hook_subtitle', 'on subscriptions they forgot about.\nHow many do YOU have?')}
        </Text>
      </View>

      {/* Quick-add cards */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {t('onboarding.hook_tap_yours', 'Tap the ones you pay for')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 2 }}>
        {QUICK_ADD_SERVICES.map((svc) => {
          const isSelected = quickAddSelected.has(svc.name);
          return (
            <TouchableOpacity
              key={svc.name}
              onPress={() => {
                analytics.track('onboarding_quick_add_tapped', { service: svc.name, selected: !isSelected });
                setQuickAddSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(svc.name)) next.delete(svc.name);
                  else next.add(svc.name);
                  return next;
                });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 24,
                borderWidth: 2,
                borderColor: isSelected ? svc.color : (isDark ? '#2A2A3E' : '#E5E7EB'),
                backgroundColor: isSelected ? svc.color + '18' : (isDark ? '#1C1C2E' : '#FFFFFF'),
                ...(isSelected ? { shadowColor: svc.color, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 } : {}),
              }}
            >
              {svc.iconUrl ? (
                <Image
                  source={{ uri: svc.iconUrl }}
                  style={{ width: 22, height: 22, borderRadius: 6 }}
                />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={svc.color} />
              )}
              <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? svc.color : colors.text }}>
                {svc.name}
              </Text>
              {isSelected && svc.amount > 0 && (
                <Text style={{ fontSize: 11, fontWeight: '600', color: svc.color }}>
                  ${svc.amount}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Running total */}
      {quickAddSelected.size > 0 && (() => {
        const total = QUICK_ADD_SERVICES
          .filter(s => quickAddSelected.has(s.name) && s.amount > 0)
          .reduce((sum, s) => sum + s.amount, 0);
        return total > 0 ? (
          <View style={{ backgroundColor: '#EF444415', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>
              {t('onboarding.hook_monthly_total', 'That\'s ${{amount}}/month already', { amount: total.toFixed(2) })}
            </Text>
            <Text style={{ fontSize: 11, color: '#EF4444', opacity: 0.8, marginTop: 2 }}>
              {t('onboarding.hook_annual', '= ${{amount}}/year', { amount: (total * 12).toFixed(0) })}
            </Text>
          </View>
        ) : null;
      })()}

      <TouchableOpacity
        testID="btn-get-started"
        style={[styles.showcaseBtn, { backgroundColor: colors.primary, marginTop: 4 }]}
        onPress={() => {
          analytics.track('onboarding_step_completed', { step: 0, step_name: 'money_hook', quick_added: quickAddSelected.size });
          setStep(1);
        }}
      >
        <Text style={styles.showcaseBtnText}>
          {quickAddSelected.size > 0
            ? t('onboarding.hook_cta_selected', 'Find the rest →')
            : t('onboarding.showcase_start')}
        </Text>
      </TouchableOpacity>
    </Animated.View>,

    // Step 1: Language (was Step 0)
    <View key="language" testID="step-language" style={styles.step}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image source={require('../assets/images/icon.png')} style={styles.logoImage} />
        <Text style={[styles.logoTitle, { color: colors.text }]}>SubRadar</Text>
        <View style={[styles.aiBadge, { backgroundColor: colors.primary }]}><Text style={styles.aiBadgeText}>AI</Text></View>
      </Animated.View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.choose_language')}</Text>
      <View style={styles.langGrid}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            testID={`lang-${lang.code}`}
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

    // Step 2: Currency
    <View key="currency" testID="step-currency" style={styles.step}>
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
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.currency')}</Text>
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

    // Step 3: Auth
    <View key="auth" testID="step-auth" style={[styles.step, { flex: 1, justifyContent: 'center', paddingBottom: 8 }]}>
      {/* Theme toggle top-right — use insets to stay below status bar */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={{ position: 'absolute', top: (safeInsets.top || 0) + 8, right: 16, zIndex: 100, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
      >
        {isDark ? <SunIcon size={18} color="#F59E0B" /> : <MoonIcon size={18} color="#6366F1" />}
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
            <TouchableOpacity testID="btn-apple" style={[styles.socialBtn, { backgroundColor: isDark ? '#1C1C1E' : '#000' }]} onPress={handleAppleLogin} disabled={loading}>
              <AppleIcon />
              <Text style={styles.socialText}>{t('onboarding.continue_apple')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="btn-google"
            style={[styles.socialBtn, styles.googleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => googlePromptAsync()}
            disabled={loading}
          >
            <GoogleIcon />
            <Text style={[styles.socialText, { color: colors.text }]}>{t('onboarding.continue_google')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-email"
            style={[styles.socialBtn, styles.emailOtpBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setOtpMode(true)}
            disabled={loading}
          >
            <MailIcon size={18} color={colors.primary} />
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
            testID="btn-verify"
            style={[styles.emailBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, otpCode.length < 6 && styles.emailBtnDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otpCode.length < 6}
          >
            <Text style={styles.emailBtnText}>{t('auth.verify')}</Text>
          </TouchableOpacity>

          {otpTimer > 0 ? (
            <Text style={[styles.otpTimerText, { color: colors.textMuted }]}>
              {t('auth.resend_in', { seconds: otpTimer })}
            </Text>
          ) : (
            <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
              <Text style={[styles.otpResendText, { color: colors.primary }]}>{t('auth.resend_code')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => { setOtpMode(false); setOtpSent(false); setOtpCode(''); }}>
            <Text style={[styles.otpBackText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.otpContainer}>
          <TextInput
            testID="email-input"
            style={[styles.emailInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email_placeholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity testID="btn-send-code" style={[styles.emailBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={handleSendOtp} disabled={loading}>
            <Text style={styles.emailBtnText}>{t('auth.send_code')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setOtpMode(false)}>
            <Text style={[styles.otpBackText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.terms, { color: colors.textSecondary }]}>
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

    // Step 4: Enable notifications
    <View key="notifications" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Ionicons name="notifications" size={56} color="#F59E0B" />
      </View>

      <Text style={[styles.headline, { textAlign: 'center', color: colors.text }]}>
        {t('onboarding.notifications_title', 'Never miss a payment')}
      </Text>
      <Text style={[styles.subheadline, { textAlign: 'center', color: colors.textSecondary, marginBottom: 16 }]}>
        {t('onboarding.notifications_subtitle', 'Get reminders before your subscriptions renew so you never get surprised by a charge')}
      </Text>

      <TouchableOpacity
        style={{ width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', backgroundColor: '#F59E0B', flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}
        onPress={async () => {
          const { status } = await Notifications.requestPermissionsAsync();
          analytics.notificationPermission(status === 'granted');
          setStep(step + 1);
        }}
      >
        <Ionicons name="notifications-outline" size={22} color="#FFF" />
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>{t('onboarding.enable_notifications', 'Enable notifications')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { analytics.notificationPermission(false); setStep(step + 1); }} style={{ paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: '600' }}>{t('onboarding.maybe_later', 'Maybe later')}</Text>
      </TouchableOpacity>
    </View>,

    // Step 5: Add first subscription
    <View key="first_sub" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
      {/* Icon */}
      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        <Ionicons name="add-circle" size={56} color={colors.primary} />
      </View>

      <Text style={[styles.headline, { textAlign: 'center', color: colors.text }]}>
        {t('onboarding.first_sub_title')}
      </Text>
      <Text style={[styles.subheadline, { textAlign: 'center', color: colors.textSecondary, marginBottom: 16 }]}>
        {t('onboarding.first_sub_subtitle')}
      </Text>

      {/* Buttons */}
      <TouchableOpacity
        style={{ width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}
        onPress={() => {
          useUIStore.getState().openAddSheet();
          navigateToApp();
        }}
      >
        <Ionicons name="sparkles-outline" size={22} color="#FFF" />
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>{t('onboarding.add_with_ai')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 10 }}
        onPress={() => {
          useUIStore.getState().openAddSheet();
          navigateToApp();
        }}
      >
        <Ionicons name="create-outline" size={22} color={colors.primary} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{t('onboarding.add_manually')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigateToApp()} style={{ paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: '600' }}>{t('onboarding.skip_for_now')}</Text>
      </TouchableOpacity>
    </View>,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>{steps[step]}</View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: colors.border }, step === i && [styles.dotActive, { backgroundColor: colors.primary }]]} />
          ))}
        </View>

        {step > 0 && step !== 3 && step !== 4 && step !== 5 && (
          <View style={styles.footerBtns}>
            {step > 1 && (
              <TouchableOpacity testID="btn-back" style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setStep(step - 1)}>
                <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}
            {step < steps.length - 1 && step !== 3 && (
              <TouchableOpacity testID="btn-next" style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={() => setStep(step + 1)}>
                <Text style={styles.nextBtnText}>{t('onboarding.next')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
    </KeyboardAvoidingView>
  );
}

// All colors removed from static styles — applied inline via colors from useTheme()
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  step: { gap: 16 },
  logoContainer: { alignItems: 'center', gap: 8, marginBottom: 16 },
  logoImage: { width: 80, height: 80, borderRadius: 20 },
  logoImageLarge: { width: 110, height: 110, borderRadius: 28 },
  logoTitle: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  aiBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  aiBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  headline: { fontSize: 30, fontWeight: '900', textAlign: 'center', lineHeight: 38, letterSpacing: -0.5 },
  subheadline: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  sectionTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  langChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  langChipActive: {},
  langFlag: { fontSize: 18 },
  langLabel: { fontSize: 13, fontWeight: '600' },
  langLabelActive: {},
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 14 },
  featureIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureEmoji: { fontSize: 24 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700' },
  featureDesc: { fontSize: 13, marginTop: 2 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currencyChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 2 },
  currencyChipActive: {},
  currencyText: { fontSize: 15, fontWeight: '600' },
  currencyTextActive: {},
  loadingOverlay: { alignItems: 'center', paddingVertical: 8 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 17 },
  googleBtn: { borderWidth: 1.5 },
  socialText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  emailInput: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    borderWidth: 1.5,
    width: '100%',
  },
  emailBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  emailBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  magicSentBox: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 16 },
  magicSentEmoji: { fontSize: 40 },
  magicSentTitle: { fontSize: 18, fontWeight: '800' },
  magicSentSub: { fontSize: 14, textAlign: 'center' },
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  footer: { padding: 24, paddingBottom: 40, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 20 },
  footerBtns: { flexDirection: 'row', gap: 10 },
  backBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  backBtnText: { fontSize: 15, fontWeight: '700' },
  nextBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  showcaseTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', lineHeight: 26, letterSpacing: -0.3, marginBottom: 4 },
  showcaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  showcaseCard: { width: '46%', borderRadius: 20, borderWidth: 1, padding: 18, gap: 10, alignItems: 'center' },
  showcaseEmoji: { fontSize: 28 },
  showcaseCardTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  showcaseCardDesc: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  showcaseBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  showcaseBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  emailOtpBtn: { borderWidth: 1 },
  emailOtpIcon: { fontSize: 18 },
  otpContainer: { gap: 14, alignItems: 'center' },
  otpSubtitle: { fontSize: 15, textAlign: 'center' },
  otpEmail: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  otpInputRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  otpDigitInput: { width: 48, height: 56, borderRadius: 12, borderWidth: 1.5, textAlign: 'center', fontSize: 22, fontWeight: '700' },
  otpDigitFilled: {},
  emailBtnDisabled: { opacity: 0.5 },
  otpTimerText: { fontSize: 13, textAlign: 'center' },
  otpResendText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  otpBackText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
