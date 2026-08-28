// Plans the edit WITHOUT touching the media: emits the list of kept spans on the
// original timeline plus the word list re-timed onto the cut timeline. Remotion
// then plays those spans straight from the source file, so there is no
// per-segment encode, no concat, and therefore no A/V drift and no accumulated
// duration error — the defects the ffmpeg-concat route produced.
//
// Reads workDir/vad.json (scripts/vad.py) as the SOLE source of speech/silence
// truth — no subprocess calls of its own (no ffmpeg silencedetect, no ffprobe).
// Previously this script ran its own separate, cruder silencedetect and never
// consulted vad.json at all, which is how a quiet punchline word ended up
// classified as "silence" and silently deleted — see references/audio-pipeline.md.
//
// node scripts/plan_cut.mjs <workDir> <wordsJson> <retakesJson> <outJson>
import fs from 'fs';
import path from 'path';

const [workDir, wordsFile, retakesFile, outFile] = process.argv.slice(2);

// GAP is now the ONLY knob that decides "is this pause worth cutting" — a raw
// gap between two `fine` speech regions must be at least this long. PAD and
// MERGE no longer conspire to raise that bar themselves (they used to: the
// real cut threshold used to be MERGE+2*PAD = 1.5s while GAP claimed 0.8s —
// found during the Silero-unification patch, see audio-pipeline.md). PAD is
// now purely cosmetic breathing room; MERGE is purely an anti-sliver safety
// net for leftover kept fragments, not a second threshold.
const GAP = Number(process.env.GAP ?? 0.7);     // min raw pause length worth cutting
const PAD = Number(process.env.PAD ?? 0.15);    // breathing room kept around speech
const MERGE = Number(process.env.MERGE ?? 0.3); // kept slivers closer than this get swallowed
const MIN_SEG = 0.70;   // a shorter span reads as a glitch — grown, never dropped
const PREROLL = 0.08;   // run-up preserved before a kept word (subtitle spacing, unrelated to cuts)
const LOOKBACK = 0.8;   // how far back to search for a word's acoustic support — a search
                        // BOUND, not a protection field, so being generous here is free

const vadPath = path.join(workDir, 'vad.json');
const vad = JSON.parse(fs.readFileSync(vadPath, 'utf8'));
if (vad.schemaVersion !== 2) {
  console.error(`[plan_cut] ${vadPath} is schemaVersion ${vad.schemaVersion ?? '(missing)'}, ` +
    `expected 2 — re-run Шаг 6.2 (scripts/vad.py) to regenerate it, this file is from an older skill version.`);
  process.exit(1);
}
const { duration: dur, fine, support, engine } = vad;
if (engine === 'energy-fallback') {
  console.error('[plan_cut] WARNING: vad.json was built with the energy-fallback detector ' +
    '(Silero/onnxruntime unavailable) — pause/word-boundary decisions are less accurate than ' +
    'usual. Say this to the user; don\'t silently proceed as if nothing changed.');
}

