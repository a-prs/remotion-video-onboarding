// Turns retake word-index pairs into cut boundaries that respect ACTUAL speech,
// not DTW timestamps. Two cases occur in real footage and they need different
// treatment:
//
//  1. The abandoned take is its own speech region ("Чувак, не гони," sits alone
//     between two pauses) — the region edges ARE the boundaries.
//  2. The speaker runs the false start straight out of the previous phrase
//     ("…особые позы, чтобы ничего её,") — one continuous region, nothing to snap
//     to. The best available clue is the local minimum of speech confidence
//     (Silero probs) or, on the energy fallback engine / to resolve a flat
//     plateau in probs, the local energy minimum — where the articulation
//     actually dips.
//
// node scripts/refine_cuts.mjs <workDir> <wordsJson> <pairsJson> <outJson>
import fs from 'fs';
import path from 'path';

const [workDir, wordsFile, pairsFile, outFile] = process.argv.slice(2);
const vadPath = path.join(workDir, 'vad.json');
const vad = JSON.parse(fs.readFileSync(vadPath, 'utf8'));
if (vad.schemaVersion !== 2) {
  console.error(`[refine_cuts] ${vadPath} is schemaVersion ${vad.schemaVersion ?? '(missing)'}, ` +
    `expected 2 — re-run Шаг 6.2 (scripts/vad.py) to regenerate it, this file is from an older skill version.`);
  process.exit(1);
}
const { hop, regions, db, probs, probHop } = vad;
// scripts/transcribe_groq.py (the Groq transcription engine, Шаг 6 п.1)
// writes words.json wrapped as {"words": [...]}, not a bare array — every
// Python consumer in this skill already unwraps that defensively
// (cut_silence.py, remap_words.py, find_repeat_candidates.py's
// load_words()), but this script did not, so the Groq path broke
// everything downstream of transcription. Found alongside the pairs.json
// unwrap bug, 2026-08-29 — same class of defect, same fix shape.
const rawWords = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
const words = Array.isArray(rawWords) ? rawWords : (rawWords.words ?? []);
// SKILL.md Шаг 6 п.5 instructs writing pairs.json as {"pairs": [[dropIdx,
// keepIdx], ...]} — a wrapped object, not a bare array. This used to read
// the parsed JSON directly as `pairs` and iterate it, which throws
// ("pairs is not iterable") the moment a real pairs.json is written per
// that spec — found by Андрей, 2026-08-29, never hit before because every
// synthetic test (including this skill's own) wrote a bare array. Accept
// either shape: unwrap `.pairs` off an object, use an array as-is.
const rawPairs = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
const pairs = Array.isArray(rawPairs) ? rawPairs : (rawPairs.pairs ?? []);

const PREROLL = 0.06;   // keep this much run-up before the kept word
const PROB_PLATEAU_EPS = 0.05;   // probs within this of the local min count as "the same minimum"

const regionAt = (t) => regions.find(([s, e]) => t >= s - 0.02 && t <= e + 0.02) ?? null;

// The non-speech stretch IMMEDIATELY before t (and not earlier than `after`).
// An earlier version returned the first gap anywhere in the range, which threw
// boundaries seconds away from the word they were supposed to sit next to.
const gapBefore = (t, after) => {
  let best = null;
  for (let i = 1; i < regions.length; i++) {
    const g = [regions[i - 1][1], regions[i][0]];
    if (g[0] > t + 0.05) break;
    if (g[1] <= t + 0.05 && g[1] - g[0] >= 0.05 && (after === null || g[0] >= after - 0.05)) best = g;
  }
  return best;
};

const minEnergyAt = (t1, t2) => {
  if (!db || !hop) return null;
  const a = Math.max(0, Math.floor(t1 / hop));
  const b = Math.min(db.length - 1, Math.ceil(t2 / hop));
  if (b <= a) return null;
  let bi = a, bv = Infinity;
  for (let i = a; i <= b; i++) if (db[i] < bv) { bv = db[i]; bi = i; }
  return +(bi * hop).toFixed(3);
};

// Silero probs give a finer, speech-aware signal than raw energy — but a real
// minimum is often a flat PLATEAU of several windows at similarly-low
// confidence, not one sharp point. Picking the widest such plateau and then
// refining its exact center with the (finer, 10ms) energy curve gives a more
// stable boundary than either signal alone.
const minProbPlateau = (t1, t2) => {
  if (!probs || !probHop) return null;
  const a = Math.max(0, Math.floor(t1 / probHop));
  const b = Math.min(probs.length - 1, Math.ceil(t2 / probHop));
  if (b <= a) return null;
  let bv = Infinity;
  for (let i = a; i <= b; i++) if (probs[i] < bv) bv = probs[i];

  let curStart = null, plateauStart = a, plateauEnd = a, bestLen = 0;
  for (let i = a; i <= b + 1; i++) {
    const inPlateau = i <= b && probs[i] <= bv + PROB_PLATEAU_EPS;
    if (inPlateau && curStart === null) curStart = i;
    if (!inPlateau && curStart !== null) {
      if (i - curStart > bestLen) { bestLen = i - curStart; plateauStart = curStart; plateauEnd = i - 1; }
      curStart = null;
    }
  }
  if (plateauEnd <= plateauStart) {
    return { t: +(plateauStart * probHop).toFixed(3), how: 'prob-min' };
  }
  const refined = minEnergyAt(plateauStart * probHop, (plateauEnd + 1) * probHop);
  if (refined !== null) return { t: refined, how: 'prob-plateau+energy-min' };
  const mid = ((plateauStart + plateauEnd + 1) / 2) * probHop;
  return { t: +mid.toFixed(3), how: 'prob-min' };
};

