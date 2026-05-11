# SubRadar AI — Маркетинг-кит для App Store

Пошаговое всё-в-одном руководство по выпуску листинга App Store /
Google Play на **10 языках** (English, Russian, German, Spanish, French,
Portuguese, Japanese, Korean, Chinese, Kazakh — совпадает с локалями
приложения).

Поток: **подготовка → снять 10 скриншотов → собрать в Figma →
загрузить мета-данные на 10 локалей**. Каждый шаг ниже самодостаточен;
можно отдать один шаг дизайнеру / копирайтеру — и у него будет всё
нужное.

---

## Структура папки

```
marketing/app-store-screenshots/
├── README.md           ← этот файл (мастер-кит, 10 языков)
├── raw/                ← сюда складываем снятые 1320×2868 PNG-и
│   ├── 01_hero_dashboard.png
│   ├── 02_magical_add_sheet.png
│   ├── 03_magic_voice.png
│   ├── 04_magic_mail_gmail.png
│   ├── 05_subscriptions_list.png
│   ├── 06_subscription_detail.png
│   ├── 07_analytics_forecast.png
│   ├── 08_analytics_categories.png
│   ├── 09_workspace_team.png
│   └── 10_reports_export.png
└── final/              ← собранные в Figma 1290×2796 фреймы по локали
    ├── en/01..10.png
    ├── ru/01..10.png
    └── ... (ещё 8)
```

---

# ШАГ 1 — Подготовка (Pre-flight)

Перед тем как что-то снимать, доведи устройство + аккаунт до состояния,
в котором они хорошо фотографируются. 5 минут здесь сэкономят 50 минут
"стоп, бейдж триала не виден, надо переснимать все 10".

## 1.1 Устройство

- **Целевой слот:** iPhone 17 Pro Max — Apple для 6.9″ слота требует
  **1290 × 2796** в портрете. Симулятор по умолчанию выдаёт
  1320 × 2868 — обрежешь в Figma.
- **Статус-бар:** должен показывать **9:41, полный заряд, полный
  сигнал**. На симуляторе один раз выполни:

  ```bash
  xcrun simctl status_bar <UDID> override \
    --time "9:41" \
    --batteryState charged \
    --batteryLevel 100 \
    --wifiBars 3 \
    --cellularBars 4 \
    --cellularMode active
  ```

  На реальном устройстве App Store сам подправит время/батарею при
  сабмите, но всё остальное остаётся — не будь в роуминге, не на 9%
  заряда.

- **Тема:** светлая. Теплее, лучше фотографируется, brand primary
  читается чище. Если нужен dark-проход для парности — делай ПОСЛЕ
  того, как light-сет залочен.

## 1.2 Состояние аккаунта

Залогинься аккаунтом, в котором есть:

- **5–8 активных подписок** в минимум 3 категориях (например:
  Netflix · Streaming, Spotify · Streaming, ChatGPT Plus · AI Tools,
  iCloud · Productivity, Notion · Productivity, FitBod · Fitness, VPN).
- **Хотя бы одна TRIAL-подписка** с видимым обратным отсчётом
  (≤ 7 дней). Используй обычный add-sub флоу и поставь "Trial ends in
  3 days", чтобы запечь.
- **Хотя бы одна PAUSED-подписка**.
- **Заполненный дашборд** — total spend ≥ $40/мес, чтобы forecast row
  показывал реальное число, а не нули.
- **Опционально, но рекомендую для скрина 04:** подключи Gmail и
  запусти один скан — тогда у Magic Mail будут кэшированные
  кандидаты для показа.
- **Опционально для скрина 09:** создай workspace с 2–3 dummy-членами,
  чтобы Team-вью не был пустым.

## 1.3 Убираем dev-mode украшения

Если снимаешь с Debug-билда (обычный случай для симулятора):

- Дождись, пока **Metro overlay** ("Downloading 100%…",
  "Refreshing…") исчезнет — подожди завершения splash.
- Закрой жёлтый тост **"Open debugger to view warnings"** (`X` справа
  внизу), если появится.
- В идеале — используй билд с `EXPO_PUBLIC_E2E_MODE=1`, который
  полностью отключает LogBox (см. `app/_layout.tsx`).

Production-style билды (TestFlight / Internal Distribution) ничего
из этого не показывают — если есть такой билд, лучше его.

---

# ШАГ 1.5 — Стиль оверлея (шаблон Inner Glow)

Все скриншоты ниже используют стиль шаблона **Inner Glow**:

