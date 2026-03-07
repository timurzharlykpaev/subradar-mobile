import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { cardsApi } from '../../src/api/cards';
import { usePaymentCardsStore } from '../../src/stores/paymentCardsStore';
import { PaymentCard } from '../../src/types';
import { COLORS, CARD_BRANDS } from '../../src/constants';

const CARD_COLORS = ['#6C47FF', '#FF6B6B', '#4CAF50', '#FF9800', '#1E88E5', '#E91E63'];

function CardVisual({ card }: { card: PaymentCard }) {
  return (
    <View style={[styles.cardVisual, { backgroundColor: card.color }]}>
      <Text style={styles.cardBrand}>{card.brand}</Text>
      <Text style={styles.cardNickname}>{card.nickname}</Text>
      <Text style={styles.cardLast4}>•••• •••• •••• {card.last4}</Text>
    </View>
  );
}

export default function CardsScreen() {
  const router = useRouter();
  const { cards, addCard, removeCard } = usePaymentCardsStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nickname: '', last4: '', brand: 'VISA' as PaymentCard['brand'], color: CARD_COLORS[0] });

  const handleAdd = () => {
    if (!form.nickname || form.last4.length !== 4) {
      Alert.alert('Ошибка', 'Введите название и 4 последних цифры карты');
      return;
    }
    addCard({ id: Date.now().toString(), isDefault: false, ...form });
    setForm({ nickname: '', last4: '', brand: 'VISA', color: CARD_COLORS[0] });
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удалить карту?', 'Это действие нельзя отменить', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
          try { await cardsApi.delete(id); } catch {}
          removeCard(id);
        }},
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Карты</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtn}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {cards.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyText}>Нет карт</Text>
            <Text style={styles.emptySubtext}>Добавьте карту для отслеживания расходов</Text>
          </View>
        )}
        {cards.map((card) => (
          <View key={card.id} style={styles.cardContainer}>
            <CardVisual card={card} />
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(card.id)}>
              <Text style={styles.deleteBtnText}>Удалить</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Добавить карту</Text>

            <TextInput
              style={styles.input}
              placeholder="Название (например: «Моя Visa»)"
              value={form.nickname}
              onChangeText={(v) => setForm((f) => ({ ...f, nickname: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Последние 4 цифры"
              value={form.last4}
              onChangeText={(v) => setForm((f) => ({ ...f, last4: v.replace(/\D/g, '').slice(0, 4) }))}
              keyboardType="numeric"
              maxLength={4}
            />

            <Text style={styles.label}>Платёжная система</Text>
            <View style={styles.row}>
              {CARD_BRANDS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, form.brand === b && styles.chipActive]}
                  onPress={() => setForm((f) => ({ ...f, brand: b as PaymentCard['brand'] }))}
                >
                  <Text style={[styles.chipText, form.brand === b && styles.chipTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Цвет</Text>
            <View style={styles.row}>
              {CARD_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotActive]}
                  onPress={() => setForm((f) => ({ ...f, color: c }))}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelBtnText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  back: { color: COLORS.primary, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  content: { padding: 16, gap: 16 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  cardContainer: { gap: 8 },
  cardVisual: { borderRadius: 16, padding: 24, height: 160, justifyContent: 'space-between' },
  cardBrand: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  cardNickname: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cardLast4: { color: 'rgba(255,255,255,0.9)', fontSize: 16, letterSpacing: 2 },
  deleteBtn: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 12 },
  deleteBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 16, color: COLORS.text },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
