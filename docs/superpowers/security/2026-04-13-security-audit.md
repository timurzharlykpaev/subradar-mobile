# Security Audit — SubRadar Infrastructure

**Дата:** 2026-04-13
**Droplet:** `46.101.197.19` (Ubuntu 24.04 LTS, 8GB RAM, 154GB disk)
**Database:** DigitalOcean Managed PostgreSQL 18 (1GB RAM, Single node)
**Режим проверки:** SSH к серверу + doctl к DO API + curl к публичным эндпоинтам

---

## ✅ Вердикт

**Никаких следов взлома НЕ обнаружено:**
- Нет майнеров (xmrig/minerd/cpuminer не запущены)
- Нет подозрительных процессов
- Нет неизвестных cron задач
- Нет странных SSH ключей (только 2 известных: gh-actions + openclaw-deploy)
- 507 brute-force попыток **заблокированы fail2ban** ✅
- Load average 0.13 (нормально для прода)
- Disk 11% (17GB из 154GB используется)

**Но есть 6 улучшений разной важности.**

---

## 🟢 Что настроено хорошо

| # | Что | Статус |
|---|-----|--------|
| 1 | **UFW firewall активен** | Открыты только 22/80/443 ✅ |
| 2 | **SSH password auth отключён** | `PasswordAuthentication no`, только ключи ✅ |
| 3 | **Root login — prohibit-password** | Нельзя войти рутом с паролем ✅ |
| 4 | **fail2ban активен** | 507 IP забанены за 7 дней, 19 сейчас активных ✅ |
| 5 | **Unattended-upgrades включены** | Security patches ставятся автоматически ✅ |
| 6 | **Docker порты на 127.0.0.1** | API контейнеры недоступны снаружи напрямую ✅ |
| 7 | **Nginx rate limiting** | `30r/s` общий, `5r/m` для /auth (анти-brute) ✅ |
| 8 | **Nginx security headers** | CSP, HSTS, X-Frame-Options, X-Content-Type ✅ |
| 9 | **HTTPS с auto-renewal** | Let's Encrypt через certbot.timer ✅ |
| 10 | **TLS 1.2+ only** | Сертификат валиден до May 30, 2026 ✅ |
| 11 | **App-level rate limiting** | `X-RateLimit-Limit: 300` из NestJS Throttler ✅ |
| 12 | **DB firewall (trusted sources)** | PostgreSQL доступна только 2 дроплетам + 1 IP ✅ |
| 13 | **DO managed DB** | Auto-backups 7 дней, SSL обязателен ✅ |
| 14 | **Нет отладочных портов** | Grafana/Prometheus/cAdvisor биндятся на 127.0.0.1 ✅ |
| 15 | **Docker auto-restart** | `restart: unless-stopped` у всех сервисов ✅ |

---

## 🟡 Проблемы для исправления

### P0 — Критично (исправить сразу)

#### 1. JWT secrets слишком короткие (31 символ)
**Что:**
- `JWT_ACCESS_SECRET` = 31 char
- `JWT_REFRESH_SECRET` = 31 char

**Риск:** Слабый HMAC-SHA256 можно подобрать быстрее. OWASP рекомендует минимум **64 символа** (256 bits) для production JWT.

**Фикс:**
```bash
# Сгенерировать новые 64-char секреты
openssl rand -base64 48 | tr -d '\n'  # 64 chars base64
```
Обновить в GitHub Secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), перезапустить контейнер. **ВАЖНО:** После смены все юзеры будут разлогинены (их токены станут невалидными).

#### 2. Permissions на .env файлах — публично читаемы
**Что:** `/opt/subradar/.env.prod` и `.env.dev` имеют `644` (`-rw-r--r--`) — любой user на сервере может прочитать секреты.

**Риск:** Если в будущем создашь non-root user или запустишь приложение не под root — они получат доступ ко всем секретам (JWT, OpenAI, RC, Stripe, DB password).

**Фикс:**
```bash
ssh root@46.101.197.19 "chmod 600 /opt/subradar/.env.prod /opt/subradar/.env.dev"
```
Также обновить `deploy.yml` workflow — добавить `chmod 600` после `cat > .env`.

---

### P1 — Важно (исправить на неделе)

#### 3. SSH доступ без 2FA
**Что:** На сервер можно зайти только с SSH ключом. Но если ключ украдут (компрометация ноутбука), никакой второй фактор не спросит.

**Риск:** Если `id_steptogoal` из `~/.ssh/` у тебя украдут — атакующий получит root SSH.

