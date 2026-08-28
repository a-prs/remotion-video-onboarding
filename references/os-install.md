# Установка под конкретную ОС

Все команды уже проверены (живой прогон + сверка с официальной докой Remotion, август 2026).
Node-пакеты — без sudo, безопасно ставить сразу. Системные пакеты (Linux apt) — **сначала
спроси пользователя**, см. SKILL.md Шаг 2.

## Общее для всех ОС

```bash
node -v                                    # нужна 18+
npx create-video@latest --yes --blank my-video
cd my-video
npm install
npx skills add remotion-dev/skills --skill '*' --agent claude-code -y
npx remotion browser ensure                # прогреть headless-браузер заранее
npx remotion add @remotion/install-whisper-cpp
```

Если `npx create-video@latest --yes ...` падает — почти всегда причина одна: текущая папка уже
внутри git-репозитория (у команды с `--yes` это жёсткое ограничение). Создай `my-video` в
отдельной пустой негит-папке.

Если `npx skills add` ругается на отсутствие команды `skills` — это НЕ про версию Claude Code.
`skills` — самостоятельный npm-пакет (CLI-утилита, отдельный сайт skills.sh), к харнессу
Claude Code отношения не имеет. Проблема почти всегда в npm/сети — `npm cache clean --force`,
проверить доступ к registry.npmjs.org.

## macOS

Ничего сверх общего списка. Git обычно уже стоит по умолчанию (нужен для локальных Code-сессий
в Claude Desktop).

## Windows

Кроме общего списка (все пункты ниже проверены на живой машине, август 2026):
- Для локальных сессий в Claude Desktop нужен установленный Git — если его нет, скачать с
  [git-scm.com](https://git-scm.com/downloads/win).
- Терминал — PowerShell (не CMD, команды выше рассчитаны на POSIX-подобный синтаксис).
- **`ffprobe` не на PATH**, хотя `ffmpeg` есть — скрипты (`cut_silence.py`, `vad.py`, `plan_cut.mjs`
  и т.д.) зовут `ffprobe` по имени и падают с `WinError 2` (файл не найден). Бинарник реально стоит,
  просто в другом месте: `node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe`. Добавь эту
  папку в PATH **в конец**, не в начало:
  ```powershell
  $env:PATH += ";$(Resolve-Path .)\node_modules\@remotion\compositor-win32-x64-msvc"
  ```
  В начало класть нельзя — у ffmpeg-сборки Remotion урезан набор фильтров (`--disable-filters` с
  белым списком), денойз в `clean_audio.py` на ней не соберётся, если она перекроет системный ffmpeg.
- **`npx remotion add` требует ПОЛНОГО имени пакета.** `npx remotion add google-fonts` тихо
  ничего не делает (код возврата 0, пакет не ставится, никакой ошибки) — нужно
  `npx remotion add @remotion/google-fonts` (с префиксом `@remotion/`), как и для
  `install-whisper-cpp` выше. Молчаливый нулевой код возврата — самое опасное в этой ошибке,
  дальше по пайплайну просто не будет нужного шрифта/пакета без единого сообщения об этом.
- **whisper.cpp: рабочая версия только 1.5.5.** Ассеты `whisper-bin-x64.zip` для v1.7.4 и новее
  отдают 404 — апстрим-репозиторий переименовал файлы релизов. Для 1.5.5 Remotion тянет бинарник
  со своего S3-зеркала, оно живо. Если установка `@remotion/install-whisper-cpp` падает на
  скачивании — зафиксируй версию модели/бинарника на 1.5.5 явно, не пробуй более новую.
- **Забитый системный диск даёт вводящую в заблуждение ошибку.** Remotion копирует `public/` в
  `os.tmpdir()` при каждом рендере. Когда на `C:` кончается место, headless Chrome отклоняет
  запросы к локальному серверу ассетов, и рендер падает с `Failed to fetch ... proxy?src=...` —
  про диск ни слова в первой строке ошибки, выглядит как баг сети/прокси. Если видишь эту ошибку
  на Windows — сначала проверь свободное место на `C:`, и если тесно, уведи временные файлы на
  другой диск через переменные окружения дочернего процесса рендера:
  ```powershell
  $env:TEMP = "D:\RemotionTemp"; $env:TMP = "D:\RemotionTemp"
  ```

## Linux — дополнительно нужны системные библиотеки apt

Headless-браузер (Chrome Headless Shell) без них не запустится вообще. **Спроси разрешение
перед этим шагом** (SKILL.md Шаг 2) — это единственный шаг, реально трогающий систему целиком.

Ubuntu 24.04 / 22.04:
```bash
sudo apt install -y libnss3 libdbus-1-3 libatk1.0-0 libasound2t64 libxrandr2 \
  libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libgbm-dev libcups2 \
  libcairo2 libpango-1.0-0 libatk-bridge2.0-0
```

Более старые Ubuntu и Debian — то же самое, но `libasound2t64` меняется на `libasound2`.

## Компоненты для звука/пауз — без отдельной установки

`scripts/cut_silence.py` и `scripts/clean_audio.py` используют только `ffmpeg`/`ffprobe` (уже
есть по шагам выше) + `numpy`/`scipy` (Python). Если у пользователя нет `pip`-пакетов —
`pip install numpy scipy` — это всё, что нужно, никаких нейросетевых моделей/торча/отдельных
рантаймов не требуется (сознательное решение, см. `references/audio-pipeline.md`).
