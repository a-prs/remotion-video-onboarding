# Карта примитивов рендера (RULEBOOK) — все живые `type` движка VerticalFromPlan

Источник правды = `apps/video-montage/remotion/src/vertical/VerticalFromPlan.tsx` (switch `renderRaw`,
**93 контентных типа** + глобальная директива `finish`). Этот файл описывает КАЖДЫЙ тип: компонент,
**tier сложности**, **режим (mode)**, маркеры-триггеры в речи, ключевые props. Держится в синхроне
с кодом скриптом `agents/montage-vertical/audit_rulebook.py` (падает при расхождении CODE↔DOC).

> Прежняя версия этого файла («24 статичных компонента, ни одного анимированного действия») была
> УСТАРЕВШЕЙ на десятки примитивов и врала про деплой. Переписано 2026-08-10 под реальный код.

## Tier — сложность визуала (принцип «сложное вперёд»)
- **T3** — интерфейс / композиция: рамка устройства, браузер, мессенджер, терминал, дашборд, канбан,
  соц-карточка, детект-рамки. Если в речи описан ИНТЕРФЕЙС — берётся T3, НЕ карточка.
- **T2** — анимированное действие / схема: цепочки, воронки, графики, счётчики, зачёркивания, вердикты.
- **T1** — простой текст / карточка: тезис, цитата, заголовок, всплывающее слово. Резерв, когда нет T3/T2.
- **Отдельная ось** (не конкурирует за слот «слово→визуал»): фоны, декор-оверлеи, контейнеры, глобальная финиш-директива.

## Mode — как примитив садится в кадр 9:16
- **overlay** — компактный, лицо видно (верхняя треть). Дефолт для talking-head.
- **fullscreen** — крупная схема/ревил на весь кадр. Между двумя fullscreen держи overlay-бит с лицом.
- **background** — полноэкранный фон ПОЗАДИ графики (faceless).
- **overlay-decor** — декор/усилитель поверх (курсор, конфетти, титр, аудио-волна).
- **outro** — финальная карта близко к концу ролика.
- **container** — контейнер битов (`block`).
- **external** — ставит отдельный пайплайн, режиссёр не эмитит (`broll`).
- **global** — глобальная пост-директива на весь ролик (`finish`).

FRAME_ROOT-примитивы (Wave 1-4 2026-08-10: интерфейсы, оверлеи данных, фоны, финиш) рендерятся в
корне кадра (читаемая полоса, без клипа гаттером). Легаси ~59 едут прежним гаттер-враппером.

## Реестр (машиночитаемо — audit_rulebook.py парсит колонки type/tier/mode)

### T3 — интерфейс / композиция
| type | component | tier | mode | триггеры в речи | ключевые props |
|---|---|---|---|---|---|
| `deviceFrame` | DeviceFrame | T3 | fullscreen | приложение, экран телефона, «в приложении» | variant, appName, `inner`, screenshot, rows |
| `browserFrame` | BrowserFrame | T3 | fullscreen | сайт, браузер, лендинг, «зашёл на страницу» | url, heading, bodyLines, buttonLabel, `inner` |
| `phoneMessenger` | PhoneMessenger | T3 | fullscreen | переписка двух людей, «написал ему» | contact, messages, input |
| `terminalSim` | TerminalSimulator | T3 | fullscreen | терминал, CLI, `npm i`, деплой, консоль (живой набор) | lines, cwd, title, cps |
| `terminal` | Terminal | T3 | overlay | [legacy] статичный терминал-лог | lines, title |
| `dashboard` | DashboardKit | T3 | fullscreen | дашборд, метрики, админка, аналитика | menu, kpis, chart/chartValues |
| `bento` | BentoGrid | T3 | fullscreen | сетка возможностей, обзор плиток | tiles |
| `kanban` | KanbanBoard | T3 | fullscreen | доска задач, канбан, «в работе → готово» | columns |
| `workspaceScene` | WorkspaceScene | T3 | fullscreen | демо проекта, IDE, файлы+терминал | projectName, files, terminalCmd, terminalOutput |
| `codeAppear` | CodeAppear | T3 | overlay | код построчно | lines, title, fontSize, stepSec |
| `codeCompare` | CodeCompare | T3 | fullscreen | [legacy] две колонки кода | leftTitle, rightTitle, heading, leftBrand, rightBrand |
| `chatBubbles` | ChatBubbles | T3 | overlay | переписка с ИИ | messages:[{from:"user"\|"ai",text}], stepSec |
| `cipherChat` | CipherChat | T3 | overlay | чат-тред, текст шифруется | messages:[{speaker,side,text,accent}], stepSec, cipherSec |
| `socialCard` | SocialCard | T3 | overlay | твит, пост, лайки, вирусный | platform, author, handle, verified, text, stats |
| `searchBar` | SearchBar | T3 | overlay | поиск, «загуглил», ввод промпта | query, suggestion, engine |
| `inputField` | InputField | T3 | overlay | форма, лид-магнит, ввод почты | label, value, buttonLabel, state |
| `notifStack` | NotificationStack | T3 | overlay | уведомления, пуши, DM стопкой | items, stepSec |
| `boundingBox` | BoundingBox | T3 | overlay | детект объектов, «ИИ видит», распознавание | image, boxes, drawSec |
| `previewGrid` | PreviewGrid | T3 | overlay | сетка превью, «N миров/вариантов» | count, label, tiles, cols, stepSec |
| `geoMap` | GeoMap | T3 | overlay | карта, точки, распространение, прицел | mode, points, accent, timerLabel, label |
| `fileTree` | FileTree | T3 | fullscreen | структура папки/репо, «где лежит файл», дерево каталогов, рабочая директория | title, nodes:[{label,depth,kind,active,badge}] |
| `globMatch` | GlobMatch | T3 | fullscreen | по маске/паттерну, «подходят эти файлы», auto-load, фильтр по расширению | glob, files:[{name,match}], tag |
| `diffReview` | DiffReview | T3 | fullscreen | ревью кода, дифф, «что изменилось», добавили/убрали строки | title, lines:[{kind:"add"\|"del"\|"ctx",label,width}] |