// Where the speech before `word` really stops. `prev` is the immediately
// preceding word (must survive intact) — the ONLY safe search zone is the ASR
// gap between prev's end and this word's start. An earlier version searched
// up to 1.0s back, bounded only by prev.START — inside a slitherly-merged
// false start that window covers the WHOLE of `prev`'s own articulation, so
// the "local minimum" could land in the middle of a word that must be kept
// (found on real material 2026-08-29: a boundary landed inside "ткани",
// truncating it, while the matching end-boundary left 0.89s of "интересней"
// — a fully-dropped word — surviving in the output). If prev and word are
// contiguous (no ASR slack at all, the common case for a slitherly-merged
// false start) there is nothing to search — the word boundary itself IS the
// only correct answer.
const boundaryBefore = (prev, word) => {
  const gap = gapBefore(word.start, prev ? prev.end : null);
  if (gap) return { gap, how: 'pause' };
  const lo = prev ? prev.end : Math.max(0, word.start - 0.5);
  const hi = Math.max(lo, word.start);
  if (hi - lo < 0.02) return { gap: [lo, hi], how: 'contiguous' };
  const p = minProbPlateau(lo, hi);
  if (p) return { gap: [p.t, p.t], how: p.how };
  const m = minEnergyAt(lo, hi);
  return { gap: m === null ? null : [m, m], how: 'energy-min' };
};

const EPS = 1e-3;
const out = [];
const log = [];
const boundaryProblems = [];
for (const [dropIdx, keepIdx] of pairs) {
  const drop = words[dropIdx];
  const keep = words[keepIdx];
  const prevKept = words[dropIdx - 1] ?? null;
  const lastDropped = words[keepIdx - 1];
  const a = boundaryBefore(prevKept, drop);
  const b = boundaryBefore(lastDropped, keep);
  // start: middle of the pause before the dropped take (its onset goes with
  // it) — for a non-pause boundary a.gap is already a single exact point.
  const start = a.gap ? (a.gap[0] + a.gap[1]) / 2 : drop.start;
  // end: resume at the kept take's true onset. PREROLL (a little run-up
  // silence before the kept word) is only safe to donate from a REAL pause —
  // shaving it off a contiguous/acoustic-minimum boundary would hand back
  // part of the dropped word we just found the exact edge of (the
  // "интересней" bug: b.how==='contiguous' but PREROLL still ate into it).
  const bEnd = b.gap ? b.gap[1] : keep.start;
  const end = Math.max(start + 0.1, b.how === 'pause' ? bEnd - PREROLL : bEnd);
  out.push([+start.toFixed(3), +end.toFixed(3)]);
  log.push(`${String(out.length).padStart(2)}  ${start.toFixed(2)} → ${end.toFixed(2)}   ` +
    `drop "${drop.word}" (${a.how})   keep "${keep.word}" (${b.how})`);

  // Invariant: the cut must fully contain the dropped range and must not
  // clip either neighboring kept word. A violation here is invisible to
  // plan_cut.mjs's V1/V3 (it trusts these boundaries as given) — print it
  // exactly as loud.
  if (prevKept && start < prevKept.end - EPS) {
    boundaryProblems.push(`pair [${dropIdx},${keepIdx}]: start ${start.toFixed(3)} clips KEPT word ` +
      `"${prevKept.word}" (${prevKept.start.toFixed(2)}-${prevKept.end.toFixed(2)})`);
  }
  if (start > drop.start + EPS) {
    boundaryProblems.push(`pair [${dropIdx},${keepIdx}]: start ${start.toFixed(3)} leaves part of DROPPED word ` +
      `"${drop.word}" (${drop.start.toFixed(2)}-${drop.end.toFixed(2)}) outside the cut`);
  }
  if (end < lastDropped.end - EPS) {
    boundaryProblems.push(`pair [${dropIdx},${keepIdx}]: end ${end.toFixed(3)} leaves part of DROPPED word ` +
      `"${lastDropped.word}" (${lastDropped.start.toFixed(2)}-${lastDropped.end.toFixed(2)}) outside the cut`);
  }
  if (end > keep.start + EPS) {
    boundaryProblems.push(`pair [${dropIdx},${keepIdx}]: end ${end.toFixed(3)} clips KEPT word ` +
      `"${keep.word}" (${keep.start.toFixed(2)}-${keep.end.toFixed(2)})`);
  }
}

fs.writeFileSync(outFile, JSON.stringify({
  cuts: out, source: 'refine_cuts', schemaVersion: 2,
}, null, 2));

if (out.length === 0) {
  console.log('no retake pairs — wrote an empty retakes.json (still tagged source: refine_cuts)');
} else {
  console.log(log.join('\n'));
  console.log(`total cut: ${out.reduce((s, [a, b]) => s + (b - a), 0).toFixed(1)}s`);
}
if (boundaryProblems.length) {
  console.error('\nBOUNDARY INVARIANT VIOLATED (must be empty):');
  for (const p of boundaryProblems) console.error('  ' + p);
  process.exitCode = 1;
}
