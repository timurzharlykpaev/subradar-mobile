# SubRadar Production Readiness Audit

**Дата:** 2026-04-16
**Скоуп:** subradar-mobile + subradar-backend
**Методология:** 8 параллельных агентов-аудиторов
**Итого:** ~130 проблем, 30+ критических

---

## 🔴 БЛОКЕРЫ ПРОДА (30) — исправить ДО запуска

### Revenue / Billing (самое критичное)

**1. `POST /billing/sync-revenuecat` без серверной проверки**
- `subradar-backend/src/billing/billing.service.ts:560-614`
- Клиент присылает `productId`, сервер доверяет → **любой юзер может curl'ом взять Organization план бесплатно**
- **Фикс:** вызывать RevenueCat REST API для верификации entitlement

**2. Отсутствует idempotency для webhook'ов**
- `subradar-backend/src/billing/billing.controller.ts:71-86`
- Replay atack: повторные webhook'и = двойные апгрейды/даунгрейды
- **Фикс:** таблица `webhook_events` с `event_id` UNIQUE

**3. Lemon Squeezy raw body не захватывается**
- `subradar-backend/src/main.ts`
- Нет `bodyParser.json({ verify })` → HMAC проверка падает → LS webhook'и отвергаются
- **Фикс:** сохранять `req.rawBody` в верификаторе подписи

**4. Trial reset через пересоздание аккаунта**
- Flag `trialUsed` привязан к user id, а не email/device
- **Attack:** создал → триал → удалил → снова = бесконечные триалы
- **Фикс:** трекать по email fingerprint + IP hash

**5. Expired trial считается активным планом**
- `subradar-backend/src/billing/billing.service.ts:208-218`
- `getEffectivePlan()` есть, но **не используется** в `consumeAiRequest()` и limit guards
- **Фикс:** заменить все `user.plan === 'pro'` на `getEffectivePlan(user)`

### Security — Authentication

**6. `/ai/suggest-cancel` БЕЗ аутентификации**
- `subradar-backend/src/ai/ai.controller.ts:211-214`
- Нет `@UseGuards(JwtAuthGuard)` → любой может спамить GPT-4o (~$0.015/call)
- **Фикс:** добавить guard + consume AI quota

**7. `/catalog/seed-prices` — любой юзер может вызвать**
- `subradar-backend/src/catalog/catalog.controller.ts:32-37`
- JWT защищён, но admin-only логики нет
- **Фикс:** `@UseGuards(AdminGuard)` или admin role check

**8. JWT алгоритм не валидируется**
- `subradar-backend/src/auth/strategies/jwt.strategy.ts:9-17`
- Passport-JWT принимает любой алгоритм → `algorithm confusion` атака
- **Фикс:** `algorithms: ['HS256']` явно

**9. Google OAuth: нет проверки audience (`azp`)**
- `subradar-backend/src/auth/auth.service.ts:270-315`
- Токен от другого приложения может работать
- **Фикс:** валидировать `azp` claim

**10. Magic link токены в plain text**
- `subradar-backend/src/auth/auth.controller.ts:95-98`
- БД compromise = все активные magic link'и
- **Фикс:** хешировать токен перед сохранением

### Data correctness — BACKEND

**11. `nextPaymentDate` баг в високосный год**
- `subradar-backend/src/subscriptions/subscriptions.service.ts:29-76`
- Для billingDay=31 → Feb 29 → March logic скипает месяц
- **Фикс:** переписать на `date-fns.addMonths()`

**12. FX конвертация — div by zero**
- `subradar-backend/src/fx/fx.service.ts:152-164`
- Если провайдер вернёт `rate: 0` → падение
- **Фикс:** `if (!fromRate || fromRate <= 0)`

**13. Subscription status transitions без валидации**
- `subradar-backend/src/subscriptions/subscriptions.controller.ts:114-135`
- Cancelled → Pause → Active работает (нелогично)
- **Фикс:** state machine: CANCELLED финальный, Archive soft delete

**14. Race condition в лимите подписок**
- `subradar-backend/src/subscriptions/guards/subscription-limit.guard.ts:54-59`
- Free юзер может создать 6+ через parallel requests
- **Фикс:** `SELECT FOR UPDATE` или транзакция с counter

**15. User deletion cascade неполный**
- `subradar-backend/src/users/users.service.ts:103-126`
- `push_tokens`, Bull queue jobs — сироты
- try/catch глотает ошибки silently
- **Фикс:** полный cascade + fail-fast

