import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { authApi } from '../src/api/auth';
import { useTheme } from '../src/theme';
import { useTranslation } from 'react-i18next';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleChangeName = useCallback((text: string) => {
    setName(text);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('settings.name_required'));
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile({ name: name.trim() });
      updateUser({ name: name.trim() });
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('settings.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const initials = (name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.cancel, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('edit_profile.title')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.save, { color: colors.primary }]}>{t('common.save')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('edit_profile.name')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.text }]}
                value={name}
                onChangeText={handleChangeName}
                placeholder={t('edit_profile.name_placeholder')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                maxLength={50}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('edit_profile.email')}</Text>
              <View style={[styles.inputDisabled, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.inputDisabledText, { color: colors.textMuted }]}>{user?.email || ''}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancel: {
    fontSize: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  save: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  form: {
    paddingHorizontal: 20,
    gap: 4,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  inputDisabled: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
  },
  inputDisabledText: {
    fontSize: 16,
  },
});
