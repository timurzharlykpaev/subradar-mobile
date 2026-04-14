# SubRadar AI — Manual QA Checklist v1.3.0

**Как пользоваться:** Идёшь по разделам сверху вниз, отмечаешь `☐ → ✅` галочкой при прохождении. Если пункт не прошёл — пометь `❌` и опиши проблему ниже таблицы.

**Приоритеты:**
- **P0** — блокер релиза (если не работает — НЕ выпускать)
- **P1** — важно (нужно исправить до следующего build)
- **P2** — nice to have (можно отложить)

**Уровень покрытия:** функционал + визуал (Inter шрифт, градиенты, тени) + переводы RU/EN + edge cases.

---

## 1. Pre-release Setup

### 1.1 Устройства и окружения

| Что | Зачем |
|-----|-------|
| iPhone с последним TestFlight билдом (v1.3.0 build 43+) | Основное тестирование |
| Sandbox Apple ID | Settings → App Store → Sandbox Account |
| 2 email аккаунта в приложении | Team Owner + Team Member |
| Airplane mode | Offline сценарии |
| Dark mode + Light mode | Визуальная проверка обеих тем |

### 1.2 Тестовые данные

| Что | Где |
|-----|-----|
| Review account | `review@subradar.ai` / OTP `000000` |
| RevenueCat dashboard | app.revenuecat.com → Subscribers |
| Backend logs | `docker logs subradar-api-prod -f` |

### 1.3 Перед каждым прогоном

- [ ] Удалить приложение с iPhone (чистый state)
- [ ] Sandbox account вышел из предыдущих тестов
- [ ] `curl https://api.subradar.ai/api/v1/billing/plans` → 200
- [ ] TestFlight билд обновлён
- [ ] Подписки в App Store Connect → "Готово к продаже"

---

## 2. Onboarding

