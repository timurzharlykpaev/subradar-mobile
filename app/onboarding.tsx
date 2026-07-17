import React, { useState, useRef, useEffect, useCallback } from 'react';
import Svg, { Path, Circle, Rect, Text as SvgText, G, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
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
  Keyboard,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DoneAccessoryInput } from '../src/components/primitives/DoneAccessoryInput';
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
import { subscriptionsApi } from '../src/api/subscriptions';
import { COLORS, CURRENCIES, LANGUAGES } from '../src/constants';
import { detectCountryFromTimezone, detectCountryFromTimezoneStrict, COUNTRY_DEFAULT_CURRENCY } from '../src/constants/timezones';
import { COUNTRIES } from '../src/constants/countries';
import { CountryPicker } from '../src/components/CountryPicker';
import { LanguagePicker } from '../src/components/LanguagePicker';
import { usersApi } from '../src/api/users';
import { useTheme, fonts } from '../src/theme';
import { SunIcon, MoonIcon, MailIcon } from '../src/components/icons';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ms, mvs, scale, isSmallScreen } from '../src/utils/responsive';

WebBrowser.maybeCompleteAuthSession();

// Web client ID
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  '1026598677430-a59lmlfdo7r0ug1f6lafl52aean648i9.apps.googleusercontent.com';
// iOS client ID (bundle: com.goalin.subradar)
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  '1026598677430-8qjldmtstvjo9a9gjsabipo05mo7ci5u.apps.googleusercontent.com';

// ─── Money Loss Icon (Step 0 hook) ───────────────────────────────────────────
// Премиальная gold монета с $, glossy highlight и тенью. Tasteful, minimal —
// в духе Stripe/Apple. Работает в обеих темах.
function MoneyLossIcon({ isDark }: { isDark: boolean }) {
  const rimDark = isDark ? '#92400E' : '#78350F';
  const dollar = isDark ? '#7C2D12' : '#78350F';

  return (
    <Svg width={84} height={84} viewBox="0 0 84 84">
      <Defs>
        {/* Внешний золотой gradient — премиум depth */}
        <LinearGradient id="coinFace" x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor="#FDE68A" />
          <Stop offset="0.45" stopColor="#FBBF24" />
          <Stop offset="1" stopColor="#D97706" />
        </LinearGradient>
        {/* Внутренний highlight для 3D эффекта */}
        <LinearGradient id="coinHighlight" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Drop shadow */}
      <Ellipse cx="42" cy="76" rx="26" ry="3.5" fill="#000000" opacity={isDark ? '0.45' : '0.18'} />

      {/* Outer rim — насыщенный bronze */}
      <Circle cx="42" cy="40" r="34" fill="#A16207" />

      {/* Face — gold gradient */}
      <Circle cx="42" cy="40" r="31" fill="url(#coinFace)" />

      {/* Inner decorative ring */}
      <Circle cx="42" cy="40" r="27" fill="none" stroke={rimDark} strokeOpacity="0.35" strokeWidth="0.8" />

      {/* Top gloss highlight — даёт 3D ощущение */}
      <Ellipse cx="42" cy="28" rx="22" ry="14" fill="url(#coinHighlight)" />

      {/* $ символ */}
      <SvgText
        x="42"
        y="53"
        textAnchor="middle"
        fontSize="38"
        fontWeight="900"
        fill={dollar}
        fontFamily="Inter-ExtraBold"
      >$</SvgText>

      {/* Subtle bottom shading для depth */}
      <Path
        d="M 11 40 A 31 31 0 0 0 73 40"
        fill="none"
        stroke="#000000"
        strokeOpacity="0.08"
        strokeWidth="6"
      />
    </Svg>
  );
}

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
// Rendered on a 30×30 coloured pill (iconBg in FLOAT_CARDS), so the SVG draws
// only the white foreground glyph — no background plate. Kept deliberately
// minimal: at this size complex paths blur, so each icon is the cleanest
// recognisable silhouette of the brand mark rather than a literal reproduction.
function NetflixIcon() {
  // Two thick verticals + a corner-to-corner diagonal stroke between them.
  // The previous single-path version stopped the diagonal 1.5px short of each
  // corner, which read as a "broken" N at the 20px size.
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Rect x="4" y="2" width="3" height="16" fill="white" />
      <Rect x="13" y="2" width="3" height="16" fill="white" />
      <Path d="M5.5 2 L14.5 18" stroke="white" strokeWidth="3" strokeLinecap="butt" />
    </Svg>
  );
}
function SpotifyIcon() {
  // Three concentric arcs curving downward, decreasing in length top→bottom.
  // Previous version used quadratic-bezier "humps" that curved the wrong way
  // and read as a stacked tilde rather than sound waves.
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M3 7.5 Q10 4 17 7.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M4 11 Q10 8 16 11.3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M5.5 14 Q10 11.8 14.5 14.3" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}
function ICloudIcon() {
  // Two-bump cloud silhouette via three arcs joining into a flat base. Reads
  // as a cloud at any size, unlike the previous lopsided blob.
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M14.5 14.5 a3 3 0 0 0 0.4 -5.95 a4 4 0 0 0 -7.7 -0.6 a3.4 3.4 0 0 0 -1.2 6.55 z"
        fill="white"
      />
    </Svg>
  );
}
function YoutubeIcon() {
  // Just the white play triangle — the iconBg pill is already YouTube red,
  // so the previous nested "white rect on red, red triangle on white" was a
  // play-button-on-a-play-button visual stutter.
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M6.5 5.5 L15 10 L6.5 14.5 Z" fill="white" />
    </Svg>
  );
}
function OpenAIIcon() {
  // Double-hexagon knotwork — the closest a 20px silhouette gets to OpenAI's
  // interlocking hex mark. Previous version drew a circle + 5-pointed star,
  // which is not the OpenAI logo at all.
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 2.2 L16.8 6.1 V13.9 L10 17.8 L3.2 13.9 V6.1 Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Path
        d="M10 6.6 L13.6 8.7 V12.3 L10 14.4 L6.4 12.3 V8.7 Z"
        stroke="white"
        strokeWidth="1.3"
        strokeLinejoin="round"
        opacity="0.65"
      />
    </Svg>
  );
}

// ─── Radar sweep ────────────────────────────────────────────────────────────
// Вращающийся сектор-«луч» сканера: градиент от прозрачного к фирменному
// фиолетовому по передней кромке. Главный премиум-штрих — даёт ощущение
// живого радара вместо статичной пульсации.
function RadarSweep({ color }: { color: string }) {
  return (
    <Svg width={150} height={150} viewBox="0 0 150 150">
      <Defs>
        <LinearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity="0" />
          <Stop offset="1" stopColor={color} stopOpacity="0.55" />
        </LinearGradient>
      </Defs>
      {/* Сектор ~50° из центра (75,75), радиус 75; яркая кромка — ведущая при вращении */}
      <Path d="M75 75 L150 75 A75 75 0 0 0 123.2 17.5 Z" fill="url(#radarSweep)" />
    </Svg>
  );
}