### T2 — анимированное действие / схема
| type | component | tier | mode | триггеры в речи | ключевые props |
|---|---|---|---|---|---|
| `spineFlow` | ConnectorSpine | T2 | overlay | проблема→решение, цепочка мысли | nodes:[{label,sub,accent}] |
| `lensPath` | SerpentineLens | T2 | fullscreen | алгоритм, весь путь от и до, «сначала…потом» | nodes:[{label,sub}] |
| `nodeSplit` | NodeSplit | T2 | fullscreen | разделить, два пути, по разным | root, branches:[{label}] |
| `pipeline` | PipelineFlow | T2 | fullscreen | пайплайн, конвейер, в фоне крутится, цикл | steps:[{label}] |
| `funnel` | FunnelFilter | T2 | fullscreen | из N отбираю K, фильтрую, топ из | topLabel, outLabel, drop, kept |
| `timeSpeed` | TimeSpeed | T2 | fullscreen | «за 5 мин вместо 3ч», мгновенно, пока спишь | fromLabel, toLabel |
| `lineChart` | LineChart | T2 | fullscreen | растёт, выстрелило, падает, динамика | values, label |
| `areaChart` | AreaChart | T2 | fullscreen | тренд, накопление, объём во времени | values, label, xLabels, accent |
| `barsGrow` | BarsGrow | T2 | fullscreen | сравнение по дням/категориям столбиками | bars:[{label,value}] |
| `bars` | BarCompare | T2 | fullscreen | [legacy] столбики; аним → `barsGrow` | bars |
| `donutFill` | DonutFill | T2 | overlay | доля, процент, половина, заполняется | value(0-100), label |
| `donut` | DonutChart | T2 | overlay | [legacy] кольцо; аним → `donutFill` | value, label |
| `countUp` | CountUpNumber | T2 | overlay | одно число, N раз, N рублей | number, label, sub |
| `odometer` | SlotOdometer | T2 | overlay | число докручивается барабаном | value, prefix, suffix, label, durSec |
| `progressBar` | ProgressBar | T2 | overlay | загрузка, готовность, прогресс | label, to(0-100) |
| `beforeAfter` | BeforeAfter | T2 | fullscreen | было/стало, до/после, «X вместо Y» | before:{label}, after:{label} |
| `pathMorph` | PathMorph | T2 | fullscreen | превращается, становится, эволюция | fromLabel, toLabel |
| `plugConnect` | PlugConnect | T2 | fullscreen | подключаю, интеграция, плагин к | a, b |
| `layerStack` | LayerStack | T2 | fullscreen | поверх, обёртка, стек, слой | layers:[{label}] |
| `swarm` | Swarm | T2 | fullscreen | сотни, тысячи, рой, завалило | label, count |
| `chaos` | ChaosNoise | T2 | fullscreen | хаос, каша, бардак, вперемешку | labels |
| `spotlight` | Spotlight | T2 | overlay | фокус на, суть, секрет (≥2 пункта) | cards:[{label}], focusIndex |
| `checklist` | Checklist | T2 | overlay | чек-лист, N критериев, по галочке, шаг за шагом | items:[{label,ok}], total, totalLabel, stepSec |
| `limitBar` | LimitBar | T2 | fullscreen | лимит/потолок/квота, «упёрся в предел», обрезается, cap, бюджет символов/токенов | label, value, cap, unit, overflowLabel |
| `gatePass` | GatePass | T2 | fullscreen | проходят гейт/фильтр, allow-list, разрешено без спроса, whitelist, апрув | header, gateLabel, tools:[…], passLabel |
| `rowCycler` | RowCycler | T2 | fullscreen | одно из N по очереди, «где живёт», варианты/тиры/режимы/среды подсвечиваются по кругу | title, rows:[{label,sub}], holdSec |
| `auditScan` | AuditScan | T2 | fullscreen | аудит/проверка/линт, скан по документу, «прогнал ревизию», часть ок часть фейл | title, rows:[{label,ok}], scanSec |
| `reconcileMatch` | ReconcileMatch | T2 | fullscreen | сверка/сопоставление двух сторон, реконсиляция, «бьётся/не бьётся», matched | leftLabel, rightLabel, rows:[{ok}] |
| `sortBins` | SortBins | T2 | fullscreen | сортирует очередь, раскидывает по категориям/корзинам, триаж | bins:[{label,accent}], items:[{label,bin}] |
| `rankBars` | RankBars | T2 | fullscreen | ранжирует/приоритизирует, «что делать дальше», пересортировка по важности | title, bars:[{label,value}] |
| `numberedRows` | NumberedRows | T2 | fullscreen | перечисление «во-первых/три вещи» | rows:[{label}] |
| `timeline` | Timeline | T2 | fullscreen | таймлайн, вехи, этапы, активный шаг | nodes, activeIndex, callout |
| `drawOn` | DrawOn | T2 | overlay | рисованная обводка/подчёркивание поверх слова | text, shape, accent |
| `annotate` | RoughAnnotate | T2 | overlay | акцент на произносимой фразе («вот ЭТО/именно») | text, variant |
| `strikeNegate` | StrikeNegate | T2 | overlay | не работает, забудь про, бесполезно (есть термин) | term, stamp |
| `duplicate` | DuplicateStamp | T2 | fullscreen | платил дважды, подписка, за то же | label, times |
| `equals` | EqualsRestate | T2 | overlay | то есть, по сути, иными словами | a, b |
| `suspenseQA` | SuspenseQA | T2 | overlay | «знаешь почему?/угадай что» | question, answer |
| `verdict` | VerdictStamp | T2 | overlay | работает/готово vs провал | text, ok |
| `orbitDiagram` | OrbitDiagram | T2 | fullscreen | экосистема, спутники вокруг ядра | center, items:[{label,brand}], title |
| `diagramFlow` | DiagramFlow | T2 | fullscreen | [legacy] статичная схема-процесс | steps, title |
| `nodeMap` | NodeMap | T2 | fullscreen | [legacy] карта узлов; аним → `spineFlow`/`nodeSplit` | nodes |
| `neuralFlow` | NeuralFlow | T2 | fullscreen | [legacy] вход→сеть→выход | inputLabel, outputLabel, pipelineSteps |
| `cipherText` | CipherText | T2 | overlay | одиночный пузырь с шифрующимся текстом | text, speaker, accent, durSec |
| `glitchText` | RgbGlitchText | T2 | overlay | RGB-глитч слова (слом/хайп) | text |
| `lottieIcon` | LottieIcon | T2 | overlay | чистая иконка: `gear`/`check`/`loader` | src, caption |

