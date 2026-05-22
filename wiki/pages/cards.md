---
title: "Payment Cards"
tags: [карта, экран, payment-cards, crud]
sources:
  - app/cards/index.tsx
  - src/stores/paymentCardsStore.ts
  - src/api/cards.ts
  - src/types/index.ts
updated: 2026-05-22
---

# Payment Cards

Экран `app/cards/index.tsx` — CRUD платёжных карт пользователя. Карты не
хранят чувствительных данных (нет PAN, CVV, expiry) — только last4, brand,
nickname и цвет для визуализации.

## Что хранится

```typescript
interface PaymentCard {
  id: string;
  nickname: string;        // "Personal Visa", "Tinkoff Black"
  last4: string;           // "4242"
  brand: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' | 'DINERS' | 'JCB';
  color: string;           // hex для визуальной карты
  isDefault: boolean;
}
```

## Store

`usePaymentCardsStore` — Zustand store **без persist**. Карты загружаются
с бэкенда через `cardsApi.list()` в `DataLoader` и держатся in-memory.

```typescript
{
  cards: PaymentCard[],
  setCards, addCard, updateCard, removeCard,
  getCard(id): PaymentCard | undefined,
}
```

## API

```typescript
cardsApi.list()               → GET /payment-cards
cardsApi.create(data)         → POST /payment-cards
cardsApi.update(id, data)     → PATCH /payment-cards/:id
cardsApi.delete(id)           → DELETE /payment-cards/:id
cardsApi.setDefault(id)       → POST /payment-cards/:id/default
```

## Удаление карты — orphan check

Перед deletion проверяется сколько подписок привязано к карте:

```typescript
const linkedCount = subscriptionsStore.subscriptions
  .filter(s => s.paymentCardId === id).length;

if (linkedCount > 0) {
  Alert.alert(`{{count}} subscriptions are linked. They will stay,
              just without a card assigned.`);
}
```

Подписки **не удаляются**, только `paymentCardId` сбрасывается серверно.

## Brand glyph

Каждый brand имеет фиксированный letter glyph + bg color (`#1A1F71` для
Visa, `#EB001B` для Mastercard, и т.д.). Не используются SVG ассеты бренд-
логотипов — single-letter работает в любой локали и упрощает релизы.

## Card colors

```typescript
const CARD_COLORS = ['#6C47FF', '#FF6B6B', '#4CAF50', '#FF9800', '#1E88E5', '#E91E63'];
```

Цвет выбирается пользователем при создании, используется в визуализации
карты и в `analytics/by-card` breakdown.

## Использование в подписках

`Subscription.paymentCardId` → ссылка на `PaymentCard.id`. Backend joinит
и возвращает `paymentCard` объект целиком (denormalized). См. [[subscriptions]].

В UI:
- AddSubscriptionSheet — picker
- SubscriptionCard — цветной dot слева
- Analytics → Card Breakdown — stacked bar + список

## Связанные страницы

- [[subscriptions]] — `paymentCardId` linking
- [[analytics]] — by-card breakdown
- [[state-management]] — `paymentCardsStore`
