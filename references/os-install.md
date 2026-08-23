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

Ничего сверх общего списка, но:
- Для локальных сессий в Claude Desktop нужен установленный Git — если его нет, скачать с
  [git-scm.com](https://git-scm.com/downloads/win).
- Терминал — PowerShell (не CMD, команды выше рассчитаны на POSIX-подобный синтаксис).

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
