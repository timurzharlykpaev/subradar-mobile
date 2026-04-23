/**
 * ScreenshotMode — the `mode === 'screenshot'` branch of BulkAddSheet.
 *
 * This mode is presentational: the orchestrator launches the image picker,
 * stores the URI, and kicks off the AI parse. Once parsing succeeds the
 * orchestrator transitions to `review`. Until then this view shows the
 * picked screenshot with a "AI распознаёт..." spinner and a back button.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';

interface Props {
  screenshotUri: string | null;
  loading: boolean;
  /** Called when user taps "← Назад". */
  onBack: () => void;
}

function ScreenshotModeImpl({ screenshotUri, loading, onBack }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      {screenshotUri && (
        <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} resizeMode="contain" />
      )}
      {loading ? (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.textSecondary }}>
            {t('add.bulk_parsing', 'AI распознаёт подписки...')}
          </Text>
        </>
      ) : null}
      <TouchableOpacity onPress={onBack} style={{ marginTop: 4 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          ← {t('common.back', 'Назад')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const ScreenshotMode = memo(ScreenshotModeImpl);

const styles = StyleSheet.create({
  screenshotPreview: { width: '100%', height: 220, borderRadius: 16 },
});
