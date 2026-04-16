---
title: "Экран аналитики"
tags: [аналитика, графики, pro, прогноз, экономия]
sources:
  - app/(tabs)/analytics.tsx
  - src/hooks/useAnalytics.ts
  - src/api/analytics.ts
  - src/hooks/useAnalysis.ts
updated: 2026-04-16
---

# Экран аналитики

## Обзор

Полноценный экран аналитики с графиками, прогнозами и AI-анализом. Часть секций доступна только Pro-пользователям.

## API endpoints

Все запросы передают `displayCurrency` из [[currency-system]]:

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/analytics/summary` | GET | Общие итоги: totalMonthly, totalYearly, renewingSoon |
| `/analytics/monthly` | GET | Помесячные данные (12 месяцев) |
| `/analytics/by-category` | GET | Разбивка по категориям |
| `/analytics/by-card` | GET | Разбивка по платёжным картам |
| `/analytics/forecast` | GET | Прогноз на 30d/6mo/12mo (Pro) |
| `/analytics/savings` | GET | Анализ экономии (Pro) |

## Секции экрана

### 1. Summary Strip (горизонтальный скролл)

- Avg/Month — средний месячный расход
- Total/Year — годовой расход
- Active Count — количество активных подписок
- Most Expensive — самая дорогая подписка

### 2. Monthly Bar Chart (MonthlyBarChart)

SVG график с барами за последние 12 месяцев. Градиентная заливка, подписи значений, оси Y с gridlines.

### 3. Category Donut Chart (CategoryDonutChart)

SVG donut chart с легендой. Показывает распределение трат по категориям:
- Размер сегмента пропорционален трате
- Процент в сегменте (если >= 8%)
- Итоговая сумма в центре
- Легенда с иконками категорий, процентами и суммами

### 4. Card Breakdown

Разбивка расходов по платёжным картам:
- Stacked bar (цветная полоса)
- Список карт с суммами и progress bar

### 5. Forecast (Pro-gated)

Прогноз расходов:
- 30 дней
- 6 месяцев
- 12 месяцев

**Pro gate:** обёрнуто в `BlurredProSection` — показывает blurred контент + кнопку upgrade для Free.

### 6. Savings Analysis (Pro-gated)

- Потенциальная экономия (число)
- Insights (типизированные подсказки)
- Дубликаты (подписки в одной категории)

**Pro gate:** `BlurredProSection`.

### 7. Top 5 Most Expensive

Топ-5 самых дорогих подписок с рангом, иконкой, суммой и progress bar.

### 8. All Subscriptions

Полный список активных подписок с суммами.

### 9. AI Analysis Section (AIAnalysisSection)

Компонент-обёртка для AI анализа:

```
if (!isPro || isPlanRequired) → AITeaser
if (isRunning && job)         → AnalysisLoadingState
if (result)                   → AIAnalysisSummary + AIRecommendationList + AIDuplicateGroup
else                          → AITeaser
```

Автотриггер: `autoTrigger()` вызывается при фокусе для Pro-пользователей.

## Team Upsell Card

Показывается Pro-пользователям когда `totalMonthly >= 20`:
- Текущие расходы vs расходы с командой
- Экономия за год

## Стейты экрана

| Стейт | Условие | UI |
|-------|---------|-----|
| Loading | Начальная загрузка | ActivityIndicator |
| Error | 3+ endpoint-а упали | Offline icon + Retry кнопка |
| Empty | 0 подписок, нет данных | Illustration + "Add subscription" кнопка |
| Data | Есть данные | Полный экран с секциями |

## Refetch логика

- Pull-to-refresh: `RefreshControl`
- Focus refetch: `useFocusEffect` — при переходе на таб
- Currency change: `useEffect([fetchAll])` — при смене displayCurrency

## Связанные страницы

- [[currency-system]] — все суммы в displayCurrency
- [[billing]] — Pro-gated секции
- [[ai-features]] — AI анализ и рекомендации
- [[subscriptions]] — данные подписок
