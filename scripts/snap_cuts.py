#!/usr/bin/env python3
"""Доводит границы резов по карте речи. Вход не меняется.

    python3 scripts/snap_cuts.py <workDir>
    workDir/retakes.raw.json (от refine_cuts.mjs) + vad.json + words_timed.json + pairs.json
      ->  workDir/retakes.json + workDir/words_cut.json

Делает три вещи, каждая найдена на реальном материале:

1. СНЯТИЕ ГРАНИЦЫ НА КАРТУ. refine_cuts.mjs ставит границу по краям слов. Если
   тайм-коды соседних слов пересекаются (конец выбрасываемого позже начала
   сохраняемого — бывает регулярно), чистой границы между ними не существует, и
   она уезжает внутрь речи: в кадре остаётся хвост выброшенного захода.
   Двигаем ТОЛЬКО если область, в которую попала граница, начинается позже
   начала реза — иначе правило отбрасывает границу в начало всей реплики и может
   вывернуть рез (end < start).
   Чья это область, решаем по ПЕРЕСЕЧЕНИЮ слышимых интервалов слов с ней, а не
   по сырым стартам (те отстают до 1.8с). Если неясно — не трогаем и сообщаем:
   угадывание здесь вырезает первый кусок нужного захода.

2. ПОДТЯГИВАНИЕ СЛОВ ЗА ГРАНИЦЕЙ. Перенос границы чинит ЗВУК, но слова остаются
   позади: их интервалы всё ещё внутри реза, plan_cut их выбросит, и субтитр
   потеряет слово, которое отчётливо слышно. Раздаём их по РЕЧИ внутри открытого
   промежутка, пропуская паузы: если раздать по всему интервалу подряд, часть
   слов попадёт в паузу, её вырежет проход по паузам, и вернётся ровно тот
   дефект (V6), который мы чинили.

3. ЗАХОДЫ, КОТОРЫХ НЕТ В РАСШИФРОВКЕ. Whisper иногда сливает несколько заходов в
   одну фразу, растягивая одно слово через паузу. Дубль есть в звуке, но не в
   тексте, и пара ИНДЕКСОВ его назвать не может. Для них в pairs.json:
     "spans":     [[начало, конец, "причина"], ...]  — вырезать этот кусок;
     "wordMoves": [[индекс, начало, конец], ...]     — слова принадлежат
                  выжившему заходу, перенести туда, иначе субтитры разъедутся.

Найдено и провалидировано на реальном материале 2026-09-02 (живой прогон,
9:43->1:12, 26 сегментов) — см. CHANGELOG.md.
"""
import io, json, sys

sys.stdout.reconfigure(encoding="utf-8")
wd = sys.argv[1] if len(sys.argv) > 1 else "."
PREROLL, MIN_LEN, MIN_WORD = 0.06, 0.10, 0.10

V = json.load(io.open(f"{wd}/vad.json", encoding="utf-8"))["fine"]
W = json.load(io.open(f"{wd}/words_timed.json", encoding="utf-8"))
_pj = json.load(io.open(f"{wd}/pairs.json", encoding="utf-8"))
P = _pj["pairs"] if isinstance(_pj, dict) else _pj
_rj = json.load(io.open(f"{wd}/retakes.raw.json", encoding="utf-8"))
cuts = [list(c) for c in (_rj["cuts"] if isinstance(_rj, dict) else _rj)]

region_of = lambda t: next(((a, b) for a, b in V if a + 0.02 < t < b - 0.02), None)
prev_end = lambda t: max([b for a, b in V if b <= t] or [0.0])
next_start = lambda t: next((a for a, b in V if a > t), None)
overlap = lambda w, r: max(0.0, min(w["end"], r[1]) - max(w["start"], r[0]))

moved = 0
for i, (a, b) in enumerate(cuts):
    if i >= len(P):
        break
    dropIdx, keepIdx = P[i][0], P[i][1]
    r = region_of(b)
    if r is None or r[0] <= a:
        continue
    kept_ov = sum(overlap(w, r) for w in W[keepIdx:keepIdx + 25])
    drop_ov = sum(overlap(w, r) for w in W[dropIdx:keepIdx])
    if max(kept_ov, drop_ov) < 0.05:
        print("[snap_cuts] рез %d: чья область %.2f-%.2f — неясно, не трогаю" % (i + 1, *r))
        continue
    if kept_ov >= drop_ov:
        newb, why = max(r[0] - PREROLL, prev_end(r[0])), "начало нужной области %.2f" % r[0]
    else:
        ns = next_start(b)
        if ns is None:
            continue
        newb, why = max(ns - PREROLL, prev_end(ns)), "следующая область %.2f" % ns
    newb = max(newb, a + MIN_LEN)
    if newb <= a:
        continue
    print("[snap_cuts] рез %d: конец %.3f -> %.3f (%s)" % (i + 1, b, newb, why))
    cuts[i][1] = round(newb, 3)
    moved += 1

pulled = 0
for i, (a, b) in enumerate(cuts):
    if i >= len(P):
        break
    keepIdx = P[i][1]
    j = keepIdx
    while j < len(W) and W[j]["start"] < b:
        j += 1
    if j == keepIdx:
        continue
    n = j - keepIdx
    room, t = [], b
    for ra, rb in V:
        if rb <= t:
            continue
        s0 = max(ra, t)
        if j < len(W) and s0 >= W[j]["start"]:
            break
        e0 = min(rb, W[j]["start"]) if j < len(W) else rb
        if e0 - s0 > 0.01:
            room.append((s0, e0))
        if sum(y - x for x, y in room) >= n * MIN_WORD:
            break
    have = sum(y - x for x, y in room)
    if have < n * MIN_WORD:
        print("[snap_cuts] рез %d: места для %d слов нет (%.2fs) — не подтягиваю" % (i + 1, n, have))
        continue
    each, k = have / n, keepIdx
    for s0, e0 in room:
        t = s0
        while k < j and t + each <= e0 + 1e-6:
            W[k]["start"], W[k]["end"] = round(t, 3), round(t + each, 3)
            t += each
            k += 1
            pulled += 1
    while k < j:
        W[k]["start"], W[k]["end"] = round(room[-1][1] - each, 3), round(room[-1][1], 3)
        k += 1
        pulled += 1

spans = _pj.get("spans", []) if isinstance(_pj, dict) else []
moves = _pj.get("wordMoves", []) if isinstance(_pj, dict) else []
for s, e, why in spans:
    cuts.append([float(s), float(e)])
    print("[snap_cuts] span %.2f-%.2f — %s" % (float(s), float(e), why))
for idx, s, e in moves:
    W[int(idx)]["start"], W[int(idx)]["end"] = float(s), float(e)

cuts.sort()
bad = [c for c in cuts if c[1] <= c[0]]
if bad:
    print("[snap_cuts] ВЫВЕРНУТЫЕ РЕЗЫ (end<=start): %s" % bad, file=sys.stderr)
    raise SystemExit(1)
# сохраняем метаданные refine_cuts (в т.ч. метку source, которую проверяет plan_cut)
out = dict(_rj) if isinstance(_rj, dict) else {}
out["cuts"] = cuts
out["snapped"] = True
json.dump(out, io.open(f"{wd}/retakes.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
json.dump(W, io.open(f"{wd}/words_cut.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)
print("[snap_cuts] границ перенесено %d, слов подтянуто %d, spans %d, wordMoves %d"
      % (moved, pulled, len(spans), len(moves)))