const words = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
const { cuts: rawRetakes, source: retakesSource } = JSON.parse(fs.readFileSync(retakesFile, 'utf8'));
if (retakesSource !== 'refine_cuts') {
  console.error(`[plan_cut] WARNING: ${retakesFile} has no "source": "refine_cuts" tag — its cut ` +
    `boundaries may be raw ASR/LLM timestamps, not real pause/energy-snapped ones. Re-run Шаг 6.3 ` +
    `(scripts/refine_cuts.mjs) to produce it properly rather than hand-writing this file.`);
}
const retakes = rawRetakes.map(([s, e]) => [s, e]).sort((a, b) => a[0] - b[0]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Remove a single [cs,ce] cut from a list of spans.
const subtractOne = (spans, [cs, ce]) => spans.flatMap(([s, e]) => {
  if (ce <= s || cs >= e) return [[s, e]];
  const out = [];
  if (cs > s) out.push([s, cs]);
  if (ce < e) out.push([ce, e]);
  return out;
});
const subtractAll = (spans, cuts) => cuts.reduce((acc, c) => subtractOne(acc, c), spans);

const wordInRetake = (w) => retakes.some(([cs, ce]) => w.start >= cs && w.start < ce);

// A word's acoustic support = the widest support[] interval touching
// [w.start - LOOKBACK, w.end]. `support` is sorted ascending (vad.py builds it
// that way), so a simple scan with early exit is enough.
const acousticSupport = (w) => {
  const lo = w.start - LOOKBACK, hi = w.end;
  let best = null;
  for (const [s, e] of support) {
    if (e < lo) continue;
    if (s > hi) break;
    if (!best || (e - s) > (best[1] - best[0])) best = [s, e];
  }
  return best;
};

// ---------------------------------------------------------------------------
// Pass 1 — pauses only. Cut every gap between `fine` regions that's >= GAP,
// padded for breathing room, but clipped by any word's acoustic support that
// falls inside the padded removal (Блокер 2 fix): a word ASR believes exists,
// which Silero/energy confirms SOME acoustic evidence for within LOOKBACK of
// it, is never removed by a pause-cut even if it missed the stricter `fine`
// bar (a quiet punchline, a word shorter than fine's duration filters). A
// word with NO acoustic support at all (an ASR hallucination in dead air) is
// not protected — the silence around it is still removed, see V4 below.
// ---------------------------------------------------------------------------

const protectedZones = words
  .filter((w) => !wordInRetake(w))
  .map(acousticSupport)
  .filter(Boolean);

let clippedByProtection = 0;
let keep = [[0, dur]];
const gaps = [];
if (fine.length === 0) {
  gaps.push([0, dur]);
} else {
  if (fine[0][0] > 0) gaps.push([0, fine[0][0]]);
  for (let i = 1; i < fine.length; i++) gaps.push([fine[i - 1][1], fine[i][0]]);
  if (fine[fine.length - 1][1] < dur) gaps.push([fine[fine.length - 1][1], dur]);
}

let pauseSecondsCut = 0;
for (const [gs, ge] of gaps) {
  if (ge - gs < GAP) continue;
  const removal = [Math.max(0, gs + PAD), Math.min(dur, ge - PAD)];
  if (removal[1] <= removal[0]) continue;
  const touching = protectedZones.filter(([ps, pe]) => pe > removal[0] && ps < removal[1]);
  const pieces = touching.length ? subtractAll([removal], touching) : [removal];
  if (touching.length) clippedByProtection++;
  for (const piece of pieces) {
    keep = subtractOne(keep, piece);
    pauseSecondsCut += piece[1] - piece[0];
  }
}
keep = keep.filter(([s, e]) => e > s);

// merge kept slivers separated by less than MERGE, then grow anything still
// under MIN_SEG (never drop it — it may carry speech) and re-merge. Pauses
// only, at this point — retakes haven't been subtracted yet (Блокер 3).
const mergeSpans = (spans, gapMax) => {
  const out = [];
  for (const sp of spans.slice().sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1];
    if (last && sp[0] - last[1] < gapMax) last[1] = Math.max(last[1], sp[1]);
    else out.push([...sp]);
  }
  return out;
};
keep = mergeSpans(keep, MERGE);
keep = keep.map(([s, e]) => {
  if (e - s >= MIN_SEG) return [s, e];
  const need = (MIN_SEG - (e - s)) / 2;
  return [Math.max(0, s - need), Math.min(dur, e + need)];
});
keep = mergeSpans(keep, MERGE);

// ---------------------------------------------------------------------------
// Pass 2 — retakes, LAST, and their boundaries become walls: never merged or
// grown across (Блокер 3). Previously retake cuts shorter than MERGE (~0.8s)
// were silently undone by the same merge pass used for pauses — almost every
// real false-start ("чувак я", "чтобы") is shorter than that, so the
// duplicate was detected but never actually removed from the output.
// ---------------------------------------------------------------------------

const EPS = 1e-3;
const isWallPoint = (t) => retakes.some(([cs, ce]) => Math.abs(t - cs) < EPS || Math.abs(t - ce) < EPS);

keep = subtractAll(keep, retakes).filter(([s, e]) => e - s > 0.02);

const shortAgainstWall = [];
keep = keep.map(([s, e]) => {
  if (e - s >= MIN_SEG) return [s, e];
  const leftWall = isWallPoint(s) || s <= EPS;
  const rightWall = isWallPoint(e) || e >= dur - EPS;
  const need = MIN_SEG - (e - s);
  if (!leftWall && !rightWall) {
    // free on both sides (a pause-only sliver that slipped through) — grow both ways as before
    const half = need / 2;
    return [Math.max(0, s - half), Math.min(dur, e + half)];
  }
  if (!leftWall) return [Math.max(0, s - need), e];       // grow left, away from the right wall
  if (!rightWall) return [s, Math.min(dur, e + need)];    // grow right, away from the left wall
  shortAgainstWall.push([s, e]);                          // walled on both sides — can't grow, report it
  return [s, e];
});

// ---------------------------------------------------------------------------
// Assign words, drop speech-less spans, re-time.
// ---------------------------------------------------------------------------

