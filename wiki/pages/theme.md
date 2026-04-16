---
title: "Система тем"
tags: [тема, цвета, dark-mode, light-mode, useTheme]
sources:
  - src/theme/index.ts
  - src/theme/colors.ts
  - src/theme/ThemeContext.tsx
  - CLAUDE.md
updated: 2026-04-16
---

# Система тем

## Принцип

Все цвета — **только** через хук `useTheme()`. Никаких хардкодов в StyleSheet.create.

## useTheme()

```typescript
const { colors, isDark, toggleTheme } = useTheme();
```

Возвращает:
- `colors` — объект `ThemeColors` с текущими значениями
- `isDark` — boolean
- `toggleTheme()` — переключение dark/light

## Палитры

### Dark Theme

```typescript
{
  primary: '#7C5CFF',
  primaryLight: '#2D2060',
  secondary: '#FF6B6B',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  background: '#11111F',
  surface: '#1C1C2E',
  surface2: '#252538',
  text: '#F1F0FF',
  textSecondary: '#A89FD0',
  textMuted: '#6B6690',
  border: '#2A2A40',
  card: '#16162A',
}
```

### Light Theme

```typescript
{
  primary: '#6C47FF',
  primaryLight: '#EDE9FF',
  secondary: '#FF6B6B',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  background: '#F4F4F8',
  surface: '#FFFFFF',
  surface2: '#F0EFF8',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  card: '#FFFFFF',
}
```

## КРИТИЧНЫЕ ПРАВИЛА

### ЗАПРЕЩЕНО

1. **`COLORS.xxx` из constants в StyleSheet.create** — это статичные dark-only значения, не реагируют на тему
2. **`isDark ? '#hex1' : '#hex2'`** — вместо этого использовать семантические имена (`colors.surface`, `colors.card`)
3. **Хардкод цветов в стилях** — за исключением допустимых случаев

### ДОПУСТИМЫЕ хардкод цвета

| Цвет | Где | Почему |
|------|-----|--------|
| `#FFF` | На кнопках с primary bg | Всегда белый текст на акцентном фоне |
| `rgba(...)` | Тени, overlay | Прозрачность не зависит от темы |
| Бренд-цвета (`#7c3aed`, `#3B82F6`) | AI тизеры, Team badges | Фиксированные бренд-акценты |

### StyleSheet.create

Должен содержать **ТОЛЬКО layout**:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1 },                    // OK — layout
  card: { borderRadius: 16, padding: 14 },   // OK — layout
  text: { fontSize: 15, fontWeight: '600' },  // OK — типографика
  // backgroundColor: colors.surface,         // ЗАПРЕЩЕНО — цвет в StyleSheet
});
```

Цвета — **inline стили**:

```typescript
<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
```

## ThemeProvider

Обёрнут в `app/_layout.tsx`:

```
ThemeProvider
  └── ... (всё приложение)
```

## AdaptiveStatusBar

```typescript
<StatusBar style={isDark ? 'light' : 'dark'} translucent={Platform.OS === 'android'} />
```

## Шрифты

Семейство **Inter**:

```typescript
const fonts = {
  regular: 'Inter-Regular',    // 400
  medium: 'Inter-Medium',      // 500
  semiBold: 'Inter-SemiBold',  // 600
  bold: 'Inter-Bold',          // 700
  extraBold: 'Inter-ExtraBold', // 800
};
```

`Inter-Medium` установлен как дефолтный шрифт для всех `Text` компонентов через `Text.defaultProps`.

## Связанные страницы

- [[architecture]] — ThemeProvider в дереве провайдеров
- [[state-management]] — тема переключается через контекст