**16. Timezone в reminder cron — сервер UTC**
- `subradar-backend/src/reminders/reminders.service.ts:21-98`
- Юзер KZ (+6) получает ремайндер не в "свой" день
- **Фикс:** использовать `user.timezoneDetected` для расчёта

### Production infra

**17. Нет test execution в CI**
- `subradar-backend/.github/workflows/deploy.yml:42-54`
- Тесты 40+ .spec.ts, но не запускаются перед деплоем
- **Фикс:** `npm run test:cov` шаг перед docker push

**18. Нет crash reporting на мобилке**
- Нет Sentry/Crashlytics — продакшн краши молча
- **Фикс:** `@sentry/react-native` + source maps upload

**19. Нет Error Boundary в `app/_layout.tsx`**
- Unhandled error = белый экран краша
- **Фикс:** обернуть `<Stack>` в `<ErrorBoundary>`

**20. Health check — dummy `{status:"ok"}`**
- `subradar-backend/src/app.controller.ts`
- Не проверяет БД, Redis, очереди
- **Фикс:** `@nestjs/terminus` с проверками

**21. Docker без resource limits**
- `subradar-backend/docker-compose.subradar.yml:4-46`
- OOM может завалить продакшн
- **Фикс:** `memory: "512M"`, `cpus: "1"`

**22. Auto-deploy в prod без approval gate**
- `subradar-backend/.github/workflows/deploy.yml:5`
- Push в main = мгновенный прод
- **Фикс:** `workflow_dispatch` с ручным approval

**23. Амплитуд SDK не установлен**
- `subradar-mobile/src/services/analytics.ts:123-152`
- 77 событий задефайнены, но только console.log
- **Фикс:** `npm install @amplitude/analytics-react-native`

### Mobile critical

**24. Нет certificate pinning**
- `subradar-mobile/src/api/client.ts:5`
- MitM атака на compromised WiFi возможна
- **Фикс:** `react-native-pinch` для `api.subradar.ai`

**25. Memory leak в `useVoiceRecorder`**
- `subradar-mobile/src/hooks/useVoiceRecorder.ts:40`
- setInterval не очищается при размонтировании во время записи
- **Фикс:** ref-based cleanup guard

**26. setState после unmount**
- `subradar-mobile/src/components/AddSubscriptionSheet.tsx:219-221, 364-366`
- Promise резолвится после размонтирования → warning/crash
- **Фикс:** `isMounted` ref или AbortController

### Privacy / Compliance

**27. GDPR: нет "Удалить аккаунт" в UI**
- Endpoint `DELETE /users/me` есть, но нет кнопки в Settings
- App Store/Google Play теперь требуют
- **Фикс:** Settings → Danger Zone → Delete Account

**28. Email в логах (PII)**
- `subradar-backend/src/billing/billing.service.ts:~285`
- `Webhook upgrade: email=${email}` в логах
- **Фикс:** `email.slice(0,3) + '***'` или hash

**29. Stack traces в prod responses**
- `subradar-backend/src/common/filters/all-exceptions.filter.ts:38-42`
- Ошибки возвращают stack trace в JSON body
- **Фикс:** `if (process.env.NODE_ENV === 'production') delete errorBody.stack`

**30. Webhook failure — нет алертов**
- Payment webhook упал → логи есть, алерта нет
- **Фикс:** try/catch в processor + Telegram alert на critical

---

## 🟡 ВАЖНО (40+) — следующий спринт

### Backend
- Invitee downgrade race condition (`billing.service.ts:281-297`)
- Team member с собственным Pro получает org features бесплатно (`billing.service.ts:182-203`)
- Weekly digest cron неидемпотентный → дубликаты писем
- Catalog refresh unique constraint race → silent fail
- Analysis dedup hash игнорирует displayCurrency
- BullMQ failed jobs не чистятся (cleanup только 50 последних)
- Refresh token без expiry tracking (старые токены вечно валидны)
- Review account `review@subradar.ai` захардкожен (App Store review)
- CORS `!origin` allow — Postman/curl проходят без проверки
- Billing status staleTime 30s → UI показывает устаревший план

### Mobile
- `AddSubscriptionSheet.tsx` 2095 строк — разбить на 5-6 компонентов
- `onboarding.tsx` 1364 строки
- `analytics.tsx` 1236 строк
- `SubscriptionCard` без `React.memo` — re-render всего списка
- Polling каждые 15 секунд → битва батареи и API rate limit
- Нет accessibility labels на TouchableOpacity
- `windowSize={5}` на FlatList — видимый jank при скролле
- Hardcoded English error messages (i18n неполный)
- Backend error messages не переводятся на клиенте
- Нет loading skeleton на первом загрузке

