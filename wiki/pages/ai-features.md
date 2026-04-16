---
title: "AI-возможности"
tags: [ai, голос, скриншот, поиск, анализ, рекомендации]
sources:
  - src/hooks/useAI.ts
  - src/api/ai.ts
  - src/types/index.ts
  - CLAUDE.md
  - docs/AI_BEHAVIOR.md
updated: 2026-04-16
---

# AI-возможности

AI — ключевое отличие SubRadar от конкурентов. Четыре основных направления: ввод данных, поиск, анализ и рекомендации.

## 1. Голосовой ввод

```
expo-av → запись аудио → FormData (file)
→ POST /ai/voice-to-subscription
→ { name, amount, currency, billingCycle, ... }
```

### Хук

```typescript
useVoiceToSubscription() → useMutation(formData: FormData)
```

### Альтернативный endpoint

```
POST /ai/voice { audioBase64 }
```

### Разрешения

Микрофон запрашивается через `expo-av` перед началом записи.

## 2. Парсинг скриншота

```
expo-image-picker → imageBase64/FormData (file)
→ POST /ai/parse-screenshot
→ { name, amount, currency, billingPeriod, date, planName }
```

### Хук

```typescript
useScreenshotParse() → useMutation(formData: FormData)
```

### Разрешения

Камера/галерея запрашиваются через `expo-image-picker`.

## 3. Умный поиск (Lookup)

```
Текстовый ввод → POST /ai/lookup { query, locale, country }
→ { name, logoUrl, category, plans[] }
```

### Хук

```typescript
useAILookupService() → useMutation(query: string)
```

### Результат

```typescript
interface AISearchResult {
  name: string;
  category: Category;
  plans: { name: string; price: number; currency: string; period: BillingPeriod }[];
  serviceUrl?: string;
  iconUrl?: string;
}
```

## 4. Парсинг текста

```typescript
useAIParseText() → useMutation(text: string)
```

Свободный текст → структурированная подписка.

## 5. AI Анализ и рекомендации

Pro-only функция. Анализирует все подписки пользователя и даёт рекомендации.

### Типы рекомендаций

```typescript
type RecommendationType = 'CANCEL' | 'DOWNGRADE' | 'SWITCH_PLAN' |
  'SWITCH_PROVIDER' | 'BUNDLE' | 'LOW_USAGE';
type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';
```

### Стадии анализа

```typescript
type AnalysisJobStatus = 'QUEUED' | 'COLLECTING' | 'NORMALIZING' |
  'LOOKING_UP' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
```

### Результат анализа

```typescript
interface AnalysisLatestResponse {
  result: {
    summary: string;
    totalMonthlySavings: number;
    currency: string;
    recommendations: Recommendation[];
    duplicates: DuplicateGroup[];
    subscriptionCount: number;
  } | null;
  job: { id: string; status: AnalysisJobStatus } | null;
  canRunManual: boolean;
  nextAutoAnalysis: string | null;
}
```

### UI

- На Dashboard: виджет AI Insights (если isPro и есть результат)
- На Analytics: полноценная секция `AIAnalysisSection`
  - `AIAnalysisSummary` — итоги
  - `AIRecommendationList` — рекомендации
  - `AIDuplicateGroup` — дубликаты
  - `AnalysisLoadingState` — прогресс по стадиям
  - `AITeaser` — для не-Pro пользователей

## API endpoints (мобильные)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/ai/voice-to-subscription` | POST (multipart) | Голос → подписка |
| `/ai/voice` | POST | Голос (base64) → подписка |
| `/ai/parse-screenshot` | POST (multipart) | Скриншот → подписка |
| `/ai/lookup` | POST | Поиск сервиса |
| `/ai/parse-text` | POST | Текст → подписка |

## Правила (из AI_BEHAVIOR.md)

1. Любая AI-фича должна иметь fallback UI (ручной ввод)
2. AI не должен принимать финансовые решения без подтверждения пользователя
3. Confidence level влияет на UI: high → автозаполнение, low → предложение с вопросом

## Связанные страницы

- [[subscriptions]] — поле `addedVia` показывает источник (AI_VOICE, AI_SCREENSHOT, AI_TEXT)
- [[billing]] — AI анализ доступен только на Pro/Team
- [[navigation]] — поток добавления подписки