// Ownership is decided by acoustic EVIDENCE, not a raw ASR point-test. DTW
// lag (0.2-0.8s, sometimes more) can put a word's *reported* start just
// outside the kept segment it actually belongs to, even though the word is
// audibly present. That used to trip V1 (spurious "repeat" at a junction —
// the word landed in the wrong segment's word list) and V3 (spurious "LOST"
// — the word's raw start missed every segment by a hair) as false positives:
// found on real material 2026-08-29 ("жирненько"/"А"/"Чувак" all flagged,
// all verified present by re-transcribing the actual rendered output). Test
// overlap against an interval widened by LOOKBACK on both sides when support
// CONFIRMS the word is real — but only as a gate, never adopt support[]'s
// own width directly: a continuous utterance's support interval can span the
// whole segment (or more), which would resolve every word in it to
// "overlaps everything" (the regression this fix first produced on Test B
// before being bounded here). Fall back to the raw ASR interval only when
// there is no support to correct with (matches V4 "unconfirmed" exactly).
// (cutWords below still slices/clips with the word's own raw start/end, not
// this widened interval — this only decides WHICH segment a word belongs to.)
const owner = (interval, segs) => segs.findIndex(([a, b]) => interval[1] > a - 0.05 && interval[0] < b + 0.05);
const evidenceInterval = (w) => acousticSupport(w) ? [w.start - LOOKBACK, w.end + LOOKBACK] : [w.start, w.end];
const final = keep;

let kept = final.map(([a, b]) => ({ a, b, words: [] }));
const wordCategory = new Map();   // word index -> 'kept' | 'retake' | 'confirmed-lost' | 'unconfirmed'
words.forEach((w, i) => {
  if (wordInRetake(w)) { wordCategory.set(i, 'retake'); return; }
  const idx = owner(evidenceInterval(w), final);
  if (idx !== -1) { kept[idx].words.push(w); wordCategory.set(i, 'kept'); return; }
  wordCategory.set(i, acousticSupport(w) ? 'confirmed-lost' : 'unconfirmed');
});

// A span carrying no speech is dead air/b-roll from a silent stretch that
// survived the grow rule — drop it, but count it (was silently absorbed before).
const emptySpansDropped = kept.filter((k) => k.words.length === 0).length;
kept = kept.filter((k) => k.words.length > 0);

// V6 — a word classified 'kept' must be classified because it fits inside
// its segment, not merely because its evidence interval overlaps one at the
// edge. `owner()` above only tests overlap (needed to survive DTW lag); a
// word can still overlap a segment while part of it sticks out — e.g. a
// retake/pause boundary landed inside the word itself, same defect class as
// the "ткани"/"интересней" truncation, just not caught upstream this time.
// This is what actually renders (cutWords below clips silently to the
// segment), so it must fail exactly as loud as V1/V3, not slip through.
const TRUNC_TOL = PAD;   // same slack already baked into a pause-cut's breathing room
const v6problems = [];

let acc = 0;
const segsOut = [];
const cutWords = [];
for (const k of kept) {
  const at = acc;
  segsOut.push([+k.a.toFixed(3), +k.b.toFixed(3)]);
  for (const w of k.words) {
    if (w.start < k.a - TRUNC_TOL || w.end > k.b + TRUNC_TOL) {
      v6problems.push(`"${w.word}" (${w.start.toFixed(2)}-${w.end.toFixed(2)}) partially outside its kept span [${k.a.toFixed(2)}, ${k.b.toFixed(2)}]`);
    }
    const start = at + Math.max(0, w.start - k.a);
    const end = at + Math.min(k.b - k.a, w.end - k.a);
    cutWords.push({ word: w.word, start: +start.toFixed(3),
                    end: +Math.max(start + 0.12, end).toFixed(3) });
  }
  acc += k.b - k.a;
}
const offsets = (() => { let a = 0; return kept.map((k) => { const o = a; a += k.b - k.a; return +o.toFixed(3); }); })();

// ---------------------------------------------------------------------------
// VERIFY — six checks, not one unchecked summary line.
// ---------------------------------------------------------------------------

