# Team Upsell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Team plan upsell — inline cards in 3 places + one-time full-screen modal + 5 reinforcement points, all i18n.

**Architecture:** Pure UI/UX work. No backend changes. No payment flow changes. New `TeamUpsellModal` component, conditional rendering in existing screens, AsyncStorage flags, analytics events.

**Tech Stack:** React Native, Expo Router, react-i18next, AsyncStorage, expo-linear-gradient.

---

## Task 1: i18n keys (10 locales)

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/ru.json`
- Modify: `src/locales/kk.json`, `de.json`, `fr.json`, `es.json`, `zh.json`, `ja.json`, `ko.json`, `pt.json`

- [ ] **Step 1: Add `team_upsell` section to en.json**

Add at top level (after `"billing"` block):

```json
  "team_upsell": {
    "modal_title": "Paying for everyone? Split the bill.",
    "modal_subtitle": "Save up to 75% — split subscriptions with team or family",
    "current_spend_label": "You spend",
    "split_label": "Split between 4 people",
    "per_person_label": "Per person",
    "yearly_savings": "{{amount}}/year savings",
    "benefit_family_title": "Everyone in sync",
    "benefit_family_desc": "All subscriptions visible to the whole team",
    "benefit_no_dupes_title": "No duplicate subs",
    "benefit_no_dupes_desc": "Spot when someone already pays for Netflix",
    "benefit_ai_title": "1000 AI requests",
    "benefit_ai_desc": "5x more than Pro",
    "price_hint": "$9.99/mo — less than one subscription",
    "cta_create_team": "Create Team — $9.99/mo",
    "cta_later": "Maybe later",
    "disclaimer": "Cancel anytime",
    "dashboard_title": "Split & Save",
    "dashboard_dynamic": "Sharing with 4 people? Save {{amount}}/year",
    "analytics_title": "Save with Team",
    "analytics_current": "Now {{amount}}/mo",
    "analytics_with_team": "With Team {{amount}}/mo per person",
    "analytics_yearly": "{{amount}}/year savings",
    "dupe_banner": "Found {{count}} subs in {{category}}. Enable Team",
    "detail_hint": "Family also has {{name}}? Find duplicates with Team",
    "ai_limit_team_cta": "Upgrade to Team — 1000 AI",
    "ai_limit_wait": "Wait until next month",
    "workspace_hero": "You spend {{amount}}/mo on subs",
    "workspace_split": "With Team you'd split to {{amount}}",
    "save_vs_separate": "Save {{amount}}/year"
  },
```

- [ ] **Step 2: Add `team_upsell` to ru.json**

```json
  "team_upsell": {
    "modal_title": "Платишь за всех? Раздели.",
    "modal_subtitle": "Сэкономь до 75% — раздели подписки с командой или семьёй",
    "current_spend_label": "Ты тратишь",
    "split_label": "Делится на 4 человек",
    "per_person_label": "На каждого",
    "yearly_savings": "{{amount}}/год экономии",
    "benefit_family_title": "Семья на одной странице",
    "benefit_family_desc": "Все подписки видны всей команде",
    "benefit_no_dupes_title": "Без дублей подписок",
    "benefit_no_dupes_desc": "Найди когда кто-то уже платит за Netflix",
    "benefit_ai_title": "1000 AI запросов",
    "benefit_ai_desc": "В 5 раз больше чем на Pro",
    "price_hint": "$9.99/мес — меньше одной подписки",
    "cta_create_team": "Создать команду — $9.99/мес",
    "cta_later": "Может позже",
    "disclaimer": "Можно отменить в любой момент",
    "dashboard_title": "Раздели и сэкономь",
    "dashboard_dynamic": "Делишь с 4 людьми? Сэкономь {{amount}}/год",
    "analytics_title": "Сэкономь с Team",
    "analytics_current": "Сейчас {{amount}}/мес",
    "analytics_with_team": "С Team {{amount}}/мес на каждого",
    "analytics_yearly": "Экономия {{amount}}/год",
    "dupe_banner": "Найдено {{count}} подписок на {{category}}. Включи Team",
    "detail_hint": "Есть другие в семье с {{name}}? Найди дубли с Team",
    "ai_limit_team_cta": "Перейти на Team — 1000 AI",
    "ai_limit_wait": "Подождать до следующего месяца",
    "workspace_hero": "Ты тратишь {{amount}}/мес на подписки",
    "workspace_split": "С Team разделил бы на {{amount}}",
    "save_vs_separate": "Экономия {{amount}}/год"
  },