// depth: 1 = передний план (крупнее, чётче, больше parallax), <1 = в глубине
// (мельче, прозрачнее, меньше плавает) — создаёт эффект орбиты вокруг логотипа.
const FLOAT_CARDS_LIGHT = [
  { name: 'Netflix',  amount: '$15.99', bg: '#FFFFFF', iconBg: '#E50914', domain: 'netflix.com', IconComponent: NetflixIcon,  x: -120, delay: 0,   duration: 3200, yPos: 10,  depth: 1    },
  { name: 'Spotify',  amount: '$9.99',  bg: '#FFFFFF', iconBg: '#1DB954', domain: 'spotify.com', IconComponent: SpotifyIcon,  x: 70,   delay: 400,  duration: 2900, yPos: 50,  depth: 0.9  },
  { name: 'iCloud',   amount: '$2.99',  bg: '#FFFFFF', iconBg: '#0071E3', domain: 'icloud.com',  IconComponent: ICloudIcon,   x: -85,  delay: 700,  duration: 3500, yPos: 95,  depth: 0.86 },
  { name: 'YouTube',  amount: '$13.99', bg: '#FFFFFF', iconBg: '#FF0000', domain: 'youtube.com', IconComponent: YoutubeIcon,  x: 100,  delay: 200,  duration: 3000, yPos: 130, depth: 1    },
  // icon.horse для openai.com отдаёт серую заглушку — берём логотип ChatGPT из Google favicons.
  { name: 'ChatGPT',  amount: '$20.00', bg: '#FFFFFF', iconBg: '#10A37F', domain: 'openai.com',  iconUrl: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128', IconComponent: OpenAIIcon,   x: -130, delay: 550,  duration: 3300, yPos: 165, depth: 0.9  },
];
const FLOAT_CARDS_DARK = [
  { name: 'Netflix',  amount: '$15.99', bg: '#23232E', iconBg: '#E50914', domain: 'netflix.com', IconComponent: NetflixIcon,  x: -120, delay: 0,   duration: 3200, yPos: 10,  depth: 1    },
  { name: 'Spotify',  amount: '$9.99',  bg: '#23232E', iconBg: '#1DB954', domain: 'spotify.com', IconComponent: SpotifyIcon,  x: 70,   delay: 400,  duration: 2900, yPos: 50,  depth: 0.9  },
  { name: 'iCloud',   amount: '$2.99',  bg: '#23232E', iconBg: '#0071E3', domain: 'icloud.com',  IconComponent: ICloudIcon,   x: -85,  delay: 700,  duration: 3500, yPos: 95,  depth: 0.86 },
  { name: 'YouTube',  amount: '$13.99', bg: '#23232E', iconBg: '#FF0000', domain: 'youtube.com', IconComponent: YoutubeIcon,  x: 100,  delay: 200,  duration: 3000, yPos: 130, depth: 1    },
  { name: 'ChatGPT',  amount: '$20.00', bg: '#23232E', iconBg: '#10A37F', domain: 'openai.com',  iconUrl: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=128', IconComponent: OpenAIIcon,   x: -130, delay: 550,  duration: 3300, yPos: 165, depth: 0.9  },
];

const FloatingCard = React.memo(function FloatingCard({ name, amount, bg, iconBg, domain, iconUrl, IconComponent, x, delay, duration, yPos, depth = 1, topOffset = 0, textColor, subColor, tileBorder }: {
  name: string; amount: string; bg: string; iconBg: string; domain: string; iconUrl?: string; IconComponent: React.FC;
  x: number; delay: number; duration: number; yPos: number; depth?: number; topOffset?: number;
  textColor: string; subColor: string; tileBorder: string;
}) {
  const entryY = useRef(new Animated.Value(30)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  // Linear 0→1 progress mapped to sine — no jump at loop boundary
  const progress = useRef(new Animated.Value(0)).current;
  // Реальный логотип через icon.horse (тот же источник, что QUICK_ADD_SERVICES);
  // при ошибке сети падаем на рукодельный SVG-силуэт, чтобы карточка не пустовала.
  const [logoFailed, setLogoFailed] = useState(false);

  // Parallax: ближние карточки (depth=1) плавают сильнее, дальние — меньше.
  const amplitude = 10 * depth;
  const floatY = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -amplitude, 0, amplitude, 0],
  });
  // Лёгкий «дрейф» наклона — оживляет, добавляет ощущение парения.
  const floatRotate = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ['0deg', '1.4deg', '0deg', '-1.4deg', '0deg'],
  });

  useEffect(() => {
    let floatLoop: ReturnType<typeof Animated.loop> | null = null;
    const entry = Animated.parallel([
      Animated.timing(entryY, {
        toValue: 0, duration: 650, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(entryOpacity, {
        toValue: depth, duration: 650, delay,
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
      transform: [
        { translateX: x },
        { translateY: Animated.add(entryY, floatY) },
        { rotate: floatRotate },
        { scale: depth },
      ],
      opacity: entryOpacity,
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 9,
        backgroundColor: bg,
        borderRadius: 16, paddingHorizontal: 11, paddingVertical: 8,
        borderWidth: 1, borderColor: tileBorder,
        shadowColor: '#1A1330', shadowOpacity: 0.12, shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 }, elevation: 8,
      }}>
        <View style={{
          width: 32, height: 32, borderRadius: 10,
          backgroundColor: '#FFFFFF',
          borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        }}>
          {logoFailed ? (
            <View style={{ width: '100%', height: '100%', backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
              <IconComponent />
            </View>
          ) : (
            <ExpoImage
              source={{ uri: iconUrl ?? `https://icon.horse/icon/${domain}` }}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
              transition={250}
              cachePolicy="memory-disk"
              onError={() => setLogoFailed(true)}
            />
          )}
        </View>
        <View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: textColor, letterSpacing: -0.2 }}>{name}</Text>
          <Text style={{ fontSize: 10, color: subColor, marginTop: 1 }}>{amount}/mo</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const AuthHero = React.memo(function AuthHero() {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Вращение радар-луча — единственная анимация центра (пульс-кольца убраны).
  const sweepRotate = useRef(new Animated.Value(0)).current;

  // Карточки темнее центра → видны в обоих темах; тонкая рамка для «стекла».
  const tileBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,12,46,0.06)';
  const sweepColor = isDark ? '#A78BFA' : '#8B5CF6';

  useEffect(() => {
    // Появление логотипа
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    // Непрерывное вращение луча
    const sweepLoop = Animated.loop(
      Animated.timing(sweepRotate, {
        toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true,
      })
    );
    sweepLoop.start();

    return () => { sweepLoop.stop(); };
  }, []);

  const spin = sweepRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: '100%', height: mvs(260) + insets.top, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' }}>
      {/* Floating cards — за лого */}
      {(isDark ? FLOAT_CARDS_DARK : FLOAT_CARDS_LIGHT).map((card) => (
        <FloatingCard key={card.name} {...card} topOffset={insets.top} textColor={colors.text} subColor={colors.textSecondary} tileBorder={tileBorder} />
      ))}

      {/* Центральный блок: glow + вращающийся радар-луч + иконка */}
      <Animated.View style={{
        alignItems: 'center', justifyContent: 'center',
        width: 180, height: 180,
        transform: [{ scale: logoScale }], opacity: logoOpacity,
        zIndex: 20,
      }}>
        {/* Glow */}
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(139,92,246,0.12)' }} />
        <View style={{ position: 'absolute', width: 116, height: 116, borderRadius: 58, backgroundColor: 'rgba(139,92,246,0.10)' }} />

        {/* Статичный циферблат радара (не мерцает) */}
        <View style={{
          position: 'absolute', width: 150, height: 150, borderRadius: 75,
          borderWidth: 1, borderColor: 'rgba(139,92,246,0.14)',
        }} />

        {/* Радар-луч — единственный движущийся элемент */}
        <Animated.View style={{ position: 'absolute', width: 150, height: 150, transform: [{ rotate: spin }] }}>
          <RadarSweep color={sweepColor} />
        </Animated.View>

        {/* Иконка */}
        <View style={{
          shadowColor: '#5A28C8', shadowOpacity: 0.5, shadowRadius: 18,
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
});

// ─── Email entry (isolated) ──────────────────────────────────────────────────
// The email field keeps its draft in LOCAL state and only lifts the value on
// submit. Previously `email` lived in OnboardingScreen, so every keystroke
// re-rendered the whole screen and rebuilt the 6-element `steps` array (plus
// re-laid-out the iOS InputAccessoryView) — that's what made typing lag/glitch.
// Keeping the draft here means typing re-renders only this tiny subtree.
const EmailEntryView = React.memo(function EmailEntryView({
  initialEmail,
  loading,
  onSubmit,
  onBack,
}: {
  initialEmail: string;
  loading: boolean;
  onSubmit: (email: string) => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState(initialEmail);

  const submit = useCallback(() => onSubmit(email.trim()), [email, onSubmit]);

  return (
    <View style={styles.otpContainer}>
      <DoneAccessoryInput
        testID="email-input"
        style={[styles.emailInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.email_placeholder')}
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        blurOnSubmit
      />
      <TouchableOpacity testID="btn-send-code" style={[styles.emailBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]} onPress={submit} disabled={loading}>
        <Text style={styles.emailBtnText}>{t('auth.send_code')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={[styles.otpBackText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─── ICP-based waste estimate (per year, $USD) ───────────────────────────────
// Values reflect average forgotten-subscription spend for each persona based on
// industry studies (Chase 2024, Bango Subscriptions Report 2025).
const ICP_WASTE_USD = { solo: 420, family: 1080, team: 3600 } as const;

// ─── Quick-add services for Step 0 (use icon.horse for real logos) ───────────
const QUICK_ADD_SERVICES = [
  { name: 'Netflix',    amount: 15.99, color: '#E50914', iconUrl: 'https://icon.horse/icon/netflix.com'     },
  { name: 'Spotify',   amount: 9.99,  color: '#1DB954', iconUrl: 'https://icon.horse/icon/spotify.com'    },
  { name: 'iCloud+',   amount: 2.99,  color: '#0071E3', iconUrl: 'https://icon.horse/icon/icloud.com'    },
  { name: 'YouTube',   amount: 13.99, color: '#FF0000', iconUrl: 'https://icon.horse/icon/youtube.com'   },
  { name: 'ChatGPT',   amount: 20.00, color: '#10A37F', iconUrl: 'https://www.google.com/s2/favicons?domain=openai.com&sz=128'    },
  { name: 'Other',     amount: 0,     color: '#8B5CF6', iconUrl: ''                                       },
] as const;

export default function OnboardingScreen() {
  const { isOnboarded, setUser, setOnboarded } = useAuthStore();
  // Returning user (logged out but already onboarded) → skip to auth step
  const [step, setStep] = useState(isOnboarded ? 3 : 0);
  const [email, setEmail] = useState('');
  // regionAutoDetected = true когда timezone маппится unambiguously на страну.
  // Используется для пропуска currency picker (Step 2) у юзеров с
  // confident detection (US/EU/RU/etc.) — снижает onboarding friction.
  const [regionAutoDetected] = useState(() => detectCountryFromTimezoneStrict() !== null);
  const [selectedRegion, setSelectedRegion] = useState<string>(() => {
    try {
      return detectCountryFromTimezone() || 'US';
    } catch {
      return 'US';
    }
  });
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    try {
      return COUNTRY_DEFAULT_CURRENCY[detectCountryFromTimezone() || 'US'] || 'USD';
    } catch {
      return 'USD';
    }
  });
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [quickAddSelected, setQuickAddSelected] = useState<Set<string>>(new Set());
  const counterAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const authErrorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showAuthError = (msg: string) => {
    setAuthError(msg);
    clearTimeout(authErrorTimer.current);
    authErrorTimer.current = setTimeout(() => setAuthError(null), 4000);
  };
  const [magicSent, setMagicSent] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const otpInputRefs = useRef<Array<TextInput | null>>([]);
  // Pre-built ref-setters so the JSX gets a stable function per index
  // instead of a fresh inline closure each render. Inline `ref={(r) => ...}`
  // was being torn down (called with null) on every controlled re-render
  // — usually invisible, but combined with `requestAnimationFrame` focus
  // calls it occasionally caught the ref mid-null and the focus jump
  // silently dropped.
  const otpRefSetters = useRef<Array<(r: TextInput | null) => void>>(
    Array.from({ length: 6 }, (_, i) => (r: TextInput | null) => {
      otpInputRefs.current[i] = r;
    }),
  ).current;

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { setLanguage, language, setCurrency } = useSettingsStore();
  const setRegionInStore = useSettingsStore((s) => s.setRegion);
  const setDisplayCurrencyInStore = useSettingsStore((s) => s.setDisplayCurrency);
  const setDisplayCurrencyAutoDetectedInStore = useSettingsStore((s) => s.setDisplayCurrencyAutoDetected);
  const icpSegment = useSettingsStore((s) => s.icpSegment);
  const setIcpSegment = useSettingsStore((s) => s.setIcpSegment);

  // Step 2 (currency) is skipped entirely when the timezone unambiguously
  // maps to a country — picker never renders, no flash, and Back from
  // step 3 jumps to step 1 instead of bouncing through a hidden step 2.
  // Using a synchronous helper instead of a post-render useEffect was
  // required to fix two bugs:
  //   • Bug — Back from step 3 hit setStep(2) → useEffect → setStep(3),
  //     so the user could never reach the currency picker even if their
  //     detected TZ was wrong (VPN / travel).
  //   • Bug — useEffect-based skip painted step 2 for one frame on slow
  //     devices before sweeping it away.
  const gotoStep = useCallback((target: number, direction: 'forward' | 'back' = 'forward') => {
    if (target === 2 && regionAutoDetected) {
      analytics.track('onboarding_step_completed', { step: 2, step_name: 'currency_autoskip' });
      setStep(direction === 'forward' ? 3 : 1);
      return;
    }
    setStep(target);
  }, [regionAutoDetected]);
  const { colors, isDark, toggleTheme } = useTheme();
  const safeInsets = useSafeAreaInsets();

  // Android hardware back: step backward through onboarding instead of exiting
  // the app. Mirrors the on-screen back button's visibility (hidden on the
  // auth/loading/final steps 3-5); on step 0 or a hidden-back step we return
  // false so the OS default (exit) applies.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const canGoBack = step > 0 && step !== 3 && step !== 4 && step !== 5;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        gotoStep(step - 1, 'back');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, gotoStep]);

  // Hide the bottom dots / nav buttons when the keyboard is up so they stop
  // colliding with the OTP inputs on shorter devices. Listening to keyboard
  // events is cheap and only renders once on toggle.
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEv, () => setKeyboardShown(true));
    const subHide = Keyboard.addListener(hideEv, () => setKeyboardShown(false));
    return () => { subShow.remove(); subHide.remove(); };
  }, []);

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
              finishAuth(userData, jwt, refresh);
            } else {
              console.warn('[GoogleAuth] No id/email in response, skipping finishAuth');
              showAuthError('Invalid user data received');
            }
          } catch (err) {
            console.error('[GoogleAuth] Error:', err);
            showAuthError(String(err));
          } finally {
            setLoading(false);
          }
        }
      }
    } catch (e: any) {
      showAuthError(t('auth.google_setup_hint'));
    }
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
    // Backfill подписок, которые юзер тапнул в quick-add (Step 0).
    // Fire-and-forget — навигацию не блокируем, ошибки логируем но не показываем
    // (юзер всё равно увидит дашборд, и если что-то не создалось — добавит вручную).
    const pending = useUIStore.getState().pendingQuickAdd;
    if (pending.length > 0) {
      pending.forEach((item) => {
        subscriptionsApi
          .create({
            name: item.name,
            amount: item.amount,
            currency: selectedCurrency,
            billingPeriod: 'MONTHLY',
            nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .catch((err) => console.warn('[quick-add backfill] failed for', item.name, err?.message));
      });
      useUIStore.getState().clearPendingQuickAdd();
    }
    setOnboarded();
    // Mirror onboarding completion to the server so the backend
    // `onboardingCompleted` column + onboarding-funnel analytics reflect
    // reality. Fire-and-forget — never block navigation on it; old backend
    // builds simply ignored the field (and pre-whitelist-fix backends would
    // 400, which we swallow here).
    usersApi
      .updateMe({ onboardingCompleted: true })
      .catch((err) =>
        console.warn('[onboarding] server sync failed', err?.message),
      );
    router.replace('/(tabs)');
  };

  // Auto-skip notifications step if permission already granted or denied
  useEffect(() => {
    if (step !== 4) return;
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status !== 'undetermined') setStep(5);
    });
  }, [step]);

  // Auto-skip is now handled synchronously via `gotoStep` — see its
  // definition above. The previous useEffect-based version caused two
  // bugs (back-loop + 1-frame flash); deleting it removes both.

  // Counter animation for money hook — персонализируется под ICP сегмент.
  // Solo: $420, Family: $1080, Team: $3600 (based on Bango 2025 / Chase 2024).
  const counterDisplayValue = useRef(0);
  const [counterDisplay, setCounterDisplay] = useState(0);
  const hookIconScale = useRef(new Animated.Value(0.4)).current;
  const hookCounterScale = useRef(new Animated.Value(0.6)).current;
  const hookIconPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (step !== 0) return;
    const target = ICP_WASTE_USD[icpSegment ?? 'solo'];
    analytics.track('onboarding_money_hook_viewed', { icp: icpSegment ?? 'unset', target });
    // Сброс при смене ICP — counter ре-анимируется с новым target'ом.
    counterAnim.setValue(0);
    counterDisplayValue.current = 0;
    setCounterDisplay(0);
    hookIconScale.setValue(0.4);
    hookCounterScale.setValue(0.6);
    // WOW entrance: icon bounce-in + counter scale-up + number roll — все
    // ПАРАЛЛЕЛЬНО, чтобы число начинало крутиться сразу.
    //
    // Раньше count-up был вторым шагом Animated.sequence ЗА пружиной иконки
    // (damping: 7 → ζ≈0.32, недодемпфирована). Sequence ждёт, пока RN сочтёт
    // пружину «в покое» — а она колеблется ~1.5с до rest. Всё это время число
    // визуально висело на 0. Параллель + маленький delay даёт тот же «вау»-беат
    // (иконка хлопает первой), но цифры стартуют через 180мс, а не через ~1.5с.
    Animated.parallel([
      Animated.spring(hookIconScale, { toValue: 1, damping: 7, stiffness: 120, useNativeDriver: true }),
      Animated.spring(hookCounterScale, { toValue: 1, damping: 9, stiffness: 90, useNativeDriver: true }),
      Animated.timing(counterAnim, {
        toValue: target,
        duration: 1800,
        delay: 180,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // Continuous pulse — иконка «дышит», feels alive, удерживает внимание.
      Animated.loop(
        Animated.sequence([
          Animated.timing(hookIconPulse, { toValue: 1.06, duration: 1100, useNativeDriver: true }),
          Animated.timing(hookIconPulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        ]),
      ).start();
    });
    const listener = counterAnim.addListener(({ value }) => {
      const rounded = Math.round(value);
      if (rounded !== counterDisplayValue.current) {
        counterDisplayValue.current = rounded;
        setCounterDisplay(rounded);
      }
    });
    return () => counterAnim.removeListener(listener);
  }, [step, icpSegment]);

  const finishAuth = (user: any, token: string, refreshToken?: string) => {
    if (!user || (!user.id && !user.email)) {
      console.error('[Auth] Invalid user object:', user);
      showAuthError(t('auth.invalid_user', 'Invalid account data received. Please try again.'));
      setLoading(false);
      return;
    }
    setRegionInStore(selectedRegion);
    // When the currency step was auto-skipped (regionAutoDetected),
    // `selectedCurrency` is a timezone-derived guess, not a user choice
    // — persist it WITHOUT flipping `currencyExplicitlySet`. That way a
    // later /users/me hydrate can still overwrite it (e.g. admin fixed
    // the value server-side), and Settings → currency change still
    // upgrades it to an explicit choice. If the picker WAS shown the
    // user did make a deliberate selection → mark it as explicit.
    if (regionAutoDetected) {
      setDisplayCurrencyAutoDetectedInStore(selectedCurrency);
    } else {
      setCurrency(selectedCurrency);
      setDisplayCurrencyInStore(selectedCurrency);
    }
    setUser(user, token, refreshToken);
    setOnboarded();
    // Best-effort sync to backend (non-blocking).
    // Send `locale` here as well so cron-driven push starts in the right language
    // even if the user never opens Settings.
    usersApi
      .updateMe({
        region: selectedRegion,
        displayCurrency: selectedCurrency,
        locale: language,
      })
      .catch(() => {});
    try {
      analytics.identify(user.id, { plan: (user as any).plan, currency: selectedCurrency });
      analytics.track('auth_completed', { method: 'unknown', is_new_user: !user.createdAt || (Date.now() - new Date(user.createdAt).getTime() < 60_000) });
    } catch {}
    // Returning user → straight to Dashboard; new user → notifications step
    if (isOnboarded) {
      router.replace('/(tabs)');
    } else {
      // Skip notifications step if permission already decided
      Notifications.getPermissionsAsync().then(({ status }) => {
        setStep(status === 'undetermined' ? 4 : 5);
      }).catch(() => setStep(4));
    }
  };

  const handleGoogleToken = async (accessToken: string) => {
    setLoading(true);
    try {
      const res = await authApi.loginWithGoogleMobile(accessToken);
      const { user, accessToken: jwt, refreshToken } = res.data;
      finishAuth(user, jwt, refreshToken);
    } catch (e: any) {
      showAuthError(e?.response?.data?.message || t('auth.google_login_failed'));
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
        showAuthError(t('auth.apple_no_token', 'No identity token received from Apple. Please try again.'));
        setLoading(false);
        return;
      }
      const res = await authApi.loginWithApple(credential.identityToken);
      const { user, accessToken: jwt, refreshToken } = res.data;
      finishAuth(user, jwt, refreshToken);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        showAuthError(e?.response?.data?.message || t('auth.apple_login_failed'));
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

  // `emailArg` is a string when called from the isolated EmailEntryView
  // (send button / return key). The OTP-sent "resend" button wires this to
  // TouchableOpacity.onPress, which passes a GestureResponderEvent — guard
  // against that by only accepting a string, otherwise fall back to the
  // lifted `email` state (already set from the first send).
  const handleSendOtp = async (emailArg?: unknown) => {
    const targetEmail = (typeof emailArg === 'string' ? emailArg : email).trim();
    if (!targetEmail.includes('@')) {
      Alert.alert('', t('onboarding.invalid_email'));
      return;
    }
    // Lift the draft so the OTP screen ("code sent to {email}") and
    // verifyOtp read the same address the user typed.
    if (targetEmail !== email) setEmail(targetEmail);
    setLoading(true);
    try {
      console.log('[OTP] Sending to:', targetEmail);
      await authApi.sendOtp(targetEmail);
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
      finishAuth(user, jwt, refreshToken);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = status === 429
        ? t('auth.too_many_attempts', 'Too many attempts. Wait a moment.')
        : (e?.response?.data?.message || t('auth.invalid_code'));
      showAuthError(msg);
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  // Functional setState — `otpCode` from closure can lag behind several
  // rapid keystrokes (auto-fill, fast manual typing). Reading `prev` from
  // the updater guarantees we never drop a digit.
  //
  // Focus moves are deferred to `requestAnimationFrame` so the next field
  // is focused AFTER React commits the new code. Calling `.focus()` in the
  // same tick as `setOtpCode` raced with the controlled `value` update and
  // sporadically dropped the caret back to the previous field.
  const handleOtpDigitChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(0, 1);
    setOtpCode((prev) => {
      const arr = prev.split('');
      arr[index] = digit;
      return arr.join('').slice(0, 6);
    });
    if (digit && index < 5) {
      requestAnimationFrame(() => {
        otpInputRefs.current[index + 1]?.focus();
      });
    }
  };

  // Backspace UX: with the old handler, deleting a filled digit required
  // two presses — the first cleared the field, the second moved focus
  // back. We now handle both states in one keystroke by reading the live
  // value through the setState updater.
  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (index === 0) return;
    setOtpCode((prev) => {
      if (prev[index]) {
        // Field has a digit — clear it, stay focused here for the
        // ergonomic "one press, one delete" behaviour.
        const arr = prev.split('');
        arr[index] = '';
        return arr.join('');
      }
      // Empty field — focus moves to prev and clears it in one stroke.
      requestAnimationFrame(() => {
        otpInputRefs.current[index - 1]?.focus();
      });
      const arr = prev.split('');
      arr[index - 1] = '';
      return arr.join('');
    });
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
      showAuthError(e?.response?.data?.message || t('auth.failed_send_link'));
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

  // Showcase cards анимация триггерится на Step 1 (Value Preview screen).
  useEffect(() => {
    if (step === 1) {
      // Reset before animating — иначе при backjump'е карточки уже стоят.
      showcaseOpacity.setValue(0);
      showcaseTranslateY.setValue(30);
      card1Scale.setValue(0.85);
      card2Scale.setValue(0.85);
      card3Scale.setValue(0.85);
      card4Scale.setValue(0.85);
      Animated.parallel([
        Animated.timing(showcaseOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(showcaseTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.spring(card1Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(180),
          Animated.spring(card2Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(260),
          Animated.spring(card3Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(340),
          Animated.spring(card4Scale, { toValue: 1, damping: 10, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [step]);

  // Replaced the dense hand-drawn SVGs (sparkle clusters, bell+badge,
  // bar+trend, three-person stack) with clean Ionicons tiles. The SVGs
  // packed too much visual noise into a 48×48 tile and made the four
  // cards compete with the headline / chips. A simple icon on a flat
  // colour reads as confident and category-defining, which is what
  // these cards need to do at a glance.
  const SHOWCASE_FEATURES = [
    { icon: 'sparkles' as const,      color: '#7C3AED', title: t('onboarding.showcase_ai_title'),        desc: t('onboarding.showcase_ai_desc'),        scale: card1Scale },
    { icon: 'notifications' as const, color: '#F59E0B', title: t('onboarding.showcase_notify_title'),    desc: t('onboarding.showcase_notify_desc'),    scale: card2Scale },
    { icon: 'bar-chart' as const,     color: '#10B981', title: t('onboarding.showcase_analytics_title'), desc: t('onboarding.showcase_analytics_desc'), scale: card3Scale },
    { icon: 'people' as const,        color: '#3B82F6', title: t('onboarding.showcase_team_title'),      desc: t('onboarding.showcase_team_desc'),      scale: card4Scale },
  ];

  const steps = [
    // Step 0: Money Loss Hook + Quick-Add
    <View key="money_hook" style={styles.step}>
      {/* Header */}
      <View style={{ alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Animated.View style={{
          width: 92, height: 92,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#F59E0B', shadowOpacity: isDark ? 0.4 : 0.22, shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          transform: [
            { scale: Animated.multiply(hookIconScale, hookIconPulse) as unknown as Animated.AnimatedInterpolation<number> },
          ],
        }}>
          <MoneyLossIcon isDark={isDark} />
        </Animated.View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444', letterSpacing: 1, textTransform: 'uppercase' }}>
          {icpSegment === 'family'
            ? t('onboarding.hook_eyebrow_family', 'The average family wastes')
            : icpSegment === 'team'
            ? t('onboarding.hook_eyebrow_team', 'The average team wastes')
            : t('onboarding.hook_eyebrow', 'The average person wastes')}
        </Text>
        {/* Animated counter — масштабируется при появлении (WOW) */}
        <Animated.View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, transform: [{ scale: hookCounterScale }], maxWidth: '100%' }}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.6}
            maxFontSizeMultiplier={1.1}
            style={{ fontSize: 64, fontWeight: '900', color: colors.text, letterSpacing: -1, fontFamily: 'Inter-ExtraBold' }}
          >
            ${counterDisplay.toLocaleString()}
          </Text>
          <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 20, fontWeight: '700', color: colors.textSecondary, paddingBottom: 12 }}>
            /{t('paywall.year', 'yr')}
          </Text>
        </Animated.View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
          {icpSegment === 'family'
            ? t('onboarding.hook_subtitle_family', 'on subscriptions someone forgot to cancel.\nHow much is your family bleeding?')
            : icpSegment === 'team'
            ? t('onboarding.hook_subtitle_team', 'on tools nobody uses anymore.\nWhat\'s your team paying for?')
            : t('onboarding.hook_subtitle', 'on subscriptions they forgot about.\nHow many do YOU have?')}
        </Text>
        {/* Social proof — trust signal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Text style={{ fontSize: 12, color: '#F59E0B', letterSpacing: 1 }}>★★★★★</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted }}>
            {t('onboarding.hook_social_proof', 'Loved by thousands tracking smarter')}
          </Text>
        </View>
      </View>

      {/* ICP chip selector — drives conditional experience downstream */}
      <View style={{ alignItems: 'center', marginTop: 6, gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {t('onboarding.icp_label', 'Who tracks subscriptions?')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['solo', 'family', 'team'] as const).map((seg) => {
            const isSel = icpSegment === seg;
            const emoji = seg === 'solo' ? '🙋' : seg === 'family' ? '👨‍👩‍👧' : '💼';
            const label = t(`onboarding.icp_${seg}`, { defaultValue: seg === 'solo' ? 'Just me' : seg === 'family' ? 'My family' : 'Our team' });
            return (
              <TouchableOpacity
                key={seg}
                onPress={() => {
                  setIcpSegment(seg);
                  analytics.track('icp_selected', { segment: seg });
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: isSel ? colors.primary : (isDark ? '#2A2A3E' : '#E5E7EB'),
                  backgroundColor: isSel ? colors.primary + '18' : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13 }}>{emoji}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isSel ? colors.primary : colors.textSecondary }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
          // Persist выбранные сервисы — добавим на Step 5 / Dashboard.
          const picked = QUICK_ADD_SERVICES
            .filter((s) => quickAddSelected.has(s.name) && s.amount > 0)
            .map((s) => ({ name: s.name, amount: s.amount }));
          if (picked.length > 0) {
            useUIStore.getState().setPendingQuickAdd(picked);
          }
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
    </View>,

    // Step 1: Value Preview (заменил Language picker — i18n autodetect через
    // expo-localization, юзер меняет язык в Settings). Highest-conversion
    // booster: показываем value до sign-up gate.
    <Animated.View
      key="value_preview"
      testID="step-value-preview"
      style={[styles.step, { opacity: showcaseOpacity, transform: [{ translateY: showcaseTranslateY }] }]}
    >
      <Animated.View style={[styles.logoContainer, logoStyle, { marginBottom: 4, gap: 4 }]}>
        <Image source={require('../assets/images/icon.png')} style={[styles.logoImage, { width: 64, height: 64, borderRadius: 16 }]} />
        <Text style={[styles.logoTitle, { color: colors.text, fontSize: 22 }]}>SubRadar</Text>
      </Animated.View>
      {/* Headline downsized to 20 + adjustsFontSizeToFit so the Russian
          "Всё, чтобы перестать терять деньги" (and similarly long de/pt/ar)
          stays on one line on standard phones, with auto-shrink for the
          edge cases (huge accessibility font scale, narrow Mini class). */}
      <Text
        adjustsFontSizeToFit
        numberOfLines={2}
        minimumFontScale={0.85}
        style={[styles.headline, { color: colors.text, textAlign: 'center', fontSize: 20, lineHeight: 26 }]}
      >
        {t('onboarding.value_preview_title', 'Everything to stop the bleeding')}
      </Text>
      <Text style={[styles.subheadline, { color: colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 }]}>
        {t('onboarding.value_preview_subtitle', 'AI tracks every subscription, you keep the money')}
      </Text>
      <View style={styles.showcaseGrid}>
        {SHOWCASE_FEATURES.map((f, i) => (
          <Animated.View
            key={i}
            style={[
              styles.showcaseCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: f.scale }],
              },
            ]}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: f.color, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={f.icon} size={22} color="#FFF" />
            </View>
            <Text style={[styles.showcaseCardTitle, { color: colors.text }]} numberOfLines={1}>{f.title}</Text>
            <Text style={[styles.showcaseCardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{f.desc}</Text>
          </Animated.View>
        ))}
      </View>
      {/* Auto-detected region confirmation. Shown only when TZ unambiguously
          mapped to a country — otherwise the user reaches the full currency
          picker on Step 2 anyway. Tapping opens the same picker used on
          Step 2 so a misdetected region (VPN/roaming) is one tap away. */}
      {regionAutoDetected && (() => {
        const regionInfo = COUNTRIES.find((c) => c.code === selectedRegion);
        return (
          <TouchableOpacity
            testID="onboarding-region-autodetect-chip"
            onPress={() => {
              analytics.track('onboarding_region_autodetect_tapped', {
                region: selectedRegion,
                currency: selectedCurrency,
              });
              setRegionPickerVisible(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 16 }}>{regionInfo?.flag ?? '🌐'}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
              {t('onboarding.region_autodetected', {
                country: regionInfo?.name ?? selectedRegion,
                currency: selectedCurrency,
                defaultValue: 'Detected: {{country}} · {{currency}}',
              })}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })()}
      {/* Language chip — мобила всегда детектит язык через expo-localization,
          поэтому chip показываем всегда. Для итальянца с итальянским iPhone
          здесь будет 🇮🇹 Italian, тапом откроется picker с возможностью
          переключиться. Без этого юзер не понимает, что app выбрал язык
          автоматически и его можно поменять — а для нескольких langs у нас
          нет переводов 1:1 с device locale (детектируется hi → fallback en). */}
      {(() => {
        const langInfo = LANGUAGES.find((l) => l.code === language);
        if (!langInfo) return null;
        return (
          <TouchableOpacity
            testID="onboarding-language-chip"
            onPress={() => {
              analytics.track('onboarding_language_chip_tapped', { language });
              setLanguagePickerVisible(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginTop: 6,
            }}
          >
            <Text style={{ fontSize: 16 }}>{langInfo.flag}</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
              {langInfo.label}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })()}
      <TouchableOpacity
        testID="btn-value-preview-continue"
        style={[styles.showcaseBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
        onPress={() => {
          analytics.track('onboarding_step_completed', { step: 1, step_name: 'value_preview' });
          gotoStep(2, 'forward');
        }}
      >
        <Text style={styles.showcaseBtnText}>
          {t('onboarding.value_preview_cta', 'Continue')}
        </Text>
      </TouchableOpacity>
    </Animated.View>,

    // Step 2: Currency
    <View key="currency" testID="step-currency" style={styles.step}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        {/* Премиум-иллюстрация: globe с накладывающимися currency-кружками —
            namespacing подписок без mismash цветов. */}
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id="globeBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={isDark ? '#3C19A0' : '#8B5CF6'} stopOpacity="0.18" />
              <Stop offset="1" stopColor={isDark ? '#7C3AED' : '#7C3AED'} stopOpacity="0.08" />
            </LinearGradient>
            <LinearGradient id="globeMain" x1="0.3" y1="0" x2="0.7" y2="1">
              <Stop offset="0" stopColor="#A78BFA" />
              <Stop offset="1" stopColor="#6B33D9" />
            </LinearGradient>
          </Defs>
          {/* Soft halo */}
          <Circle cx="60" cy="60" r="58" fill="url(#globeBg)" />
          {/* Main coin/globe */}
          <Circle cx="60" cy="60" r="40" fill="url(#globeMain)" />
          {/* Top gloss */}
          <Ellipse cx="60" cy="44" rx="28" ry="14" fill="#FFFFFF" opacity="0.25" />
          {/* Equator + meridian — лёгкие штрихи globe */}
          <Ellipse cx="60" cy="60" rx="40" ry="14" fill="none" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="1" />
          <Ellipse cx="60" cy="60" rx="14" ry="40" fill="none" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1" />
          {/* Center $ — primary currency */}
          <SvgText x="60" y="71" textAnchor="middle" fontSize="32" fontWeight="900" fill="#FFFFFF">$</SvgText>
          {/* Satellite currencies — distinct positions, less clutter */}
          <Circle cx="102" cy="32" r="11" fill={isDark ? '#1C1C2E' : '#FFFFFF'} stroke="#7C3AED" strokeWidth="2" />
          <SvgText x="102" y="36" textAnchor="middle" fontSize="11" fontWeight="800" fill="#7C3AED">€</SvgText>
          <Circle cx="20" cy="88" r="10" fill={isDark ? '#1C1C2E' : '#FFFFFF'} stroke="#7C3AED" strokeWidth="2" />
          <SvgText x="20" y="92" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7C3AED">£</SvgText>
        </Svg>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.region_title', 'Where do you buy subscriptions?')}</Text>
      <Text style={[styles.subheadline, { color: colors.textSecondary }]}>{t('onboarding.region_subtitle', 'So prices stay accurate for you.')}</Text>

      {/* Region selector */}
      {(() => {
        const regionInfo = COUNTRIES.find((c) => c.code === selectedRegion);
        return (
          <TouchableOpacity
            testID="onboarding-region-select"
            onPress={() => setRegionPickerVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 36 }}>{regionInfo?.flag ?? '🌐'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {t('settings.region', 'Region')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 }} numberOfLines={1}>
                {regionInfo?.name ?? selectedRegion}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })()}

      <Text style={[styles.subheadline, { color: colors.textSecondary, marginTop: 4 }]}>{t('onboarding.choose_currency')}</Text>
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
    // ВАЖНО: НЕ ставить `justifyContent: 'center'` — KAV выше использует
    // `behavior="padding"`, и при появлении клавиатуры контейнер сжимается,
    // re-center подбрасывает AuthHero и инпуты ("сильный глюк"). Якорим
    // содержимое сверху с небольшим paddingTop, чтобы визуально не уехало
    // от центра без клавиатуры.
    <View key="auth" testID="step-auth" style={[styles.step, { flex: 1, justifyContent: 'flex-start', paddingTop: 24, paddingBottom: 8 }]}>
      <AuthHero />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {!otpMode ? (
        <>
          <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 4, letterSpacing: -0.5 }}>
            SubRadar
          </Text>
          {/* Value bullets — последний шанс продать ценность перед sign-up */}
          <View style={{ alignItems: 'center', gap: 6, marginBottom: 20 }}>
            {[
              { icon: 'sparkles', text: t('onboarding.auth_perk_ai', { defaultValue: t('onboarding.showcase_ai_title') }) },
              { icon: 'notifications', text: t('onboarding.auth_perk_alerts', { defaultValue: t('onboarding.showcase_notify_title') }) },
              { icon: 'shield-checkmark', text: t('onboarding.auth_perk_privacy', { defaultValue: 'Bank-grade privacy — your data is yours' }) },
            ].map((perk, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={perk.icon as any} size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{perk.text}</Text>
              </View>
            ))}
          </View>
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
                ref={otpRefSetters[index]}
                testID={`otp-input-${index}`}
                style={[styles.otpDigitInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, otpCode[index] ? styles.otpDigitFilled : null]}
                value={otpCode[index] || ''}
                onChangeText={(text) => {
                  // Принимаем любой ввод длиннее 1 как paste (а не только
                  // ровно 6 цифр через regex — раньше "12 34 56" / поверх
                  // существующей цифры / частичные коды не срабатывали).
                  // Чистим всё кроме цифр и распределяем по полям.
                  const digits = text.replace(/\D/g, '');
                  if (digits.length >= 2) {
                    const code = digits.slice(0, 6);
                    setOtpCode(code);
                    const target = Math.min(code.length, 5);
                    requestAnimationFrame(() => {
                      otpInputRefs.current[target]?.focus();
                    });
                    return;
                  }
                  handleOtpDigitChange(digits, index);
                }}
                onKeyPress={(e) => handleOtpKeyPress(e, index)}
                keyboardType="number-pad"
                keyboardAppearance={isDark ? 'dark' : 'light'}
                // Один InputAccessoryView на 6 переключающихся фокусов —
                // источник iOS RTI sessionID-конфликтов и "System gesture
                // gate timed out". Number-pad и без Done закрывается тапом
                // вне поля. Поэтому здесь обычный TextInput, не
                // DoneAccessoryInput.
                // maxLength чуть больше 6: даёт пасту с разделителями
                // ("12 34 56", "123-456") пройти целиком — handler выше
                // сам выкинет не-цифры и возьмёт первые 6. Отображается
                // всегда 1 цифра через `value={otpCode[index]}`.
                maxLength={20}
                // `selectTextOnFocus` removed — combined with programmatic
                // `.focus()` it flashed the previous digit as selected for
                // one frame before the new keystroke replaced it. On rapid
                // typing this looked like the caret was bouncing.
                // iOS-autofill SMS-кода: достаточно повесить только на
                // первое поле — дальше iOS сам распределит цифры.
                textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
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
        <EmailEntryView
          initialEmail={email}
          loading={loading}
          onSubmit={handleSendOtp}
          onBack={() => setOtpMode(false)}
        />
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
    <View key="notifications" testID="step-notifications" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
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
        testID="btn-notifications-enable"
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

      <TouchableOpacity testID="btn-notifications-skip" onPress={() => { analytics.notificationPermission(false); setStep(step + 1); }} style={{ paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: '600' }}>{t('onboarding.maybe_later', 'Maybe later')}</Text>
      </TouchableOpacity>
    </View>,

    // Step 5: Add first subscription
    (() => {
      const pending = useUIStore.getState().pendingQuickAdd;
      const hasPicks = pending.length > 0;
      return (
        <View key="first_sub" testID="step-first-sub" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
            <Ionicons name={hasPicks ? 'checkmark-circle' : 'add-circle'} size={56} color={colors.primary} />
          </View>

          <Text style={[styles.headline, { textAlign: 'center', color: colors.text }]}>
            {hasPicks
              ? t('onboarding.first_sub_title_picked', { count: pending.length, defaultValue: `Adding your ${pending.length} pick${pending.length > 1 ? 's' : ''}` })
              : t('onboarding.first_sub_title')}
          </Text>
          <Text style={[styles.subheadline, { textAlign: 'center', color: colors.textSecondary, marginBottom: 16 }]}>
            {hasPicks
              ? t('onboarding.first_sub_subtitle_picked', {
                  names: `${pending.map((p) => p.name).slice(0, 3).join(', ')}${pending.length > 3 ? '…' : ''}`,
                  defaultValue: `${pending.map((p) => p.name).slice(0, 3).join(', ')}${pending.length > 3 ? '…' : ''} — find the rest with AI`,
                })
              : t('onboarding.first_sub_subtitle')}
          </Text>

          {/* Buttons */}
          <TouchableOpacity
            testID="btn-first-sub-ai"
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
            testID="btn-first-sub-manual"
            style={{ width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={() => {
              useUIStore.getState().openAddSheet();
              navigateToApp();
            }}
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.primary }}>{t('onboarding.add_manually')}</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="btn-first-sub-skip" onPress={() => navigateToApp()} style={{ paddingVertical: 12 }}>
            <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: '600' }}>
              {hasPicks ? t('onboarding.done_for_now', { defaultValue: "I'm done for now" }) : t('onboarding.skip_for_now')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    })(),
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Theme toggle убран из онбординга — distraction в hot funnel.
          Доступен в Settings. */}
      {/* ScrollView вместо фиксированного View: на маленьких экранах
          (iPhone SE 1st gen, mini'ах с увеличенным шрифтом, Android
          до 5") контент шага не помещается — раньше logoContainer
          уезжал под status bar, а нижние chip'ы / CTA обрезались без
          возможности доскроллить. flexGrow + justifyContent: 'center'
          сохраняет вертикальное центрирование для больших экранов,
          а на маленьких просто включается скролл.
          paddingTop через safeInsets фиксит конкретный кейс «лого под
          шапкой» — у нас нет SafeAreaView edges=['top'] поверх. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, paddingTop: safeInsets.top + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
      >
        {steps[step]}
      </ScrollView>

      {/* CountryPicker рендерим на корневом уровне, а не внутри step-3 (auth),
          чтобы chip с auto-detected region на Step 1 мог его открыть. */}
      <CountryPicker
        visible={regionPickerVisible}
        selectedCode={selectedRegion}
        title={t('onboarding.region_title', 'Where do you buy subscriptions?')}
        onClose={() => setRegionPickerVisible(false)}
        onSelect={(code) => {
          setSelectedRegion(code);
          const suggested = COUNTRY_DEFAULT_CURRENCY[code];
          if (suggested) setSelectedCurrency(suggested);
          analytics.track('region_selected', { region: code, suggested_currency: suggested ?? null });
        }}
      />

      <LanguagePicker
        visible={languagePickerVisible}
        selectedCode={language}
        title={t('onboarding.choose_language', 'Choose your language')}
        onClose={() => setLanguagePickerVisible(false)}
        onSelect={(code) => {
          setLanguage(code);
          analytics.track('onboarding_language_selected', { language: code });
        }}
      />

      {/* Hide the whole footer (pagination dots + back/next) while the
          keyboard is up. On the OTP step the dots used to sit on top of the
          verify button on shorter devices, and the number-pad has no Done
          accessory — tapping outside is the only way to close it, so we
          let the content area swallow taps. */}
      {!keyboardShown && (
        <View
          style={[
            styles.footer,
            // Android: clear the system navigation bar (edge-to-edge draws the
            // footer behind it, cutting off the Continue/Next buttons). iOS keeps
            // its tuned paddingBottom:40 (home indicator fits within it).
            Platform.OS === 'android' && {
              paddingBottom: safeInsets.bottom + 20,
            },
          ]}
        >
          {/* Pagination dots — только в configuration steps (0-2). На terminal
              screens (auth/notifications/first_sub) убираем visual noise. */}
          {step < 3 && (
            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: colors.border }, step === i && [styles.dotActive, { backgroundColor: colors.primary }]]} />
              ))}
            </View>
          )}

          {step > 0 && step !== 3 && step !== 4 && step !== 5 && (
            <View style={styles.footerBtns}>
              {step > 1 && (
                <TouchableOpacity testID="btn-back" style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => gotoStep(step - 1, 'back')}>
                  <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{t('common.back')}</Text>
                </TouchableOpacity>
              )}
              {step < steps.length - 1 && step !== 3 && (
                <TouchableOpacity testID="btn-next" style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={() => gotoStep(step + 1, 'forward')}>
                  <Text style={styles.nextBtnText}>{t('onboarding.next')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {authError && (
        <View style={{ position: 'absolute', bottom: 40, left: 16, right: 16, backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 }}>
          <Ionicons name="alert-circle" size={20} color="#FFF" />
          <Text style={{ flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600' }} numberOfLines={2}>{authError}</Text>
          <TouchableOpacity onPress={() => setAuthError(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={18} color="#FFFFFF99" />
          </TouchableOpacity>
        </View>
      )}
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
  showcaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  showcaseCard: { width: '47%', borderRadius: 16, borderWidth: 1, padding: 12, gap: 6, alignItems: 'center' },
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
  otpInputRow: { flexDirection: 'row', gap: isSmallScreen ? 6 : 8, justifyContent: 'center' },
  otpDigitInput: { width: scale(48), height: scale(56), borderRadius: 12, borderWidth: 1.5, textAlign: 'center', fontSize: ms(22), fontWeight: '700' },
  otpDigitFilled: {},
  emailBtnDisabled: { opacity: 0.5 },
  otpTimerText: { fontSize: 13, textAlign: 'center' },
  otpResendText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  otpBackText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
