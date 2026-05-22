---
title: "Экран экспорта PDF и CSV"
tags: [экспорт, pdf, csv, экран, expo-file-system]
sources:
  - app/reports/index.tsx
  - src/api/reports.ts
  - src/services/csvExport.ts
  - src/api/workspace.ts
updated: 2026-05-22
---

# Экран экспорта PDF и CSV

Экран `app/reports/index.tsx` — генерация и экспорт сводок о подписках.
Поддерживает PDF (серверно) и CSV (локально).

## UI

- **Тип сводки:** Summary / Detailed / Tax (radio)
- **Period:** This month / This quarter / This year
- **Format:** PDF / CSV
- **Scope:** Personal / Team (только для team owner)

Free plan hint показывается до нажатия Generate, чтобы юзер не узнавал
о квоте после 403.

## Поток PDF

```
1. POST /reports/generate (или /workspace/me/reports для team) →
   { id, status: 'GENERATING' }

2. Poll GET /reports/:id каждые 2s, max 15 итераций (30s wall-clock)
   → READY | FAILED

3. FileSystem.downloadAsync(`${API_URL}/reports/:id/download`, localPath,
   { headers: { Authorization } }) → файл в documentDirectory

4. setGenerating(false) ДО Sharing — спиннер не сидит поверх share sheet

5. Sharing.shareAsync(localPath, { mimeType: 'application/pdf', UTI:
   'com.adobe.pdf' }) — fire-and-forget
```

## Freeze fix (commit `f0d2d2b`)

До этого фикса прерванный network mid-PDF-request оставлял экран frozen на
спиннере — RN's `fetch` не имеет default timeout, dropped connection
никогда не резолвится, `finally` блок не выполняется.

Исправления:

1. `fetchWithTimeout` wrapper — `AbortController` с timeout 25s для
   create/download, 8s для poll. AbortError surfaces dedicated "Connection
   lost" notice + Retry action.
2. Per-poll-iteration error swallow — single dropped poll не убивает
   весь flow, цикл продолжает попытки на оставшихся итерациях.
3. `setGenerating(false)` ДО `Sharing.shareAsync` — iOS share sheet hangs
   больше не блокируют экран на "Downloading…".

```typescript
const fetchWithTimeout = async (url, init = {}) => {
  const ms = init.ms ?? 25000;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(tid); }
};
```

## Plan-aware error handling

Раньше 403 ВСЕГДА показывало "Free plan: 1 report/month" — некорректно для
Pro/Team пользователей, кому 403 пришёл по другой причине (rate-limit,
disabled-for-org). Сейчас:

| Status | Free user | Pro/Team user |
|--------|-----------|---------------|
| 403 | "Free plan limit" + Upgrade CTA → /paywall | "Report unavailable" + backend message verbatim |
| 401 | "Session expired" | "Session expired" |
| 404 | backend message или "Report not found" | то же |
| AbortError | "Connection lost" + Retry | "Connection lost" + Retry |

## CSV экспорт

Локальный, без сервера:
```typescript
exportSubscriptionsCsv(subscriptions) // из src/services/csvExport.ts
```
Генерируется на устройстве из `subscriptionsStore` → `Sharing.shareAsync()`.
Безлимит на всех планах.

## Personal / Team scope (для Team owner)

Toggle виден только когда `access.isTeamOwner && access.plan === 'organization'`.

- `personal` → `POST /reports/generate` — личные подписки юзера
- `team` → `workspaceApi.generateTeamReport(type, { from, to, locale,
  displayCurrency })` → агрегат всех членов + breakdown + overlap savings

Полленинг и download — единый flow через тот же `reportId`.

## Передача displayCurrency

```typescript
const reportCurrency = (displayCurrency || currency || 'USD').toUpperCase();
```

Передаётся в body запроса → backend форматирует PDF в этой валюте, независимо
от `users.displayCurrency` на сервере. См. [[currency-system]].

## Analytics events

- `report_generated { type, format, period, scope? }` — после успешной генерации
  PDF или CSV

## Связанные страницы

- [[billing]] — Free plan = 1 PDF/month, Pro = unlimited
- [[workspace]] — team scope toggle, owner-only
- [[currency-system]] — reportCurrency
- [[known-issues]] — fix `f0d2d2b` — freeze-on-interrupt
