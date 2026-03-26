# AGENTS.md — subradar-mobile

## ⚠️ ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА

### Окружения
- `development` / `preview` → DEV API (`api-dev.subradar.ai`)
- `production` → PROD API (`api.subradar.ai`)
- Конфиг в `eas.json`, подхватывается через `EXPO_PUBLIC_API_URL`

### Git Workflow
```bash
# Всегда от dev
git checkout dev && git pull
git checkout -b feat/xxx   # или fix/, docs/

# Коммит
git add -A && git commit -m "feat: ..."

# Мерж в dev → удалить ветку
git checkout dev && git merge feat/xxx
git push origin dev
git branch -d feat/xxx
```

> ❌ В `main` — ТОЛЬКО по явной команде Тимура!

### Production билд — ТОЛЬКО по команде Тимура
```bash
# НЕ делать самостоятельно!
eas build --profile production --platform ios
eas build --profile production --platform android
```

### Флоу разработки
1. Фича → ветка от `dev`
2. Тест через `eas build --profile development`
3. TestFlight через `eas build --profile preview`
4. Prod — только после одобрения Тимура

### Перед каждым коммитом
```bash
npx tsc --noEmit 2>&1 | grep "error TS"
```

### Стек
- Expo + React Native + TypeScript
- Expo Router (файловая структура в `app/`)
- Zustand (stores в `src/stores/`)
- React Query (хуки в `src/hooks/`)
- i18n: 10 языков в `src/locales/`
- Push: Expo Push Token (`ExponentPushToken[...]`)

### Важно
- Push токены — Expo Push Token, НЕ нативный APNs
- RevenueCat для IAP — НЕ ТРОГАТЬ логику покупок без Тимура
- Все тексты через `t()` из i18n

Подробнее: `DEVELOPMENT.md`
