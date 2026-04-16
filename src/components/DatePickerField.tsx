import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme';

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
}

export function DatePickerField({ label, value, onChange, placeholder }: Props) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  const dateValue = value ? new Date(value + 'T00:00:00') : new Date();
  const isValid = value && !isNaN(dateValue.getTime());

  const handleChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      onChange(selectedDate.toISOString().split('T')[0]);
    }
  };

  const displayText = isValid
    ? dateValue.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : placeholder || 'Select date';

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.button, { borderColor: colors.border, backgroundColor: colors.background }]}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, { color: isValid ? colors.text : colors.textMuted }]}>
          {displayText}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6 },
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  buttonText: { fontSize: 15 },
  iosPicker: { marginTop: 4 },
});