const norm = (x) => String(x || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');

// V1 — a junction must not repeat a word (the "чтобы… чтобы" defect: a dropped
// word's onset survives on the tail of one span and is spoken again on the next).
const v1problems = [];
for (let i = 1; i < kept.length; i++) {
  const prev = kept[i - 1].words, next = kept[i].words;
  if (!prev.length || !next.length) continue;
  if (norm(prev[prev.length - 1].word) === norm(next[0].word)) {
    v1problems.push(`junction ${i}: "${prev[prev.length - 1].word}" repeats at ${kept[i].a.toFixed(2)}s`);
  }
}

// V2 — every retake cut must have ZERO overlap with the final kept union (Блокер 3).
const v2problems = [];
for (const [cs, ce] of retakes) {
  for (const [a, b] of segsOut) {
    if (ce > a + EPS && cs < b - EPS) {
      v2problems.push(`retake [${cs.toFixed(2)}, ${ce.toFixed(2)}] overlaps kept segment [${a.toFixed(2)}, ${b.toFixed(2)}]`);
    }
  }
}

// V3 — an acoustically-confirmed word must never be lost to a pause-cut.
const v3problems = [];
const v4unconfirmed = [];
words.forEach((w, i) => {
  const cat = wordCategory.get(i);
  if (cat === 'confirmed-lost') v3problems.push(`"${w.word}" at ${w.start.toFixed(2)}s had acoustic support but was cut`);
  if (cat === 'unconfirmed') v4unconfirmed.push(`"${w.word}" at ${w.start.toFixed(2)}s (no acoustic support — possible ASR hallucination)`);
});

// V5 — words kept, broken down by reason instead of one opaque ratio.
const counts = { total: words.length, kept: 0, retake: 0, unconfirmed: 0, confirmedLost: 0 };
for (const cat of wordCategory.values()) {
  if (cat === 'kept') counts.kept++;
  else if (cat === 'retake') counts.retake++;
  else if (cat === 'unconfirmed') counts.unconfirmed++;
  else if (cat === 'confirmed-lost') counts.confirmedLost++;
}

const failed = v1problems.length > 0 || v2problems.length > 0 || v3problems.length > 0 ||
  v6problems.length > 0 || counts.confirmedLost > 0;

fs.writeFileSync(outFile, JSON.stringify({
  segments: segsOut, offsets, duration: +acc.toFixed(3), words: cutWords,
  meta: {
    engine, gap: GAP, pad: PAD, merge: MERGE, lookback: LOOKBACK,
    pauseSecondsCut: +pauseSecondsCut.toFixed(2),
    retakeSecondsCut: +retakes.reduce((s, [a, b]) => s + (b - a), 0).toFixed(2),
    spansClippedByWordProtection: clippedByProtection,
    emptySpansDropped, shortSegmentsAgainstWall: shortAgainstWall.length,
    wordsTruncatedByCut: v6problems.length,
    wordCounts: counts,
  },
}, null, 2));

const lens = segsOut.map(([a, b]) => b - a).sort((x, y) => x - y);
console.log(`[plan_cut] engine=${engine}  GAP=${GAP}s PAD=${PAD}s MERGE=${MERGE}s  ` +
  `(minimal cuttable pause = ${GAP}s, no other constant raises that bar)`);
console.log(`segments: ${segsOut.length}`);
console.log(`duration: ${acc.toFixed(2)}s  (pauses cut ${pauseSecondsCut.toFixed(1)}s, retakes cut ` +
  `${retakes.reduce((s, [a, b]) => s + (b - a), 0).toFixed(1)}s)`);
if (lens.length) {
  console.log(`segment length: min ${lens[0].toFixed(2)}s | median ${lens[Math.floor(lens.length / 2)].toFixed(2)}s | max ${lens[lens.length - 1].toFixed(2)}s`);
}
console.log(`words: ${counts.kept} kept, ${counts.retake} removed as retakes, ` +
  `${counts.unconfirmed} removed as unconfirmed (no acoustic support — see V4), ` +
  `${counts.confirmedLost} LOST despite confirmed support (V3 — must be 0)`);
if (clippedByProtection) console.log(`word protection clipped ${clippedByProtection} pause-removal span(s)`);
if (emptySpansDropped) console.log(`dropped ${emptySpansDropped} speech-less span(s) (dead air survivors)`);
if (shortAgainstWall.length) {
  console.log(`${shortAgainstWall.length} segment(s) shorter than ${MIN_SEG}s squeezed between two retake walls, left as-is:`);
  for (const [s, e] of shortAgainstWall) console.log(`  [${s.toFixed(2)}, ${e.toFixed(2)}] (${(e - s).toFixed(2)}s)`);
}
if (v4unconfirmed.length) {
  console.log(`V4 (informational, not a failure) — ${v4unconfirmed.length} word(s) removed with no acoustic support:`);
  for (const p of v4unconfirmed) console.log('  ' + p);
}
if (failed) {
  console.log('VERIFY FAILED:');
  for (const p of v1problems) console.log(`  V1 ${p}`);
  for (const p of v2problems) console.log(`  V2 ${p}`);
  for (const p of v3problems) console.log(`  V3 ${p}`);
  if (counts.confirmedLost) console.log(`  V3 wordCounts.confirmedLost = ${counts.confirmedLost}, expected 0`);
  for (const p of v6problems) console.log(`  V6 ${p}`);
  process.exitCode = 1;
} else {
  console.log('verify: V1-V3,V6 clean (no junction repeats, no retake survived, no confirmed word lost, no word truncated by a cut)');
}