### T1 — простой текст / карточка (резерв)
| type | component | tier | mode | триггеры в речи | ключевые props |
|---|---|---|---|---|---|
| `glassText` | GlassPanel | T1 | overlay | тезис словами | heading, label, accentWord, size |
| `fullScreenText` | FullScreenText | T1 | overlay | хук, панчлайн | text, accentWord, accentColor, fontSize, label |
| `iconTitle` | IconTitle | T1 | overlay | заголовок с иконкой/брендом | title, label, brand, icon |
| `iconPopup` | IconPopup | T1 | overlay | короткий поп с иконкой | text, brand, icon |
| `quoteCard` | QuoteCard | T1 | overlay | цитата | text, author |
| `chapterCards` | ChapterCards | T1 | fullscreen | обзор N глав/пунктов | chapters:[{title,subtitle,brand}], title |
| `cardPile` | CardPile | T1 | fullscreen | стопка карточек, CTA-финал | cards:[{title,subtitle,badge,brand}], title |
| `heroCard` | HeroCard | T1 | fullscreen | глубокий разбор | title, category, description, bullets, brand |
| `heroNumber` | inline (→CountUpNumber) | T1 | overlay | [legacy] крупное число; аним → `countUp` | number, heading, label, sub |
| `kineticWord` | KineticWord | T1 | overlay | сильное ключевое слово всплывает | word, sentiment |
| `pointer` | Pointer | T1 | overlay | смотри сюда, вот тут, видишь | label |
| `twoColumn` | TwoColumn | T1 | fullscreen | [legacy] сравнение двух колонок словами | left, right |

