# SubRadar AI — Manual QA Checklist v1.4.0

**Дата актуализации:** 2026-04-19
**Предыдущая версия:** [2026-04-14-manual-qa-checklist.md](./2026-04-14-manual-qa-checklist.md) (v1.3.0)

## Изменения с v1.3.0

- **Billing state machine** (backend) — webhooks идут через state machine + outbox worker + reconciliation cron
- **Email compliance sprint** — suppression list, Resend webhook, List-Unsubscribe на всех массовых email, CAN-SPAM footer, HMAC unsubscribe URL, reminder idempotency
- **Paywall recovery UX** — SyncRetryModal после 3 неудачных sync, pending-receipt recovery на старте, async RC configure, fail-fast на тестовом ключе в prod
- **RestorePurchasesButton** — единый компонент на paywall + settings (link-style)
- **BannerRenderer** — один приоритет-роутер вместо inline-рендеров; порядок: `billing_issue → grace → expiration → double_pay → annual_upgrade → win_back`
- **useEffectiveAccess** — единственный источник правды для limits (`usePlanLimits` удалён), `nextPaymentDate` приходит из backend (локально не считается)
- **Product IDs from backend** — `access.products.*` вместо хардкода; если offerings не загрузились за 10 сек — показываем "prices unavailable" карточку вместо fallback-цен
- **subscriptionsStore без AsyncStorage** — TanStack Query единственный cache
- **Rate limits** (backend) — checkout 5/min, sync 10/min, cancel 3/min, trial 1/min
- **Workspace audit + amplitude** — все membership-изменения логируются; create/invite за `PlanGuard` + `RequirePlanCapability`

---

