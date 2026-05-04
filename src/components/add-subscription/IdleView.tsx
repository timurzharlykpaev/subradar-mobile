import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { DoneAccessoryInput } from '../primitives/DoneAccessoryInput';
import { AICreditsBadge } from '../AICreditsBadge';
import { CameraIcon } from '../icons';
import { GmailImportEntryButton } from '../email-import/GmailImportEntryButton';
import type { CatalogService } from '../../services/catalogCache';

// ── Quick chips (hardcoded, 0 AI credits, 0 network) ─────────────────────────
// Used as fallback when the regional catalog hasn't loaded yet.
//
// Order matters: items here are shown top-to-bottom in `IdleView`, with the
// first 8 surfaced before the "+N more" toggle. Sort order is **global
// popularity** (subscriber count + cultural reach as of 2026), NOT category
// grouping — without this, users on cold start saw 6 streaming services
// before any AI/cloud/productivity option, hiding the most-likely matches
// (ChatGPT, iCloud, Notion) behind the "+more" tap.
//
// Backend `/catalog/popular` always wins when offerings are loaded — this
// list is purely an offline / first-launch fallback.

export const QUICK_CHIPS = [
  // ── Top 8 (above-the-fold in IdleView) ──────────────────────────────────
  { name: 'Netflix', letter: 'N', letterBg: '#E50914', iconUrl: 'https://icon.horse/icon/netflix.com', amount: 15.49, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://netflix.com', cancelUrl: 'https://www.netflix.com/cancelplan', plans: [{ name: 'Standard with Ads', priceMonthly: 6.99, currency: 'USD' }, { name: 'Standard', priceMonthly: 15.49, currency: 'USD' }, { name: 'Premium', priceMonthly: 22.99, currency: 'USD' }] },
  { name: 'Spotify', letter: 'S', letterBg: '#1DB954', iconUrl: 'https://icon.horse/icon/spotify.com', amount: 11.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'MUSIC', serviceUrl: 'https://spotify.com', cancelUrl: 'https://www.spotify.com/account/subscription/cancel', plans: [{ name: 'Individual', priceMonthly: 11.99, currency: 'USD' }, { name: 'Duo', priceMonthly: 16.99, currency: 'USD' }, { name: 'Family', priceMonthly: 19.99, currency: 'USD' }] },
  { name: 'ChatGPT', letter: 'C', letterBg: '#10A37F', iconUrl: 'https://icon.horse/icon/openai.com', amount: 20, currency: 'USD', billingPeriod: 'MONTHLY', category: 'AI_SERVICES', serviceUrl: 'https://chat.openai.com', cancelUrl: 'https://help.openai.com/en/articles/7232013', plans: [{ name: 'Plus', priceMonthly: 20, currency: 'USD' }, { name: 'Pro', priceMonthly: 200, currency: 'USD' }] },
  { name: 'YouTube', letter: 'Y', letterBg: '#FF0000', iconUrl: 'https://icon.horse/icon/youtube.com', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://youtube.com', cancelUrl: 'https://youtube.com/paid_memberships', plans: [{ name: 'Individual', priceMonthly: 13.99, currency: 'USD' }, { name: 'Family', priceMonthly: 22.99, currency: 'USD' }] },
  { name: 'Amazon Prime', letter: 'A', letterBg: '#FF9900', iconUrl: 'https://icon.horse/icon/amazon.com', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://amazon.com', cancelUrl: 'https://www.amazon.com/mc/cancel', plans: [{ name: 'Monthly', priceMonthly: 14.99, currency: 'USD' }, { name: 'Annual', priceMonthly: 11.58, currency: 'USD' }] },
  { name: 'iCloud+', letter: 'i', letterBg: '#3693F3', iconUrl: 'https://icon.horse/icon/icloud.com', amount: 0.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'INFRASTRUCTURE', serviceUrl: 'https://icloud.com', cancelUrl: 'https://support.apple.com/billing', plans: [{ name: '50 GB', priceMonthly: 0.99, currency: 'USD' }, { name: '200 GB', priceMonthly: 2.99, currency: 'USD' }, { name: '2 TB', priceMonthly: 9.99, currency: 'USD' }] },
  { name: 'Apple Music', letter: 'A', letterBg: '#FC3C44', iconUrl: 'https://icon.horse/icon/music.apple.com', amount: 10.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'MUSIC', serviceUrl: 'https://music.apple.com', cancelUrl: 'https://support.apple.com/billing', plans: [{ name: 'Individual', priceMonthly: 10.99, currency: 'USD' }, { name: 'Family', priceMonthly: 16.99, currency: 'USD' }] },
  { name: 'Disney+', letter: 'D', letterBg: '#113CCF', iconUrl: 'https://icon.horse/icon/disneyplus.com', amount: 13.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://disneyplus.com', cancelUrl: 'https://www.disneyplus.com/account/subscription', plans: [{ name: 'Basic', priceMonthly: 7.99, currency: 'USD' }, { name: 'Premium', priceMonthly: 13.99, currency: 'USD' }] },
  // ── Below the fold (revealed by "+N more" tap) ──────────────────────────
  { name: 'Notion', letter: 'N', letterBg: '#000000', iconUrl: 'https://icon.horse/icon/notion.so', amount: 10, currency: 'USD', billingPeriod: 'MONTHLY', category: 'PRODUCTIVITY', serviceUrl: 'https://notion.so', cancelUrl: 'https://notion.so/settings', plans: [{ name: 'Plus', priceMonthly: 10, currency: 'USD' }, { name: 'Business', priceMonthly: 15, currency: 'USD' }] },
  { name: 'Google One', letter: 'G', letterBg: '#4285F4', iconUrl: 'https://icon.horse/icon/one.google.com', amount: 1.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'INFRASTRUCTURE', serviceUrl: 'https://one.google.com', cancelUrl: 'https://one.google.com/settings', plans: [{ name: '100 GB', priceMonthly: 1.99, currency: 'USD' }, { name: '200 GB', priceMonthly: 2.99, currency: 'USD' }, { name: '2 TB', priceMonthly: 9.99, currency: 'USD' }] },
  { name: 'HBO Max', letter: 'H', letterBg: '#5822B4', iconUrl: 'https://icon.horse/icon/max.com', amount: 16.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://max.com', cancelUrl: 'https://help.max.com/cancel', plans: [{ name: 'With Ads', priceMonthly: 9.99, currency: 'USD' }, { name: 'Ad-Free', priceMonthly: 16.99, currency: 'USD' }, { name: 'Ultimate', priceMonthly: 20.99, currency: 'USD' }] },
  { name: 'Figma', letter: 'F', letterBg: '#A259FF', iconUrl: 'https://icon.horse/icon/figma.com', amount: 12, currency: 'USD', billingPeriod: 'MONTHLY', category: 'DESIGN', serviceUrl: 'https://figma.com', cancelUrl: 'https://figma.com/settings', plans: [{ name: 'Professional', priceMonthly: 12, currency: 'USD' }, { name: 'Organization', priceMonthly: 45, currency: 'USD' }] },
  { name: 'Slack', letter: 'S', letterBg: '#4A154B', iconUrl: 'https://icon.horse/icon/slack.com', amount: 7.25, currency: 'USD', billingPeriod: 'MONTHLY', category: 'PRODUCTIVITY', serviceUrl: 'https://slack.com', cancelUrl: 'https://slack.com/help/categories/200122103', plans: [{ name: 'Pro', priceMonthly: 7.25, currency: 'USD' }, { name: 'Business+', priceMonthly: 12.50, currency: 'USD' }] },
  { name: 'Claude', letter: 'C', letterBg: '#D4A574', iconUrl: 'https://icon.horse/icon/claude.ai', amount: 20, currency: 'USD', billingPeriod: 'MONTHLY', category: 'AI_SERVICES', serviceUrl: 'https://claude.ai', cancelUrl: 'https://claude.ai/settings', plans: [{ name: 'Pro', priceMonthly: 20, currency: 'USD' }, { name: 'Max', priceMonthly: 100, currency: 'USD' }] },
  { name: 'Apple TV+', letter: 'A', letterBg: '#333333', iconUrl: 'https://icon.horse/icon/tv.apple.com', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'STREAMING', serviceUrl: 'https://tv.apple.com', cancelUrl: 'https://support.apple.com/billing', plans: [{ name: 'Monthly', priceMonthly: 9.99, currency: 'USD' }] },
  { name: 'Adobe CC', letter: 'A', letterBg: '#FF0000', iconUrl: 'https://icon.horse/icon/adobe.com', amount: 59.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'DESIGN', serviceUrl: 'https://adobe.com', cancelUrl: 'https://account.adobe.com/plans', plans: [{ name: 'Photography', priceMonthly: 9.99, currency: 'USD' }, { name: 'Single App', priceMonthly: 22.99, currency: 'USD' }, { name: 'All Apps', priceMonthly: 59.99, currency: 'USD' }] },
  { name: 'Xbox Game Pass', letter: 'X', letterBg: '#107C10', iconUrl: 'https://icon.horse/icon/xbox.com', amount: 14.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'GAMING', serviceUrl: 'https://xbox.com/game-pass', cancelUrl: 'https://account.microsoft.com/services', plans: [{ name: 'Core', priceMonthly: 9.99, currency: 'USD' }, { name: 'Standard', priceMonthly: 14.99, currency: 'USD' }, { name: 'Ultimate', priceMonthly: 19.99, currency: 'USD' }] },
  { name: 'PlayStation Plus', letter: 'P', letterBg: '#003087', iconUrl: 'https://icon.horse/icon/playstation.com', amount: 9.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'GAMING', serviceUrl: 'https://playstation.com', cancelUrl: 'https://store.playstation.com/subscriptions', plans: [{ name: 'Essential', priceMonthly: 9.99, currency: 'USD' }, { name: 'Extra', priceMonthly: 14.99, currency: 'USD' }, { name: 'Premium', priceMonthly: 17.99, currency: 'USD' }] },
  { name: 'GitHub Copilot', letter: 'G', letterBg: '#24292E', iconUrl: 'https://icon.horse/icon/github.com', amount: 10, currency: 'USD', billingPeriod: 'MONTHLY', category: 'AI_SERVICES', serviceUrl: 'https://github.com/features/copilot', cancelUrl: 'https://github.com/settings/billing', plans: [{ name: 'Individual', priceMonthly: 10, currency: 'USD' }, { name: 'Business', priceMonthly: 19, currency: 'USD' }] },
  { name: 'NordVPN', letter: 'N', letterBg: '#4687FF', iconUrl: 'https://icon.horse/icon/nordvpn.com', amount: 12.99, currency: 'USD', billingPeriod: 'MONTHLY', category: 'SECURITY', serviceUrl: 'https://nordvpn.com', cancelUrl: 'https://my.nordaccount.com/billing', plans: [{ name: 'Monthly', priceMonthly: 12.99, currency: 'USD' }, { name: 'Annual', priceMonthly: 4.59, currency: 'USD' }] },
] as const;

export type QuickChipItem = typeof QUICK_CHIPS[number];

// Extracted to avoid useState inside .map()
function QuickChipButton({ chip, colors, onPress }: {
  chip: QuickChipItem;
  colors: any;
  onPress: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.background }]}
      onPress={onPress}
    >
      {!imgError ? (
        <Image
          source={{ uri: chip.iconUrl }}
          style={styles.quickChipIcon}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.quickChipIconFallback, { backgroundColor: chip.letterBg }]}>
          <Text style={styles.quickChipIconLetter}>{chip.letter}</Text>
        </View>
      )}
      <Text style={[styles.quickChipText, { color: colors.text }]}>{chip.name}</Text>
    </TouchableOpacity>
  );
}

