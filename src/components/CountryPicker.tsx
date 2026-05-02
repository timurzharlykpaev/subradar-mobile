import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { COUNTRIES } from '../constants/countries';
import { DoneAccessoryInput } from './primitives/DoneAccessoryInput';

interface Props {
  visible: boolean;
  selectedCode?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export function CountryPicker({
  visible,
  selectedCode,
  onSelect,
  onClose,
  title = 'Select country',
}: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    // `presentationStyle="pageSheet"` is the iOS-native sheet style — it
    // automatically respects the status bar / Dynamic Island insets so
    // the close button no longer collides with the system clock. On
    // Android `presentationStyle` is ignored (Android always renders
    // full-screen), and the SafeAreaView below handles its insets there.
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={{ width: 28 }} />
        </View>
        <DoneAccessoryInput
          style={[
            styles.search,
            {
              backgroundColor: colors.surface2,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Search country"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderColor: colors.border }]}
              onPress={() => {
                onSelect(item.code);
                onClose();
              }}
            >
              <Text style={{ fontSize: 22 }}>{item.flag}</Text>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.code, { color: colors.textMuted }]}>
                {item.code}
              </Text>
              {selectedCode === item.code && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 17, fontWeight: '700' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 15 },
  code: { fontSize: 12, fontWeight: '600' },
});
