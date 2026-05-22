# Wiki Log

## 2026-05-22 — Major refresh

- Добавлено: workspace, gmail-import, reports, review-prompt, paywall, cards
- Обновлено: subscriptions, billing, notifications, state-management, onboarding, known-issues, ai-features
- Обновлён index.md — новые страницы в категориях Сущности, Экраны и UI, Фичи
- Причина: за месяц добавилось много фич — Team UI (workspace.tsx + transfer ownership + team analytics), Gmail сканирование (background scan job, persistence, daily quota), reports на мобиле с PDF/CSV экспортом, RevenueCat IAP integration с sync retry, review prompt state machine с wow-moment triggers, payment cards CRUD. Также зафиксированы недавние fixes: f0d2d2b (reports freeze), 32c2835 (reminderDays), 335c40a (i18n {{names}}), и добавлен раздел App Store backward compatibility в known-issues.

## 2026-04-16 — Создание wiki

- Добавлено: SCHEMA.md, index.md, log.md
- Добавлено 14 страниц:
  - overview, architecture, navigation, state-management
  - subscriptions, billing
  - theme, analytics, onboarding
  - auth, currency-system
  - ai-features, notifications
  - known-issues
- Причина: инициализация LLM Wiki на основе кодовой базы, CLAUDE.md и docs/
