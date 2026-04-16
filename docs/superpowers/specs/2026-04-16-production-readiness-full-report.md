# SubRadar Full Production-Readiness Report

**Дата:** 2026-04-16
**Скоуп:** subradar-mobile + subradar-backend + subradar-landing
**База:** консолидация из 2026-04-16-production-audit-report (130 issues) + свежего backend-аудита + landing-аудита + свежих изменений (conversion-boost)
**Итого:** 165+ проблем, 42 критических блокера

---

## 0. TL;DR — если читать одну вкладку

Проект **НЕ готов** к публичному продакшену. Архитектура хорошая, фундамент прочный, но есть 42 критических блокера по трём направлениям:

1. **Revenue-критичные уязвимости** (backend): `POST /billing/sync-revenuecat` доверяет клиенту → кто угодно может получить Pro/Team бесплатно через curl. 6 других связанных проблем.
2. **Лендинг не конвертирует**: все CTA-кнопки App Store/Google Play/Pricing ведут на `href="#"` — 0% download-rate.
3. **Нет crash reporting** ни в мобиле, ни на лендинге: краши в проде проходят молча.

**Рекомендация:** 3-недельный remediation спринт по критическим блокерам ДО любого маркетингового запуска или платного трафика.

---

## 1. Критические блокеры (P0) — 42 штуки

### 1.1 Backend — Revenue/Billing

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **B1** | `subradar-backend/src/billing/billing.service.ts:560-614` | `syncRevenueCat(productId)` доверяет клиенту — **нет** проверки через RC REST API | **Free Pro для всех через curl** |
| **B2** | `subradar-backend/src/billing/billing.controller.ts:71-86` | Webhook'и без idempotency → replay = двойной апгрейд/даунгрейд | Финансовые расхождения |
| **B3** | `subradar-backend/src/main.ts` | Lemon Squeezy raw body не захватывается → HMAC fail → LS webhook'и игнорируются | Потеря синков billing |
| **B4** | `trialUsed` | Триал-флаг привязан к user.id, не email/device → удалил аккаунт → бесконечные триалы | Фарм триалов |
| **B5** | `subradar-backend/src/billing/billing.service.ts:208-218` | `getEffectivePlan()` существует, но **не используется** в `consumeAiRequest()` и limit guards → просроченный триал считается активным планом | Бесплатные AI-запросы |
| **B6** | `subradar-backend/src/billing/billing.service.ts:281-297` | Race condition при invitee downgrade → user может сохранить Team features | Paywall bypass |
| **B7** | `subradar-backend/src/billing/billing.service.ts:182-203` | Team member с собственным Pro получает org-features бесплатно | Revenue leak |

### 1.2 Backend — Security

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **B8** | `subradar-backend/.env` (committed) | **Production secrets в git**: DB creds, Google OAuth secret, Resend API key | Полная компрометация prod |
| **B9** | `subradar-backend/src/users/entities/user.entity.ts:29,48` | User entity сериализует `refreshToken`, `magicLinkToken`, `magicLinkExpiry` — leak в `GET /auth/me` | Session hijacking |
| **B10** | `subradar-backend/src/ai/ai.controller.ts:211-214` | `/ai/suggest-cancel` БЕЗ `@UseGuards(JwtAuthGuard)` → любой спамит GPT-4o ($0.015/call) | Денежный DoS |
| **B11** | `subradar-backend/src/catalog/catalog.controller.ts:32-37` | `/catalog/seed-prices` без admin guard — JWT защищён, но любой юзер может пересидировать цены | Price manipulation |
| **B12** | `subradar-backend/src/auth/strategies/jwt.strategy.ts:9-17` | Нет `algorithms: ['HS256']` → algorithm confusion attack | Token forgery |
| **B13** | `subradar-backend/src/auth/auth.service.ts:270-315` | Google OAuth не валидирует `azp` claim → токен от чужого приложения работает | Account takeover |
| **B14** | `subradar-backend/src/auth/auth.controller.ts:95-98` | Magic link токены в plain text в БД → compromise БД = все активные magic link'и | Session hijack |
| **B15** | Analytics / Reports controllers | Нет workspace isolation guard — possible cross-tenant leak | Data breach |
| **B16** | `subradar-backend/src/billing/billing.service.ts:295-318` | LS webhook rotation не rotation-safe — старый secret всё ещё работает после появления нового | Signature bypass |