```

- [ ] **Step 3: Add team_upsell to remaining 8 locales**

For kk/de/fr/es/zh/ja/ko/pt — use English values from Step 1 as fallback (translate later via translation service or manually). The block structure is identical.

Quick approach: Use the same English keys but localize key strings. For brevity in this plan, use English fallback in non-en/ru locales — i18n will fallback to English if key missing.

- [ ] **Step 4: Verify all 10 locales have valid JSON**

Run for each locale:
```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
for f in src/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "INVALID: $f"; done
```
Expected: no INVALID lines

- [ ] **Step 5: Commit**

```bash
git add src/locales/
git commit -m "i18n(team-upsell): add team upsell translation keys to all locales"
```

---

## Task 2: TeamUpsellModal component

**Files:**
- Create: `src/components/TeamUpsellModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, fonts } from '../theme';
import { SafeLinearGradient } from './SafeLinearGradient';

interface Props {
  visible: boolean;
  monthlySpend: number;
  currency: string;
  onCreateTeam: () => void;
  onLater: () => void;
}

export function TeamUpsellModal({ visible, monthlySpend, currency, onCreateTeam, onLater }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const counterAnim = useRef(new Animated.Value(0)).current;
  const [counter, setCounter] = React.useState(0);

  // Calculations
  const perPerson = Math.round((monthlySpend / 4) * 100) / 100;
  const yearlySavings = Math.round(monthlySpend * 12 * 0.75);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 18, useNativeDriver: true }),
      ]).start();

      counterAnim.setValue(0);
      Animated.timing(counterAnim, { toValue: monthlySpend, duration: 1200, useNativeDriver: false }).start();
      const id = counterAnim.addListener(({ value }) => setCounter(Math.round(value * 100) / 100));
      return () => counterAnim.removeListener(id);
    } else {
      opacityAnim.setValue(0);
      slideAnim.setValue(40);
    }
  }, [visible, monthlySpend]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onLater}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Close */}
            <TouchableOpacity style={styles.closeBtn} onPress={onLater}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Hero icon */}
            <View style={[styles.iconCircle, { backgroundColor: '#06B6D420' }]}>
              <Ionicons name="people" size={36} color="#06B6D4" />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              {t('team_upsell.modal_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('team_upsell.modal_subtitle')}
            </Text>

            {/* Spend calculation */}
            <View style={[styles.calcCard, { backgroundColor: isDark ? '#1A1A2E' : '#F0F4FF' }]}>
              <Text style={[styles.calcLabel, { color: colors.textMuted }]}>
                {t('team_upsell.current_spend_label')}
              </Text>
              <Text style={[styles.spendAmount, { color: colors.text }]}>
                {currency} {counter.toFixed(2)}/mo
              </Text>
              <View style={styles.divider} />
              <Text style={[styles.calcLabel, { color: colors.textMuted }]}>
                {t('team_upsell.per_person_label')}
              </Text>
              <Text style={[styles.perPersonAmount, { color: '#06B6D4' }]}>
                {currency} {perPerson.toFixed(2)}/mo
              </Text>
              <Text style={[styles.savingsBadge, { color: '#22C55E' }]}>
                {t('team_upsell.yearly_savings', { amount: `${currency} ${yearlySavings}` })}
              </Text>
            </View>

            {/* Benefits */}
            <View style={styles.benefits}>
              {[
                { icon: 'people-circle' as const, key: 'family' },
                { icon: 'search' as const, key: 'no_dupes' },
                { icon: 'sparkles' as const, key: 'ai' },
              ].map((b) => (
                <View key={b.key} style={styles.benefitRow}>
                  <View style={[styles.benefitIcon, { backgroundColor: '#06B6D415' }]}>
                    <Ionicons name={b.icon} size={20} color="#06B6D4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>
                      {t(`team_upsell.benefit_${b.key}_title`)}
                    </Text>
                    <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                      {t(`team_upsell.benefit_${b.key}_desc`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Price hint */}
            <Text style={[styles.priceHint, { color: colors.textMuted }]}>
              {t('team_upsell.price_hint')}
            </Text>

            {/* CTA */}
            <TouchableOpacity onPress={onCreateTeam} activeOpacity={0.85}>
              <SafeLinearGradient
                colors={['#06B6D4', '#0EA5E9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{t('team_upsell.cta_create_team')}</Text>
              </SafeLinearGradient>
            </TouchableOpacity>

            {/* Later */}
            <TouchableOpacity onPress={onLater} style={styles.laterBtn}>
              <Text style={[styles.laterText, { color: colors.textMuted }]}>
                {t('team_upsell.cta_later')}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              {t('team_upsell.disclaimer')}
            </Text>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingHorizontal: 20, maxHeight: '92%' },
  closeBtn: { position: 'absolute', top: 8, right: 12, padding: 8, zIndex: 10 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 8, marginBottom: 16 },
  title: { fontSize: 24, fontFamily: fonts.extraBold, textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 12 },
  calcCard: { borderRadius: 16, padding: 18, marginBottom: 18, alignItems: 'center' },
  calcLabel: { fontSize: 11, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  spendAmount: { fontSize: 28, fontFamily: fonts.bold, marginBottom: 12 },
  divider: { width: 40, height: 2, backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: 4, borderRadius: 1 },
  perPersonAmount: { fontSize: 32, fontFamily: fonts.extraBold, marginVertical: 4 },
  savingsBadge: { fontSize: 13, fontFamily: fonts.bold, marginTop: 6 },
  benefits: { gap: 12, marginBottom: 18 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { fontSize: 14, fontFamily: fonts.semiBold },
  benefitDesc: { fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  priceHint: { fontSize: 12, fontFamily: fonts.medium, textAlign: 'center', marginBottom: 12 },
  cta: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: '#06B6D4', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  ctaText: { fontSize: 16, fontFamily: fonts.bold, color: '#FFF', letterSpacing: 0.2 },
  laterBtn: { alignItems: 'center', paddingVertical: 14 },
  laterText: { fontSize: 14, fontFamily: fonts.semiBold, opacity: 0.6 },
  disclaimer: { fontSize: 11, fontFamily: fonts.regular, textAlign: 'center', opacity: 0.5 },
});
```

- [ ] **Step 2: tsc check**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/TeamUpsellModal.tsx
git commit -m "feat(team-upsell): add TeamUpsellModal component with savings calculator"
```

---

## Task 3: Modal trigger logic in dashboard

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Add modal state and trigger useEffect**

After the existing `showTrialOffer` state and before `useEffect` blocks, add state:

```tsx
const [showTeamUpsell, setShowTeamUpsell] = React.useState(false);
```

Add new useEffect after the TrialOfferModal trigger:

```tsx
// Show TeamUpsellModal once when Pro user hits a "moment of truth"
useEffect(() => {
  if (loading) return;
  const isPro = billing?.plan === 'pro';
  const isTeam = billing?.plan === 'organization';
  if (!isPro || isTeam) return;

  const duplicateCount = duplicateCategories.length;
  const subsCount = activeSubs.length;
  const triggers = subsCount >= 8 || duplicateCount >= 2 || totalMonthly >= 50;
  if (!triggers) return;

  AsyncStorage.getItem('team_modal_shown_v1').then((val) => {
    if (val) return;
    setShowTeamUpsell(true);
    AsyncStorage.setItem('team_modal_shown_v1', '1');
    AsyncStorage.setItem('team_modal_dismissed_at', new Date().toISOString());
    const trigger = duplicateCount >= 2 ? 'duplicates' : subsCount >= 8 ? 'subs_count' : 'spend';
    analytics.track('team_upsell_modal_shown', { trigger });
  });
}, [loading, billing?.plan, activeSubs.length, duplicateCategories.length, totalMonthly]);
```

- [ ] **Step 2: Import TeamUpsellModal**

Add to imports:
```tsx
import { TeamUpsellModal } from '../../src/components/TeamUpsellModal';
```

- [ ] **Step 3: Render modal at end of SafeAreaView**

After `<TrialOfferModal>` and before closing `</SafeAreaView>`, add:

```tsx
<TeamUpsellModal
  visible={showTeamUpsell}
  monthlySpend={totalMonthly}
  currency={currency}
  onCreateTeam={() => {
    setShowTeamUpsell(false);
    analytics.track('team_upsell_modal_cta_tapped');
    router.push('/paywall' as any);
  }}
  onLater={() => {
    setShowTeamUpsell(false);
    analytics.track('team_upsell_modal_dismissed');
  }}
/>
```

- [ ] **Step 4: tsc check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat(team-upsell): trigger modal once when Pro user hits spend/dupe/count threshold"
```

---

## Task 4: Dashboard inline card + dynamic banner text

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Find existing dashboard "Share with family?" banner (around line 293-322)**

Read app/(tabs)/index.tsx around lines 290-325 to find the existing banner. It currently uses `t('dashboard.team_upsell_desc', ...)`.

- [ ] **Step 2: Replace banner text with dynamic version**

Change the `Text` showing description from:
```tsx
{t('dashboard.team_upsell_desc', 'Team plan: split costs & spot duplicate subs')}
```

To:
```tsx
{t('team_upsell.dashboard_dynamic', { amount: `${currency} ${Math.round(totalMonthly * 12 * 0.75)}` })}
```

Also update the title from `dashboard.team_upsell_title` to `team_upsell.dashboard_title`:
```tsx
{t('team_upsell.dashboard_title')}
```

Add `analytics.track('team_upsell_dashboard_card_tapped')` before `router.push('/paywall')` in onPress handler.

- [ ] **Step 3: tsc check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat(team-upsell): dynamic savings amount in dashboard banner"
```

---

## Task 5: Analytics inline card

**Files:**
- Modify: `app/(tabs)/analytics.tsx`

- [ ] **Step 1: Find suitable insertion point**

Read around the "Расходы по месяцам" / monthly expenses chart. Insert new card AFTER that block but BEFORE category breakdown.

- [ ] **Step 2: Add Team upsell card**

After the monthly chart `</View>`, add:

```tsx
{billingStatus?.plan === 'pro' && totalMonthly >= 20 && (
  <TouchableOpacity
    style={[styles.teamCard, { backgroundColor: colors.card, borderColor: '#06B6D4' + '40' }]}
    onPress={() => {
      analytics.track('team_upsell_analytics_card_tapped');
      router.push('/paywall' as any);
    }}
    activeOpacity={0.85}
  >
    <View style={styles.teamCardHeader}>
      <View style={[styles.teamCardIcon, { backgroundColor: '#06B6D420' }]}>
        <Ionicons name="people" size={20} color="#06B6D4" />
      </View>
      <Text style={[styles.teamCardTitle, { color: colors.text }]}>
        {t('team_upsell.analytics_title')}
      </Text>
    </View>
    <View style={styles.teamCardRow}>
      <View style={styles.teamCardCol}>
        <Text style={[styles.teamCardLabel, { color: colors.textMuted }]}>
          {t('team_upsell.analytics_current', { amount: `$${totalMonthly.toFixed(0)}` })}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
      <View style={styles.teamCardCol}>
        <Text style={[styles.teamCardValue, { color: '#06B6D4' }]}>
          {t('team_upsell.analytics_with_team', { amount: `$${(totalMonthly / 4).toFixed(0)}` })}
        </Text>
      </View>
    </View>
    <Text style={[styles.teamCardSavings, { color: '#22C55E' }]}>
      {t('team_upsell.analytics_yearly', { amount: `$${Math.round(totalMonthly * 12 * 0.75)}` })}
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Add styles**

In the `StyleSheet.create({...})` block, add:

```tsx
teamCard: { marginHorizontal: 20, marginTop: 16, marginBottom: 8, borderRadius: 16, padding: 16, borderWidth: 1.5 },
teamCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
teamCardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
teamCardTitle: { fontSize: 15, fontWeight: '700' },
teamCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
teamCardCol: { flex: 1 },
teamCardLabel: { fontSize: 13, fontWeight: '600' },
teamCardValue: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
teamCardSavings: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 },
```

- [ ] **Step 4: Verify required imports exist**

Check that `Ionicons`, `useRouter` (router), `analytics`, `useTranslation` (t) are imported. If not, add:
```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { analytics } from '../../src/services/analytics';
import { useTranslation } from 'react-i18next';
```

Also need access to `totalMonthly` — verify it's computed in this file. If not, compute from subscriptions:
```tsx
const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
const totalMonthly = subscriptions
  .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
  .reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
    return sum + (Number(s.amount) || 0) * mult;
  }, 0);
```

- [ ] **Step 5: tsc check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/analytics.tsx
git commit -m "feat(team-upsell): add Team savings card to analytics tab"
```

---

## Task 6: Subscriptions duplicate banner

**Files:**
- Modify: `app/(tabs)/subscriptions.tsx`

- [ ] **Step 1: Read existing structure**

Read app/(tabs)/subscriptions.tsx to find where the subscription list is rendered. Identify a place above the list to insert a banner.

- [ ] **Step 2: Compute duplicate categories**

After `subscriptions` is available in scope, add:

```tsx
const duplicateCategoriesArr = React.useMemo(() => {
  const counts = subscriptions.reduce((acc, s) => {
    if (s.status !== 'ACTIVE' && s.status !== 'TRIAL') return acc;
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(counts).filter(([, c]) => c > 1);
}, [subscriptions]);

const isPro = billingStatus?.plan === 'pro';
const isTeam = billingStatus?.plan === 'organization';
```

If `billingStatus` is not available, add:
```tsx
import { useBillingStatus } from '../../src/hooks/useBilling';
const { data: billingStatus } = useBillingStatus();
```

- [ ] **Step 3: Insert banner above list**

Above the `FlatList` or `ScrollView` rendering subscriptions:

```tsx
{isPro && !isTeam && duplicateCategoriesArr.length >= 1 && (
  <TouchableOpacity
    style={[styles.dupeBanner, { backgroundColor: '#06B6D415', borderColor: '#06B6D440' }]}
    onPress={() => {
      analytics.track('team_upsell_dupe_banner_tapped');
      router.push('/paywall' as any);
    }}
    activeOpacity={0.85}
  >
    <Ionicons name="people" size={18} color="#06B6D4" />
    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>
      {t('team_upsell.dupe_banner', { count: duplicateCategoriesArr.length, category: duplicateCategoriesArr[0]?.[0] ?? '' })}
    </Text>
    <Ionicons name="chevron-forward" size={16} color="#06B6D4" />
  </TouchableOpacity>
)}
```

- [ ] **Step 4: Add styles**

```tsx
dupeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
```

- [ ] **Step 5: tsc check + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/subscriptions.tsx
git commit -m "feat(team-upsell): duplicate categories banner in subscriptions list"
```

---

## Task 7: Workspace personal hero

**Files:**
- Modify: `app/(tabs)/workspace.tsx`

- [ ] **Step 1: Read current empty state structure**

Read app/(tabs)/workspace.tsx around lines 140-210 (existing `!isTeam` empty state).

- [ ] **Step 2: Add personal hero before feature list**

Insert ABOVE the existing feature list (which has "Start Team — $9.99/mo" CTA):

```tsx
{totalMonthly > 0 && (
  <View style={[styles.personalHero, { backgroundColor: colors.card }]}>
    <Text style={[styles.personalHeroLine1, { color: colors.text }]}>
      {t('team_upsell.workspace_hero', { amount: `${currency} ${totalMonthly.toFixed(2)}` })}
    </Text>
    <Text style={[styles.personalHeroLine2, { color: '#06B6D4' }]}>
      {t('team_upsell.workspace_split', { amount: `${currency} ${(totalMonthly / 4).toFixed(2)}` })}
    </Text>
  </View>
)}
```

- [ ] **Step 3: Compute totalMonthly + currency in workspace.tsx**

Add at top of component:
```tsx
const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
const { currency } = useSettingsStore();
const totalMonthly = subscriptions
  .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
  .reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
    return sum + (Number(s.amount) || 0) * mult;
  }, 0);
```

If imports don't exist, add:
```tsx
import { useSubscriptionsStore } from '../../src/stores/subscriptionsStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
```

- [ ] **Step 4: Track workspace visits**

Inside `useEffect(() => { ... }, [])` (mount effect), add:
```tsx
AsyncStorage.getItem('workspace_visits_count').then((val) => {
  const count = (parseInt(val ?? '0', 10) || 0) + 1;
  AsyncStorage.setItem('workspace_visits_count', String(count));
});
```

If `AsyncStorage` not imported:
```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
```

- [ ] **Step 5: Add styles**

```tsx
personalHero: { marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 16, alignItems: 'center', gap: 4 },
personalHeroLine1: { fontSize: 14, fontWeight: '600' },
personalHeroLine2: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
```

- [ ] **Step 6: tsc + commit**

```bash
npx tsc --noEmit
git add app/(tabs)/workspace.tsx
git commit -m "feat(team-upsell): personal hero with split calculation in workspace tab"
```

---

## Task 8: Paywall Team save badge

**Files:**
- Modify: `app/paywall.tsx`

- [ ] **Step 1: Read PLANS array (lines 28-64) and find org plan**

The org plan is at `id: 'org'` with cyan color #06B6D4.

- [ ] **Step 2: Compute and display save badge**

In `app/paywall.tsx`, after existing `useBillingStatus` hook (around line 76), add:

```tsx
const subscriptions = useSubscriptionsStore((s) => s.subscriptions);
const userMonthly = subscriptions
  .filter((s) => s.status === 'ACTIVE' || s.status === 'TRIAL')
  .reduce((sum, s) => {
    const mult = s.billingPeriod === 'WEEKLY' ? 4 : s.billingPeriod === 'QUARTERLY' ? 1/3 : s.billingPeriod === 'YEARLY' ? 1/12 : 1;
    return sum + (Number(s.amount) || 0) * mult;
  }, 0);
const teamYearlySavings = userMonthly > 0 ? Math.round(userMonthly * 12 * 0.75) : 0;
```

If import missing:
```tsx
import { useSubscriptionsStore } from '../src/stores/subscriptionsStore';
```

- [ ] **Step 3: Render save badge in org plan card**

In the PLANS map render (around line 364+), find where Pro plan shows "Most Popular" badge. Add similar logic for org:

```tsx
{plan.id === 'org' && teamYearlySavings > 0 && !isCurrent && (
  <View style={[styles.inlineBadge, { backgroundColor: '#22C55E' }]}>
    <Text style={styles.inlineBadgeText}>
      {t('team_upsell.save_vs_separate', { amount: `$${teamYearlySavings}` })}
    </Text>
  </View>
)}
```

Place this badge alongside or instead of generic badges for org.

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add app/paywall.tsx
git commit -m "feat(team-upsell): show personal yearly savings badge on Team plan card"
```

---

## Task 9: Subscription detail Team hint

**Files:**
- Modify: `app/subscription/[id].tsx`

- [ ] **Step 1: Add billing status hook**

If not already present:
```tsx
import { useBillingStatus } from '../../src/hooks/useBilling';
const { data: billing } = useBillingStatus();
const isPro = billing?.plan === 'pro';
const isTeam = billing?.plan === 'organization';
```

- [ ] **Step 2: Add hint block**

After main subscription info (and before action buttons or notes section), add:

```tsx
{isPro && !isTeam && (
  <TouchableOpacity
    style={[styles.teamHint, { backgroundColor: '#06B6D410', borderColor: '#06B6D430' }]}
    onPress={() => {
      analytics.track('team_upsell_detail_hint_tapped');
      router.push('/paywall' as any);
    }}
    activeOpacity={0.85}
  >
    <Ionicons name="people-outline" size={18} color="#06B6D4" />
    <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.text }}>
      {t('team_upsell.detail_hint', { name: subscription.name })}
    </Text>
    <Ionicons name="chevron-forward" size={16} color="#06B6D4" />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Add styles**

```tsx
teamHint: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginVertical: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
```

- [ ] **Step 4: Verify imports (analytics, router)**

Required:
```tsx
import { analytics } from '../../src/services/analytics';
```

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
git add app/subscription/[id].tsx
git commit -m "feat(team-upsell): hint about finding duplicates on subscription detail screen"
```

---

## Task 10: AI limit Alert with Team CTA

**Files:**
- Modify: `src/components/AddSubscriptionSheet.tsx`

- [ ] **Step 1: Find existing AI limit Alerts**

Search for `t('add.ai_limit_title'` in the file (3 occurrences around lines 510, 566, 645).

- [ ] **Step 2: Add billing status check at top**

Add to component imports/state:
```tsx
import { useBillingStatus } from '../hooks/useBilling';
const { data: billing } = useBillingStatus();
const isPro = billing?.plan === 'pro';
```

- [ ] **Step 3: Replace each AI limit Alert with conditional Team upsell**

For each occurrence of:
```tsx
Alert.alert(
  t('add.ai_limit_title', 'AI request limit reached'),
  ...,
  [
    ...,
    { text: t('subscription_plan.upgrade_pro'), onPress: () => router.push('/paywall') },
  ],
);
```

Change the upgrade button conditionally:
```tsx
Alert.alert(
  t('add.ai_limit_title', 'AI request limit reached'),
  ...,
  isPro
    ? [
        { text: t('team_upsell.ai_limit_wait', 'Wait until next month'), style: 'cancel' },
        { text: t('team_upsell.ai_limit_team_cta', 'Upgrade to Team — 1000 AI'), onPress: () => { analytics.track('team_upsell_ai_limit_tapped'); router.push('/paywall'); } },
      ]
    : [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('subscription_plan.upgrade_pro'), onPress: () => router.push('/paywall') },
      ],
);
```

Apply to all 3 occurrences.

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
git add src/components/AddSubscriptionSheet.tsx
git commit -m "feat(team-upsell): show Team CTA when Pro user hits AI limit"
```

---

## Final Verification

- [ ] **Step 1: Full tsc**

```bash
cd /Users/timurzharlykpaev/Desktop/repositories/subradar-mobile
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Run tests**

```bash
npx jest --passWithNoTests 2>&1 | tail -10
```
Expected: existing tests still pass

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Summary table

| Task | File | Change |
|------|------|--------|
| 1 | `src/locales/*.json` (10) | i18n keys |
| 2 | `src/components/TeamUpsellModal.tsx` | NEW component |
| 3 | `app/(tabs)/index.tsx` | Modal trigger + render |
| 4 | `app/(tabs)/index.tsx` | Dynamic banner text |
| 5 | `app/(tabs)/analytics.tsx` | Inline savings card |
| 6 | `app/(tabs)/subscriptions.tsx` | Duplicate banner |
| 7 | `app/(tabs)/workspace.tsx` | Personal hero + visit counter |
| 8 | `app/paywall.tsx` | Save badge on Team card |
| 9 | `app/subscription/[id].tsx` | Detail hint |
| 10 | `src/components/AddSubscriptionSheet.tsx` | AI limit Team CTA |