interface Props {
  catalogServices: CatalogService[];
  isRecording: boolean;
  durationFmt: string;
  onSmartSubmit: (text: string) => void;
  onQuickChip: (chip: QuickChipItem) => void;
  onCatalogChip: (service: CatalogService) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCamera: () => void;
  onManualToggle: () => void;
  /** Show the Pro paywall modal for the given feature key (Gmail import). */
  onProGate?: (feature: string) => void;
  /** Close the parent Add Sheet (used before navigating to Gmail flow). */
  onClose?: () => void;
  /**
   * Initial value for the smart input. Parent should pair this with a
   * remount `key` when it needs to reset or replace the value — state
   * re-initializes on each mount, so no useEffect is required here.
   */
  seedSmartInput?: string;
}

function IdleViewImpl({
  catalogServices,
  isRecording,
  durationFmt,
  onSmartSubmit,
  onQuickChip,
  onCatalogChip,
  onStartRecording,
  onStopRecording,
  onCamera,
  onManualToggle,
  onProGate,
  onClose,
  seedSmartInput,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [smartInput, setSmartInput] = useState(seedSmartInput ?? '');
  const [showAllChips, setShowAllChips] = useState(false);

  const handleSubmit = useCallback(() => {
    const v = smartInput.trim();
    if (v.length > 0) onSmartSubmit(v);
  }, [smartInput, onSmartSubmit]);

  const handleMicPress = useCallback(() => {
    if (isRecording) onStopRecording();
    else onStartRecording();
  }, [isRecording, onStartRecording, onStopRecording]);

  const handleShowAll = useCallback(() => setShowAllChips(true), []);

  // Shared input style — inline to keep theme-aware (project rule: no static COLORS)
  const inputStyle = {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    letterSpacing: 0,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  };

  return (
    <View style={{ gap: 16, paddingBottom: 40 }}>
      {/* Smart input with mic & camera */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
          {t('add.smart_input_label', 'What subscription?')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <DoneAccessoryInput
              testID="smart-input"
              style={[inputStyle, { marginTop: 0 }]}
              value={smartInput}
              onChangeText={setSmartInput}
              placeholder={t('add.smart_input_placeholder', 'Netflix, Spotify $9.99/mo...')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleSubmit}
              autoCorrect={false}
            />
          </View>
          {/* Mic button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: isRecording ? '#EF4444' : colors.primary }]}
            onPress={handleMicPress}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color="#FFF" />
          </TouchableOpacity>
          {/* Camera button */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
            onPress={onCamera}
          >
            <CameraIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {isRecording && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>{durationFmt}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {t('add.tap_stop', 'Tap mic to stop')}
            </Text>
          </View>
        )}
        {/* Submit button if text entered */}
        {smartInput.trim().length > 0 && (
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' }}
            onPress={handleSubmit}
          >
            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>
              {t('add.search', 'Search')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick chips — catalog → fallback to QUICK_CHIPS */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
          {t('add.popular', 'Popular')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {catalogServices.length > 0 ? (
            // Regional catalog available — use it
            <>
              {(showAllChips ? catalogServices : catalogServices.slice(0, 8)).map((svc) => (
                <TouchableOpacity
                  key={svc.slug || svc.name}
                  style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => onCatalogChip(svc)}
                >
                  {svc.iconUrl ? (
                    <Image source={{ uri: svc.iconUrl }} style={styles.quickChipIcon} />
                  ) : (
                    <View style={[styles.quickChipIconFallback, { backgroundColor: colors.primary }]}>
                      <Text style={styles.quickChipIconLetter}>{svc.name?.[0]}</Text>
                    </View>
                  )}
                  <Text style={[styles.quickChipText, { color: colors.text }]}>{svc.name}</Text>
                </TouchableOpacity>
              ))}
              {!showAllChips && catalogServices.length > 8 && (
                <TouchableOpacity
                  style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={handleShowAll}
                >
                  <Ionicons name="add" size={18} color={colors.textSecondary} />
                  <Text style={[styles.quickChipText, { color: colors.textSecondary }]}>
                    +{catalogServices.length - 8}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            // Fallback to hardcoded QUICK_CHIPS (with FX conversion via InlineConfirmCard)
            <>
              {(showAllChips ? QUICK_CHIPS : QUICK_CHIPS.slice(0, 8)).map((chip) => (
                <QuickChipButton key={chip.name} chip={chip} colors={colors} onPress={() => onQuickChip(chip)} />
              ))}
              {!showAllChips && QUICK_CHIPS.length > 8 && (
                <TouchableOpacity
                  style={[styles.quickChip, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={handleShowAll}
                >
                  <Ionicons name="add" size={18} color={colors.textSecondary} />
                  <Text style={[styles.quickChipText, { color: colors.textSecondary }]}>
                    +{QUICK_CHIPS.length - 8}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* Gmail import entry — Pro/Team gated, navigates out of the sheet. */}
      {onProGate && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <GmailImportEntryButton onProGate={onProGate} onPress={onClose} />
        </View>
      )}

      {/* "or enter manually" collapsible */}
      <TouchableOpacity
        testID="btn-manual-toggle"
        onPress={onManualToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
          {t('add.or_manual', 'or enter manually')}
        </Text>
      </TouchableOpacity>

      {/* AI Credits Badge */}
      <AICreditsBadge />
    </View>
  );
}

export const IdleView = memo(IdleViewImpl);

const styles = StyleSheet.create({
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
  },
  quickChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  quickChipIconFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quickChipIconLetter: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  quickChipText: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 110,
  },
});