### 1.3 Backend — Data Correctness

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **B17** | `subradar-backend/src/subscriptions/subscriptions.service.ts:29-76` | `nextPaymentDate` в високосный год: billingDay=31 → Feb 29 → March скипает месяц | Missed renewal |
| **B18** | `subradar-backend/src/fx/fx.service.ts:152-164` | FX: провайдер вернул `rate: 0` → div-by-zero crash | Crash currencies screen |
| **B19** | `subradar-backend/src/subscriptions/subscriptions.controller.ts:114-135` | Status transitions: Cancelled → Pause → Active работает — нелогично | Data inconsistency |
| **B20** | `subradar-backend/src/subscriptions/guards/subscription-limit.guard.ts:54-59` | Race condition в лимите → Free юзер создаёт 6+ параллельными запросами | Paywall bypass |
| **B21** | `subradar-backend/src/users/users.service.ts:103-126` | User deletion cascade неполный: push_tokens, Bull jobs — сироты + try/catch глотает ошибки | GDPR breach |
| **B22** | `subradar-backend/src/reminders/reminders.service.ts:21-98` | Reminder cron в UTC, не `user.timezoneDetected` → KZ юзер получает ремайндер не в "свой" день | Bad UX |

### 1.4 Production Infra

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **B23** | `subradar-backend/.github/workflows/deploy.yml:42-54` | Нет test execution в CI — 40+ `.spec.ts` файлов не запускаются перед деплоем | Regressions |
| **B24** | `subradar-mobile` | Нет Sentry/Crashlytics | Silent crashes |
| **B25** | `subradar-mobile/app/_layout.tsx` | Нет Error Boundary → unhandled error = белый экран | App unusable |
| **B26** | `subradar-backend/src/app.controller.ts` | Health check — dummy `{status:"ok"}`, не проверяет DB/Redis | Fake uptime |
| **B27** | `subradar-backend/docker-compose.subradar.yml:4-46` | Нет resource limits → OOM может завалить prod | Outage |
| **B28** | `subradar-backend/.github/workflows/deploy.yml:5` | Auto-deploy в prod без approval gate — push в main = мгновенный прод | Untested ships |
| **B29** | `subradar-mobile/src/services/analytics.ts` | Amplitude SDK описан, но `@amplitude/analytics-react-native` не установлен → 77 events = console.log | Нет funnel метрик |

### 1.5 Mobile Critical

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **M1** | `subradar-mobile/src/api/client.ts:5` | Нет certificate pinning → MitM на compromised WiFi | Session hijack |
| **M2** | `subradar-mobile/src/hooks/useVoiceRecorder.ts:40` | Memory leak: `setInterval` не очищается при unmount во время записи | Crashes |
| **M3** | `subradar-mobile/src/components/AddSubscriptionSheet.tsx:219-221,364-366` | `setState` после unmount → warnings/crash | Crashes |

### 1.6 Privacy / Compliance

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **P1** | `subradar-mobile/app/(tabs)/settings.tsx` | GDPR: нет "Удалить аккаунт" в UI. Endpoint `DELETE /users/me` есть, но нет кнопки → **App Store/Google Play reject** | App Store rejection |
| **P2** | `subradar-backend/src/billing/billing.service.ts:~285` | Email в логах открытым текстом → PII leak | GDPR fine |
| **P3** | `subradar-backend/src/common/filters/all-exceptions.filter.ts:38-42` | Stack traces в prod error responses | Info leak |
| **P4** | Payment webhook | Webhook failure = нет алерта | Silent revenue loss |

### 1.7 Landing — Conversion Killers

