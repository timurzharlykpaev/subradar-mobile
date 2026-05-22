---
title: "Gmail Bulk Import"
tags: [gmail, ai, импорт, скан, pro, экран]
sources:
  - app/gmail-import.tsx
  - src/api/gmail.ts
  - src/hooks/useGmail.ts
  - src/hooks/useActiveGmailScan.ts
  - src/components/add-subscription/BulkConfirmView.tsx
  - src/components/add-subscription/BulkEditModal.tsx
updated: 2026-05-22
---

# Gmail Bulk Import

Bulk-импорт подписок: пользователь подключает Gmail через OAuth, бэкенд
сканирует входящие за последние 90 дней, AI парсит чеки, мобилка показывает
список candidates → user picks → batch create. Pro/Team only.

## Поток

```
1. Not connected → "Connect Gmail" CTA
   → useGmailConnect() → POST /gmail/connect → authUrl
   → WebBrowser.openAuthSessionAsync(authUrl)
   → Google redirect → backend → deep link subradar:// → app resumes

2. Connected → "Scan inbox" CTA
   → useGmailScanJob().start({ force? })
   → POST /gmail/scan/start → { jobId, status: 'pending' | 'completed' (cached) }
   → poll GET /gmail/scan/status/:jobId каждые 2-8s (adaptive)
   → status='completed' → result.candidates[]

3. Review screen (BulkConfirmView)
   → user checks/unchecks rows
   → per-row edit через BulkEditModal (цена, период, категория, plan, card)
   → "Save N subscriptions" → batch POST /subscriptions

4. Done → scan.reset() → DeviceEventEmitter.emit(GMAIL_SCAN_CLEARED_EVENT)
        → useActiveGmailScan (dashboard banner) исчезает
```

## Pro/Team gate

Server-side guard `RequireProGuard` отвечает `HTTP 402 PRO_PLAN_REQUIRED`
для Free. Mobile UI:
- Mounts paywall route `router.push('/paywall?prefill=pro-yearly&feature=magic_mail')`
- Аттрибуция через query-param `feature` — измеряет конверсию tile → paywall
  → purchase per gated tile.

См. [[paywall]] для feature-source аналитики.

## Hook: `useGmailScanJob` (фоновый поллинг)

`src/hooks/useGmail.ts` — главный stateful хук.

### Состояние

```typescript
{
  jobId: string | null,
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed',
  result: GmailScanResult | null,
  error: { code?, message, statusCode? } | null,
  cached: boolean,
  progress: GmailScanProgress | null,
}
```

### Persistence через AsyncStorage

`ACTIVE_SCAN_STORAGE_KEY = 'gmail:scan:active-jobId'` — записывается при
старте, читается на mount/foreground для auto-resume.

### Auto-resume сценарии

| Триггер | Откуда | Что делает |
|---------|--------|-----------|
| Mount | `useEffect` + `recoverOnce.current` | Читает stored jobId → resume |
| Foreground | `AppState.addEventListener('change')` | Если active → reload + resume |
| Push notification | Deep link `?jobId=…` | Bypass start, идёт сразу в resume |

### Adaptive polling backoff

```
elapsed < 15s  → 2s interval  (fetch stage, fast updates)
elapsed < 60s  → 4s interval  (AI parse stage, slower updates)
elapsed > 60s  → 8s interval  (long tail)
```

3-минутный cap (`POLL_ATTEMPTS = 90`). Если cap превышен — UI не падает в
failed, scan продолжается серверно, push-нотификация деeplink-нет юзера
обратно.

### Transient error handling

- `404` на resume → job expired (>30 min TTL) → drop stored jobId, mark failed
- Network blip / 5xx → backoff retry до 3 раз внутри poll
- 401 / 403 / 400 → терминальный fail

## Hook: `useActiveGmailScan` (dashboard banner)

`src/hooks/useActiveGmailScan.ts` — read-only компаньон для отображения
прогресса вне gmail-import screen.

- Polls тот же endpoint `/gmail/scan/status/:jobId`
- **Slower cadence** — 5s (vs 2-8s в screen-level хуке) — экономия батареи
  на dashboard где сканирование не primary view
- Listens на `GMAIL_SCAN_CLEARED_EVENT` через `DeviceEventEmitter` — instant
  hide когда screen-level hook сделал `scan.reset()`
- Re-reads AsyncStorage на `useFocusEffect` + `AppState='active'`

## BulkConfirmView / BulkEditModal

Те же компоненты, что используются в `AddSubscriptionSheet` для AI-голоса
и AI-screenshot (рефакторинг `35a1f1a refactor(gmail-import): reuse
BulkConfirmView/BulkEditModal`).

Per-row:
- Service icon (если `catalogServiceId` совпал)
- Verify-amount hint когда `amountFromEmail === false` или
  `amountIsApproximate === true` (12× monthly = approx yearly)
- Inline edit (плитки: цена, период, категория, plan, card, теги)
- Delete row → удаляется из `bulkItems` + `bulkChecked` синхронно

## Daily quota

`status().dailyScans` (опциональное поле):
```typescript
{ used: 3, cap: 10, resetAt: '2026-05-23T00:00:00Z' }
```

UI рендерит "3 of 10 scans left today" pill. Когда `used >= cap` — Scan
button заблокирован preemptively (без сетевого роундтрипа за 429).

## Cosmic loader

Кастомный animated loader (`feat(gmail-import): cosmic inbox sweep loader`)
показывает прогресс: `progress.emailsScanned / total` + текущий этап
(`fetching` → `parsing` → `analyzing`). Адаптивный к теме.

## Empty / error states

- `connected && no result && status=completed && candidates=[]` → "We
  didn't find any subscriptions" с explainer (не silent blank screen)
- Connection expired (refresh token revoked) → auto-disconnect через
  NoticeBanner + "Reconnect" action
- 404 на resume → "Scan expired" + новый Scan CTA

## Связанные страницы

- [[ai-features]] — AI парсинг чеков (тот же конвейер что для голоса/скрин)
- [[paywall]] — gate с `feature` аттрибуцией
- [[notifications]] — push deep-link на завершение scan
- [[subscriptions]] — bulk create
- [[review-prompt]] — `gmail_import_complete` trigger
