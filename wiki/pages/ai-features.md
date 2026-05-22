---
title: "AI-возможности"
tags: [ai, голос, скриншот, поиск, анализ, рекомендации, bulk, gmail]
sources:
  - src/hooks/useAI.ts
  - src/hooks/useAnalysis.ts
  - src/hooks/useVoiceRecorder.ts
  - src/api/ai.ts
  - src/types/index.ts
  - CLAUDE.md
  - docs/AI_BEHAVIOR.md
updated: 2026-05-22
---

# AI-возможности

AI — ключевое отличие SubRadar от конкурентов. Четыре основных направления: ввод данных, поиск, анализ и рекомендации.

## 1. Голосовой ввод

Стек переведён с `expo-av` на `expo-audio` (новый SDK). Кастомный хук
`useVoiceRecorder` (`src/hooks/useVoiceRecorder.ts`) предоставляет:

```typescript
useVoiceRecorder(
  onDone: (uri: string) => void,
  onError?: (reason: 'no_uri' | 'start_failed' | 'stop_failed') => void,
)
→ { isRecording, duration, start, stop, cancel }
```

Особенности:
- `MAX_RECORDING_SECONDS = 30` — auto-stop
- `requestRecordingPermissionsAsync()` запрашивает доступ к микрофону
- `safeUri()` defensively reads `recorder.uri` — после crashed stop() или
  unmount native shared object может быть gone, property access throws
- `swallow()` глотает promise rejections от released SharedObject

### Поток

```
expo-audio → запись → uri (.m4a)
→ FormData (file)
→ POST /ai/voice-to-subscription
→ { name, amount, currency, billingCycle, ... }
```

### Хук

```typescript
useVoiceToSubscription() → useMutation(formData: FormData)
```

### Voice-first Add flow (commit `ef53106`)

В `AddSubscriptionSheet` voice — primary CTA, не tucked в submenu. Split
mic + loading bubble на outer/inner layers (`22aada4`) для smoothness.

### Альтернативный endpoint

```
POST /ai/voice { audioBase64 }
```

### Sentence-shape rejection (commit `b7f434a`)

AI text/lookup отвергает sentence-shaped input ("I want to add Netflix") —
парсер ждёт plain service name. Юзеру показывается hint что писать.

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

## 5. Bulk parse через Gmail

Самый мощный AI workflow — bulk-импорт чеков из Gmail. Pro/Team only,
описан в [[gmail-import]].

Конвейер:
```
Gmail OAuth → backend scan inbox (90d, 200 receipts max)
→ AI parse каждый чек → candidates с confidence + amountFromEmail flag
→ BulkConfirmView review → batch create
```

Те же `BulkConfirmView` / `BulkEditModal` используются для голоса и
скриншота (рефакторинг `35a1f1a`) — единый review UX независимо от источника.

## 6. AI Анализ и рекомендации

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
| `/gmail/scan/start` | POST | Bulk-парсинг inbox (Pro/Team) |
| `/workspace/me/analysis/run` | POST | Team AI-анализ overlaps |

## Правила (из AI_BEHAVIOR.md)

1. Любая AI-фича должна иметь fallback UI (ручной ввод)
2. AI не должен принимать финансовые решения без подтверждения пользователя
3. Confidence level влияет на UI: high → автозаполнение, low → предложение с вопросом

## Связанные страницы

- [[subscriptions]] — поле `addedVia` показывает источник (AI_VOICE, AI_SCREENSHOT, AI_TEXT)
- [[billing]] — AI анализ доступен только на Pro/Team
- [[navigation]] — поток добавления подписки
- [[gmail-import]] — bulk-парсинг inbox
- [[workspace]] — team AI analysis (overlaps + teamSavings)
- [[paywall]] — gate на AI Pro фичи через `feature` attribution