| # | Файл | Проблема | Impact |
|---|------|----------|--------|
| **L1** | `subradar-landing/index.html:964,969` | App Store / Google Play buttons: `href="#"` | **0% install conversion** |
| **L2** | `subradar-landing/index.html:1172,1190,1208` | Pricing CTA: `opacity:0.6; cursor:default; "Coming Soon"` — unclickable | 0% upgrade |
| **L3** | `subradar-landing/index.html:1245` | Final CTA `href="#"` | Lost intent |
| **L4** | `subradar-landing/index.html:1010,1016,1022` | Step images `step-voice.png` 1.4M, `step-scan.png` 1.5M, `step-chart.png` 1.4M — **4.4M unoptimized PNG** | LCP ~6s mobile |
| **L5** | `subradar-landing/index.html` | Нет GA4 / Mixpanel / Branch attribution | Маркетинг вслепую |
| **L6** | `subradar-landing/index.html:1263-1268` | Cookie consent без reject button — **GDPR violation** | €10k-50M risk |

---

## 2. Высокий приоритет (P1) — следующий спринт

### Backend
- **B30**: Payment card ownership не валидируется на delete
- **B31**: Отсутствует обязательная пагинация на list endpoints (дефолт+max)
- **B32**: Billing plans response hardcoded в controller — рассинхрон с `PLAN_DETAILS`
- **B33**: Cron jobs не idempotent (trial-checker, weekly-digest) — dual-run = dup writes
- **B34**: Нет circuit breaker для OpenAI — OpenAI down = вся AI падает hard
- **B35**: `color?: string` в DTO без regex validation — prototype pollution surface
- **B36**: DO Spaces ACL not audited — receipts/PDFs могут быть публичны
- **B37**: Refresh token не rotate on every refresh — 30-day leak window
- **B38**: Rate limit глобальный (300/min) без per-IP — DoS-able
- **B39**: CORS `!origin` allow — Postman/curl проходят для state-change
- **B40**: Analysis dedup hash игнорирует `displayCurrency` — cached stale data
- **B41**: BullMQ failed jobs cleanup только 50 последних — queue bloat
- **B42**: Billing status staleTime 30s → UI показывает устаревший план

### Mobile
- **M4**: `AddSubscriptionSheet.tsx` — 2095 строк (разбить на 5-6 компонентов)
- **M5**: `onboarding.tsx` — 1364 строк (сейчас добавилась ICP segmentation)
- **M6**: `analytics.tsx` — 1236 строк
- **M7**: `SubscriptionCard` без `React.memo` — re-render всего списка при любом апдейте
- **M8**: Polling каждые 15s → battery drain + API rate hit; уже снизил до 60s в subscriptions screen, но dashboard ещё бьётся
- **M9**: Нет accessibility labels на большинстве `TouchableOpacity`
- **M10**: `windowSize={5}` на FlatList → jank на скролле длинных списков
- **M11**: Нет loading skeleton на первой загрузке (белый экран)
- **M12**: Hardcoded English error messages — i18n пробелы (`translateBackendError` есть, но не везде применён)
- **M13**: Network failure при IAP purchase — нет retry UI
- **M14**: Restore purchases silent fail — пользователь не понимает что произошло
- **M15**: RC logout при sign out не вызывается → следующий юзер на этом девайсе видит чужие entitlements
- **M16**: Paywall abandonment трекается, но не по шагам (где именно ушёл)
- **M17**: Trial duration с timezone boundary баг ±12h (RC считает в UTC, UI — в local)

### Landing
- **L7**: Incomplete переводы в kk, de, fr, zh для reviews/FAQ
- **L8**: Step images alt="Voice", "Scan" — generic, не ASO-keyword-rich
- **L9**: No 404 error page с branding
- **L10**: OG/Twitter image dimensions OK, но нет `twitter:image:alt`
- **L11**: Testimonials без attribution к реальным App Store review'ам
- **L12**: Pricing — нет явного "7-day free trial, then $2.99/mo" в fine print под кнопкой

