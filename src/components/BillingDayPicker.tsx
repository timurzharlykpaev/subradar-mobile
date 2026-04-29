import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  /** Currently selected day (1–31). Pass empty string for "not set yet". */
  value: number | string;
  onChange: (day: number) => void;
  /** Optional label rendered above the picker button. */
  label?: string;
  /** Optional placeholder when value is empty. */
  placeholder?: string;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Compact "billing day" picker.
 *
 * Replaces the inline numeric `<TextInput>` that the user reported as
 * "глючит и съехало вниз" — the input was a 80px-wide field jammed
 * next to a date picker, with `textAlign: 'center'` + iOS keyboard
 * accessory glitches that pushed the cursor below baseline.
 *
 * Tapping the field opens a bottom-sheet modal with a 7-column grid
 * of all 31 days. Selected day gets a filled-circle indicator using
 * the same nested-View pattern as `DatePickerField` so the background
 * stays centered on the digit.
 */
export function BillingDayPicker({ value, onChange, label, placeholder }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const numericValue =
    typeof value === 'number'
      ? value
      : value && /^\d+$/.test(String(value))
      ? parseInt(String(value), 10)
      : null;

  const handlePick = (day: number) => {
    onChange(day);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.button, { borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.buttonText,
            { color: numericValue ? colors.text : colors.textMuted },
          ]}
        >
          {numericValue
            ? t('add.billing_day_value', '{{day}}-е число', { day: numericValue })
            : placeholder ??
              t('add.billing_day_placeholder', 'Tap to choose')}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: colors.card }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {label ?? t('add.billing_day', 'Billing day')}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {t(
                'add.billing_day_hint',
                'Day of the month when payment is taken (1–31)',
              )}
            </Text>

            <View style={styles.grid}>
              {DAYS.map((day) => {
                const isSelected = day === numericValue;
                return (
                  <TouchableOpacity
                    key={day}
                    style={styles.cell}
                    onPress={() => handlePick(day)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.cellCircle,
                        isSelected && { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          { color: isSelected ? '#fff' : colors.text },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  buttonText: { fontSize: 15 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 15, fontWeight: '500', lineHeight: 18 },
});
