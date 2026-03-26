# Development & Release Flow — SubRadar Mobile

## Окружения

| Profile | API | Назначение |
|---------|-----|------------|
| `development` | `api-dev.subradar.ai` | Локальная разработка / dev client |
| `preview` | `api-dev.subradar.ai` | TestFlight internal / Firebase App Distribution |
| `production` | `api.subradar.ai` | App Store / Google Play |

Разделение настроено в `eas.json` через `EXPO_PUBLIC_API_URL`.  
Код в `src/api/client.ts` подхватывает нужный URL автоматически.

---

## Флоу разработки

### 1. Разработка новой фичи

```bash
# Всегда от dev
git checkout dev && git pull
git checkout -b feat/название   # или fix/, docs/

# Работа...
git add -A && git commit -m "feat: описание"

# Мерж в dev
git checkout dev && git merge feat/название
git push origin dev
git branch -d feat/название
```

> ❌ **НИКОГДА** напрямую в `main` без команды Тимура!

### 2. Тест на устройстве (dev client)

```bash
eas build --profile development --platform ios
# или android
eas build --profile development --platform android
```

Смотрит в **DEV API** (`api-dev.subradar.ai`).

### 3. TestFlight / Internal Testing

```bash
# Только после проверки на dev!
eas build --profile preview --platform ios
eas submit --profile preview --platform ios
```

Смотрит в **DEV API** — тестируем на реальных устройствах перед продом.

### 4. Production Release

```bash
# ⚠️ ТОЛЬКО по явной команде Тимура!
git checkout main && git merge dev && git push origin main

eas build --profile production --platform ios
eas build --profile production --platform android

eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Смотрит в **PROD API** (`api.subradar.ai`).

---

## Бэкенд (subradar-backend)

| Ветка | Деплой | API |
|-------|--------|-----|
| `dev` | авто (GitHub Actions) | `api-dev.subradar.ai` |
| `main` | `workflow_dispatch` → prod | `api.subradar.ai` |

> Новые фичи тестировать через `api-dev` пока не убедишься что всё работает.

---

## Чеклист перед production билдом

- [ ] Фича протестирована через `preview` profile на TestFlight
- [ ] Нет TypeScript ошибок: `npx tsc --noEmit`
- [ ] Бэкенд изменения смержены в `main` и задеплоены
- [ ] Тимур дал команду на релиз

---

## Команды

```bash
# Посмотреть статус билдов
eas build:list --limit 5

# Логи конкретного билда
eas build:view <build-id>

# Обновить OTA (без нового билда, только JS)
eas update --branch preview --message "описание"
eas update --branch production --message "описание"
```