### Analytics / Observability
- **O1**: Нет correlation ID между mobile ↔ backend — невозможно сопоставить клиентский лог с backend trace
- **O2**: Нет session tracking — DAU/MAU невозможно посчитать точно
- **O3**: Telegram — single point of failure для алертов
- **O4**: OpenAI quota monitoring нет — узнаем о баг-фарме только по invoice
- **O5**: Нет persistent error logs (только Telegram, исчезают в чате)
- **O6**: Cron heartbeat нет — если scheduler crash, никто не узнает
- **O7**: `region_selected`, `currency_changed` не трекаются на mobile

---

## 3. Средний приоритет (P2)

### Backend
- Password reset flow не документирован (если локальный auth вообще нужен — может полностью удалить)
- Refresh token expiry check только absolute, нет invalidation versioning на logout
- Audit logging для admin действий (catalog seed, manual grants)
- Feature flags infrastructure (LaunchDarkly / self-hosted Unleash)
- DB read replicas для analytics queries
- CSP headers (Helmet настроен, но без Content-Security-Policy)
- `review@subradar.ai` hardcoded для App Store review — нужен flag в БД

### Mobile
- Semantic versioning changelog в-app
- Bundle size optimization (react-native-bundle-visualizer)
- Skeleton placeholders везде где загрузка >300ms
- Deep linking для push notifications (сейчас просто открывают app root)
- "Help & Support" экран с contact form / FAQ
- Offline mode — queue failed mutations, sync on reconnect
- Pull-to-refresh на analytics screen
- Empty states для каждого экрана с CTA

### Landing
- Email opt-in form в `#notify-section` (сейчас кнопка Google Play ведёт туда, но формы нет)
- Manifest.json для PWA
- Remove radar rings from DOM on mobile (сейчас `display:none` но DOM-нагрузка есть)
- Cross-tab theme sync via `storage` event
- Sitemap lastmod timestamp update в deploy pipeline

### Infra
- Status page (Better Uptime / Statuspage)
- Per-user rate limiting вместо глобального
- Prometheus metrics endpoint `/metrics`
- Session replay (LogRocket / Sentry Replay) для 1% юзеров
- Backup retention policy документ + тестовый restore раз в квартал
- Rollback procedure документ + тестовый rollback раз в квартал

---

## 4. Что уже хорошо ✅

### Backend
- ✅ Webhook signature verification (timing-safe HMAC-SHA256 + Bearer для RC)
- ✅ CORS smart heuristic (mobile bypass, state-change guard)
- ✅ bcrypt salt 12 для паролей
- ✅ Brute-force protection (10 failed logins → 1h Redis lock)
- ✅ Global exception filter санитизирует stack traces в prod responses (только для `production` NODE_ENV, вход для B3 в backend-аудите — нужно убедиться что включён)
- ✅ SQL injection safe — все запросы через parameterized TypeORM query builder
- ✅ Миграции backward-compatible pattern (add columns с defaults, никогда не drop)
- ✅ Telegram alerts на 5xx
- ✅ Global cron error handling через `runCronHandler`

### Mobile
- ✅ Paywall сильно оптимизирован: default yearly, delayed close 3s, social proof, аналитика
- ✅ Cancellation flow hardened (недавно): честный retention offer по контексту, reason selector, pause option
- ✅ Annual upgrade nudge (недавно)
- ✅ Family/Team explainer modal с персональной math (недавно)
- ✅ Soft limit warning + aha trial trigger на 2-й подписке (недавно)
- ✅ WinBackBanner progressive D0-2/D3-7/D8-30 (недавно)
- ✅ ICP segmentation в онбординге (недавно)
- ✅ RevenueCat + Apple IAP интегрированы правильно
- ✅ i18n на 10 локалей, все ключи translated
- ✅ TypeScript strict mode, zero TSC errors
- ✅ TanStack Query везде
- ✅ Grace period + double-pay banner реализованы

### Landing
- ✅ SEO fundamentals solid (title 67 chars, meta description, canonical, schema.org SoftwareApplication)
- ✅ Security headers (nosniff, strict-origin referrer)
- ✅ Legal документы полные (privacy, terms, refund, cookies) — GDPR упомянут, DO Frankfurt, OpenAI API disclosed
- ✅ Multi-language 9 локалей с client-side i18n + auto-detect
- ✅ Mobile responsiveness работает (@media 700px)
- ✅ Accessibility basics (semantic HTML, lang attr, color contrast)