### Отдельная ось — фон / декор / контейнер / глобальная директива
| type | component | tier | mode | триггеры / роль | ключевые props |
|---|---|---|---|---|---|
| `matrixRain` | MatrixRain | фон | background | faceless фон-дождь символов | columns, accent |
| `meshGradient` | MeshGradient | фон | background | faceless мягкий градиент-фон | — |
| `audioWave` | AudioWave | decor | overlay-decor | осциллограф под голос (интро/связка) | label, src(авто) |
| `audioSpectrum` | AudioSpectrum | decor | overlay-decor | эквалайзер под голос (ритм-куски) | label, src(авто) |
| `cursor` | Cursor | усилитель | overlay-decor | курсор+клик поверх интерфейса (жму/кликаю) | targetX, targetY, fromX, fromY, label, clickAtSec |
| `confetti` | Confetti | decor | overlay-decor | праздничный ревил/успех | label, count, seed |
| `lowerThird` | LowerThird | decor | overlay-decor | нижняя плашка-титр имя/должность | name, subtitle, accent |
| `endCard` | EndCard | outro | outro | финальная CTA-карта близко к концу | channel, handle, cta |
| `logo` | LogoMark | decor | overlay-decor | лого-марка бренда | brand, effect, size, caption |
| `block` | MegaBlock | контейнер | container | мега-блок c `beats[]` (внутрь любой type) | beats:[{at,type,props,transition}], hold |
| `broll` | Broll | пайплайн | external | окно браузера с реальной страницей — ОТДЕЛЬНЫЙ пайплайн, режиссёр не эмитит | src, url, stops, srcW, srcH |

### Глобальная директива (не контентный тип)
| directive | component | роль | props |
|---|---|---|---|
| `finish` | GrainVignette | глобальная пост-обработка на весь ролик (грейн/виньетка) | grain, vignette, intensity |

**Служебные акты** (движок/пайплайн, режиссёр не эмитит как обычный `type`): `subtitles` (караоке-слова
→ SubtitleTrack, поддерживает `skin`), `sfx` (звук, поле `sfx` на акте → SfxTrack), `noface`
(faceless-режим), `camera` (CameraFX — режиссёрская камера + оранжевые lightleak-склейки).

**Flow-переходы** (поле `flow` на акте, faceless по умолчанию): `zoom` (зум-сквозь, продолжение мысли),
`cut` (листаем, новый пункт). Расширяемы (iris/clockWipe/pixelate/lightleak) — см. transitions.ts.
**Транзишены битов внутри block** (`transition`): `stack` (дефолт), `replace`, `morph`.

## Как добавить/обновить примитив (реальный процесс, без sudo)
1. Лист-компонент: `apps/video-montage/remotion/src/vertical/components/<Name>.tsx` (чистый Remotion:
   spring/interpolate от локального кадра, `random('seed')` вместо `Math.random`, без useState/setTimeout/CSS-анимаций).
2. Регистрация: импорт + `case "<type>":` в `apps/video-montage/remotion/src/vertical/VerticalFromPlan.tsx`
   (`renderRaw`). Если примитив несёт СВОЮ подложку/рамку — добавь в `NO_PLATE`. Full-frame (интерфейс/фон/
   финиш) — добавь в `FRAME_ROOT` (фоны → `FR_BG`, поверх сабов → `FR_TOP`).
3. Промпт: занеси `type`+props в `agents/montage-vertical/plan_prompt.md` и `plan_prompt_noface.md`
   (маркер→действие, tier, mode) + строку в реестр этого файла.
4. Аудит: `python3 agents/montage-vertical/audit_rulebook.py` — должен пройти без diff.
5. **Деплой БЕЗ root/sudo/systemctl.** Прод-рендер (`apps/video-montage/remotion/server.js`, :8082) и
   dev-серверы (:8085/86/87) — office-owned, бандлят `src/index.ts` с диска на живую. Ре-бандл:
   `python3 agents/montage-vertical/rebundle_renderer.py` (пере-сохраняет банк-компонент → `init()` →
   свежий бандл, без остановки сервиса). Проверка: `GET :8082/health` → ready + смоук-рендер нового типа.

> ⚠️ Старая инструкция про `deploy_vertical_bank.sh` + sudo + рестарт и «источник правды = apps/remocn»
> — НЕВЕРНА. Источник правды рендера = `apps/video-montage/remotion` (прод бандлит именно его).
> `apps/remocn` — только Studio-референс внешнего вида, НЕ авторитетен для рендера (отстаёт на десятки типов).

Компаньон по ДИЗАЙНУ действий (как выглядит анимация) — `marker-action-library.md`.
