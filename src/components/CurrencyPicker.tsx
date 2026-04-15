import React, { useMemo, useState } from 'react';
import {
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

const PRIMARY = ['USD', 'EUR', 'GBP', 'KZT', 'RUB', 'UAH', 'TRY'];
const ADDITIONAL = [
  'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK',
  'PLN', 'CZK', 'HUF', 'BYN',
  'JPY', 'CNY', 'HKD', 'KRW', 'SGD', 'THB', 'IDR', 'MYR', 'PHP', 'INR',
  'AED', 'SAR', 'ILS', 'EGP',
  'MXN', 'BRL', 'ARS', 'CLP', 'COP',
  'ZAR', 'NGN',
  'UZS', 'KGS', 'TJS', 'TMT', 'AZN', 'AMD', 'GEL',
];
const ALL_CODES = Array.from(new Set([...PRIMARY, ...ADDITIONAL]));

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export function CurrencyPicker({
  visible,
  selected,
  onSelect,
  onClose,
  title = 'Currency',
}: Props) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return ALL_CODES;
    return ALL_CODES.filter((c) => c.includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <View style={{ width: 28 }} />
        </View>
        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: colors.surface2,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search currency code"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <FlatList
          data={filtered}
          keyExtractor={(c) => c}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              style={[styles.row, { borderColor: colors.border }]}
            >
              <Text style={[styles.code, { color: colors.text }]}>{item}</Text>
              {selected === item && (
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
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  code: { flex: 1, fontSize: 15, fontWeight: '600' },
});