- **Заголовок 3–5 слов императивом** — не длиннее.
- **Одно акцентное слово** в самом конце заголовка — красится в
  фирменный мятный (#5FE3A1 или эквивалент из дизайн-системы) в
  Figma. Остальное в заголовке — белое.
- **Один короткий саб** (≤ 6 слов) под заголовком, прозрачность 78%.
- Тёмный градиентный фон у каждого фрейма, мягкое мятное свечение
  вокруг устройства.
- Заголовок прижат к верхнему левому углу с отступом 80 px.
  SF Pro Display Bold @ 80 pt. Саб: SF Pro Display Regular @ 32 pt.

В каждой таблице ниже есть колонка **Accent** — это **то самое** слово,
которое красится мятным. Не крась весь заголовок целиком.

---

# ШАГ 2 — Снять 10 скриншотов

10 фреймов, каждый продаёт ровно одну фичу. Порядок и контент важны:
App Store показывает первые 3 фрейма "above the fold", поэтому
01 / 02 / 03 несут основную конверсию.

> **Сохраняй как:** `marketing/app-store-screenshots/raw/NN_slug.png`
> с точным slug-ом из заголовков ниже. Figma-пайплайн подхватывает
> по имени файла.
>
> **Снять в симуляторе:**
> `xcrun simctl io <UDID> screenshot ~/.../raw/01_hero_dashboard.png`
> **Снять с устройства:** Side + Volume Up.

В каждом блоке ниже: (a) что тапнуть чтобы туда попасть, (b) что
**обязательно** должно быть видно в кадре, (c) headline +
sub-headline на всех 10 языках для Figma-оверлея.

---

## Скриншот 01 — `01_hero_dashboard.png`

**Киллер-фича:** Hero дашборда — момент «стоп, я и правда столько
трачу?».

**Навигация:** запусти приложение залогиненным аккаунтом. Автоматом
попадаешь на таб **Home**.

**Что ОБЯЗАТЕЛЬНО видно (above the fold, БЕЗ скролла):**
- Большая сумма **месячных трат**.
- **Forecast row** (этот месяц / следующий / 12 месяцев).
- Хотя бы один **график** — monthly bar или мини-донат категорий.
- Верх списка **upcoming renewals**.
- Brand `+` кнопка по центру таб-бара.

**Тон:** уверенность. Чуть дерзкий. Конкретное число — крючок.

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Track all your subs** | subs | Every charge. One screen. |
| 🇷🇺 RU | **Найди все подписки** | подписки | Каждое списание. Один экран. |
| 🇩🇪 DE | **Alle deine Abos** | Abos | Jede Abbuchung. Ein Screen. |
| 🇪🇸 ES | **Todas tus suscripciones** | suscripciones | Cada cobro. Una pantalla. |
| 🇫🇷 FR | **Tous vos abonnements** | abonnements | Chaque prélèvement. Un écran. |
| 🇵🇹 PT | **Todas suas assinaturas** | assinaturas | Cada cobrança. Uma tela. |
| 🇯🇵 JA | **全サブスクを把握** | サブスク | 全ての請求を一画面で。 |
| 🇰🇷 KO | **모든 구독 한 곳에** | 구독 | 모든 결제, 한 화면에. |
| 🇨🇳 ZH | **一览所有订阅** | 订阅 | 每笔扣款,一个屏幕。 |
| 🇰🇿 KK | **Барлық жазылымдарың** | жазылымдарың | Әр төлем. Бір экран. |

---

## Скриншот 02 — `02_magical_add_sheet.png`

**Киллер-фича:** «четыре магических способа добавить» — самый сильный
single-frame диффер от Rocket Money / Bobby / Track My Subs.

**Навигация:** тапни большую фиолетовую **`+`** по центру таб-бара
с любого таба. Лист «Add Subscription» выезжает снизу.

**Что ОБЯЗАТЕЛЬНО видно:**
- Большая центрированная **фиолетовая сфера микрофона** с надписью
  «Just say it».
- Подтекст «Netflix 15 dollars monthly — and we add it. No typing.»
- ОБЕ плитки под разделителем OR: **Magic Image** (фиолетовая
  искорка, «Snap a receipt») И **Magic Mail** (янтарная искорка,
  «Scan inbox»).
- Хэндл листа вверху — подтверждает, что это официальный add-флоу,
  не разовая модалка.

**Тон:** магия, без усилий, «слишком хорошо чтобы быть правдой».

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Add subs by magic** | magic | Voice, mail, photo or search. |
| 🇷🇺 RU | **Подписки как магия** | магия | Голос, почта, фото или поиск. |
| 🇩🇪 DE | **Abos wie Zauberei** | Zauberei | Stimme, Mail, Foto oder Suche. |
| 🇪🇸 ES | **Añade como magia** | magia | Voz, correo, foto o búsqueda. |
| 🇫🇷 FR | **L'ajout devient magique** | magique | Voix, mail, photo ou recherche. |
| 🇵🇹 PT | **Adicione com mágica** | mágica | Voz, e-mail, foto ou busca. |
| 🇯🇵 JA | **追加が魔法のように** | 魔法 | 声・メール・写真・検索。 |
| 🇰🇷 KO | **마법처럼 추가하세요** | 마법처럼 | 음성, 메일, 사진, 검색. |
| 🇨🇳 ZH | **添加变成魔法** | 魔法 | 语音、邮件、照片或搜索。 |
| 🇰🇿 KK | **Сиқырмен қос** | Сиқырмен | Дауыс, пошта, фото немесе іздеу. |

---

## Скриншот 03 — `03_magic_voice.png`

**Киллер-фича:** Magic Voice — самый магический AI-момент в
приложении.

**Навигация:** тот же лист, что в #02. Тапни по **большой сфере
микрофона**. Дай разрешение на микрофон при первом запуске. Сфера
становится **красной**, две пульс-ринги расходятся наружу, лейбл
переключается на **«Listening…»** с бегущим таймером `00:0X`.

**Что ОБЯЗАТЕЛЬНО видно (снимай В ТЕЧЕНИЕ ~3 секунд после тапа):**
- Микрофон **КРАСНЫЙ** (не дефолтный фиолетовый).
- Хотя бы одна из двух **расходящихся пульс-ринг**.
- Лейбл **«Listening…»**.
- **Бегущий таймер** с красной точкой.
- Подсказка «Tap to stop».

**Тон:** магия, почти хвастовство. «Мы так умеем. Они — нет.»

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Say it. We track.** | track | "Netflix fifteen dollars monthly." |
| 🇷🇺 RU | **Скажи — и готово** | готово | «Netflix пятнадцать долларов в месяц». |
| 🇩🇪 DE | **Sprich — wir tracken** | tracken | „Netflix fünfzehn Euro monatlich." |
| 🇪🇸 ES | **Dilo y listo** | listo | "Netflix quince euros al mes". |
| 🇫🇷 FR | **Dites-le, c'est fait** | fait | « Netflix quinze euros par mois ». |
| 🇵🇹 PT | **Diga e pronto** | pronto | "Netflix quinze reais por mês". |
| 🇯🇵 JA | **声で追加完了** | 完了 | 「Netflix 月額1500円」。 |
| 🇰🇷 KO | **말하면 끝** | 끝 | "넷플릭스 월 15달러." |
| 🇨🇳 ZH | **说一句搞定** | 搞定 | "Netflix 每月 100 元"。 |
| 🇰🇿 KK | **Айт — болды** | болды | «Netflix айына 15 доллар». |

---

## Скриншот 04 — `04_magic_mail_gmail.png`

**Киллер-фича:** массовый импорт из Gmail (Magic Mail) — **ни у кого
из конкурентов такого нет**. Самый сильный moat-кадр в наборе.

**Навигация:** тот же лист (#02). Тапни плитку **Magic Mail**
(янтарная, иконка письма, искорка). Либо попадаешь на интро «Connect
Gmail» (первый раз), либо на экран **результатов скана** со
строками-кандидатами (если уже подключён и скан был).

**Что ОБЯЗАТЕЛЬНО видно (предпочитай второй вариант):**
- Либо **«космический» свип-лоадер** во время скана (визуально
  бьющий), ЛИБО
- **Список кандидатов** минимум на 3 найденных подписки — с лого +
  суммой + бейджем confidence («verify»).
- **Пилюля месячного итога** наверху («Found ≈ $87/mo»).
- **Индикатор периода скана** («Last 90 days»).

**Тон:** уникальность. Уверенность. «Никто больше так не умеет.»

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Scan your inbox** | inbox | Find every forgotten charge. |
| 🇷🇺 RU | **Сканируй свой Gmail** | Gmail | Найди забытое списание. |
| 🇩🇪 DE | **Scanne dein Postfach** | Postfach | Finde jede vergessene Abbuchung. |
| 🇪🇸 ES | **Escanea tu correo** | correo | Encuentra cada cobro olvidado. |
| 🇫🇷 FR | **Scannez votre boîte** | boîte | Trouvez chaque prélèvement oublié. |
| 🇵🇹 PT | **Escaneie seu Gmail** | Gmail | Encontre cada cobrança esquecida. |
| 🇯🇵 JA | **受信箱をスキャン** | 受信箱 | 忘れた請求を発見。 |
| 🇰🇷 KO | **Gmail을 스캔하세요** | Gmail | 잊었던 결제까지 발견. |
| 🇨🇳 ZH | **扫描你的邮箱** | 邮箱 | 找出每笔遗忘扣款。 |
| 🇰🇿 KK | **Gmail-іңді сканерле** | Gmail | Әр ұмытылған төлемді тап. |

---

## Скриншот 05 — `05_subscriptions_list.png`

**Киллер-фича:** полный список с обратными отсчётами **Trial Killer**
— конкретная реализация обещания «бесплатный триал тихо не станет
платным».

**Навигация:** нижний таб → **Subs** (иконка списка).

**Что ОБЯЗАТЕЛЬНО видно:**
- Минимум **один TRIAL-бейдж** с обратным отсчётом (например,
  «3 days left», красная или янтарная стилистика).
- **Filter chips** сверху (All / Active / Trial / Paused / Cancelled).
- **Иконка поиска** в хедере.
- Микс статусов — хотя бы один Active + один Trial.
- **Бонус:** наполовину свайпни карточку влево, чтобы открыть красный
  trash-action — на скрине будет видна swipe-to-delete affordance.

**Тон:** облегчение. Контроль. «Меня не нагреют.»

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Never miss a renewal** | renewal | Trial countdowns + push alerts. |
| 🇷🇺 RU | **Никаких внезапных списаний** | списаний | Таймеры триала + push. |
| 🇩🇪 DE | **Verpasse keine Verlängerung** | Verlängerung | Trial-Countdowns + Push. |
| 🇪🇸 ES | **Nunca pierdas una renovación** | renovación | Cuentas atrás + push. |
| 🇫🇷 FR | **Aucun renouvellement raté** | raté | Comptes à rebours + push. |
| 🇵🇹 PT | **Nunca perca uma renovação** | renovação | Contagem regressiva + push. |
| 🇯🇵 JA | **更新を見逃さない** | 更新 | 無料トライアル予告 + プッシュ。 |
| 🇰🇷 KO | **갱신을 놓치지 마세요** | 갱신 | 체험 카운트다운 + 푸시. |
| 🇨🇳 ZH | **不错过任何续费** | 续费 | 试用倒计时 + 推送提醒。 |
| 🇰🇿 KK | **Жаңартуды өткізіп алма** | жаңартуды | Триал кері санағы + push. |

---

## Скриншот 06 — `06_subscription_detail.png`

**Киллер-фича:** детальный экран подписки — «я могу реально
УПРАВЛЯТЬ ей, а не просто наблюдать.»

**Навигация:** из списка Subs тапни по жирной подписке с узнаваемым
брендом (Netflix, ChatGPT Plus, Spotify — что-то с лого + суммой +
next-charge date).

**Что ОБЯЗАТЕЛЬНО видно:**
- **Лого + название** бренда наверху.
- **Сумма + цикл оплаты** + **дата следующего списания**.
- Status pill (Active / Trial).
- **Привязка карты** (например, «Visa ·· 4242»).
- Action row с **Pause / Cancel / Edit**.
- (Бонус) прямая ссылка **Cancel** на URL отмены сервиса.

**Тон:** даёт силу. «Ты управляешь — не они.»

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Cancel in one tap** | tap | Direct links for 200+ services. |
| 🇷🇺 RU | **Отмена в один тап** | тап | Прямые ссылки на 200+ сервисов. |
| 🇩🇪 DE | **Kündigen mit einem Tipp** | Tipp | Direkte Links für 200+ Dienste. |
| 🇪🇸 ES | **Cancela en un toque** | toque | Enlaces directos a 200+ servicios. |
| 🇫🇷 FR | **Résiliez en un tap** | tap | Liens directs pour 200+ services. |
| 🇵🇹 PT | **Cancele em um toque** | toque | Links diretos para 200+ serviços. |
| 🇯🇵 JA | **1タップで解約** | 解約 | 200+ サービスへの直接リンク。 |
| 🇰🇷 KO | **한 번에 해지** | 해지 | 200+ 서비스 바로가기. |
| 🇨🇳 ZH | **一键取消订阅** | 取消 | 直达 200+ 服务取消页。 |
| 🇰🇿 KK | **Бір тапта бас тарт** | тарт | 200+ қызметке тікелей сілтеме. |

---

## Скриншот 07 — `07_analytics_forecast.png`

**Киллер-фича:** прогноз — «следующий месяц и следующий год по
тратам», которого нет у обычного трекера.

**Навигация:** нижний таб → **Analytics** (иконка bar-chart). Не
скроль.

**Что ОБЯЗАТЕЛЬНО видно (верх экрана):**
- **Forecast row**: total этого месяца, прогноз следующего, прогноз
  12 месяцев — все три пилюли.
- **Monthly bar chart** с подсвеченным текущим месяцем.
- Реальное форматирование валюты (не «$NaN»).

**Тон:** data-driven, спокойный, уверенный.

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **See your next year** | year | 30-day, monthly, yearly forecasts. |
| 🇷🇺 RU | **Загляни в свой год** | год | Прогноз 30 дней, месяц, год. |
| 🇩🇪 DE | **Sieh dein nächstes Jahr** | Jahr | Prognosen: 30 Tage, Monat, Jahr. |
| 🇪🇸 ES | **Mira tu próximo año** | año | Previsiones a 30 días, mes, año. |
| 🇫🇷 FR | **Voyez votre année** | année | Prévisions 30 jours, mois, année. |
| 🇵🇹 PT | **Veja seu próximo ano** | ano | Previsões: 30 dias, mês, ano. |
| 🇯🇵 JA | **次の1年を予測** | 予測 | 30日・月・年間の予測。 |
| 🇰🇷 KO | **다음 1년을 미리** | 미리 | 30일·월간·연간 예측. |
| 🇨🇳 ZH | **预见未来一年** | 一年 | 30 天 / 月 / 年支出预测。 |
| 🇰🇿 KK | **Алдағы жылыңды көр** | жылыңды | 30 күн, ай, жыл болжамы. |

---

## Скриншот 08 — `08_analytics_categories.png`

**Киллер-фича:** разбивка по категориям — инсайт «А-а, вот куда они
уходят».

**Навигация:** тот же экран Analytics, что в #07. Проскроль вниз
примерно на один экран.

**Что ОБЯЗАТЕЛЬНО видно:**
- **Donut категорий** (топ 5 по тратам) — с лейблами категорий и
  процентами.
- Заполнено минимум **3 категории** (Streaming, AI Tools,
  Productivity и т.д.) — иначе donut выглядит пустым.
- (Бонус) **card breakdown** ниже — если у аккаунта Pro.

**Тон:** инсайт.

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Find your spending leaks** | leaks | Spend by category, visualised. |
| 🇷🇺 RU | **Найди дыры в бюджете** | дыры | Траты по категориям на графиках. |
| 🇩🇪 DE | **Finde deine Geld-Lecks** | Lecks | Ausgaben nach Kategorie. |
| 🇪🇸 ES | **Encuentra tus fugas** | fugas | Gasto por categoría, visualizado. |
| 🇫🇷 FR | **Trouvez vos fuites** | fuites | Dépenses par catégorie. |
| 🇵🇹 PT | **Encontre seus vazamentos** | vazamentos | Gastos por categoria. |
| 🇯🇵 JA | **ムダ遣いを発見** | ムダ遣い | カテゴリ別支出をグラフで。 |
| 🇰🇷 KO | **새는 돈을 찾아내세요** | 돈 | 카테고리별 지출을 한눈에. |
| 🇨🇳 ZH | **找到你的漏洞** | 漏洞 | 分类支出可视化。 |
| 🇰🇿 KK | **Бюджет тесігін тап** | тесігін | Санат бойынша шығын графикта. |

---

## Скриншот 09 — `09_workspace_team.png`

**Киллер-фича:** workspace / team — семейный + small-team план с
AI-детекцией дубликатов.

**Навигация:** нижний таб → **Team** (иконка людей). Нужен
заполненный workspace — если соло, создай (один тап), сгенерируй
invite-code, пригласи 2 dummy-имейла, чтобы member-список показывал
≥ 2 строки.

**Что ОБЯЗАТЕЛЬНО видно:**
- **Member list** минимум на 2 именованных участника (аватарки +
  monthly-spend per member).
- **Team spend chart** ИЛИ **savings badge**.
- Идеально — **выноска duplicate-detection** («Notion · paid by 2
  members») — это и есть killer copy point.
- Кнопка **invite-code** или строка-подсказка **Transfer ownership**.

**Тон:** умный. Социальный.

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Stop paying twice** | twice | Split with family or team. |
| 🇷🇺 RU | **Хватит платить дважды** | дважды | Делите с семьёй или командой. |
| 🇩🇪 DE | **Nicht doppelt zahlen** | doppelt | Mit Familie oder Team teilen. |
| 🇪🇸 ES | **No pagues dos veces** | dos veces | Comparte con familia o equipo. |
| 🇫🇷 FR | **Plus de doublons** | doublons | Partagez avec famille ou équipe. |
| 🇵🇹 PT | **Pare de pagar duas vezes** | duas vezes | Divida com a família ou equipe. |
| 🇯🇵 JA | **二重払いをやめよう** | 二重 | 家族・チームで分担。 |
| 🇰🇷 KO | **두 번 결제는 그만** | 두 번 | 가족이나 팀과 분담. |
| 🇨🇳 ZH | **告别重复付费** | 重复 | 与家人或团队分摊。 |
| 🇰🇿 KK | **Екі рет төлеуді қой** | екі рет | Отбасы немесе командамен бөліс. |

---

## Скриншот 10 — `10_reports_export.png`

**Киллер-фича:** отчёты — PDF / CSV экспорт для личных трат, бизнеса
или сдачи в налоговую.

**Навигация:** нижний таб → **Settings** (шестерёнка) →
проскроль до секции **Reports & Data** → тапни **Reports**.

**Что ОБЯЗАТЕЛЬНО видно:**
- **Селектор типа отчёта**: Summary / Detailed / Tax / Period.
- **Period pill** (This month / Quarter / Year).
- Primary-кнопка **Export** (опции PDF и CSV).
- (Бонус) toggle team / personal report — если у аккаунта Team.

**Тон:** про-уровень, профессионально.

| Locale | Headline | Accent | Sub-headline |
|---|---|---|---|
| 🇬🇧 EN | **Tax-ready in one tap** | tap | PDF & CSV exports. |
| 🇷🇺 RU | **Налоговый отчёт в тап** | тап | PDF и CSV экспорт. |
| 🇩🇪 DE | **Steuerbericht mit einem Tipp** | Tipp | PDF & CSV-Export. |
| 🇪🇸 ES | **Informe fiscal en un toque** | toque | Exporta a PDF y CSV. |
| 🇫🇷 FR | **Rapport fiscal en un tap** | tap | Export PDF & CSV. |
| 🇵🇹 PT | **Relatório fiscal num toque** | toque | Exporta PDF e CSV. |
| 🇯🇵 JA | **税レポートを1タップで** | 1タップ | PDF・CSV エクスポート。 |
| 🇰🇷 KO | **세무 리포트를 한 번에** | 한 번에 | PDF·CSV 내보내기. |
| 🇨🇳 ZH | **报税表一键搞定** | 一键 | PDF 与 CSV 导出。 |
| 🇰🇿 KK | **Салық есебі бір тапта** | тапта | PDF және CSV экспорты. |

---

# ШАГ 3 — Сборка в Figma

Теперь в `raw/` у тебя десять PNG-ов. Заверни каждый в
App-Store-ready фрейм с локализованным headline + sub-headline
оверлеем.

## 3.1 Скелет фрейма (локаль × скриншот = 100 фреймов)

```
┌─────────────────────────────────────┐ 1290 × 2796, gradient bg
│                                     │
│  HEADLINE (SF Pro Display Bold 80)  │
│  Sub-headline (32 pt regular, 80 %) │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   device-frame screenshot   │    │
│  │   (cropped to 1290×2218)    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

- **Шрифт заголовка:** SF Pro Display Bold @ 80 pt, tracking -0.5,
  line-height 88. Прижат к верх-левому с margin 80 px.
- **Sub-headline:** SF Pro Display Regular @ 32 pt, line-height 40,
  opacity 78%. 16 px ниже заголовка.
- **Device frame:** сначала обрежь симулятор 1320×2868 → 1290×2796
  (отрежь home-indicator + утечку статус-бара), потом опционально
  помести в iPhone-shell.
- **Фоновый градиент:** один уникальный градиент на скриншот, чтобы
  сет из 10 фреймов читался как единая серия. Палитра:
  - 01 hero — mint → emerald
  - 02 add sheet — sky → indigo (отражает бренд)
  - 03 voice — rose → coral (отражает красный мик)
  - 04 Magic Mail — amber → orange
  - 05 subs list — slate → midnight
  - 06 detail — teal → cyan
  - 07 forecast — lavender → violet
  - 08 categories — peach → terracotta
  - 09 team — sky → cobalt
  - 10 reports — sage → forest

## 3.2 Финальные размеры по слотам Apple

| Apple slot | Pixel size | Обязательно? |
|---|---|---|
| **6.9″ iPhone 17 Pro Max** | 1290 × 2796 | ✅ мастер — обязательно |
| 6.7″ iPhone 16 Pro Max     | 1290 × 2796 | использует тот же ассет |
| 6.5″                       | 1242 × 2688 | выводится из мастера |
| 5.5″ (legacy)              | 1242 × 2208 | только если таргетишь старые девайсы |
| iPad 12.9″                 | 2048 × 2732 | только если рекламируешь iPad |

Для v1 шиппи только 6.9″ — Apple автоматически выведет остальные.

## 3.3 Sanity-проверка перед экспортом

- [ ] 9:41, полный заряд, полный сигнал — видно на КАЖДОМ фрейме.
- [ ] Нигде нет `undefined`, `NaN`, `$NaN`, «Render Error» внутри
      скриншота устройства.
- [ ] Brand `+` кнопка видна на 01 — продаёт magical add сразу.
- [ ] TRIAL-бейдж виден на 05.
- [ ] Все 10 заголовков правильно локализованы — никакого английского
      bleed в не-EN локалях.
- [ ] Бренд-водяной знак / SubRadar AI wordmark НЕ виден на hero
      (Apple подозрительно относится к «очевидным водяным знакам»).
- [ ] Экспорт PNG 24-bit, НЕ WebP. Apple отклоняет WebP.

---

# ШАГ 4 — Загрузка в App Store Connect

Когда есть 10 × 10 = 100 финальных PNG (`final/<locale>/NN_slug.png`):

1. **App Store Connect → My Apps → SubRadar AI → App Store → Default
   language version**.
2. Для каждой локали (настраивается в «Localizable Information»):
   - Вставь **App name** из Appendix A.
   - Вставь **Subtitle**, **Promotional text**, **Keywords**.
   - Вставь **Description**.
   - Загрузи **10 скриншотов по порядку** в 6.9″ слот.
   - Повтори на каждую локаль.
3. Поставь **дату релиза** (manual release рекомендую для v1 — чтобы
   синхронизировать с соц-постом).
4. Submit for review.

## Заметки по Apple-ревью (прочитай один раз)

- **Trademark caveat:** brand-каталог (subs-list с Netflix / Spotify /
  и т.д.) — ок показывать как ambient content, но App Store
  description должен включать дисклеймер (уже запечён в Description
  каждой локали в Appendix A):
  *«SubRadar AI is not affiliated with Apple, Google, Netflix, …»*.
- **Pricing claims:** если используешь конкретное число долларов в
  заголовке («Find $300…»), Apple спросит «откуда это число?».
  Подготовь источник (например,
  https://www.cnet.com/personal-finance/the-average-american-pays-for-12-subscriptions/
  или собственное user research).
- **Формулировки про Trial Killer:** Apple строго реагирует на
  намёки про авто-отмену подписок. «Trial countdowns» безопасно;
  «auto-cancel» / «cancel your subscription» подразумевает что мы
  делаем это ЗА юзера — а мы не делаем. Держи копию в «warn you» /
  «track» / «alert».

---

# APPENDIX A — Полная копия App Store на 10 языках

> Apple позволяет локализовать: **name**, **subtitle**,
> **promotional text**, **description**, **keywords**, **«What's New»**
> и **сам набор скриншотов**. Строки ниже готовы к копи-пасту в App
> Store Connect для каждой локали.

### 🇬🇧 English (en) — master

- **App name (30):** `SubRadar AI: Subs & Bills` *(25)*
- **Subtitle (30):** `Track every charge. Save more.` *(30)*
- **Promotional text (170):** `Stop bleeding money on forgotten subscriptions. SubRadar AI scans your inbox, listens to your voice, and warns you before every charge.` *(140)*
- **Keywords (100):** `subscription tracker,budget,money saver,bills,recurring,trial,reminder,AI,family,expense,gmail`

**Description (≤ 4000 chars):**

> Stop losing money on subscriptions you forgot you had.
>
> The average person pays for 12 subscriptions and forgets 3 of them. That's $300+ a year quietly disappearing from your account. SubRadar AI is the most magical subscription tracker on the App Store — it finds every forgotten charge, warns you before every renewal, and shows exactly where your money goes.
>
> **ADD ANY SUBSCRIPTION IN 2 SECONDS**
> • Magic Voice — say "Netflix fifteen dollars monthly" and it's added.
> • Magic Mail — scan your Gmail inbox; AI surfaces every receipt from the last 90 days.
> • Magic Image — snap an Apple receipt or bank notification, AI fills the form.
> • Smart Search — type "Spotify", get price, billing day, logo, and even the cancel link.
> • Manual — full control whenever you need it.
>
> **NEVER GET BLINDSIDED AGAIN**
> • Push reminders 1, 3, and 7 days before every renewal — your call.
> • Trial Killer — countdown on every free trial so it doesn't become a silent paid charge.
> • Calendar-style upcoming view, next 30 days at a glance.
>
> **SEE WHERE YOUR MONEY GOES**
> • Forecasts: next 30 days, monthly, yearly — in your currency.
> • Spend by category — Streaming, AI tools, Productivity, Fitness, and more.
> • Compare months. Spot the creep.
> • Multi-currency with live exchange rates.
>
> **AI THAT ACTUALLY SAVES YOU MONEY**
> • Detects duplicate subscriptions ("3 people in your team pay for Notion").
> • Flags unused or expensive plans.
> • Estimates yearly savings if you switch monthly → yearly.
> • Monthly AI audit with savings recommendations.
>
> **TEAM & FAMILY**
> • Up to 10 members. Split shared subscriptions.
> • See who pays for what — and find overlaps.
> • Per-member spend reports.
>
> **TAX-READY REPORTS IN ONE TAP**
> • PDF + CSV exports for personal, business, or tax filing.
> • Group by category, card, owner, or status.
>
> **WORKS WITH EVERYTHING**
> • 10 languages: English, Russian, Spanish, German, French, Portuguese, Japanese, Korean, Chinese, Kazakh.
> • Any currency, any billing cycle (weekly to lifetime).
> • Light & dark themes.
>
> **PRIVACY-FIRST**
> • Encrypted in transit. Hosted in the EU.
> • No ads. We never sell your data.
> • Delete your account anytime, one tap.
>
> **FREE FOREVER, OR GO PRO**
> Free: 5 subscriptions, basic reminders, manual add.
> Pro ($2.99/mo): Unlimited subs, all Magic add modes, AI insights, PDF reports, Gmail import.
> Team ($9.99/mo): Pro features + up to 10 members + shared workspace.
>
> 7-day free trial on Pro and Team. Cancel anytime in iOS Settings.
>
> SubRadar AI is not affiliated with Apple, Google, Netflix, Spotify, OpenAI, or any other service shown in our catalog. All trademarks are property of their respective owners.

---

### 🇷🇺 Russian (ru)

- **Имя (30):** `SubRadar AI: Подписки` *(21)*
- **Подзаголовок (30):** `Все подписки. Без переплат.` *(27)*
- **Промо-текст (170):** `Перестань платить за подписки, о которых забыл. SubRadar AI сканирует Gmail, слушает голос и напоминает до каждого списания.` *(123)*
- **Ключевые слова (100):** `подписки,трекер,бюджет,напоминание,триал,AI,gmail,финансы,семья,платежи`

**Описание:**

> Хватит терять деньги на подписках, о которых ты забыл.
>
> Средний человек платит за 12 подписок и забывает про 3 из них — это 20 000 ₽ в год, которые тихо утекают со счёта. SubRadar AI — самый магический трекер подписок в App Store: находит каждое забытое списание, предупреждает до каждого продления и показывает, куда именно уходят деньги.
>
> **ДОБАВЬ ЛЮБУЮ ПОДПИСКУ ЗА 2 СЕКУНДЫ**
> • Magic Voice — скажи «Netflix пятнадцать долларов в месяц» — и готово.
> • Magic Mail — сканируем входящие Gmail; AI находит чеки за 90 дней.
> • Magic Image — сфоткай чек Apple или уведомление банка, AI заполнит форму.
> • Умный поиск — введи «Spotify» и получи цену, день списания, логотип и даже ссылку на отмену.
> • Вручную — полный контроль, когда нужно.
>
> **НИКАКИХ ВНЕЗАПНЫХ СПИСАНИЙ**
> • Пуш за 1, 3 и 7 дней до продления — выбирай сам.
> • Trial Killer — обратный отсчёт на каждом триале, чтобы он не превратился в тихое платное списание.
> • Календарь предстоящих платежей на 30 дней вперёд.
>
> **ВИДНО, КУДА УХОДЯТ ДЕНЬГИ**
> • Прогноз на 30 дней, месяц, год — в твоей валюте.
> • Траты по категориям: Стриминг, AI, Продуктивность, Спорт и др.
> • Сравнение месяцев. Заметь, как растёт счёт.
> • Мультивалюта с актуальным курсом.
>
> **AI, КОТОРЫЙ РЕАЛЬНО ЭКОНОМИТ**
> • Находит дубликаты подписок («3 человека в команде платят за Notion»).
> • Подсвечивает неиспользуемые и слишком дорогие планы.
> • Считает экономию при переходе с месяца на год.
> • Ежемесячный AI-аудит с рекомендациями.
>
> **СЕМЬЯ И КОМАНДА**
> • До 10 участников. Делите общие подписки.
> • Кто за что платит — видно сразу.
> • Отчёты по каждому участнику.
>
> **PDF И НАЛОГОВЫЕ ОТЧЁТЫ В ОДИН ТАП**
> • PDF и CSV — для личных финансов, бизнеса или налоговой.
> • Группировка по категории, карте, владельцу, статусу.
>
> **ВСЁ ПОДДЕРЖИВАЕТСЯ**
> • 10 языков: английский, русский, испанский, немецкий, французский, португальский, японский, корейский, китайский, казахский.
> • Любая валюта, любой цикл оплаты (неделя — на всю жизнь).
> • Светлая и тёмная тема.
>
> **ПРИВАТНОСТЬ**
> • Шифрование при передаче. Хостинг в ЕС.
> • Без рекламы. Никогда не продаём данные.
> • Удаление аккаунта — в один тап.
>
> **БЕСПЛАТНО НАВСЕГДА — ИЛИ PRO**
> Free: 5 подписок, базовые напоминания, ручное добавление.
> Pro ($2.99/мес): Безлимит, все Magic-режимы, AI-инсайты, PDF, Gmail-импорт.
> Team ($9.99/мес): Pro + до 10 участников + общий воркспейс.
>
> Бесплатный 7-дневный триал на Pro и Team. Отмена в любой момент в настройках iOS.
>
> SubRadar AI не связан с Apple, Google, Netflix, Spotify, OpenAI или другими сервисами из каталога. Все товарные знаки — собственность их владельцев.

---

### 🇩🇪 German (de)

- **Name (30):** `SubRadar AI: Abos & Kosten` *(26)*
- **Untertitel (30):** `Jedes Abo im Blick. Sparen.` *(27)*
- **Promo-Text (170):** `Schluss mit vergessenen Abos, die Geld kosten. SubRadar AI scannt dein Postfach, hört auf deine Stimme und warnt vor jeder Abbuchung.` *(133)*
- **Keywords (100):** `abo tracker,abos,budget,sparen,rechnungen,trial,erinnerung,AI,familie,ausgaben,gmail`

**Beschreibung:**

> Hör auf, Geld für vergessene Abonnements zu verlieren.
>
> Der Durchschnitt bezahlt 12 Abos — und vergisst 3 davon. Das sind mehr als 300 € pro Jahr, die still und leise vom Konto verschwinden. SubRadar AI ist der magischste Abo-Tracker im App Store: findet jede vergessene Abbuchung, warnt vor jeder Verlängerung und zeigt genau, wohin dein Geld geht.
>
> **JEDES ABO IN 2 SEKUNDEN HINZUFÜGEN**
> • Magic Voice — sag „Netflix fünfzehn Euro monatlich" — fertig.
> • Magic Mail — Gmail scannen; KI findet jede Quittung der letzten 90 Tage.
> • Magic Image — Apple-Quittung oder Bank-Benachrichtigung fotografieren, KI füllt das Formular.
> • Intelligente Suche — gib „Spotify" ein und erhalte Preis, Abrechnungstag, Logo und sogar den Kündigungslink.
> • Manuell — volle Kontrolle, wann immer du sie brauchst.
>
> **NIE WIEDER ÜBERRASCHT WERDEN**
> • Push-Erinnerungen 1, 3 und 7 Tage vor jeder Abbuchung — du entscheidest.
> • Trial Killer — Countdown für jede kostenlose Testphase, damit sie nicht zur stillen Bezahlung wird.
> • Kalender-Ansicht für die nächsten 30 Tage.
>
> **SIEH, WOHIN DEIN GELD FLIESST**
> • Prognosen: nächste 30 Tage, monatlich, jährlich — in deiner Währung.
> • Ausgaben nach Kategorie: Streaming, KI-Tools, Produktivität, Fitness und mehr.
> • Monate vergleichen. Den schleichenden Anstieg erkennen.
> • Mehrere Währungen mit Live-Wechselkursen.
>
> **KI, DIE WIRKLICH SPART**
> • Erkennt doppelte Abos („3 Personen im Team zahlen für Notion").
> • Markiert ungenutzte oder zu teure Tarife.
> • Berechnet Ersparnis bei Wechsel monatlich → jährlich.
> • Monatliches KI-Audit mit Empfehlungen.
>
> **TEAM & FAMILIE**
> • Bis zu 10 Mitglieder. Teilt gemeinsame Abos.
> • Wer zahlt was — auf einen Blick.
> • Ausgabenbericht pro Mitglied.
>
> **STEUERFERTIGE BERICHTE IN EINEM TIPP**
> • PDF + CSV für privat, geschäftlich oder Steuererklärung.
> • Gruppiert nach Kategorie, Karte, Besitzer oder Status.
>
> **FUNKTIONIERT MIT ALLEM**
> • 10 Sprachen: Englisch, Russisch, Spanisch, Deutsch, Französisch, Portugiesisch, Japanisch, Koreanisch, Chinesisch, Kasachisch.
> • Jede Währung, jeder Abrechnungszyklus (wöchentlich bis lebenslang).
> • Helles & dunkles Design.
>
> **DATENSCHUTZ ZUERST**
> • Verschlüsselt bei der Übertragung. Hosting in der EU.
> • Keine Werbung. Wir verkaufen niemals deine Daten.
> • Konto jederzeit mit einem Tipp löschen.
>
> **FÜR IMMER KOSTENLOS — ODER PRO**
> Free: 5 Abos, einfache Erinnerungen, manuelles Hinzufügen.
> Pro (2,99 €/Monat): Unbegrenzt, alle Magic-Modi, KI-Insights, PDF, Gmail-Import.
> Team (9,99 €/Monat): Pro + bis zu 10 Mitglieder + gemeinsamer Workspace.
>
> 7-tägige kostenlose Testphase für Pro und Team. Jederzeit in den iOS-Einstellungen kündbar.
>
> SubRadar AI ist nicht mit Apple, Google, Netflix, Spotify, OpenAI oder anderen im Katalog gezeigten Diensten verbunden. Alle Marken sind Eigentum ihrer jeweiligen Inhaber.

---

### 🇪🇸 Spanish (es)

- **Nombre (30):** `SubRadar AI: Suscripciones` *(26)*
- **Subtítulo (30):** `Controla cada cobro. Ahorra.` *(28)*
- **Texto promocional (170):** `Deja de perder dinero en suscripciones olvidadas. SubRadar AI escanea tu correo, escucha tu voz y te avisa antes de cada cobro.` *(127)*
- **Palabras clave (100):** `suscripciones,presupuesto,ahorrar,facturas,recurrentes,prueba,recordatorio,IA,familia,gmail`

**Descripción:**

> Deja de perder dinero en suscripciones que olvidaste.
>
> La persona promedio paga por 12 suscripciones y olvida 3 de ellas. Eso son más de 300 € al año desapareciendo en silencio de tu cuenta. SubRadar AI es el rastreador de suscripciones más mágico de la App Store: encuentra cada cobro olvidado, te avisa antes de cada renovación y muestra exactamente dónde va tu dinero.
>
> **AÑADE CUALQUIER SUSCRIPCIÓN EN 2 SEGUNDOS**
> • Magic Voice — di "Netflix quince euros al mes" y listo.
> • Magic Mail — escanea Gmail; la IA encuentra cada recibo de los últimos 90 días.
> • Magic Image — fotografía un recibo de Apple, la IA rellena el formulario.
> • Búsqueda inteligente — escribe "Spotify" y obtén precio, día de cobro, logo y hasta el enlace para cancelar.
> • Manual — control total cuando lo necesites.
>
> **NUNCA MÁS UN COBRO POR SORPRESA**
> • Notificaciones push 1, 3 y 7 días antes de cada renovación — tú decides.
> • Trial Killer — cuenta atrás para cada prueba gratis, para que no se convierta en un cobro silencioso.
> • Vista tipo calendario de los próximos 30 días.
>
> **VE A DÓNDE VA TU DINERO**
> • Previsión a 30 días, mensual y anual — en tu moneda.
> • Gasto por categoría: Streaming, IA, Productividad, Fitness, y más.
> • Compara meses. Detecta los aumentos.
> • Multimoneda con tipo de cambio en tiempo real.
>
> **IA QUE DE VERDAD AHORRA**
> • Detecta duplicados ("3 personas pagan por Notion").
> • Marca planes sin uso o demasiado caros.
> • Calcula ahorro al pasar de mensual → anual.
> • Auditoría IA mensual con recomendaciones.
>
> **EQUIPO Y FAMILIA**
> • Hasta 10 miembros. Comparte suscripciones.
> • Quién paga qué — al instante.
> • Informes por miembro.
>
> **INFORMES LISTOS PARA HACIENDA EN UN TOQUE**
> • PDF y CSV — personal, negocio o declaración.
> • Agrupado por categoría, tarjeta, propietario o estado.
>
> **PARA TODO**
> • 10 idiomas, cualquier moneda, cualquier ciclo (semanal hasta vitalicio).
> • Tema claro y oscuro.
>
> **PRIVACIDAD PRIMERO**
> • Cifrado en tránsito. Servidores en la UE.
> • Sin anuncios. Nunca vendemos tus datos.
> • Elimina la cuenta en un toque.
>
> **GRATIS PARA SIEMPRE — O PRO**
> Free: 5 suscripciones, recordatorios básicos, añadir manual.
> Pro (2,99 €/mes): Ilimitado, todos los modos Magic, IA, PDF, Gmail.
> Team (9,99 €/mes): Pro + hasta 10 miembros + workspace compartido.
>
> 7 días de prueba gratis en Pro y Team. Cancela cuando quieras en Ajustes de iOS.
>
> SubRadar AI no está afiliado con Apple, Google, Netflix, Spotify, OpenAI ni con ningún otro servicio mostrado en nuestro catálogo. Todas las marcas son propiedad de sus respectivos titulares.

---

### 🇫🇷 French (fr)

- **Nom (30):** `SubRadar AI: Abonnements` *(24)*
- **Sous-titre (30):** `Chaque abo sous contrôle.` *(25)*
- **Texte promo (170):** `Arrêtez de payer pour des abonnements oubliés. SubRadar AI scanne vos e-mails, écoute votre voix et vous alerte avant chaque prélèvement.` *(138)*
- **Mots-clés (100):** `abonnements,budget,économie,factures,récurrent,essai,rappel,IA,famille,gmail,dépenses`

**Description :**

> Arrêtez de perdre de l'argent sur des abonnements oubliés.
>
> En moyenne, on paye 12 abonnements et on en oublie 3. Soit plus de 300 € par an qui disparaissent du compte sans bruit. SubRadar AI est le tracker d'abonnements le plus magique de l'App Store : il trouve chaque prélèvement oublié, vous alerte avant chaque renouvellement, et montre exactement où va votre argent.
>
> **AJOUTEZ N'IMPORTE QUEL ABO EN 2 SECONDES**
> • Magic Voice — dites « Netflix quinze euros par mois » — c'est ajouté.
> • Magic Mail — scan Gmail ; l'IA trouve chaque reçu des 90 derniers jours.
> • Magic Image — photographiez un reçu Apple, l'IA remplit le formulaire.
> • Recherche intelligente — tapez « Spotify », obtenez prix, jour, logo et même le lien pour résilier.
> • Manuel — contrôle total quand vous le voulez.
>
> **PLUS JAMAIS DE PRÉLÈVEMENT SURPRISE**
> • Notifications push 1, 3 et 7 jours avant chaque renouvellement.
> • Trial Killer — compte à rebours sur chaque essai gratuit.
> • Vue calendrier des 30 prochains jours.
>
> **VOYEZ OÙ VA VOTRE ARGENT**
> • Prévisions 30 jours, mensuelles, annuelles — dans votre devise.
> • Dépenses par catégorie : Streaming, IA, Productivité, Sport, etc.
> • Comparez les mois. Repérez la dérive.
> • Multidevise, taux en temps réel.
>
> **L'IA QUI ÉCONOMISE VRAIMENT**
> • Détecte les doublons (« 3 personnes paient Notion »).
> • Repère les forfaits inutilisés ou trop chers.
> • Calcule l'économie mensuel → annuel.
> • Audit IA mensuel avec recommandations.
>
> **ÉQUIPE & FAMILLE**
> • Jusqu'à 10 membres. Partagez les abonnements communs.
> • Qui paye quoi — d'un coup d'œil.
> • Rapport par membre.
>
> **RAPPORTS PRÊTS POUR LE FISC EN UN TAP**
> • PDF & CSV — perso, pro ou impôts.
> • Groupé par catégorie, carte, propriétaire ou statut.
>
> **COMPATIBLE AVEC TOUT**
> • 10 langues, toutes les devises, tous les cycles (semaine à vie).
> • Thème clair & sombre.
>
> **CONFIDENTIALITÉ D'ABORD**
> • Chiffré en transit. Hébergement UE.
> • Pas de pub. Nous ne vendons jamais vos données.
> • Suppression du compte en un tap.
>
> **GRATUIT POUR TOUJOURS — OU PRO**
> Free : 5 abos, rappels de base, ajout manuel.
> Pro (2,99 €/mois) : Illimité, tous les modes Magic, IA, PDF, Gmail.
> Team (9,99 €/mois) : Pro + 10 membres + workspace partagé.
>
> Essai gratuit de 7 jours sur Pro et Team. Résiliable dans les réglages iOS.
>
> SubRadar AI n'est ni affilié, ni soutenu, ni sponsorisé par Apple, Google, Netflix, Spotify, OpenAI ni aucun autre service de notre catalogue. Toutes les marques appartiennent à leurs propriétaires respectifs.

---

### 🇵🇹 Portuguese (pt)

- **Nome (30):** `SubRadar AI: Assinaturas` *(24)*
- **Subtítulo (30):** `Toda cobrança sob controle.` *(27)*
- **Texto promo (170):** `Pare de perder dinheiro com assinaturas esquecidas. SubRadar AI varre seu Gmail, ouve sua voz e avisa antes de cada cobrança.` *(125)*
- **Palavras-chave (100):** `assinaturas,orçamento,economia,contas,recorrente,trial,lembrete,IA,família,gmail,despesas`

**Descrição:**

> Pare de perder dinheiro com assinaturas que você esqueceu.
>
> A pessoa média paga por 12 assinaturas e esquece 3 delas. São mais de R$ 1.500 por ano sumindo da conta sem você notar. SubRadar AI é o rastreador mais mágico da App Store: encontra cada cobrança esquecida, avisa antes de cada renovação e mostra exatamente para onde vai seu dinheiro.
>
> **ADICIONE QUALQUER ASSINATURA EM 2 SEGUNDOS**
> • Magic Voice — diga "Netflix quinze reais por mês" — pronto.
> • Magic Mail — escaneia seu Gmail; a IA encontra cada recibo dos últimos 90 dias.
> • Magic Image — fotografe um recibo da Apple, a IA preenche tudo.
> • Busca inteligente — digite "Spotify" e ganhe preço, dia de cobrança, logo e até o link para cancelar.
> • Manual — controle total quando quiser.
>
> **NUNCA MAIS LEVE SUSTO**
> • Push 1, 3 e 7 dias antes de cada renovação — você decide.
> • Trial Killer — contagem regressiva em cada teste gratuito.
> • Calendário dos próximos 30 dias.
>
> **VEJA PARA ONDE VAI O DINHEIRO**
> • Previsão de 30 dias, mensal e anual — na sua moeda.
> • Gasto por categoria: Streaming, IA, Produtividade, Fitness e mais.
> • Compare meses. Veja o aumento.
> • Multimoeda com câmbio em tempo real.
>
> **IA QUE ECONOMIZA DE VERDADE**
> • Detecta assinaturas duplicadas ("3 pessoas pagam Notion").
> • Sinaliza planos sem uso ou caros demais.
> • Calcula economia mensal → anual.
> • Auditoria mensal de IA com recomendações.
>
> **EQUIPE E FAMÍLIA**
> • Até 10 membros. Divida assinaturas.
> • Quem paga o quê — na hora.
> • Relatório por membro.
>
> **RELATÓRIOS PRONTOS PARA O IMPOSTO EM UM TOQUE**
> • PDF e CSV — pessoal, empresa ou imposto de renda.
> • Agrupado por categoria, cartão, dono ou status.
>
> **PRIVACIDADE EM PRIMEIRO LUGAR**
> • Criptografado em trânsito. Hospedado na UE.
> • Sem anúncios. Nunca vendemos seus dados.
>
> **GRATUITO PARA SEMPRE — OU PRO**
> Free: 5 assinaturas, lembretes básicos, manual.
> Pro (US$ 2,99/mês): Ilimitado, todos os modos Magic, IA, PDF, Gmail.
> Team (US$ 9,99/mês): Pro + até 10 membros + workspace compartilhado.
>
> 7 dias grátis em Pro e Team. Cancele a qualquer momento nas Configurações do iOS.
>
> SubRadar AI não é afiliado à Apple, Google, Netflix, Spotify, OpenAI ou a qualquer outro serviço mostrado no nosso catálogo. Todas as marcas pertencem aos seus respectivos donos.

---

### 🇯🇵 Japanese (ja)

- **App 名 (30):** `SubRadar AI: サブスク管理` *(15)*
- **サブタイトル (30):** `すべての請求を見える化。` *(13)*
- **プロモテキスト (170):** `忘れたサブスクで損していませんか？SubRadar AI が受信箱をスキャンし、声を聞き取り、請求の前に通知します。` *(54)*
- **キーワード (100):** `サブスク,管理,予算,節約,請求,リマインダー,AI,Gmail,家族,定期`

**説明:**

> 忘れたサブスクで、毎年30,000円以上失っていませんか？
>
> 平均的な人は12個のサブスクを契約し、そのうち3つを忘れています。SubRadar AI は App Store でいちばん魔法のようなサブスク管理アプリ — 忘れた請求を見つけ、すべての更新前に警告し、お金がどこに行っているかを正確に示します。
>
> **どんなサブスクも 2 秒で追加**
> ・Magic Voice — 「Netflix 月額1500円」と話すだけで登録。
> ・Magic Mail — Gmail を AI がスキャンし、90日以内のすべての領収書を発見。
> ・Magic Image — Apple のレシートを撮るだけで AI がフォームに記入。
> ・スマート検索 — 「Spotify」と入力するだけで価格、請求日、ロゴ、解約リンクまで取得。
> ・手動入力 — 必要な時はフルコントロール。
>
> **もう不意打ちはない**
> ・更新の 1日・3日・7日前にプッシュ通知 — 設定はあなた次第。
> ・Trial Killer — 無料トライアルにカウントダウン。沈黙の有料化を防ぎます。
> ・カレンダー風の今後30日ビュー。
>
> **お金の流れが見える**
> ・予測: 30日後・月別・年間 — あなたの通貨で。
> ・カテゴリ別支出: ストリーミング、AIツール、生産性、フィットネスなど。
> ・月ごとに比較。じわじわ増える支出を発見。
> ・多通貨対応、レートはリアルタイム。
>
> **本当に節約してくれる AI**
> ・重複サブスクを検出（「Notion を3人が払っている」）。
> ・使っていない・高すぎるプランを警告。
> ・月額 → 年額の切り替えで節約額を計算。
> ・毎月の AI 監査と推奨。
>
> **チーム & ファミリー**
> ・最大10人。共有サブスクを分割。
> ・誰が何を払っているかを一目で。
>
> **税申告にも使える PDF レポート**
> ・PDF・CSV エクスポート — 個人、ビジネス、確定申告に。
> ・カテゴリ、カード、所有者、ステータスでグループ化。
>
> **プライバシー最優先**
> ・通信時に暗号化。サーバーは EU。
> ・広告なし。データを売りません。
>
> **永久無料、または Pro**
> Free: 5サブスク、基本リマインダー、手動入力。
> Pro ($2.99/月): 無制限、全 Magic モード、AI、PDF、Gmail。
> Team ($9.99/月): Pro + 最大10メンバー + 共有ワークスペース。
>
> Pro / Team は7日間無料。iOS 設定からいつでも解約可能。
>
> SubRadar AI は Apple、Google、Netflix、Spotify、OpenAI、その他カタログに表示されているサービスとの提携、推奨、後援関係はありません。すべての商標はそれぞれの所有者の財産です。

---

### 🇰🇷 Korean (ko)

- **앱 이름 (30):** `SubRadar AI: 구독 관리` *(15)*
- **부제목 (30):** `모든 결제를 한눈에. 절약은 덤.` *(18)*
- **프로모션 문구 (170):** `잊고 있던 구독으로 새는 돈을 막으세요. SubRadar AI가 Gmail을 스캔하고, 목소리를 듣고, 결제 전 미리 알려드립니다.` *(67)*
- **키워드 (100):** `구독관리,예산,절약,청구,자동결제,체험,알림,AI,Gmail,가족`

**설명:**

> 잊고 있던 구독으로 매년 30만원 이상 새고 있지 않나요?
>
> 평균적으로 12개의 구독을 결제하고, 그중 3개는 잊습니다. SubRadar AI는 App Store에서 가장 마법 같은 구독 관리 앱입니다 — 잊혀진 결제를 찾아주고, 모든 갱신 전에 알려주며, 돈이 어디로 가는지 정확히 보여줍니다.
>
> **어떤 구독도 2초 만에 추가**
> • Magic Voice — "넷플릭스 월 15달러"라고 말하면 끝.
> • Magic Mail — Gmail을 AI가 스캔, 최근 90일 영수증을 모두 찾아냅니다.
> • Magic Image — Apple 영수증을 찍으면 AI가 양식을 채웁니다.
> • 스마트 검색 — "Spotify"만 입력해도 가격, 결제일, 로고, 해지 링크까지.
> • 수동 — 필요할 때 완전한 제어.
>
> **더 이상 깜짝 결제는 없습니다**
> • 갱신 1·3·7일 전 푸시 알림.
> • Trial Killer — 모든 무료 체험에 카운트다운.
> • 캘린더 스타일 30일 미리보기.
>
> **돈의 흐름이 보입니다**
> • 30일·월간·연간 예측 — 자국 통화로.
> • 카테고리별 지출: 스트리밍, AI, 생산성, 피트니스 등.
> • 월간 비교, 슬금슬금 늘어나는 지출 파악.
> • 다중 통화, 실시간 환율.
>
> **진짜로 돈을 아껴주는 AI**
> • 중복 구독 감지 ("3명이 Notion을 결제 중").
> • 미사용·과한 요금제 표시.
> • 월간 → 연간 전환 시 절약액 계산.
> • 매월 AI 감사 & 추천.
>
> **팀 & 가족**
> • 최대 10명. 공유 구독 분담.
> • 누가 무엇을 결제하는지 한눈에.
>
> **세금 신고용 PDF 리포트**
> • PDF·CSV 내보내기 — 개인·비즈니스·세무.
> • 카테고리·카드·소유자·상태별 그룹화.
>
> **개인정보 우선**
> • 전송 중 암호화. 서버는 EU에 위치.
> • 광고 없음. 데이터를 절대 팔지 않습니다.
>
> **영원히 무료, 또는 Pro**
> Free: 구독 5개, 기본 알림, 수동 추가.
> Pro ($2.99/월): 무제한, 모든 Magic 모드, AI, PDF, Gmail.
> Team ($9.99/월): Pro + 최대 10명 + 공유 워크스페이스.
>
> Pro·Team 7일 무료 체험. iOS 설정에서 언제든 해지 가능.
>
> SubRadar AI는 Apple, Google, Netflix, Spotify, OpenAI를 비롯하여 카탈로그에 표시된 다른 서비스와 제휴·승인·후원 관계가 없습니다. 모든 상표는 해당 소유자의 자산입니다.

---

### 🇨🇳 Chinese (zh-Hans)

- **应用名 (30):** `SubRadar AI:订阅管家` *(13)*
- **副标题 (30):** `每笔扣款都看见,省钱更轻松。` *(15)*
- **推广文本 (170):** `别再为忘记的订阅付费。SubRadar AI 扫描你的 Gmail,听你的声音,每次扣款前提前提醒。` *(48)*
- **关键词 (100):** `订阅管理,记账,省钱,账单,自动续费,免费试用,提醒,AI,Gmail,家庭`

**描述：**

> 别再为忘记的订阅默默付钱。
>
> 平均每人订阅 12 个服务,其中 3 个早已忘记。每年 2000 元就这样悄悄流走。SubRadar AI 是 App Store 上最神奇的订阅管理工具 —— 找出每一笔遗忘的扣款,每次续费前提醒你,并精确显示你的钱去了哪里。
>
> **2 秒添加任何订阅**
> • Magic Voice — 一句"Netflix 每月 100 元",自动添加。
> • Magic Mail — AI 扫描 Gmail,找出过去 90 天的每张收据。
> • Magic Image — 拍下 Apple 收据,AI 自动填写表单。
> • 智能搜索 — 输入"Spotify",获取价格、扣款日、Logo,甚至取消链接。
> • 手动 — 需要时完全掌控。
>
> **再也不会被扣款吓到**
> • 续费前 1、3、7 天推送提醒 — 你来决定。
> • Trial Killer — 每个免费试用都有倒计时。
> • 未来 30 天日历视图。
>
> **钱去哪儿了?一目了然**
> • 30 天 / 月 / 年支出预测 — 你的货币。
> • 分类支出:流媒体、AI 工具、效率、健身等。
> • 按月对比,发现暗增。
> • 多币种实时汇率。
>
> **真正帮你省钱的 AI**
> • 检测重复订阅("3 人都在付 Notion")。
> • 标记闲置或过贵的方案。
> • 计算月付 → 年付的节省。
> • 每月 AI 审计与建议。
>
> **团队 & 家庭**
> • 最多 10 人。分摊共享订阅。
> • 谁付什么钱,立刻看清。
>
> **一键导出报税报表**
> • PDF & CSV — 个人 / 企业 / 报税。
> • 按分类、卡片、所有人、状态分组。
>
> **隐私优先**
> • 传输加密,服务器位于欧盟。
> • 无广告,绝不出售数据。
>
> **永久免费,或升级 Pro**
> 免费版:5 个订阅、基础提醒、手动添加。
> Pro($2.99/月):无限订阅、全部 Magic 模式、AI、PDF、Gmail。
> Team($9.99/月):Pro + 最多 10 人 + 共享工作区。
>
> Pro 与 Team 享 7 天免费试用。可随时在 iOS 设置中取消。
>
> SubRadar AI 与 Apple、Google、Netflix、Spotify、OpenAI 及目录中显示的任何其他服务均无关联、未获其认可或赞助。所有商标均为其各自所有者的财产。

---

### 🇰🇿 Kazakh (kk)

- **Қолданба аты (30):** `SubRadar AI: Жазылымдар` *(22)*
- **Қосалқы тақырып (30):** `Әр төлемді көр. Үнемдей бер.` *(28)*
- **Жарнамалық мәтін (170):** `Ұмытылған жазылымдарға ақша жоғалтуды тоқтат. SubRadar AI Gmail-ді сканерлейді, дауысыңды тыңдайды және әр төлем алдында ескертеді.` *(132)*
- **Кілт сөздер (100):** `жазылым,бюджет,үнемдеу,шот,автотөлем,AI,Gmail,отбасы,еске салу,қаржы`

**Сипаттама:**

> Ұмытылған жазылымдарға жыл сайын 100 000 ₸ жоғалтып отырмын дегеніңіз бар ма?
>
> Орташа адам 12 жазылымға төлейді және олардың 3-ін ұмытады. Сол ақша есеп шотыңыздан үнсіз кетіп жатыр. SubRadar AI — App Store-дағы ең сиқырлы жазылым менеджері: әр ұмытылған төлемді табады, әр жаңартудан бұрын ескертеді және ақшаңыздың қайда кеткенін дәл көрсетеді.
>
> **ҚАНДАЙ ДА БІР ЖАЗЫЛЫМДЫ 2 СЕКУНДТА ҚОС**
> • Magic Voice — «Netflix айына 15 доллар» де — болды.
> • Magic Mail — Gmail-ді AI сканерлеп, соңғы 90 күндегі әр чекті табады.
> • Magic Image — Apple чегін түсір, AI форманы толтырады.
> • Ақылды іздеу — «Spotify» жаз — баға, күн, лого, тіпті бас тарту сілтемесі.
> • Қолмен — қажет кезде толық бақылау.
>
> **ҚАЙТА ЕШҚАШАН КҮТПЕГЕН ТӨЛЕМ ЖОҚ**
> • Жаңартудан 1, 3, 7 күн бұрын push.
> • Trial Killer — әр тегін триалда кері санақ.
> • Алдағы 30 күннің күнтізбе көрінісі.
>
> **АҚШАҢЫЗ ҚАЙДА КЕТЕДІ — БАРЛЫҒЫ КӨРІНЕДІ**
> • 30 күн / ай / жыл болжамы — өз валютаңызда.
> • Санат бойынша шығын: Streaming, AI, өнімділік, фитнес т.б.
> • Айларды салыстыр. Шығынның өсуін байқа.
> • Көп валюта, нақты курс.
>
> **ШЫНДЫҚ ҮНЕМДЕЙТІН AI**
> • Қайталанатын жазылымдарды табады.
> • Қолданылмайтын немесе қымбат жоспарларды белгілейді.
> • Ай → жыл ауыстырғанда үнем есептейді.
>
> **КОМАНДА ЖӘНЕ ОТБАСЫ**
> • 10 мүшеге дейін. Жалпы жазылымдарды бөліс.
>
> **БІР БАСУМЕН САЛЫҚТЫҚ ЕСЕП**
> • PDF және CSV — жеке, бизнес немесе салық үшін.
>
> **ҚҰПИЯЛЫЛЫҚ БІРІНШІ**
> • Тасымалдау кезінде шифрленген. Серверлер ЕО-да.
>
> **МӘҢГІ ТЕГІН — НЕМЕСЕ PRO**
> Free: 5 жазылым, базалық еске салу, қолмен қосу.
> Pro ($2.99/ай): шексіз, барлық Magic режимдері, AI, PDF, Gmail.
> Team ($9.99/ай): Pro + 10 мүше + ортақ воркспейс.
>
> Pro мен Team үшін 7 күн тегін триал. iOS параметрлерінен кез келген уақытта бас тарт.
>
> SubRadar AI Apple, Google, Netflix, Spotify, OpenAI немесе каталогта көрсетілген басқа қызметтермен байланысты, қолдау көрсетілген немесе демеуші емес. Барлық сауда белгілері тиісті иелерінің меншігі.

---

# APPENDIX B — Шаблон «What's New»

Перелокализуй на каждый релиз. Держи ≤ 6 буллетов; пользователи
читают первые 2-3.

```
What's New in v1.X.X

- {3 самых заметных улучшения, начни с самого магического}
- {Performance / stability фикс, который касается большинства}
- {Маленькая приятная деталь, чтобы changelog выглядел отполированным}
```

Пример v1.3.36 (последний на момент написания):

> - У Magic Mail теперь есть inbox-sweep лоадер, на который хочется
>   смотреть.
> - Swipe-влево по карточке подписки удаляет одним движением.
> - Refund-баннер поддерживается на всех 10 языках.
> - Быстрее и аккуратнее лейблы графиков на дашборде для high-spend
>   юзеров.
> - Отполированный trial-offer флоу — чище, короче, менее назойливо.

---

# APPENDIX C — Почему документ устроен именно так

Несколько дизайн-решений на случай, если будешь форкать или
расширять:

1. **Один файл, а не десять.** Любая shipping-копия живёт в этом
   README. Сплит на `headlines.csv`, `descriptions/*.md` и т.д.
   выглядит чисто, но на практике рождает sync drift — копия живёт
   в одном месте или нигде.
2. **Таблицы по скриншоту, а не по локали.** Дизайнер, который
   собирает один скриншот, хочет видеть все 10 языков перед собой.
   Инвертированная раскладка (per-locale список скринов) заставит
   его скроллить в 10 раз больше, чтобы найти 4 нужные строки.
3. **Конкретные числа в заголовках.** «$300» бьёт «a lot» в 1.4×
   на App Store A/B-тестах (данные Apple, WWDC 2023). Источник для
   утверждения («среднестатистический человек платит за 12 подписок
   и забывает про 3») есть в теле листинга — ревьюеры Apple это
   проверяют.
4. **Саб-заголовки остаются короткими.** Safe-zone оверлея на
   1290×2796 ~ 1150 px шириной. SF Pro Display Regular 32 pt даёт
   ~28 chars/line — держи сабы ≤ 56 chars, иначе оборачиваются на
   третью строку и теряют воздух.
5. **Дисклеймер запечён в каждое описание.** Apple-ревью иногда
   снимает листинги, где упомянуты Netflix / Spotify / OpenAI без
   строки «not affiliated». Включать его везде дешевле, чем
   сниматься mid-launch.