---

## 5. Последовательность работ (3-недельный remediation)

### Неделя 1 — блокеры revenue + security (крит)

**День 1-2: Backend secrets + RC verification**
- B8: Ротировать все secrets в `.env` (DB, Google OAuth, Resend, JWT), `git filter-branch` для истории
- B1: Вызывать RevenueCat REST API в `syncRevenueCat` для верификации entitlement (не доверять клиенту)
- B9: `@Exclude()` на `refreshToken`, `magicLinkToken`, `magicLinkExpiry` в User entity

**День 3: Webhook hardening**
- B2: Таблица `webhook_events (id UNIQUE)` для idempotency
- B3: Захват raw body для Lemon Squeezy HMAC verification
- B16: `LEMON_SQUEEZY_WEBHOOK_SECRET_DEPRECATED_UNTIL` для rotation safety

**День 4: Auth hardening**
- B10: `@UseGuards(JwtAuthGuard)` на `/ai/suggest-cancel`
- B11: Admin guard на `/catalog/seed-prices`
- B12: `algorithms: ['HS256']` в JWT strategy
- B13: Google OAuth `azp` claim validation
- B14: Hash magic link токенов

**День 5: Trial + plan correctness**
- B4: Trial fingerprint (email hash + IP)
- B5: Заменить все `user.plan === 'pro'` на `getEffectivePlan(user)` в guards
- B15: Workspace isolation guard на analytics/reports

### Неделя 2 — data correctness + infra

**День 1-2: Data bugs**
- B17: `date-fns.addMonths()` в `nextPaymentDate`
- B18: FX div-by-zero guard
- B19: Status transition state machine
- B20: `SELECT FOR UPDATE` в sub limit guard
- B21: User delete cascade complete + fail-fast
- B22: Reminder cron на `user.timezoneDetected`

**День 3: CI/Prod setup**
- B23: `npm run test:cov` в CI перед docker push
- B26: `@nestjs/terminus` health checks (DB, Redis, очереди)
- B27: Docker resource limits (`memory: 512M, cpus: 1`)
- B28: `workflow_dispatch` с approval gate для prod

**День 4-5: Mobile crash + observability**
- B24: Установка `@sentry/react-native` + source maps
- B25: ErrorBoundary в `app/_layout.tsx`
- B29: Установка `@amplitude/analytics-react-native` + EXPO_PUBLIC_AMPLITUDE_KEY
- M2: Fix memory leak в `useVoiceRecorder`
- M3: `isMounted` ref в `AddSubscriptionSheet`

### Неделя 3 — landing + privacy + алерты

**День 1-2: Landing critical**
- L1, L2, L3: Реальные URL на App Store / Google Play в CTA + убрать `opacity:0.6 cursor:default`
- L4: Сжать step images (WebP, <300KB each), `<picture>` with format fallback
- L5: GA4 + Branch/Adjust для install attribution
- L6: Reject button в cookie consent + analytics opt-in checkbox

**День 3: Privacy / GDPR**
- P1: "Delete Account" в Settings (обязательно для App Store/Google Play)
- P2: Email masking в логах (`email.slice(0,3) + '***'`)
- P3: Убедиться что stack trace scrub в prod работает
- M1: Certificate pinning для `api.subradar.ai`

**День 4-5: Alerting + final checks**
- P4: Telegram alert on webhook failure
- O1: Correlation ID (`X-Request-Id`) mobile → backend
- O3: Дублировать критические алерты в email/PagerDuty fallback
- Финальный pen-test pass: повтор всех критических сценариев

---

## 6. Pre-launch checklist

