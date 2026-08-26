# Карта примитивов рендера — реально существующие компоненты этого скилла

Источник правды = файлы в `assets/primitives/` этого репозитория (51 компонент, не считая
`SubtitleTrack.tsx` — тот не маркер-триггер, см. отдельную заметку ниже). Этот файл описывает
КАЖДЫЙ реально существующий тип: компонент, **tier сложности**, **режим (mode)**, маркеры-триггеры
в речи, ключевые props.

> 2026-08-26: таблица урезана до компонентов, которые реально лежат в `assets/primitives/` —
> раньше она была скопирована из внутреннего рулбука Андрея почти без правок и называла ~90
> компонентов, из которых 44 в этом публичном репозитории физически не существовали (агент на
> живой сессии мог предложить пользователю компонент, которого нет, и упасть на импорте). Если
> нужен примитив, которого здесь нет — это нормально, его рисуют с нуля вместе с пользователем
> (см. «Правило: новый примитив — всегда предлагай занести в банк» в `SKILL.md`) и, если получилось
> удачно, добавляют сюда как обычную строку.

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

## Реестр

### T3 — интерфейс / композиция
| type | component | tier | mode | триггеры в речи | ключевые props |
|---|---|---|---|---|---|
| `terminal` | Terminal | T3 | overlay | терминал-лог, консоль, CLI | lines, title |
| `workspaceScene` | WorkspaceScene | T3 | fullscreen | демо проекта, IDE, файлы+терминал | projectName, files, terminalCmd, terminalOutput |
| `codeAppear` | CodeAppear | T3 | overlay | код построчно | lines, title, fontSize, stepSec |
| `codeCompare` | CodeCompare | T3 | fullscreen | две колонки кода | leftTitle, rightTitle, heading, leftBrand, rightBrand |
| `chatBubbles` | ChatBubbles | T3 | overlay | переписка с ИИ | messages:[{from:"user"\|"ai",text}], stepSec |

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
| `barsGrow` | BarsGrow | T2 | fullscreen | сравнение по дням/категориям столбиками | bars:[{label,value}] |
| `bars` | BarCompare | T2 | fullscreen | [legacy] столбики; аним → `barsGrow` | bars |
| `donutFill` | DonutFill | T2 | overlay | доля, процент, половина, заполняется | value(0-100), label |
| `donut` | DonutChart | T2 | overlay | [legacy] кольцо; аним → `donutFill` | value, label |
| `countUp` | CountUpNumber | T2 | overlay | одно число, N раз, N рублей | number, label, sub |
| `progressBar` | ProgressBar | T2 | overlay | загрузка, готовность, прогресс | label, to(0-100) |
| `beforeAfter` | BeforeAfter | T2 | fullscreen | было/стало, до/после, «X вместо Y» | before:{label}, after:{label} |
| `pathMorph` | PathMorph | T2 | fullscreen | превращается, становится, эволюция | fromLabel, toLabel |
| `plugConnect` | PlugConnect | T2 | fullscreen | подключаю, интеграция, плагин к | a, b |
| `layerStack` | LayerStack | T2 | fullscreen | поверх, обёртка, стек, слой | layers:[{label}] |
| `swarm` | Swarm | T2 | fullscreen | сотни, тысячи, рой, завалило | label, count |
| `chaos` | ChaosNoise | T2 | fullscreen | хаос, каша, бардак, вперемешку | labels |
| `spotlight` | Spotlight | T2 | overlay | фокус на, суть, секрет (≥2 пункта) | cards:[{label}], focusIndex |
| `numberedRows` | NumberedRows | T2 | fullscreen | перечисление «во-первых/три вещи» | rows:[{label}] |
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
| `lottieIcon` | LottieIcon | T2 | overlay | чистая иконка: `gear`/`check`/`loader` | src, caption |

### T1 — простой текст / карточка (резерв)
| type | component | tier | mode | триггеры в речи | ключевые props |
|---|---|---|---|---|---|
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

### Отдельная ось — фон / декор
| type | component | tier | mode | триггеры / роль | ключевые props |
|---|---|---|---|---|---|
| `audioWave` | AudioWave | decor | overlay-decor | осциллограф под голос (интро/связка) | label, src(авто) |
| `audioSpectrum` | AudioSpectrum | decor | overlay-decor | эквалайзер под голос (ритм-куски) | label, src(авто) |
| `logo` | LogoMark | decor | overlay-decor | лого-марка бренда | brand, effect, size, caption |

**Субтитры** — не маркер-триггер, а всегда-включённый оверлей: `assets/primitives/SubtitleTrack.tsx`
(karaoke-группировка по словам из `cut_words.json`, см. Шаг 6 в `SKILL.md`).

> ⚠️ У этого публичного скилла нет планового движка с JSON-актами (в отличие от внутреннего
> прода Андрея) — примитивы подключаются вручную через `/remotion-markup`. Динамический фон из
> цветных пятен (`meshGradient`/`matrixRain`), рамки интерфейсов (браузер/телефон/дашборд),
> курсор-клик, конфетти, нижняя плашка-титр и контейнер из нескольких битов (`block`) существуют
> во внутреннем банке Андрея, но НЕ портированы сюда — если пользователь просит что-то из этого,
> рисуй с нуля по описанию/референсу (см. правило ниже), не притворяйся, что готовый файл уже есть.

> ⚠️ `assets/primitives/FxGlowText.tsx` — реальный файл, но НЕ используй его: это референс WebGL2-
> эффекта, требует `@remotion/effects` (не в зависимостях этого скилла) и явной настройки ANGLE-
> рендерера, которой здесь нет. Не в этой таблице намеренно — считай его отсутствующим, пока
> кто-то целенаправленно не включит и не задокументирует.

## Как добавить/обновить примитив (для ЭТОГО скилла — файлы лежат в самом проекте пользователя)
1. Компонент: `assets/primitives/<Name>.tsx` (чистый Remotion: `useCurrentFrame`/`interpolate`/`spring`
   от локального кадра, без `useState`/`setTimeout`/CSS-анимаций — см. любой существующий файл рядом
   как образец, например `SubtitleTrack.tsx`).
2. Подключение: обычный React-импорт в композицию пользователя (`/remotion-markup` знает, как это
   сделать) — нет `case "<type>":`, нет реестра, который парсит код, подключение делается вручную.
3. Занеси строку в реестр этого файла (`primitive-map.md`) и, если примитив триггерится по слову в
   речи, — в `marker-action-library.md` (маркер → действие).
4. Рендер: обычный `/remotion-render`/`npx remotion render` — нет отдельного сервера/порта, никакого
   деплоя/рестарта не требуется, это часть проекта пользователя.

Компаньон по ДИЗАЙНУ действий (как выглядит анимация) — `marker-action-library.md`.