**Путь:** Первый запуск приложения

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 2.1 | New User | Открыть app 1й раз | Слайд 0: "Money hook" — $624 counter с анимацией | P0 | ☐ |
| 2.2 | New User | Quick-add чипсы (Netflix, Spotify) | При выборе — цветная тень вокруг чипса | P1 | ☐ |
| 2.3 | New User | "Начать — это бесплатно" | Градиентная кнопка #6C47FF → #9B7AFF, Inter-Bold | P1 | ☐ |
| 2.4 | New User | Свайп → | Слайд 1: выбор языка (10 флагов) | P0 | ☐ |
| 2.5 | New User | Выбрать "Қазақша" | UI моментально переключается на казахский | P0 | ☐ |
| 2.6 | New User | Слайд 2: валюта | Выбор USD/EUR/GBP/KZT/RUB/UAH/TRY | P0 | ☐ |
| 2.7 | New User | Слайд 3: логин | Apple / Google / Email кнопки | P0 | ☐ |
| 2.8 | New User | Нет бейджа "7 дней Pro" | Удалён (триал теперь через paywall) | P0 | ☐ |
| 2.9 | New User | Слайд 4: уведомления | "Не пропускай платежи", оранжевая кнопка-колокольчик | P1 | ☐ |
| 2.10 | New User | Слайд 5: добавить sub | 2 кнопки: "С AI" / "Вручную" / "Пропустить" | P0 | ☐ |
| 2.11 | New User | "Пропустить" | Переход на Dashboard | P0 | ☐ |
| 2.12 | Re-open | Выйти из аккаунта и зайти заново | Онбординг НЕ показывается повторно (флаг `welcome_shown`) | P1 | ☐ |
| 2.13 | Long name input | Имя 50+ символов | Truncate без крашей | P2 | ☐ |
| 2.14 | Dark mode | В онбординге | Все слайды корректны в тёмной теме | P1 | ☐ |

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
| 3.11 | Logout | Снова зайти другим аккаунтом | trial_offered / welcome_shown очищены | P1 | ☐ |
| 3.12 | Delete account | Settings → Delete account | Подтверждение + полное удаление | P1 | ☐ |

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
| 4.9 | Pro User (trial active) | Badge | PRO + счётчик "7d left" если есть trialDaysLeft | P1 | ☐ |
| 4.10 | Pro User (cancelAtPeriodEnd) | — | ExpirationBanner "Доступ до DD.MM" | P0 | ☐ |
| 4.11 | Team Owner | Бейдж | TEAM (cyan #06B6D4) | P0 | ☐ |
| 4.12 | Team Owner, workspace expired | Сверху | Красный alert "Команда закроется через X дней" | P0 | ☐ |
| 4.13 | Team Member (без своего Pro) | Бейдж | TEAM MEMBER (cyan) | P0 | ☐ |
| 4.14 | Team Member + own Pro | Сверху | DoublePayBanner жёлтый "У тебя Pro и Team" | P0 | ☐ |
| 4.15 | Grace period user | Сверху | GraceBanner оранжевый с днями | P0 | ☐ |
| 4.16 | User с billingIssueAt | Сверху | BillingIssueBanner красный "Платёж не прошёл" | P0 | ☐ |
| 4.17 | Degraded mode (Free, 4+ subs) | Hero + список | Сумма из первых 3, "{{count}} подписок скрыто" | P0 | ☐ |
| 4.18 | Любой | Быстрые действия | 3 кнопки: Добавить / Отчёт / Pro (или Team) | P1 | ☐ |
| 4.19 | Любой | Pull-to-refresh | Индикатор, данные обновляются | P1 | ☐ |
| 4.20 | Любой с subs | Тап на карточку в "Активные подписки" | Открывается subscription/[id] | P0 | ☐ |
| 4.21 | Free User, AITeaser | — | Баннер "AI найдёт экономию" | P2 | ☐ |
| 4.22 | Offline | Airplane mode | OfflineBanner сверху, кэш работает | P1 | ☐ |
| 4.23 | Длинное имя sub (40+ символов) | В списке | Truncate с `...` | P2 | ☐ |
| 4.24 | Dark ↔ Light | Переключить тему | Цвета меняются, hero gradient сохраняется | P1 | ☐ |
| 4.25 | RU локаль | Все тексты | Полный перевод, без fallback на английский | P1 | ☐ |
| 4.26 | "Tap +" FAB | Центр tab bar | Открывает AddSubscriptionSheet | P0 | ☐ |
| 4.27 | Дубли в подписках | 2 Netflix | Duplicate Categories блок, "2 совпадения" | P2 | ☐ |
| 4.28 | Прогноз блок | — | 3 карточки: 1 / 6 / 12 месяцев | P1 | ☐ |

---

## 5. Add Subscription

**Путь:** FAB "+" или Dashboard → "Добавить"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 5.1 | Free User | Открыть sheet | AI input сверху, популярные сервисы, microphone, camera | P0 | ☐ |
| 5.2 | Любой | Тап на Netflix в Popular | Быстрое добавление с иконкой | P0 | ☐ |
| 5.3 | Любой | Ввести "Netflix 15.99/mo" | AI распознаёт → InlineConfirmCard | P0 | ☐ |
| 5.4 | Любой | Ввести "Netflix, Spotify" | BulkAddSheet появляется с list | P1 | ☐ |
| 5.5 | Любой | Тап microphone → сказать | Transcribing indicator → результат | P1 | ☐ |
| 5.6 | Любой | Тап camera → screenshot | AI parse-screenshot → результат | P1 | ☐ |
| 5.7 | Любой | "или введите вручную" | Manual form открывается | P0 | ☐ |
| 5.8 | Manual form | Заполнить всё + Сохранить | Sub добавлен, sheet закрывается | P0 | ☐ |
| 5.9 | Manual form | Период "Ежемесячно" → RU | Переведён | P1 | ☐ |
| 5.10 | Manual form | Reminder по дефолту | Выбран "3 дня" (для новой sub) | P1 | ☐ |
| 5.11 | Manual form | Категории | Переведены на RU/EN | P1 | ☐ |
| 5.12 | Free User, уже 3 sub | Попытка 4-ю sub | Alert "Лимит Free: 3. Перейти на Pro?" | P0 | ☐ |
| 5.13 | Free User | Нажать "Перейти на Pro" в Alert | Sheet закрывается → paywall | P0 | ☐ |
| 5.14 | Free User, BulkAdd 6 subs | — | Добавляется 3, Alert "Added 3 of 6: Netflix, Disney+..." | P0 | ☐ |
| 5.15 | Free User, лимит AI (5/5) | Voice/Text AI | Alert "AI limit reached. Upgrade to Pro" | P0 | ☐ |
| 5.16 | Pro User, лимит AI (200/200) | Voice | Alert с CTA "Upgrade to Team — 1000 AI" | P1 | ☐ |
| 5.17 | AI parse fail | — | Error message "Could not parse, try again" | P2 | ☐ |
| 5.18 | Offline | Попытка AI | Offline error, manual работает | P1 | ☐ |
| 5.19 | Close sheet | Swipe down | Sheet закрывается, state не сохраняется | P1 | ☐ |
| 5.20 | Категория иконка | После добавления | CategoryBadge с правильной иконкой | P2 | ☐ |

---

## 6. Subscriptions List

**Путь:** Tab "Подписки"

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 6.1 | Любой | Открыть tab | Summary: Active count, total/mo, N/3 progress | P0 | ☐ |
| 6.2 | Любой | Фильтры | Все / Активные / Trial / Отменённые | P0 | ☐ |
| 6.3 | Любой | Сортировка | По дате / Цена ↓ / Цена ↑ / А-Я | P1 | ☐ |
| 6.4 | Любой | Поиск (иконка лупы) | Filter по имени | P2 | ☐ |
| 6.5 | Любой | SubscriptionCard | Инет-Bold имя, Inter-Bold сумма, period переведён | P1 | ☐ |
| 6.6 | Free User, 4+ subs | — | LockedSubscriptionCard placeholders (опция degraded mode) | P0 | ☐ |
| 6.7 | Degraded mode | Banner "Скрыто X подписок" | Фиолетовый, Tap → paywall | P0 | ☐ |
| 6.8 | Degraded mode | Тап на locked card | Alert "Get Pro to see N subs" | P0 | ☐ |
| 6.9 | Pro User, 2+ subs same category | Над списком | Duplicate banner "Enable Team" | P1 | ☐ |
| 6.10 | Любой | Тап на card | Открывается subscription/[id] | P0 | ☐ |
| 6.11 | Любой | Swipe card → Delete | Subscription удалена | P1 | ☐ |
| 6.12 | Empty state | 0 sub | Иконка + "Добавь первую подписку" | P1 | ☐ |
| 6.13 | Trial sub | Badge | Оранжевый "Trial" + "N days" | P1 | ☐ |
| 6.14 | Cancelled sub | Badge | Серый "Cancelled" | P1 | ☐ |
| 6.15 | Next payment date | Отображение | Локализованный формат даты | P2 | ☐ |

---

## 7. Subscription Detail & Edit

**Путь:** Тап на карточку подписки

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 7.1 | Любой | Открыть detail | Иконка, имя, сумма + period переведён ("/ Ежемесячно") | P0 | ☐ |
| 7.2 | Pro User (не Team) | Внутри detail | TeamHint "Есть другие в семье с {name}?" | P1 | ☐ |
| 7.3 | Любой | Статус (Active/Trial/Cancelled) | Бейдж с цветом | P1 | ☐ |
| 7.4 | Любой | Reminder блок | Показывает реальное значение (не хардкод [3]) | P0 | ☐ |
| 7.5 | Любой | Тап "Edit" | EditSubscriptionSheet | P0 | ☐ |
| 7.6 | Edit sheet | Reminder состояние | Реальное значение из подписки (или "Off" если null) | P0 | ☐ |
| 7.7 | Edit sheet | Категория | Переведена на RU/EN | P0 | ☐ |
| 7.8 | Edit sheet | Период оплаты | Переведён (Ежемесячно, Ежегодно) | P0 | ☐ |
| 7.9 | Edit sheet | Изменить + Сохранить | Изменения применяются | P0 | ☐ |
| 7.10 | Cancel URL есть | Кнопка "Отменить подписку" | Открывает URL в браузере | P1 | ☐ |
| 7.11 | Любой | Тап "Удалить" | Подтверждение → удаление | P0 | ☐ |
| 7.12 | Нет секции "Чеки" | — | Удалена (не показывается) | P1 | ☐ |
| 7.13 | Длинное имя | 50+ символов | Truncate | P2 | ☐ |

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

---

## 10. Paywall

**Путь:** Любой upsell / Settings → Upgrade / Лимит достигнут

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 10.1 | Любой | Открыть paywall | 3 плана: Free / Pro / Team | P0 | ☐ |
| 10.2 | Любой | Toggle Monthly / Yearly | Цены обновляются | P0 | ☐ |
| 10.3 | Yearly | Badge "BEST VALUE" | Зелёный | P1 | ☐ |
| 10.4 | Free User (canTrial) | Под Pro | "7 days free" hint (purple) | P0 | ☐ |
| 10.5 | Free User (canTrial) | CTA | "7 days free — Start Trial →" | P0 | ☐ |
| 10.6 | Free User | Нажать CTA Pro | Apple confirmation sheet "7 days free, then $2.99/mo" | P0 | ☐ |
| 10.7 | Apple sheet | Face ID → Confirm | Purchase success, plan=pro | P0 | ☐ |
| 10.8 | Apple sheet | Cancel | Возврат на paywall, нет ошибок | P1 | ☐ |
| 10.9 | Pro User | Team плашка | Бейдж "Save $X/year" (green) с персональным расчётом | P1 | ☐ |
| 10.10 | Team User | Team бейдж | "CURRENT PLAN" (green) | P1 | ☐ |
| 10.11 | Любой | Disclaimer | "7-day free trial, then auto-renews. Cancel in iOS Settings" | P0 | ☐ |
| 10.12 | Любой | "Maybe later" | fontSize 13, opacity 0.5, dismissable | P1 | ☐ |
| 10.13 | Любой | Social proof card | "Found 4 forgotten subs. Saved $180" | P2 | ☐ |
| 10.14 | Любой | Restore Purchases (внизу) | Восстанавливает подписку, синкает с backend | P0 | ☐ |
| 10.15 | RC offerings not loaded | Отображение цен | Fallback "$2.99 / $24.99 / $9.99 / $79.99" | P1 | ☐ |
| 10.16 | Terms + Privacy links | Тапы | Открывают subradar.ai/legal/terms и /privacy | P1 | ☐ |
| 10.17 | Close (X) | Вверху справа | Появляется через 3с, закрывает paywall | P1 | ☐ |
| 10.18 | Trialing user | Бейдж сверху | Orange "N days trial active" | P1 | ☐ |
| 10.19 | Cancelled user | Бейдж сверху | "Cancelled — expires DD.MM" | P1 | ☐ |
| 10.20 | RU локаль | CTA + disclaimer | Переведены корректно | P1 | ☐ |

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
| 11.10 | Pro + Team double-pay | Сверху | DoublePayBanner жёлтый | P0 | ☐ |
| 11.11 | Billing issue | Сверху | BillingIssueBanner красный | P0 | ☐ |
| 11.12 | Profile row | AI used | `{used}/{limit} AI` (limit не '∞' для Team) | P1 | ☐ |
| 11.13 | Free User | "Apple 7-day free trial" row | Открывает paywall | P1 | ☐ |
| 11.14 | Pro Monthly | Annual nudge | "Switch to Yearly — Save $X" карточка | P1 | ☐ |
| 11.15 | Pro User | "Manage Subscription" | CancellationInterceptModal | P0 | ☐ |
| 11.16 | Cancel flow (Pro) | "Cancel anyway" | RC Customer Center | P0 | ☐ |
| 11.17 | Cancel flow (Trial) | — | Прямой `POST /billing/cancel` (не RC Customer Center) | P0 | ☐ |
| 11.18 | Cancel success | После returning | Alert "Subscription cancelled", billing обновлён | P0 | ☐ |
| 11.19 | Restore Purchases | Settings | Восстанавливает, sync с backend | P0 | ☐ |
| 11.20 | Notifications toggle | Master switch | On/Off, сохраняется на backend | P1 | ☐ |
| 11.21 | Reminder days | Выбор 1/3/7 дней | Сохраняется | P1 | ☐ |
| 11.22 | Email notifications | Toggle | `PUT /notifications/settings` | P1 | ☐ |
| 11.23 | Weekly AI Digest | Toggle (только Pro) | Для Free заблокирован с замком | P1 | ☐ |
| 11.24 | Currency | Выбор | Обновляется везде | P1 | ☐ |
| 11.25 | Language | 10 языков | Моментальное переключение UI | P0 | ☐ |
| 11.26 | Date format | DD/MM / MM/DD / YYYY-MM-DD | Применяется в списках | P2 | ☐ |
| 11.27 | Dark mode toggle | On/Off | Все экраны реагируют | P1 | ☐ |
| 11.28 | Export CSV | Тап | Share sheet с CSV | P2 | ☐ |
| 11.29 | Replay Onboarding | Debug опция | Онбординг показывается снова | P2 | ☐ |
| 11.30 | Logout | Кнопка | Confirmation → logout → онбординг | P0 | ☐ |
| 11.31 | Delete Account | Кнопка (Danger) | Двойное подтверждение → удаление | P0 | ☐ |
| 11.32 | Version info | Внизу | v1.3.0 · Subradar | P2 | ☐ |

---

## 12. Billing Scenarios (sandbox)

**Путь:** Проверка реальных RC webhooks в sandbox

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 12.1 | Free → Start Trial | Apple sheet → Confirm | INITIAL_PURCHASE webhook → plan=pro | P0 | ☐ |
| 12.2 | Trial active | Settings badge | PRO + trial days | P0 | ☐ |
| 12.3 | Trial → auto-renew (sandbox accelerated) | Wait ~5 min | RENEWAL webhook → plan stays pro | P0 | ☐ |
| 12.4 | Cancel trial before period end | Customer Center | CANCELLATION webhook → cancelAtPeriodEnd=true | P0 | ☐ |
| 12.5 | Trial cancel → wait for expiry | Sandbox 1 day | EXPIRATION webhook → plan=free, grace 7d | P0 | ☐ |
| 12.6 | Grace period starts | Dashboard | GraceBanner оранжевый | P0 | ☐ |
| 12.7 | After grace expires | Cron ~daily | plan=free, locked UI (degraded mode) | P0 | ☐ |
| 12.8 | Team Owner → EXPIRATION | Cascade | Все members получают team_expired grace | P0 | ☐ |
| 12.9 | Payment fails (change card) | In Customer Center | BILLING_ISSUE webhook → red banner | P0 | ☐ |
| 12.10 | Payment restored | Успешный retry | plan continues, banner исчезает | P0 | ☐ |
| 12.11 | Buy Team as Pro user | App Store purchase | PRODUCT_CHANGE → organization plan | P1 | ☐ |
| 12.12 | Uncancel | Через Customer Center | UNCANCELLATION → cancelAtPeriodEnd=false | P1 | ☐ |

---

## 13. Email Notifications

**Путь:** Проверка email рассылок

| # | Роль | Действие | Ожидаем | P | ✓ |
|---|------|----------|---------|---|---|
| 13.1 | Pro User | Weekly digest (понедельник 12:00 UTC) | Email приходит | P1 | ☐ |
| 13.2 | Digest email | Unsubscribe link | Signed URL api.subradar.ai/api/v1/unsubscribe?... | P0 | ☐ |
| 13.3 | Тап Unsubscribe | — | HTML страница "You've been unsubscribed" + Subscribe back | P0 | ☐ |
| 13.4 | После unsubscribe | Settings | Weekly Digest toggle = OFF | P0 | ☐ |
| 13.5 | Gmail header | List-Unsubscribe | Показывается кнопка "Unsubscribe" в Gmail UI | P1 | ☐ |
| 13.6 | Free User | Weekly digest | Не приходит (только Pro) | P1 | ☐ |
| 13.7 | Payment reminder | За 3 дня до charge | Email + push приходят | P1 | ☐ |
| 13.8 | Email notifications OFF | В Settings | Reminder emails не приходят | P1 | ☐ |

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

### 14.2 Тёмная/светлая тема

| # | Что | P | ✓ |
|---|-----|---|---|
| 14.2.1 | Переключение в Settings | P1 | ☐ |
| 14.2.2 | Dark mode: все экраны читаемы | P1 | ☐ |
| 14.2.3 | Light mode: все экраны читаемы | P1 | ☐ |
| 14.2.4 | Graident hero card не инвертируется | P2 | ☐ |
| 14.2.5 | Status bar цвет правильный (translucent Android) | P2 | ☐ |

### 14.3 Offline / плохой интернет

| # | Что | P | ✓ |
|---|-----|---|---|
| 14.3.1 | Airplane mode → Dashboard | P1 | ☐ |
| 14.3.2 | OfflineBanner показывается | P1 | ☐ |
| 14.3.3 | Кэш работает (старые данные видны) | P1 | ☐ |
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

---

## 15. Regression (что могло сломаться)

После каждого рефакторинга/фичи проверить смежное:

| # | Что добавили | Что могло сломаться | Проверить | P | ✓ |
|---|--------------|---------------------|-----------|---|---|
| 15.1 | Grace period | Старые Pro юзеры | Pro с `cancelAtPeriodEnd: true` видят ExpirationBanner | P0 | ☐ |
| 15.2 | Team logic | Individual Pro | Купил Pro без Team — всё работает как раньше | P0 | ☐ |
| 15.3 | Apple trial | Old backend trial | Юзеры с `trialUsed=true` из БД (старые) — корректно | P0 | ☐ |
| 15.4 | Effective access | Limits | Free лимит 3, Pro unlimited — работают | P0 | ☐ |
| 15.5 | Inter шрифт | Старые компоненты | Везде Inter, нет системного fallback | P1 | ☐ |
| 15.6 | Gradient в Expo Go | Fallback | SafeLinearGradient → View работает в Expo Go | P2 | ☐ |
| 15.7 | isCancelled logic | Старые подписки | `cancelAtPeriodEnd=true` → бейдж FREE в degraded | P0 | ☐ |

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