### Analytics / Observability
- Нет correlation ID между mobile ↔ backend
- Нет session tracking (DAU/MAU невозможно посчитать)
- Telegram — single point of failure для alert'ов
- OpenAI quota monitoring нет
- Нет persistent error logs (только Telegram, исчезают)
- Distributed tracing отсутствует
- Нет high-error-rate alerting
- Cron heartbeat — если shed crash, никто не узнает
- `region_selected`, `currency_changed` события не трекаются

### Production
- `.env.example` без описаний переменных
- Database connection pool не настроен
- Нет load testing (неизвестен capacity)
- Source maps для mobile не загружаются
- Нет "Help & Support" в приложении
- Backup retention policy для DO DB не документирован
- Нет rollback procedure для App Store
- Мобильные build profiles (5 штук) не описаны

### Billing UX
- Network failure при покупке — нет retry
- Restore purchases silent fail
- RC logout при sign out не вызывается → следующий юзер видит чужие entitlements
- Paywall abandonment не трекается детально
- Trial duration с timezone boundary баг (±12ч)

---

## 🟢 POLISH (30+) — backlog

- Semantic versioning changelog
- Architecture diagram в README
- Bundle size optimization
- Feature flags (LaunchDarkly)
- Read replicas для DB
- Status page (Better Uptime)
- Per-user rate limiting (сейчас глобальный 300/min)
- Prometheus metrics `/metrics`
- Session replay (LogRocket, 1% users)
- Password reset endpoint
- Account enumeration prevention (silent magic link)
- CSP headers (Helmet уже есть, но без CSP)
- Webhook signature key rotation mechanism
- Audit logging для admin действий
- Refresh token versioning (invalidate all on logout)
- Client-side input validation (trim, sanitize)

---

## API Contract Match — ЧИСТО ✅

Все 60+ эндпоинтов маппятся. Найдены 2 minor gaps:
- `GET /analytics/by-card` и `/analytics/forecast` игнорируют `displayCurrency` query param
- `getTrials()` и `getSavings()` — backend сервис-методы не реализованы

---

## Рекомендуемый план

### Неделя 1 (критические блокеры revenue + security)
Пункты 1–10: syncRevenueCat, webhook idempotency, LS raw body, trial reset guard, expired trial gating, /ai/suggest-cancel auth, seed-prices admin, JWT алгоритм, Google audience, magic link hash.

### Неделя 2 (data correctness + infra)
Пункты 11–22: nextPaymentDate, FX div0, status transitions, sub limit race, cascade delete, timezone, CI tests, Sentry, ErrorBoundary, health check, Docker limits, approval gate.

### Неделя 3 (mobile + privacy + alerting)
Пункты 23–30: Amplitude, cert pinning, memory leaks, Delete Account UI, PII cleanup, stack trace scrub, webhook alerts.

### Месяц 2–3
Все 🟡 важное.

---

## Метрики перед запуском

| Категория | До запуска |
|-----------|-----------|
| Критические issues | **0** (сейчас 30) |
| Test coverage на CI | **≥60%** |
| Crash reporting | **активен** |
| GDPR delete flow | **в UI** |
| Load test | **100 req/sec пройден** |
| Backup policy | **задокументирована, тестирована** |
| Rollback procedure | **протестирована 1 раз** |

---

## Файл-индекс проблем

- `subradar-backend/src/billing/billing.service.ts` — 6 критичных issues
- `subradar-backend/src/subscriptions/subscriptions.service.ts` — 3 критичных
- `subradar-backend/src/auth/` — 4 критичных
- `subradar-backend/src/ai/ai.controller.ts` — 1 критичный
- `subradar-backend/src/catalog/catalog.controller.ts` — 1 критичный
- `subradar-backend/src/main.ts` — 1 критичный (LS raw body)
- `subradar-backend/src/common/filters/all-exceptions.filter.ts` — 1 важный (stack trace)
- `subradar-backend/.github/workflows/deploy.yml` — 2 критичных
- `subradar-mobile/src/api/client.ts` — 1 критичный (cert pinning)
- `subradar-mobile/src/hooks/useVoiceRecorder.ts` — 1 критичный (memory leak)
- `subradar-mobile/src/components/AddSubscriptionSheet.tsx` — 3 важных
- `subradar-mobile/app/_layout.tsx` — 1 критичный (ErrorBoundary)
- `subradar-mobile/src/services/analytics.ts` — 1 критичный (Amplitude не включен)