**Как пользоваться:** Идёшь по разделам сверху вниз, отмечаешь `☐ → ✅` галочкой при прохождении. Если пункт не прошёл — пометь `❌` и опиши проблему в [Failed Items Log](#failed-items-log).

**Приоритеты:**
- **P0** — блокер релиза (если не работает — НЕ выпускать)
- **P1** — важно (нужно исправить до следующего build)
- **P2** — nice to have (можно отложить)

**Покрытие:** функционал + визуал (Inter шрифт, градиенты, тени) + переводы 10 локалей + edge cases + state-machine сценарии.

---

## 1. Pre-release Setup

### 1.1 Устройства и окружения

| Что | Зачем |
|-----|-------|
| iPhone с последним TestFlight билдом (v1.4.0, build 44+) | Основное тестирование |
| Sandbox Apple ID | Settings → App Store → Sandbox Account |
| 2 email аккаунта в приложении | Team Owner + Team Member |
| Airplane mode | Offline сценарии |
| Dark mode + Light mode | Визуальная проверка обеих тем |
| Gmail + Yahoo + Apple Mail (web) | Проверка List-Unsubscribe UI |

### 1.2 Тестовые данные и сервисы

| Что | Где |
|-----|-----|
| Review account | `review@subradar.ai` / OTP `000000` |
| RevenueCat dashboard | app.revenuecat.com → Subscribers |
| Resend dashboard | resend.com → Emails / Webhooks (проверить подпись `RESEND_WEBHOOK_SECRET` выставлен) |
| Backend logs | `ssh droplet → docker logs subradar-api-prod -f` |
| Billing health endpoint | `curl -H "x-health-token: $BILLING_HEALTH_TOKEN" https://api.subradar.ai/api/v1/health/billing` |
| Admin DB доступ | `psql` для проверки `suppressed_emails`, `outbox_events`, `webhook_events`, `user_trials` |

### 1.3 Перед каждым прогоном

- [ ] Удалить приложение с iPhone (чистый state, AsyncStorage очищен) — P0
- [ ] Sandbox account вышел из предыдущих тестов — P0
- [ ] `curl https://api.subradar.ai/api/v1/billing/plans` → 200 — P0
- [ ] `curl https://api.subradar.ai/api/v1/health/billing` → `webhookFailureRate < 0.05`, `outboxFailed < 10` — P0
- [ ] TestFlight билд обновлён — P0
- [ ] Подписки в App Store Connect → "Готово к продаже" — P0
- [ ] Paid Applications Agreement = Active — P0
- [ ] Resend Webhook подписан на `email.bounced` + `email.complained` — P1
- [ ] `RESEND_WEBHOOK_SECRET` и `BILLING_HEALTH_TOKEN` выставлены в GitHub Actions secrets — P1

---

## 2. Onboarding

**Путь:** Первый запуск приложения (6 слайдов: 0–5)

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 2.1 | New User | Открыть app 1й раз | Слайд 0: "Money hook" — $624 counter с анимацией | P0 | ☐ |
| 2.2 | New User | Quick-add чипсы (Netflix, Spotify) | При выборе — цветная тень вокруг чипса | P1 | ☐ |
| 2.3 | New User | "Начать — это бесплатно" | Градиентная кнопка #6C47FF → #9B7AFF, Inter-Bold | P1 | ☐ |
| 2.4 | New User | Свайп → | Слайд 1: выбор языка (10 флагов) | P0 | ☐ |
| 2.5 | New User | Выбрать "Қазақша" | UI моментально переключается на казахский | P0 | ☐ |
| 2.6 | New User | Слайд 2: валюта | Выбор USD/EUR/GBP/KZT/RUB/UAH/TRY | P0 | ☐ |
| 2.7 | New User | Слайд 3: логин | Apple / Google / Email кнопки | P0 | ☐ |
| 2.8 | New User | Нет бейджа "7 дней Pro" в онбординге | Удалён (триал теперь через paywall) | P0 | ☐ |
| 2.9 | New User | Слайд 4: уведомления | "Не пропускай платежи", оранжевая кнопка-колокольчик | P1 | ☐ |
| 2.10 | New User | Слайд 5: финальный showcase | Ценностное предложение + CTA на Dashboard | P0 | ☐ |
| 2.11 | New User | Тап "Пропустить/Продолжить" на любом слайде | Переход на Dashboard | P0 | ☐ |
| 2.12 | Re-open | Выйти из аккаунта и зайти заново | Онбординг НЕ показывается повторно (флаг `welcome_shown`) | P1 | ☐ |
| 2.13 | Long name input | Имя 50+ символов | Truncate без крашей | P2 | ☐ |
| 2.14 | Dark mode | В онбординге | Все слайды корректны в тёмной теме | P1 | ☐ |
| 2.15 | Fresh install после v1.3.x | Нет AsyncStorage cache подписок | Onboarding показывается нормально, старый кэш не мигрируется | P1 | ☐ |

---

## 3. Auth

**Путь:** Слайд логина в онбординге или после logout

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 3.1 | New User | Тап "Apple" | Нативный Apple Sign In sheet | P0 | ☐ |
| 3.2 | Apple auth | Cancel | Возврат к слайду логина, нет ошибок | P1 | ☐ |
| 3.3 | Apple auth | Success | Dashboard, plan: free | P0 | ☐ |
| 3.4 | New User | Тап "Google" | Google OAuth sheet | P0 | ☐ |
| 3.5 | Google auth | Success | Dashboard, plan: free | P0 | ☐ |
| 3.6 | New User | Тап "Email" | OTP форма | P0 | ☐ |
| 3.7 | Email flow | Ввести `review@subradar.ai` | Не показывает что отправили письмо (ок) | P1 | ☐ |
| 3.8 | Email flow | OTP `000000` | Вход успешен (test bypass) | P0 | ☐ |
| 3.9 | Email flow | Ввести невалидный OTP 5 раз | Error message "Invalid code" | P2 | ☐ |
| 3.10 | Logout | Settings → Logout | Редирект на онбординг, RC identity cleared | P0 | ☐ |
| 3.11 | Logout | Снова зайти другим аккаунтом | `trial_offered` / `welcome_shown` очищены, `pending_receipt` очищен | P1 | ☐ |
| 3.12 | Delete account | Settings → Delete account | Подтверждение + полное удаление (включая `suppressed_emails` по email) | P1 | ☐ |
| 3.13 | Pending receipt recovery | Вход с активной RC-подпиской, но backend не знает | На старте мобильный делает `POST /billing/sync-revenuecat` → plan=pro в течение секунд | P0 | ☐ |
| 3.14 | RC configure async | Apple Sign-In до завершения `configureRevenueCat()` | Авторизация проходит, RC identify потом донастраивается | P1 | ☐ |

---

## 4. Dashboard

**Путь:** Tab "Главная"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 4.1 | New User, 0 subs | Открыть таб | WelcomeSheet "Добавь первую подписку" | P0 | ☐ |
| 4.2 | Free User, 1+ sub | Hero card | Gradient #6C47FF → #4A2FB0, Inter-ExtraBold, purple shadow | P1 | ☐ |
| 4.3 | Free User | Бейдж FREE справа вверху | Серый #6B7280, локализованный текст | P0 | ☐ |
| 4.4 | Free User, добавил 1-ю sub | — | TrialOfferModal через ~0.5с | P0 | ☐ |
| 4.5 | Free User, Skip TrialOffer | Повторно добавить sub | Модалка НЕ появляется снова | P1 | ☐ |
| 4.6 | Pro User, 5+ subs | Dashboard | Team Upsell карточка "Раздели и сэкономь" | P1 | ☐ |
| 4.7 | Pro User, 8+ subs | Dashboard | TeamUpsellModal (один раз за жизнь юзера) | P1 | ☐ |
| 4.8 | Pro User | Hero + бейдж PRO (#8B5CF6) | Правильно определяет Pro | P0 | ☐ |
| 4.9 | Pro User (trial active) | Badge | PRO + счётчик "7d left" если есть `trialDaysLeft` | P1 | ☐ |
| 4.10 | Team Owner | Бейдж | TEAM (cyan #06B6D4) | P0 | ☐ |
| 4.11 | Team Member (без своего Pro) | Бейдж | TEAM MEMBER (cyan) | P0 | ☐ |
| 4.12 | Pull-to-refresh | Тянуть вниз | Индикатор, `/billing/me` + подписки обновляются | P1 | ☐ |
| 4.13 | Любой с subs | Тап на карточку в "Активные подписки" | Открывается `subscription/[id]` | P0 | ☐ |
| 4.14 | Offline | Airplane mode | OfflineBanner сверху, кэш TanStack Query работает | P1 | ☐ |
| 4.15 | Длинное имя sub (40+ символов) | В списке | Truncate с `...` | P2 | ☐ |
| 4.16 | Dark ↔ Light | Переключить тему | Цвета меняются, hero gradient сохраняется | P1 | ☐ |
| 4.17 | RU локаль | Все тексты | Полный перевод, без fallback на английский | P1 | ☐ |
| 4.18 | "Tap +" FAB | Центр tab bar | Открывает AddSubscriptionSheet | P0 | ☐ |
| 4.19 | Прогноз блок | — | 3 карточки: 1 / 6 / 12 месяцев | P1 | ☐ |

### 4.2 BannerRenderer (приоритет)

**BannerRenderer** — единственный рендер баннера, читает `access.banner.priority` из `/billing/me`. Порядок приоритета определён на backend:
`billing_issue → grace → expiration → double_pay → annual_upgrade → win_back → none`.

| # | Сценарий (состояние юзера) | Ожидаемый баннер | P | ✓ |
|---|----------------------------|------------------|---|---|
| 4.20 | User с `billingIssueAt` (Apple billing retry) | BillingIssueBanner красный "Платёж не прошёл" | P0 | ☐ |
| 4.21 | Grace period active (`billing_status=grace`) | GraceBanner оранжевый с днями до конца | P0 | ☐ |
| 4.22 | Pro cancelAtPeriodEnd=true | ExpirationBanner "Доступ до DD.MM" | P0 | ☐ |
| 4.23 | Team Member + own Pro | DoublePayBanner жёлтый "У тебя Pro и Team" | P0 | ☐ |
| 4.24 | Pro Monthly, >6 мес | AnnualUpgradeBanner (экономия X/год) | P1 | ☐ |
| 4.25 | Cancelled/expired >30 days | WinBackBanner | P2 | ☐ |
| 4.26 | Одновременно billing_issue + grace | Показан ТОЛЬКО billing_issue (высший приоритет) | P0 | ☐ |
| 4.27 | Amplitude event | `banner_shown` с `priority` value при рендере | P1 | ☐ |
| 4.28 | Тап на баннер | `banner_action_tapped` + корректный переход | P1 | ☐ |

### 4.3 Быстрые действия

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 4.29 | Любой | Быстрые действия | 3 кнопки: Добавить / Отчёт / Pro (или Team для Pro) | P1 | ☐ |
| 4.30 | Free User, AITeaser | — | Баннер "AI найдёт экономию" | P2 | ☐ |
| 4.31 | Free User, 4+ subs | Degraded mode | Сумма из первых 3, "{{count}} подписок скрыто" | P0 | ☐ |
| 4.32 | Дубли в подписках | 2 Netflix | Duplicate Categories блок, "2 совпадения" | P2 | ☐ |

---

## 5. Add Subscription

**Путь:** FAB "+" или Dashboard → "Добавить"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 5.1 | Free User | Открыть sheet | AI input сверху, популярные сервисы, microphone, camera | P0 | ☐ |
| 5.2 | Любой | Тап на Netflix в Popular | Быстрое добавление с иконкой (не тратит AI кредит) | P0 | ☐ |
| 5.3 | Любой | Ввести "Netflix 15.99/mo" | AI распознаёт → InlineConfirmCard | P0 | ☐ |
| 5.4 | Любой | Ввести "Netflix, Spotify" | BulkAddSheet появляется с list | P1 | ☐ |
| 5.5 | Любой | Тап microphone → сказать | Transcribing indicator → результат | P1 | ☐ |
| 5.6 | Любой | Тап camera → screenshot | AI parse-screenshot → результат | P1 | ☐ |
| 5.7 | Любой | "или введите вручную" | Manual form открывается | P0 | ☐ |
| 5.8 | Manual form | Заполнить всё + Сохранить | Sub добавлен, sheet закрывается | P0 | ☐ |
| 5.9 | Manual form | Период "Ежемесячно" → RU | Переведён | P1 | ☐ |
| 5.10 | Manual form | Reminder по дефолту | Выбран "3 дня" (для новой sub) | P1 | ☐ |
| 5.11 | Manual form | Категории | Переведены на RU/EN | P1 | ☐ |
| 5.12 | Manual form | Billing day | 1-31 (clamp'ится при вводе вне диапазона) | P1 | ☐ |
| 5.13 | Manual form | Date pickers | Pure JS календарь (не нативный DateTimePicker) | P1 | ☐ |
| 5.14 | Manual form | Numeric keyboards (iOS) | Кнопка "Done" присутствует | P1 | ☐ |
| 5.15 | Free User, уже 3 sub | Попытка 4-ю sub | Alert "Лимит Free: 3. Перейти на Pro?" (читает `access.limits.subscriptions.used`) | P0 | ☐ |
| 5.16 | Free User | Нажать "Перейти на Pro" в Alert | Sheet закрывается → paywall | P0 | ☐ |
| 5.17 | Free User, BulkAdd 6 subs | — | Добавляется 3, Alert "Added 3 of 6: Netflix, Disney+..." | P0 | ☐ |
| 5.18 | Free User, лимит AI (5/5) | Voice/Text AI | Alert "AI limit reached. Upgrade to Pro" (читает `access.limits.aiRequests`) | P0 | ☐ |
| 5.19 | Pro User, лимит AI (200/200) | Voice | Alert с CTA "Upgrade to Team — 1000 AI" | P1 | ☐ |
| 5.20 | AI parse fail | — | Error message "Could not parse, try again" | P2 | ☐ |
| 5.21 | Offline | Попытка AI | Offline error, manual работает | P1 | ☐ |
| 5.22 | Close sheet | Swipe down | Sheet закрывается, state не сохраняется | P1 | ☐ |
| 5.23 | Категория иконка | После добавления | CategoryBadge с правильной иконкой | P2 | ☐ |
| 5.24 | AudioRecorder | Микрофон denied | Alert с объяснением, manual доступен | P1 | ☐ |
| 5.25 | Camera denied | Screenshot flow | Alert с объяснением, offer "выбрать из галереи" | P1 | ☐ |

---

## 6. Subscriptions List

**Путь:** Tab "Подписки"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 6.1 | Любой | Открыть tab | Summary: Active count, total/mo, N/3 progress (Free) или N (Pro) | P0 | ☐ |
| 6.2 | Любой | Фильтры | Все / Активные / Trial / Отменённые | P0 | ☐ |
| 6.3 | Любой | Сортировка | По дате / Цена ↓ / Цена ↑ / А-Я | P1 | ☐ |
| 6.4 | Любой | Поиск (иконка лупы) | Filter по имени | P2 | ☐ |
| 6.5 | Любой | SubscriptionCard | Inter-Bold имя, Inter-Bold сумма, period переведён | P1 | ☐ |
| 6.6 | Free User, 4+ subs | Degraded mode | LockedSubscriptionCard placeholders (видно 3, остальные скрыты) | P0 | ☐ |
| 6.7 | Degraded mode | Banner "Скрыто X подписок" | Фиолетовый, Tap → paywall | P0 | ☐ |
| 6.8 | Degraded mode | Тап на locked card | Alert "Get Pro to see N subs" | P0 | ☐ |
| 6.9 | Pro User, 2+ subs same category | Над списком | Duplicate banner "Enable Team" | P1 | ☐ |
| 6.10 | Любой | Тап на card | Открывается `subscription/[id]` | P0 | ☐ |
| 6.11 | Любой | Swipe card → Delete | Subscription удалена, UndoToast 5s | P1 | ☐ |
| 6.12 | Empty state | 0 sub | Иконка + "Добавь первую подписку" | P1 | ☐ |
| 6.13 | Trial sub | Badge | Оранжевый "Trial" + "N days" | P1 | ☐ |
| 6.14 | Cancelled sub | Badge | Серый "Cancelled" | P1 | ☐ |
| 6.15 | Next payment date | Отображение | Локализованный формат даты (из backend, не локальный расчёт) | P2 | ☐ |
| 6.16 | AsyncStorage drop | Kill app → open (airplane mode) | Видны кэшированные подписки из TanStack Query в памяти (если app не убивался полностью); после cold-start в offline — empty state + OfflineBanner | P0 | ☐ |
| 6.17 | Быстрое редактирование | Отредактировать sum + save | `nextPaymentDate` обновляется из backend ответа | P0 | ☐ |

---

## 7. Subscription Detail & Edit

**Путь:** Тап на карточку подписки

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 7.1 | Любой | Открыть detail | Иконка, имя, сумма + period переведён ("/ Ежемесячно") | P0 | ☐ |
| 7.2 | Pro User (не Team) | Внутри detail | TeamHint "Есть другие в семье с {name}?" | P1 | ☐ |
| 7.3 | Любой | Статус (Active/Trial/Cancelled) | Бейдж с цветом | P1 | ☐ |
| 7.4 | Любой | Reminder блок | Показывает реальное значение (не хардкод [3]) | P0 | ☐ |
| 7.5 | Любой | Следующий платёж | Дата из backend `nextPaymentDate` (локально не пересчитывается) | P0 | ☐ |
| 7.6 | "In N days" badge | При следующем платеже < 7 дней | Бейдж "in N days" оранжевый/красный | P1 | ☐ |
| 7.7 | Любой | Тап "Edit" | EditSubscriptionSheet | P0 | ☐ |
| 7.8 | Edit sheet | Reminder состояние | Реальное значение из подписки (или "Off" если null) | P0 | ☐ |
| 7.9 | Edit sheet | Категория | Переведена на RU/EN | P0 | ☐ |
| 7.10 | Edit sheet | Период оплаты | Переведён (Ежемесячно, Ежегодно) | P0 | ☐ |
| 7.11 | Edit sheet | Изменить day + Сохранить | `nextPaymentDate` обновляется (refetch после save) | P0 | ☐ |
| 7.12 | Edit sheet | Edit/delete icons размер | Увеличены (видны, не обрезаются) | P2 | ☐ |
| 7.13 | Cancel URL есть | Кнопка "Отменить подписку" | Открывает URL в браузере | P1 | ☐ |
| 7.14 | Любой | Тап "Удалить" | Подтверждение → удаление | P0 | ☐ |
| 7.15 | Нет секции "Чеки" | — | Удалена (не показывается) | P1 | ☐ |
| 7.16 | Длинное имя | 50+ символов | Truncate | P2 | ☐ |
| 7.17 | Tags выбраны в Add | В detail | Теги отображаются, selection консистентна | P1 | ☐ |

---

## 8. Analytics

**Путь:** Tab "Аналитика"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 8.1 | Free User | Открыть tab | Stats: avg/mo, year total, active count | P0 | ☐ |
| 8.2 | Любой | Monthly chart | Bar chart 12 месяцев, активный — выше | P1 | ☐ |
| 8.3 | Degraded mode | Под графиком | Hint "Без скрытых: USD X/mo" | P0 | ☐ |
| 8.4 | Pro User (не Team), 20+ USD/mo | — | Team savings card "Сэкономь USD X/год" | P1 | ☐ |
| 8.5 | Любой | Category donut chart | По категориям, переведены | P0 | ☐ |
| 8.6 | Pro User | Duplicates блок | Subscription overlaps по категориям | P2 | ☐ |
| 8.7 | PERIOD_SHORT | "/мес", "/год" в топ-5 | Переведены (не хардкод "mo", "yr") | P1 | ☐ |
| 8.8 | Free User | AI audit | Заблокировано, CTA "Upgrade to Pro" | P1 | ☐ |
| 8.9 | 0 подписок | Empty state | "Недостаточно данных" | P2 | ☐ |
| 8.10 | Dark mode | Графики | Цвета корректны в тёмной теме | P1 | ☐ |
| 8.11 | Forecast card | Рендер | Нет overflow, billingPeriod переведён | P1 | ☐ |
| 8.12 | Currency отличная от default | Все суммы пересчитаны | Client-side FX conversion для популярных сервисов | P1 | ☐ |

---

## 9. Workspace (Team)

**Путь:** Tab "Команда"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 9.1 | Free / Pro (не Team) | Открыть tab | Empty state с Feature list + CTA "Start Team — $9.99/mo" | P0 | ☐ |
| 9.2 | Free / Pro | Hero сверху если totalMonthly > 0 | "Ты тратишь $X/mo, с Team — $X/4" | P1 | ☐ |
| 9.3 | Free / Pro | Кнопка "Join Team" | JoinTeamSheet открывается | P0 | ☐ |
| 9.4 | Pro User с своим Pro | Join by code | Alert "У тебя уже есть Pro. Платить за оба?" | P0 | ☐ |
| 9.5 | Join flow | Неправильный код | Error "Invalid code" | P1 | ☐ |
| 9.6 | Join flow | Валидный код | Success, переход в Team view | P0 | ☐ |
| 9.7 | Team Owner | Workspace view | Название, member count, invite button | P0 | ☐ |
| 9.8 | Team Owner | Генерировать invite code | 10 символов, expires 48h | P0 | ☐ |
| 9.9 | Team Owner | Workspace expired | Red alert "Закроется через X дней" | P0 | ☐ |
| 9.10 | Team Member | Grace banner | "Owner перестал платить, осталось X дней" | P0 | ☐ |
| 9.11 | Team Owner | Список members | Имя + spend + status badge (own Pro / Grace / Team) | P1 | ☐ |
| 9.12 | Team Owner | Remove member | Удаление + confirmation | P1 | ☐ |
| 9.13 | Team Member | Кнопка "Leave team" | Подтверждение + выход + 7-day grace | P1 | ☐ |
| 9.14 | Team Owner | "Delete team" | Двойное подтверждение + удаление | P1 | ☐ |
| 9.15 | Team Owner | Team Spend Chart | Bar chart по members | P2 | ☐ |
| 9.16 | Team Owner | Team Overlaps | Показывает дубли в команде | P2 | ☐ |
| 9.17 | Team Owner | AI Analysis кнопка | Запускает team-wide анализ | P2 | ☐ |

### 9.2 Workspace gating (backend)

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 9.18 | Free user → `POST /workspace` | 403 "Plan does not allow creating team" (PlanGuard) | P0 | ☐ |
| 9.19 | Free user → `POST /workspace/invite` | 403 "Plan does not allow inviting" | P0 | ☐ |
| 9.20 | Concurrent invite (2 параллельных запроса) | Только один успешный, второй — 409/повтор (pessimistic lock) | P1 | ☐ |
| 9.21 | Audit логи | После create/invite/remove/role_change — запись в amplitude + audit_logs | P1 | ☐ |

---

## 10. Paywall

**Путь:** Любой upsell / Settings → Upgrade / Лимит достигнут

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 10.1 | Любой | Открыть paywall | 3 плана: Free / Pro / Team | P0 | ☐ |
| 10.2 | Любой | Toggle Monthly / Yearly | Цены обновляются из RevenueCat offerings по product IDs из `access.products` | P0 | ☐ |
| 10.3 | Yearly | Badge "BEST VALUE" | Зелёный | P1 | ☐ |
| 10.4 | Free User (canTrial) | Под Pro | "7 days free" hint (purple) | P0 | ☐ |
| 10.5 | Free User (canTrial) | CTA | "7 days free — Start Trial →" | P0 | ☐ |
| 10.6 | Free User | Нажать CTA Pro | Apple confirmation sheet "7 days free, then $X.XX/mo" | P0 | ☐ |
| 10.7 | Apple sheet | Face ID → Confirm | Purchase success, plan=pro (после sync с backend) | P0 | ☐ |
| 10.8 | Apple sheet | Cancel | Возврат на paywall, нет ошибок | P1 | ☐ |
| 10.9 | Pro User | Team плашка | Бейдж "Save $X/year" (green) с персональным расчётом | P1 | ☐ |
| 10.10 | Team User | Team бейдж | "CURRENT PLAN" (green) | P1 | ☐ |
| 10.11 | Любой | Disclaimer | "7-day free trial, then auto-renews. Cancel in iOS Settings" | P0 | ☐ |
| 10.12 | Любой | "Maybe later" | fontSize 13, opacity 0.5, dismissable | P1 | ☐ |
| 10.13 | Любой | Social proof card | "Found 4 forgotten subs. Saved $180" | P2 | ☐ |
| 10.14 | Любой | RestorePurchasesButton (внизу) | Восстанавливает подписку, syncает с backend | P0 | ☐ |
| 10.15 | Offerings не загрузились за 10 сек | Отображение | "Prices unavailable" карточка заменяет plan cards, CTA disabled | P0 | ☐ |
| 10.16 | Terms + Privacy links | Тапы | Открывают subradar.ai/legal/terms и /privacy | P1 | ☐ |
| 10.17 | Close (X) | Вверху справа | Появляется через 3с, закрывает paywall | P1 | ☐ |
| 10.18 | Trialing user | Бейдж сверху | Orange "N days trial active" | P1 | ☐ |
| 10.19 | Cancelled user | Бейдж сверху | "Cancelled — expires DD.MM" | P1 | ☐ |
| 10.20 | RU локаль | CTA + disclaimer | Переведены корректно | P1 | ☐ |

### 10.2 Sync retry + pending receipt (recovery UX)

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 10.21 | Покупка прошла на Apple, но `/billing/sync-revenuecat` падает | Автоматический retry 3 раза с backoff | P0 | ☐ |
| 10.22 | 3 retry исчерпаны | SyncRetryModal "Try again / Later" | P0 | ☐ |
| 10.23 | SyncRetryModal → "Try again" | Повторная попытка sync; на успехе — модалка закрывается, план активен | P0 | ☐ |
| 10.24 | SyncRetryModal → "Later" | Модалка закрывается, `pending_receipt` сохранён в AsyncStorage | P0 | ☐ |
| 10.25 | Закрыть приложение и открыть заново (с `pending_receipt`) | На старте — авто-попытка sync; на успехе — alert "Подписка активирована" | P0 | ☐ |
| 10.26 | Amplitude events | `sync_retry_attempt` × N, `sync_retry_succeeded` ИЛИ `sync_retry_exhausted` | P1 | ☐ |
| 10.27 | Все строки SyncRetryModal | Переведены в 10 локалях (`sync_retry_*` keys) | P1 | ☐ |

### 10.3 Fail-fast + async RC init

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 10.28 | Prod build, `EXPO_PUBLIC_REVENUECAT_KEY_IOS` = `test_*` | App падает на старте с явной ошибкой (fail-fast) | P0 | ☐ |
| 10.29 | RC configure async | Login завершается до того, как RC identify готов — flow не блокируется | P1 | ☐ |
| 10.30 | `isPro` safe-default | До загрузки `/billing/me` — `isPro = false` (не undefined) | P1 | ☐ |

---

## 11. Settings

**Путь:** Tab "Настройки"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 11.1 | Любой | Profile card | Avatar, name, email, plan badge | P0 | ☐ |
| 11.2 | Free User | Бейдж | Серый "FREE" | P0 | ☐ |
| 11.3 | Free User (был Pro, degraded) | Бейдж + sub | "FREE" + "Was Pro" маленьким текстом | P1 | ☐ |
| 11.4 | Pro User | Бейдж | Purple "PRO" (#8B5CF6) | P0 | ☐ |
| 11.5 | Pro (trial) | Бейдж | "PRO" + статус "Active" / "Trial" | P1 | ☐ |
| 11.6 | Team Owner | Бейдж | Cyan "TEAM" (#06B6D4) | P0 | ☐ |
| 11.7 | Team Member (без Pro) | Бейдж | Cyan "TEAM MEMBER" | P0 | ☐ |
| 11.8 | Team Member + own Pro | Бейдж | Cyan "PRO + TEAM" | P0 | ☐ |
| 11.9 | Grace period | Бейдж | Orange "GRACE" + "Xd" остаток | P0 | ☐ |
| 11.10 | Profile row | AI used | `{used}/{limit} AI` из `access.limits.aiRequests` (limit не '∞' для Team) | P1 | ☐ |
| 11.11 | Free User | "Apple 7-day free trial" row | Открывает paywall | P1 | ☐ |
| 11.12 | Pro Monthly | Annual nudge | "Switch to Yearly — Save $X" карточка (только monthly, не trial) | P1 | ☐ |
| 11.13 | Pro User | "Manage Subscription" | CancellationInterceptModal | P0 | ☐ |
| 11.14 | Cancel flow (Pro) | "Cancel anyway" | RC Customer Center → на success `/billing/sync-revenuecat` | P0 | ☐ |
| 11.15 | Cancel flow (Trial) | — | Прямой `POST /billing/cancel` (не RC Customer Center) | P0 | ☐ |
| 11.16 | Cancel success | После returning | Alert "Subscription cancelled", billing обновлён | P0 | ☐ |
| 11.17 | RC UI недоступен | Cancel fallback | `POST /billing/cancel` напрямую через backend | P1 | ☐ |
| 11.18 | RestorePurchasesButton | Settings | Link-style (origin='settings'), ведёт в тот же flow что и на paywall | P0 | ☐ |
| 11.19 | Restore: подписки не найдены | Alert | "Не найдено — активных подписок на этом Apple ID не найдено" | P1 | ☐ |
| 11.20 | Restore: успех | Alert | "Покупки восстановлены" + invalidate billing cache | P0 | ☐ |
| 11.21 | Notifications toggle | Master switch | On/Off, сохраняется на backend | P1 | ☐ |
| 11.22 | Reminder days | Выбор 1/3/7 дней | Сохраняется | P1 | ☐ |
| 11.23 | Email notifications | Toggle | `PUT /notifications/settings` | P1 | ☐ |
| 11.24 | Weekly AI Digest | Toggle (только Pro) | Для Free заблокирован с замком | P1 | ☐ |
| 11.25 | Currency | Выбор | Обновляется везде, FX пересчёт | P1 | ☐ |
| 11.26 | Language | 10 языков (en/ru/es/de/fr/pt/zh/ja/ko/kk) | Моментальное переключение UI | P0 | ☐ |
| 11.27 | Date format | DD/MM / MM/DD / YYYY-MM-DD | Применяется в списках | P2 | ☐ |
| 11.28 | Dark mode toggle | On/Off | Все экраны реагируют | P1 | ☐ |
| 11.29 | Export CSV | Тап | Share sheet с CSV | P2 | ☐ |
| 11.30 | Replay Onboarding | Debug опция | Онбординг показывается снова | P2 | ☐ |
| 11.31 | Logout | Кнопка | Confirmation → logout → онбординг | P0 | ☐ |
| 11.32 | Delete Account | Кнопка (Danger) | Двойное подтверждение → удаление | P0 | ☐ |
| 11.33 | Version info | Внизу | v1.4.0 · Subradar | P2 | ☐ |

---

## 12. Billing Scenarios (sandbox + backend state machine)

**Путь:** Проверка реальных RC webhooks в sandbox + state machine корректность

### 12.1 Основные переходы state machine

| # | Роль | Действие | Ожидаем webhook → state | P | ✓ |
|---|------|----------|--------------------------|---|---|
| 12.1 | Free → Start Trial | Apple sheet → Confirm | `INITIAL_PURCHASE` → `trialing`, plan=pro, `user_trials` row создан | P0 | ☐ |
| 12.2 | Trial active | Settings badge | PRO + trial days | P0 | ☐ |
| 12.3 | Trial → auto-renew (sandbox accelerated) | Wait ~5 min | `RENEWAL` → `active`, plan stays pro | P0 | ☐ |
| 12.4 | Cancel trial before period end | Customer Center | `CANCELLATION` → state `cancelled_pending`, `cancelAtPeriodEnd=true` | P0 | ☐ |
| 12.5 | Trial cancel → wait for expiry | Sandbox 1 day | `EXPIRATION` → `free`, grace 7d | P0 | ☐ |
| 12.6 | Grace period starts | Dashboard | GraceBanner оранжевый | P0 | ☐ |
| 12.7 | After grace expires | Cron ~daily reconciliation | `state=free`, locked UI (degraded mode) | P0 | ☐ |
| 12.8 | Team Owner → EXPIRATION | Cascade | Все members получают `team_expired` grace | P0 | ☐ |
| 12.9 | Payment fails (change card) | In Customer Center | `BILLING_ISSUE` webhook → red banner | P0 | ☐ |
| 12.10 | Payment restored | Успешный retry | plan continues, banner исчезает | P0 | ☐ |
| 12.11 | Buy Team as Pro user | App Store purchase | `PRODUCT_CHANGE` → organization plan | P1 | ☐ |
| 12.12 | Uncancel | Через Customer Center | `UNCANCELLATION` → `cancelAtPeriodEnd=false` | P1 | ☐ |

### 12.2 Идемпотентность + outbox + reconciliation

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 12.13 | RC шлёт один и тот же webhook 2 раза (event_id совпадает) | 2й обрабатывается и dedup'ится (по claimWebhookEvent), state не меняется повторно | P0 | ☐ |
| 12.14 | Outbox handler (amplitude) падает | Retry до 10 раз с exp backoff, в `/health/billing` виден `outboxFailed++` | P1 | ☐ |
| 12.15 | Reconciliation cron | Запускается ежечасно, dry-run по умолчанию; включение feature flag — реально корректирует state | P1 | ☐ |
| 12.16 | User состояние разошлось с RC | Reconciliation исправляет при следующем запуске | P1 | ☐ |
| 12.17 | `webhook_events` row | Имеет `userId`, `eventType`, `error` (или null на success) | P2 | ☐ |

### 12.3 Trial concurrency

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 12.18 | Две попытки активации trial подряд (race) | Только один `user_trials` row, pessimistic lock защищает | P0 | ☐ |
| 12.19 | User уже использовал trial → `POST /billing/trial` | 409 "Trial already used" | P0 | ☐ |
| 12.20 | Rate limit `/billing/trial` | 1/min — 2й запрос в ту же минуту → 429 | P1 | ☐ |

### 12.4 Rate limiting

| # | Endpoint | Лимит | P | ✓ |
|---|----------|-------|---|---|
| 12.21 | `POST /billing/checkout` | 5/min → 6й = 429 | P1 | ☐ |
| 12.22 | `POST /billing/sync-revenuecat` | 10/min → 11й = 429 | P1 | ☐ |
| 12.23 | `POST /billing/cancel` | 3/min → 4й = 429 | P1 | ☐ |
| 12.24 | RC webhook (`/billing/webhook/revenuecat`) | БЕЗ лимита (webhook auth) | P0 | ☐ |
| 12.25 | LS webhook | БЕЗ лимита (webhook auth) | P0 | ☐ |

### 12.5 Health endpoint

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 12.26 | `GET /health/billing` без токена | 401 | P1 | ☐ |
| 12.27 | `GET /health/billing` с валидным токеном | JSON с `webhookEvents24h`, `webhookFailures24h`, `webhookFailureRate`, `outboxPending`, `outboxFailed` | P1 | ☐ |

---

## 13. Email Notifications (compliance + routes)

**Путь:** Проверка email рассылок + compliance

### 13.1 List-Unsubscribe на всех массовых email

| # | Email | List-Unsubscribe header | Unsub URL в футере | P | ✓ |
|---|-------|-------------------------|--------------------|---|---|
| 13.1 | Weekly digest | ✅ HMAC URL + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` | ✅ | P0 | ☐ |
| 13.2 | Payment reminder (за 3 дня) | ✅ | ✅ | P0 | ☐ |
| 13.3 | Monthly report | ✅ | ✅ | P0 | ☐ |
| 13.4 | Trial expiry warning | ✅ | ✅ | P0 | ☐ |
| 13.5 | Pro expiration 7-day notice | ✅ | ✅ | P0 | ☐ |
| 13.6 | Magic link / OTP | ❌ (транзакционный — намеренно БЕЗ) | ❌ | P0 | ☐ |
| 13.7 | Gmail UI | "Unsubscribe" кнопка показывается рядом с From | P1 | ☐ | |
| 13.8 | Yahoo Mail UI | То же | P2 | ☐ | |

### 13.2 Unsubscribe flow

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 13.9 | Тап "Unsubscribe" в email footer | HTML страница "You've been unsubscribed" + Subscribe back CTA | P0 | ☐ |
| 13.10 | URL содержит HMAC подпись | Tampered URL → 400 | P0 | ☐ |
| 13.11 | URL истёк (>30 дней) | 400 + reasonable error | P1 | ☐ |
| 13.12 | После unsubscribe | Settings → Weekly Digest toggle = OFF | P0 | ☐ |
| 13.13 | Subscribe back из страницы | Возвращает подписку на тот же unsubType | P1 | ☐ |

### 13.3 Suppression list + Resend webhook

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 13.14 | Отправка на bouncing inbox (hard bounce) | Resend шлёт `email.bounced` → ResendWebhookController → row в `suppressed_emails` с reason=`hard_bounce` | P0 | ☐ |
| 13.15 | Soft bounce | reason=`soft_bounce` | P1 | ☐ |
| 13.16 | Complaint (spam report) | `email.complained` → reason=`complaint` | P0 | ☐ |
| 13.17 | Повторная отправка на suppressed адрес | Silent skip, лог "Email skipped — ... is on the suppression list" | P0 | ☐ |
| 13.18 | Webhook с невалидной Svix подписью | 401, нет записи | P0 | ☐ |
| 13.19 | Webhook без `RESEND_WEBHOOK_SECRET` (dev) | Проверка пропускается (лог warn) | P2 | ☐ |

### 13.4 Footer (CAN-SPAM)

| # | Что | Ожидаем | P | ✓ |
|---|-----|---------|---|---|
| 13.20 | Физический адрес | "Goalin LLP · Astana, Kazakhstan" | P0 | ☐ |
| 13.21 | 3 ссылки | Unsubscribe (HMAC) / Privacy / Terms | P0 | ☐ |
| 13.22 | Preheader (hidden div) | ≤110 chars, контекст письма | P1 | ☐ |

### 13.5 Reminder idempotency

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 13.23 | Cron запускается 2 раза подряд в один UTC день | Reminder email отправляется ТОЛЬКО один раз (проверка `lastReminderSentDate`) | P0 | ☐ |
| 13.24 | Resend вернул 5xx | `lastReminderSentDate` НЕ обновляется, следующий cron попробует ещё раз | P0 | ☐ |

### 13.6 Delivery + PII

| # | Сценарий | Ожидаем | P | ✓ |
|---|----------|---------|---|---|
| 13.25 | Email notifications OFF в Settings | Payment reminders не приходят | P1 | ☐ |
| 13.26 | Free User | Weekly digest не приходит (только Pro) | P1 | ☐ |
| 13.27 | Логи backend | Email адреса маскированы (`maskEmail` — `u***@gmail.com`) | P1 | ☐ |
| 13.28 | DKIM + SPF | Настроены в Resend dashboard для `subradar.ai` | P0 | ☐ |

---

## 14. Cross-functional

### 14.1 Переводы (10 локалей)

| # | Локаль | Что проверять | P | ✓ |
|---|--------|---------------|---|---|
| 14.1.1 | RU | Все экраны полностью на русском | P0 | ☐ |
| 14.1.2 | EN | Все экраны на английском | P0 | ☐ |
| 14.1.3 | KK (казахский) | Ключевые экраны (onboarding, paywall, settings) | P1 | ☐ |
| 14.1.4 | DE / FR / ES | Paywall + disclaimer корректно | P2 | ☐ |
| 14.1.5 | ZH / JA / KO | Нет ломаных символов, корректная верстка | P2 | ☐ |
| 14.1.6 | PT | Paywall + settings | P2 | ☐ |
| 14.1.7 | Все локали | Новые ключи `sync_retry_*` переведены | P1 | ☐ |
| 14.1.8 | Все локали | Новые ключи billing refactor UI (limits, banners, restore) переведены | P1 | ☐ |

### 14.2 Тёмная/светлая тема

| # | Что | P | ✓ |
|---|-----|---|---|
| 14.2.1 | Переключение в Settings | P1 | ☐ |
| 14.2.2 | Dark mode: все экраны читаемы | P1 | ☐ |
| 14.2.3 | Light mode: все экраны читаемы | P1 | ☐ |
| 14.2.4 | Graident hero card не инвертируется | P2 | ☐ |
| 14.2.5 | Status bar цвет правильный (translucent Android) | P2 | ☐ |
| 14.2.6 | Все цвета из `useTheme()` (не хардкод из constants/COLORS) | P1 | ☐ |

### 14.3 Offline / плохой интернет

| # | Что | P | ✓ |
|---|-----|---|---|
| 14.3.1 | Airplane mode → Dashboard | P1 | ☐ |
| 14.3.2 | OfflineBanner показывается | P1 | ☐ |
| 14.3.3 | Кэш работает (TanStack Query in-memory) | P1 | ☐ |
| 14.3.4 | Online → автоматический sync | P1 | ☐ |
| 14.3.5 | Slow network (3G) — нет зависаний | P2 | ☐ |

### 14.4 Edge cases

| # | Что | P | ✓ |
|---|-----|---|---|
| 14.4.1 | Имя с emoji (🎬 Netflix) | P2 | ☐ |
| 14.4.2 | Очень длинное имя подписки (80+ chars) | P2 | ☐ |
| 14.4.3 | Сумма 10000.00 — не ломает верстку | P2 | ☐ |
| 14.4.4 | Список 50+ подписок (скролл плавный) | P2 | ☐ |
| 14.4.5 | Accessibility: Large text iOS — не ломается | P2 | ☐ |
| 14.4.6 | Поворот экрана (landscape) — игнор или работает | P2 | ☐ |
| 14.4.7 | Screen reader (VoiceOver) базовые элементы | P2 | ☐ |
| 14.4.8 | Double-tap на кнопку покупки — один request | P0 | ☐ |
| 14.4.9 | 31 число при месячной оплате | P1 | ☐ |

### 14.5 Аналитика (Amplitude events)

| # | Событие | Когда летит | P | ✓ |
|---|---------|-------------|---|---|
| 14.5.1 | `sync_retry_attempt` / `_succeeded` / `_exhausted` | После покупки + sync retries | P1 | ☐ |
| 14.5.2 | `restore_initiated` / `restore_completed` / `restore_failed` | На RestorePurchasesButton | P1 | ☐ |
| 14.5.3 | `banner_shown` / `banner_action_tapped` | Рендер/тап BannerRenderer | P1 | ☐ |
| 14.5.4 | `workspace.member_*` | Membership changes (backend outbox → amplitude) | P2 | ☐ |

---

## 15. Regression (что могло сломаться)

После каждого рефакторинга/фичи проверить смежное:

| # | Что добавили/изменили | Что могло сломаться | Проверить | P | ✓ |
|---|------------------------|---------------------|-----------|---|---|
| 15.1 | Billing state machine (backend) | Старые Pro юзеры | `cancelAtPeriodEnd: true` → корректный ExpirationBanner | P0 | ☐ |
| 15.2 | `BillingMeResponse` shape | Мобильные хуки | Все потребители `useEffectiveAccess` читают limits правильно | P0 | ☐ |
| 15.3 | Apple trial | Backend `trialUsed=true` (старые) | Не предлагается повторный trial | P0 | ☐ |
| 15.4 | `useEffectiveAccess.limits` | Старые usages `usePlanLimits` | `usePlanLimits` удалён, нет import-ошибок | P0 | ☐ |
| 15.5 | Inter шрифт | Старые компоненты | Везде Inter, нет системного fallback | P1 | ☐ |
| 15.6 | Gradient в Expo Go | Fallback | SafeLinearGradient → View работает | P2 | ☐ |
| 15.7 | `isCancelled` logic | Старые подписки | Бейдж FREE в degraded mode корректен | P0 | ☐ |
| 15.8 | Product IDs из backend | Paywall | Если backend вернул другие product IDs (prod vs staging) — paywall рендерит правильно | P0 | ☐ |
| 15.9 | Drop AsyncStorage persist subs | Cold start | Свежая установка + cold start — нет попытки читать старые AsyncStorage ключи подписок | P0 | ☐ |
| 15.10 | BannerRenderer (единый) | Inline banners | Нет двойного показа (inline + BannerRenderer) — только BannerRenderer | P0 | ☐ |
| 15.11 | RC async configure | Cold start до login | App не падает, login завершается | P1 | ☐ |
| 15.12 | Pending receipt | Partial purchase | После краша посередине покупки — на следующем старте syncается | P0 | ☐ |
| 15.13 | Fail-fast test key in prod | Прод билд | Если случайно попадёт test RC key — билд не стартует (явная ошибка) | P0 | ☐ |
| 15.14 | `nextPaymentDate` из backend | Старые клиенты | Edit sub → refetch возвращает новую дату | P0 | ☐ |
| 15.15 | `lastReminderSentDate` (backend) | Cron | 2 запуска в один день → 1 email | P0 | ☐ |
| 15.16 | List-Unsubscribe везде | Gmail policy | Письма не падают в spam от новых юзеров | P0 | ☐ |
| 15.17 | Goalin LLP · Astana footer | CAN-SPAM | Адрес виден на всех массовых email | P0 | ☐ |
| 15.18 | Suppressed email check | Все sendEmail call sites | Suppressed → silent skip, не падение | P0 | ☐ |
| 15.19 | Workspace PlanGuard | Free user direct API | `POST /workspace` → 403, не 500 | P1 | ☐ |
| 15.20 | Reconciliation cron | Drift users | Feature flag off → dry-run только, нет нежелательных изменений state | P1 | ☐ |

---

## 16. Summary Counters

После прохождения — подсчитай:

**P0 (блокеры):**
- Всего: ___ / ___
- Passed: ___ ✅
- Failed: ___ ❌

**P1 (важно):**
- Всего: ___ / ___
- Passed: ___ ✅
- Failed: ___ ❌

**P2 (nice to have):**
- Всего: ___ / ___
- Passed: ___ ✅
- Failed: ___ ❌

---

## Failed Items Log

Сюда записывай проблемы с деталями:

```
#___ | P_ | Экран: ___
Что произошло:
Ожидалось:
Приоритет фикса:
```

---

**Правила релиза:**
- ✅ **Разрешено выпускать**: 100% P0 passed
- ⚠️ **Условно**: остались P1 issues, но есть workaround
- ❌ **Запрещено**: есть P0 failed или критичные P1 без workaround