**Фикс (выбери одно):**
- **Вариант А:** Passphrase на ключе (добавить `ssh-keygen -p -f ~/.ssh/id_steptogoal`)
- **Вариант B:** Установить [google-authenticator-libpam](https://github.com/google/google-authenticator-libpam) для TOTP второго фактора
- **Вариант C:** Использовать SSH через Tailscale (private network) вместо публичного 22 порта

**Рекомендация:** Вариант А — самое простое и эффективное. 1 минута настройки.

#### 4. Нет rootkit scanner
**Что:** `chkrootkit` и `rkhunter` не установлены.

**Риск:** Если сервер скомпрометируют через уязвимость приложения — автоматическая детекция rootkit'ов не сработает.

**Фикс:**
```bash
ssh root@46.101.197.19 "
apt-get install -y rkhunter
rkhunter --update
rkhunter --propupd  # baseline
echo '0 3 * * 0 rkhunter --check --sk --quiet | mail -s \"rkhunter\" admin@subradar.ai' >> /etc/crontab
"
```
Или установи без email — запускать вручную раз в месяц.

#### 5. Нет DDoS защиты (Cloudflare или DO LB)
**Что:** Сейчас трафик идёт напрямую на droplet → nginx. Один массированный DDoS убьёт сервер.

**Риск:** Конкуренты/боты могут уронить сервис на часы. Nginx rate limiting работает per-IP, но не спасёт от distributed атак с 1000+ IP.

**Фикс:**
- **Бесплатно:** Cloudflare Free tier — поставить CNAME на субдомены, включить proxy (orange cloud). Получишь: DDoS protection, WAF, кеш, бесплатный SSL
- **Настроить origin IP whitelist:** После Cloudflare — блокировать весь трафик на 80/443 кроме Cloudflare IPs в UFW

**Инструкция:** Настроить Cloudflare займёт 10-15 минут. Не требует изменений в коде.

#### 6. Monitoring alerts не настроены
**Что:** Grafana + Prometheus + Loki стоят, но алертов нет (`/etc/prometheus/alerts/` пуст).

**Риск:** Когда что-то сломается (API down, disk full, high CPU) — узнаешь только когда юзер напишет.

**Фикс:** Создать Prometheus rules для:
- API down > 1 min
- CPU > 80% 5 min
- Disk > 80%
- Failed login spike > 100/min
- Memory > 90%

Отправку в Telegram можно настроить через Alertmanager + Telegram bot.

---

### P2 — Nice to have

#### 7. Открытый SSH port 22
**Что:** Порт 22 торчит наружу. Вчера было 3067 failed login attempts за 24ч.

**Риск:** Нагрузка на fail2ban, логи засоряются, мизерный шанс 0-day в SSH. Не критично — ключи защищают.

**Фикс (опционально):**
- Перенести SSH на port 2222 (уменьшит 99% брутфорса)
- Или использовать [ssh через Tailscale](https://tailscale.com/kb/1193/tailscale-ssh) — никаких публичных портов

#### 8. Нет alerting на failed login spike
Fail2ban банит, но если атакующий использует rotating IPs — массированная кампания пройдёт "под радаром". Нужен Telegram alert при > 500 failed logins / час.

#### 9. Docker images устарели
`postgres:15` (не 16/17), `grafana/loki:2.9.0` (есть 3.x). Не критично — только minor CVE могут накопиться.

---

## 🛡️ Защита данных БД

### Текущее состояние

| Что | Статус |
|-----|--------|
| SSL обязателен на соединении | ✅ `sslmode=require` в DATABASE_URL |
| DB недоступна извне | ✅ firewall только 3 источника (2 droplet + 1 IP) |
| Auto-backups | ✅ DO делает каждый день, хранит 7 дней |
| PITR (point-in-time recovery) | ✅ DO PostgreSQL поддерживает |
| Single point of failure | ⚠️ **1 node** — если упадёт, downtime |

### Рекомендации

**P1 — High Availability:**
- Текущая: `db-s-1vcpu-1gb, 1 node` ≈ $15/мес
- Upgrade: `db-s-1vcpu-2gb, primary + standby` ≈ $50/мес
- Даёт: автоматический failover, 99.95% SLA вместо 99.5%

**P2 — Расширенные бэкапы:**
- Помимо DO auto-backups (7 дней) — настроить **ежедневный pg_dump в DO Spaces**
- Хранить 30 дней отдельно — защита от случайного DELETE через приложение

---

## 📋 Итоговый план действий

### Сейчас (сегодня, 15 минут)

- [ ] **Поменять JWT secrets на 64-char** (GitHub Secrets → redeploy)
- [ ] **chmod 600 на .env файлы** (одной SSH командой)

### На неделе (1-2 часа)

- [ ] **Passphrase на SSH ключ** (5 мин)
- [ ] **Cloudflare Free** перед доменами (15 мин)
- [ ] **Установить rkhunter** + weekly cron (10 мин)

### В течение месяца (половина дня)

- [ ] **Prometheus alerts + Telegram bot** для API down, disk, CPU
- [ ] **Перенести SSH на 2222** или Tailscale
- [ ] **DB upgrade на HA** если бизнес-критично

---

## 🚫 Что делать при подозрении на взлом

1. **Не ребутай сервер** — потеряешь evidence в RAM
2. `ps auxf > /tmp/ps.txt` — снимок процессов
3. `ss -tnp > /tmp/connections.txt` — активные соединения
4. `last -n 100 > /tmp/logins.txt` — кто заходил
5. `docker logs subradar-api-prod > /tmp/app.log` — логи приложения
6. Отключить публичный доступ: `ufw default deny incoming`
7. Связаться с DO support + скачать snapshot для forensics
8. Ротация всех секретов (JWT, DB password через DO UI, API keys)

---

## Summary

| Уровень | Кол-во issues | Статус |
|---------|---------------|--------|
| 🚨 Критичные (P0) | 2 | JWT length + env permissions |
| ⚠️ Важные (P1) | 4 | SSH 2FA, rkhunter, Cloudflare, Alerts |
| 💡 Nice to have (P2) | 3 | SSH port, login alerting, image updates |

**Общая оценка: 7/10** — базовая безопасность в порядке (firewall, fail2ban, SSL, rate limiting), но нужны P0 фиксы и слой DDoS защиты.

Если сделать все P0+P1 фиксы — оценка станет **9/10** на уровне enterprise production.