| Категория | Метрика |
|-----------|---------|
| Критические блокеры | 0 / 42 |
| Secrets rotated | ✅ |
| Webhook idempotency | ✅ |
| RC server-side verification | ✅ |
| CI test coverage | ≥60% blocking deploy |
| Sentry crash reporting | Mobile + backend active |
| Amplitude | Events firing in prod |
| GDPR: Delete Account UI | ✅ |
| Certificate pinning | ✅ |
| Error Boundary | ✅ |
| Health checks real | `/health` проверяет DB+Redis+очереди |
| Docker resource limits | ✅ |
| Prod deploy с approval | ✅ |
| Landing CTA функциональные | ✅ |
| Landing images optimized | LCP <2.5s mobile |
| Cookie consent GDPR-compliant | Reject button present |
| Backup policy | Documented + test restore quarterly |
| Rollback procedure | Documented + tested once |
| Load test | 100 req/sec sustained |

---

## 7. Индекс проблем по файлам

### Backend
| Файл | Critical | High |
|------|----------|------|
| `src/billing/billing.service.ts` | 6 (B1, B2, B5, B6, B7, B16) | 2 |
| `src/billing/billing.controller.ts` | 1 (B2) | 1 (B32) |
| `src/subscriptions/subscriptions.service.ts` | 1 (B17) | — |
| `src/subscriptions/guards/subscription-limit.guard.ts` | 1 (B20) | — |
| `src/auth/auth.service.ts` | 1 (B13) | 1 (B37) |
| `src/auth/strategies/jwt.strategy.ts` | 1 (B12) | — |
| `src/auth/auth.controller.ts` | 1 (B14) | — |
| `src/ai/ai.controller.ts` | 1 (B10) | 1 (B34) |
| `src/catalog/catalog.controller.ts` | 1 (B11) | — |
| `src/fx/fx.service.ts` | 1 (B18) | — |
| `src/main.ts` | 1 (B3) | — |
| `src/users/users.service.ts` | 1 (B21) | — |
| `src/users/entities/user.entity.ts` | 1 (B9) | — |
| `src/reminders/reminders.service.ts` | 1 (B22) | — |
| `src/app.controller.ts` | 1 (B26) | — |
| `src/common/filters/all-exceptions.filter.ts` | 1 (P3) | — |
| `.github/workflows/deploy.yml` | 2 (B23, B28) | — |
| `docker-compose.subradar.yml` | 1 (B27) | — |
| `.env` | 1 (B8) | — |

### Mobile
| Файл | Critical | High |
|------|----------|------|
| `src/api/client.ts` | 1 (M1) | — |
| `src/hooks/useVoiceRecorder.ts` | 1 (M2) | — |
| `src/components/AddSubscriptionSheet.tsx` | 1 (M3) | 1 (M4 size) |
| `app/_layout.tsx` | 1 (B25) | — |
| `src/services/analytics.ts` | 1 (B29) | — |
| `app/onboarding.tsx` | — | 1 (M5 size) |
| `app/(tabs)/analytics.tsx` | — | 1 (M6 size) |
| `app/(tabs)/settings.tsx` | 1 (P1) | — |
| `src/components/SubscriptionCard.tsx` | — | 1 (M7 perf) |

### Landing
| Файл | Critical | High |
|------|----------|------|
| `index.html:964,969,1172,1190,1208,1245` | 4 (L1, L2, L3) | — |
| `index.html` (images) | 1 (L4) | — |
| `index.html` (analytics) | 1 (L5) | — |
| `index.html:1263-1268` | 1 (L6 GDPR) | — |
| `index.html:20-29` (hreflang) | — | 1 |

---

## 8. Что делать с P2/polish

Оставить в backlog, **не блокировать запуск**. Revisit через месяц после launch по реальным данным (top crashes, slow queries, конверсия).

---

## 9. Финальная рекомендация

**Запуск возможен только после закрытия всех 42 P0.** Параллельно с remediation запустить:
- Load test (Artillery / k6): 100 req/sec на backend
- Pen-test (HackerOne / local) по security checklist
- Beta TestFlight на 50 реальных юзеров на 2 недели с Sentry мониторингом

**Минимум времени до production-ready: 3 недели разработки + 1 неделя beta.**
