import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';

interface Props {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  placeholder?: string;
}

const FALLBACK_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const FALLBACK_WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function DatePickerField({ label, value, onChange, placeholder }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [show, setShow] = useState(false);

  const monthsShort = useMemo(() => {
    const v = t('date_picker.months_short', { returnObjects: true, defaultValue: FALLBACK_MONTHS_SHORT });
    return Array.isArray(v) && v.length === 12 ? (v as string[]) : FALLBACK_MONTHS_SHORT;
  }, [t, i18n.language]);

  const weekdaysShort = useMemo(() => {
    const v = t('date_picker.weekdays_short', { returnObjects: true, defaultValue: FALLBACK_WEEKDAYS_SHORT });
    return Array.isArray(v) && v.length === 7 ? (v as string[]) : FALLBACK_WEEKDAYS_SHORT;
  }, [t, i18n.language]);

  const parsed = useMemo(() => {
    if (!value) return null;
    const d = new Date(value + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const [viewYear, setViewYear] = useState(() => (parsed ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (parsed ?? new Date()).getMonth());

  const displayText = parsed
    ? parsed.toLocaleDateString(i18n.language || undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : placeholder || t('date_picker.select_date', 'Select date');

  const days = useMemo(() => {
    const count = daysInMonth(viewYear, viewMonth);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [viewYear, viewMonth]);

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth
    ? parsed.getDate()
    : null;

  const handleSelect = (day: number) => {
    const str = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    onChange(str);
    setShow(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const openPicker = () => {
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setShow(true);
  };

  // First day of week offset (0=Sun)
  const firstDayOffset = new Date(viewYear, viewMonth, 1).getDay();
  const gridCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push(null);
    for (const d of days) cells.push(d);
    return cells;
  }, [firstDayOffset, days]);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.button, { borderColor: colors.border, backgroundColor: colors.background }]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Text style={[styles.buttonText, { color: parsed ? colors.text : colors.textMuted }]}>
          {displayText}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={show} animationType="slide" transparent onRequestClose={() => setShow(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShow(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Month nav */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} hitSlop={12}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>
                {monthsShort[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={12}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekRow}>
              {weekdaysShort.map((d, i) => (
                <Text key={`${d}-${i}`} style={[styles.weekDay, { color: colors.textMuted }]}>{d}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.daysGrid}>
              {gridCells.map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.dayCell,
                    day === selectedDay && { backgroundColor: colors.primary, borderRadius: 20 },
                  ]}
                  onPress={() => day && handleSelect(day)}
                  disabled={!day}
                  activeOpacity={0.6}
                >
                  {day ? (
                    <Text style={[
                      styles.dayText,
                      { color: day === selectedDay ? '#fff' : colors.text },
                    ]}>
                      {day}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            {/* Today button */}
            <TouchableOpacity
              style={[styles.todayButton, { borderColor: colors.border }]}
              onPress={() => {
                const now = new Date();
                handleSelect(now.getDate());
                setViewYear(now.getFullYear());
                setViewMonth(now.getMonth());
              }}
            >
              <Text style={[styles.todayText, { color: colors.primary }]}>{t('date_picker.today', 'Today')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
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
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontWeight: '500' },
  todayButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  todayText: { fontSize: 15, fontWeight: '700' },
});
