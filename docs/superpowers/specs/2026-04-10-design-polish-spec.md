# Design Polish — Spec

**Goal:** Поднять визуальное качество приложения до premium-уровня без изменения layout/навигации. Шрифт Inter + градиенты на CTA + глубина карточек + paywall конверсия + onboarding polish.

**Scope:** ~15 точечных визуальных правок. Средний уровень — шрифт, градиенты, тени, анимации press-feedback. Layout экранов не меняется.

**Constraints:**
- Не ломать существующую логику
- Не менять layout/структуру экранов
- Не добавлять новых библиотек (expo-linear-gradient уже в SDK)
- Все изменения через `useTheme()` colors — не хардкодить цвета
- Inter шрифт: добавить .ttf, загрузить через expo-font

---

## 1. Шрифт Inter

**Файлы:** `assets/fonts/Inter-*.ttf`, `app/_layout.tsx`, `src/theme/`

- Добавить Inter: Regular (400), Medium (500), SemiBold (600), Bold (700), ExtraBold (800)
- Загрузка через `expo-font` в `_layout.tsx` — показывать splash пока не загрузится
- Глобальный `defaultProps` на `Text` или через theme context: `fontFamily: 'Inter-Medium'` по умолчанию
- Weight mapping:
  - Body text / paragraphs: Inter-Regular (400)
  - Labels, captions: Inter-Medium (500)
  - Subheadings, buttons: Inter-SemiBold (600)
  - Headings: Inter-Bold (700)
  - Hero numbers ($624, USD 13.99): Inter-ExtraBold (800)
- Letter-spacing: -0.3 для fontSize >= 28, 0 для body, +0.5 для uppercase labels

## 2. Градиенты на CTA-кнопках

**Файлы:** Все экраны с primary-кнопками, onboarding, paywall, tab bar

- Все primary-кнопки: `LinearGradient colors={['#6C47FF', '#9B7AFF']}` start={x:0,y:0} end={x:1,y:0}
- borderRadius кнопок: стандартизировать на 16
- Цветная тень: `shadowColor: '#7C5CFF'`, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: {0, 6}
- Tab bar "+" кнопка: тот же gradient
- Затрагивает: "Начать — это бесплатно", "Далее", "Добавить подписку", "Start Trial", paywall CTA

## 3. Hero-карточка дашборда

**Файлы:** `app/(tabs)/index.tsx`

- Градиент фона: `['#6C47FF', '#4A2FB0']` start={x:0,y:0} end={x:0.5,y:1}
- Subtle overlay: View с `backgroundColor: 'rgba(255,255,255,0.06)'`, borderRadius: 999, width/height 200, position absolute top-right — "свечение"
- Тень: `shadowColor: '#6C47FF'`, opacity 0.3, radius 20

## 4. Карточки — глубина и feedback

**Файлы:** `src/components/SubscriptionCard.tsx`, карточки в index/analytics

- Тени: dark `shadowOpacity: 0.2`, light `shadowOpacity: 0.08`, radius 12, offset {0, 4}
- Light-тема тень: `shadowColor: '#6C47FF'` (фиолетовый оттенок) вместо чёрного
- borderRadius: стандартизировать на 16 для всех карточек
- Убрать `borderWidth: 1` на карточках в light-теме — тени достаточно
- Press feedback на интерактивных карточках: Animated scale 0.98 при нажатии (100ms in, 150ms out)

## 5. Paywall конверсия

**Файлы:** `app/paywall.tsx`

- CTA: gradient (секция 2) + paddingVertical: 22 (было 18)
- Social proof: gradient border `borderColor` → LinearGradient wrapper с colors `['#6C47FF20', 'transparent']`
- Выбранная plan-карточка: `shadowColor: plan.color`, opacity 0.25, radius 16
- "Maybe later": fontSize 13 (было 15), opacity 0.5
- Testimonial text: Inter-Medium italic

## 6. Onboarding polish

**Файлы:** `app/onboarding.tsx`

- Кнопка "Начать": gradient (секция 2)
- Counter $624: Inter-ExtraBold, letterSpacing: -1
- Quick-add чипсы: при выборе добавить `shadowColor: svc.color`, opacity 0.3, radius 8
- Auth экран: **убрать бейдж "7 дней Pro бесплатно"** (триал больше не авто, бейдж врёт)
- Кнопки auth: тень на Google button

---

## Дизайн-токены (обновлённые)

| Токен | Было | Стало |
|-------|------|-------|
| Font | System | Inter (400-800) |
| CTA buttons | Solid #7C5CFF | Gradient #6C47FF → #9B7AFF |
| Button borderRadius | 10-16 (разброс) | 16 (единый) |
| Card borderRadius | 12-20 (разброс) | 16 (единый) |
| Card shadow (dark) | opacity 0.06 | opacity 0.2 |
| Card shadow (light) | black, 0.06 | #6C47FF, 0.08 |
| Card border (light) | 1px solid | убрать (тень достаточно) |
| Hero card bg | Solid primary | Gradient #6C47FF → #4A2FB0 |
| CTA shadow | none | #7C5CFF, 0.35, radius 12 |
| Press feedback | none | scale 0.98, 100ms |
| Heading letter-spacing | 0 | -0.3 (для 28px+) |
