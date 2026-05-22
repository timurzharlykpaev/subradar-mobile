---
title: "Workspace / Team"
tags: [workspace, team, организация, командные-фичи, экран]
sources:
  - app/(tabs)/workspace.tsx
  - src/api/workspace.ts
  - src/hooks/useWorkspaceAnalysis.ts
  - src/components/InviteCodeSheet.tsx
  - src/components/JoinTeamSheet.tsx
  - src/components/TransferOwnershipSheet.tsx
  - src/components/TeamOverlaps.tsx
  - src/components/TeamSpendChart.tsx
  - src/components/MemberDetailSheet.tsx
updated: 2026-05-22
---

# Workspace / Team

Команда — это shared workspace для Team тарифа: пользователь и его близкие
видят общие подписки, dedup-овые расходы (если оба платят за Netflix), и
получают командный AI-анализ перекрытий.

## Когда показывается

Таб `Workspace` (`app/(tabs)/workspace.tsx`) виден всем пользователям. Поведение
зависит от плана (см. [[billing]] → `useEffectiveAccess`):

| Состояние | UI |
|-----------|-----|
| `!workspace` | Empty state: "Create team" + "Join team by code" |
| Есть workspace, но `plan !== 'organization'` | Read-only список + grace banner |
| Team owner | Полное управление: invite, remove, transfer, delete |
| Team member | Список + кнопка "Leave team" |

## API surface

`workspaceApi` ([[state-management]] → `src/api/workspace.ts`):

| Метод | Endpoint | Кто может |
|-------|----------|-----------|
| `getMe()` | `GET /workspace/me` | Все |
| `getAnalytics({displayCurrency})` | `GET /workspace/me/analytics` | Все участники |
| `create(name)` | `POST /workspace` | Любой Pro/Team |
| `invite(wsId, email, role)` | `POST /workspace/:id/invite` | Owner |
| `generateInviteCode(wsId)` | `POST /workspace/:id/invite-code` | Owner |
| `joinByCode(code)` | `POST /workspace/join/:code` | Любой |
| `removeMember(wsId, memberId)` | `DELETE /workspace/:id/members/:m` | Owner |
| `leave(wsId)` | `POST /workspace/:id/leave` | Member |
| `deleteWorkspace(wsId)` | `DELETE /workspace/:id` | Owner |
| `transferOwnership(wsId, memberId, confirm)` | `POST /workspace/:id/transfer-owner` | Owner |
| `rename(wsId, name)` | `PATCH /workspace/:id` | Owner |
| `changeRole(wsId, memberId, role)` | `PATCH /workspace/:id/members/:m/role` | Owner |
| `getAnalysisLatest()` | `GET /workspace/me/analysis/latest` | Все |
| `runAnalysis()` | `POST /workspace/me/analysis/run` | Owner |
| `generateTeamReport(type, opts)` | `POST /workspace/me/reports` | Owner |

## Invite / Join поток

### Invite Code (предпочтительный)

```
Owner → generateInviteCode() → 6-значный код + expiresAt
      → InviteCodeSheet показывает + Share
Joiner → JoinTeamSheet → joinByCode(code)
       → invalidate ['workspace']
```

Коды одноразовые, expire через несколько дней (backend rule).

### Direct invite (email)

```
Owner → invite(workspaceId, email, role='MEMBER')
      → backend отправляет email с magic link
```

## Transfer Ownership

Two-step безопасный паттерн:

1. Owner выбирает target member из списка → `setTransferTarget(member)`
2. Открывается `TransferOwnershipSheet` — пользователь печатает literal
   `TRANSFER` (backend проверяет `confirm === 'TRANSFER'`)
3. `workspaceApi.transferOwnership(wsId, memberId, 'TRANSFER')`
4. После success: invalidate `workspace` + `billing` (биллинг может перейти
   на нового владельца)

Старый owner автоматически становится `ADMIN` — сохраняет повседневные права,
теряет owner-only операции (delete, transfer, generate team report).

## Team Analytics

`useQuery(['workspace-analytics', currency])` →
`workspaceApi.getAnalytics({ displayCurrency })`.

Возвращает:
- `totalMonthly` — общий месячный расход команды
- `memberCount` — количество активных участников
- `members[]` — разбивка по участникам (имя, подписки, сумма)
- `displayCurrency` — валюта ответа сервера

### Client-side FX-конвертация

Бэкенд иногда возвращает суммы в `users.displayCurrency` (stale persisted
value) вместо запрошенной. Workspace screen **client-converts** через
`convertAmount(n, serverCurrency, displayCurrency)` из `fxCache` — fallback
на сырое число если FX cache не загрузился. См. [[currency-system]].

## AI анализ команды (`useWorkspaceAnalysisLatest`)

Хук в `src/hooks/useWorkspaceAnalysis.ts`:

```typescript
useWorkspaceAnalysisLatest() → useQuery(['workspace-analysis', 'latest'])
useRunWorkspaceAnalysis()    → useMutation → invalidate ['workspace-analysis']
```

Результат `analysisData.result`:
- `teamSavings` — потенциальная экономия от устранения перекрытий
- `overlaps[]` — группы дубликатов (несколько участников платят за один сервис)

UI компонент `TeamOverlaps` визуализирует.

## Компоненты

| Компонент | Назначение |
|-----------|-----------|
| `InviteCodeSheet` | Bottom sheet с кодом + share |
| `JoinTeamSheet` | Ввод кода (для joiner) |
| `TransferOwnershipSheet` | Confirm with typed literal |
| `MemberDetailSheet` | Подробности по члену команды |
| `TeamOverlaps` | Список перекрывающихся подписок |
| `TeamSpendChart` | Stacked chart расходов по членам |
| `TeamExplainerModal` | Объяснение что такое Team |

## Pull-to-refresh

`handleRefresh()` запускает:
1. `reconcileBillingDrift()` — синхронизация RC ↔ backend (важно тут — самое
   видимое место drift'а: Team banner показывает "ends in N days" пока
   Apple говорит что подписка обновится)
2. `refetchQueries` для `billing`, `workspace`, `workspace-analytics`,
   `workspace-analysis`

## Обработка ошибок

Все мутации (create, remove, leave, delete, transfer) используют
`NoticeBanner` вместо `Alert.alert` — единый стиль с экранами Gmail Import
и Reports.

## Связанные страницы

- [[billing]] — `useEffectiveAccess`, Team plan, grace period
- [[currency-system]] — client-FX-конвертация на team-analytics
- [[reports]] — team report (toggle Personal / Team)
- [[state-management]] — workspace query keys
- [[navigation]] — таб Workspace
