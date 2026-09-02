#!/usr/bin/env python3
"""Пересаживает тайм-коды слов на реальный звук. Вход не меняется.

    python3 scripts/fix_word_times.py <workDir>
    workDir/words.raw.json + workDir/vad.json  ->  workDir/words_timed.json

Зачем это ОБЯЗАТЕЛЬНО и именно ЗДЕСЬ (до поиска дублей и до границ резов):

Whisper (и локальный, и через Groq) выдаёт тайм-коды, которые систематически
расходятся со звуком. Замерено на реальном 9:43 talking-head:
  * `end` ставится равным старту СЛЕДУЮЩЕГО слова, поэтому слово перед паузой
    «занимает» время, которого не звучало: «которая» 230.72-240.29 = 9.58с,
    «не» 267.36-273.12 = 5.76с. Таких слов было 23 из 297.
  * `start` может оказаться в тишине целиком: «жирненько» 166.50 при реальном
    звуке с 168.33 — промах 1.84с.
Всё, что ниже по конвейеру, сравнивает слова с картой речи. Если подать ей
интервалы, которых в звуке нет, границы резов будут ставиться мимо, а проверки
V3/V6 начнут шуметь ложными срабатываниями. После этой правки на том же
материале ВОСЕМЬ границ из девяти встали на настоящую паузу сами, без какой-либо
доп. логики — раньше почти все были приблизительными.

Порядок важен: скрипт удаляет галлюцинации, а `pairs.json` — это ИНДЕКСЫ в
массиве слов. Запуск после Шага 6 п.5 сдвинул бы все индексы.

Найдено и провалидировано на реальном материале 2026-09-02 (живой прогон,
9:43->1:12, 26 сегментов) — см. CHANGELOG.md.
"""
import io, json, sys

sys.stdout.reconfigure(encoding="utf-8")
wd = sys.argv[1] if len(sys.argv) > 1 else "."
SRC, DST, VAD = f"{wd}/words.raw.json", f"{wd}/words_timed.json", f"{wd}/vad.json"

LOOKBACK = 0.8   # тот же порог «акустического подтверждения», что в plan_cut.mjs
MIN_WORD = 0.10

raw = json.load(io.open(SRC, encoding="utf-8"))
W = [dict(x) for x in (raw["words"] if isinstance(raw, dict) else raw)]
V = json.load(io.open(VAD, encoding="utf-8"))
if V.get("schemaVersion") != 2:
    print("[fix_word_times] vad.json старой схемы — перезапусти Шаг 6 п.3", file=sys.stderr)
    raise SystemExit(1)
fine, support = V["fine"], V["support"]


def gap_to(regions, w):
    """0.0 если слово пересекает речь, иначе расстояние до ближайшей области."""
    best = float("inf")
    for a, b in regions:
        if w["end"] >= a and w["start"] <= b:
            return 0.0
        best = min(best, a - w["end"] if a > w["end"] else w["start"] - b)
    return best


# Галлюцинации Whisper на тишине («Спасибо.», «Продолжение следует...») приходят
# ровно на границах его 30-секундных окон. Судим по РАССТОЯНИЮ до речи, а не по
# факту пересечения: по пересечению вместе с ними отсеиваются настоящие тихие
# слова, у которых размах схлопнулся до 20-60мс («не», «и», «то», «что»).
kept, dropped = [], []
for w in W:
    (dropped if gap_to(support, w) > LOOKBACK else kept).append(w)
if dropped:
    print("[fix_word_times] снято галлюцинаций: %d (%s)" % (
        len(dropped), ", ".join(sorted({x["word"] for x in dropped}))))

region_of = lambda t: next(((a, b) for a, b in fine if a <= t <= b), None)
next_region = lambda t: next((r for r in fine if r[0] > t), None)

fixed_end = fixed_start = 0
for i, w in enumerate(kept):
    r = region_of(w["start"])
    if r is None:                                   # старт в тишине — сдвигаем на речь
        nr = next_region(w["start"])
        if nr:
            w["start"] = round(nr[0], 3)
            r = nr
            fixed_start += 1
    if r is not None and w["end"] > r[1] + 0.001:    # конец за пределами звука
        w["end"] = round(max(r[1], w["start"] + MIN_WORD), 3)
        fixed_end += 1
    nxt = kept[i + 1]["start"] if i + 1 < len(kept) else None
    if nxt is not None and w["end"] > nxt:
        w["end"] = round(max(min(w["end"], nxt), w["start"] + 0.02), 3)

over = sum(1 for w in kept if w["end"] - w["start"] > 1.2)
print("[fix_word_times] концов подрезано %d, стартов сдвинуто %d; "
      "слов с невозможным размахом осталось %d" % (fixed_end, fixed_start, over))
json.dump(kept, io.open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("[fix_word_times] wrote %s (%d words)" % (DST, len(kept)))
