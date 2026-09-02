// Regression suite for scripts/refine_cuts.mjs — the boundary-in-continuous-
// speech class of defect found on real material 2026-08-29: when a false
// start runs straight out of the previous phrase (no VAD pause between the
// last kept word and the drop, or between the last dropped word and the
// resumed take), the old code searched up to 1.0s back for a local
// probability/energy minimum, bounded only by the PREVIOUS word's START —
// which let the "minimum" land inside that word's own articulation. Real
// example: dropping words [184..189] ("это и визуально выглядит гораздо
// интересней") to keep "это ... вкуснее" starting at word 190. The old code
// put the start boundary inside "ткани" (word 183, must survive intact) and
// the end boundary inside "интересней" (word 189, must be fully removed),
// producing an audible "мышечный интересней это" splice. See
// core/warm/decisions.md 2026-08-29 for the full report from Андрей.
//
// Run: node tests/regression-refine-cuts.mjs

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'refine_cuts.mjs');

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error(`  ✗ ${msg}`); failures++; }
  else console.log(`  ✓ ${msg}`);
};

const mkWorkDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `refine-cuts-test-${name}-`));
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj));

const runRefineCuts = (workDir, wordsFile, pairsFile) => {
  const outFile = path.join(workDir, 'retakes.json');
  let stdout = '', status = 0;
  try {
    stdout = execFileSync('node', [SCRIPT, workDir, wordsFile, pairsFile, outFile], { encoding: 'utf8' });
  } catch (e) {
    stdout = (e.stdout ?? '') + (e.stderr ?? '');
    status = e.status ?? 1;
  }
  const retakes = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null;
  return { stdout, status, retakes };
};

// ---------------------------------------------------------------------------
// Test A — slitherly-merged false start, no pause anywhere ("ткани"/
// "интересней" class). The boundary must snap exactly to the word edges,
// not to some acoustic minimum found by wandering into a neighboring word.
// ---------------------------------------------------------------------------
function testContiguousBoundarySnap() {
  console.log('\n[A] boundary in continuous speech snaps to the word edge ("ткани"/"интересней" class)');
  const wd = mkWorkDir('contiguous');
  // real timestamps from Андрей's report (182-184, 189-190) plus plausible
  // contiguous fillers for the words in between (185-188), all touching —
  // exactly the "no pause at all" case this bug needs to reproduce.
  const words = [
    { word: 'мышечной', start: 361.39, end: 362.03 },     // 182
    { word: 'ткани', start: 362.03, end: 362.41 },        // 183 — must survive intact
    { word: 'это', start: 362.41, end: 362.93 },          // 184 — drop starts
    { word: 'и', start: 362.93, end: 363.05 },            // 185
    { word: 'визуально', start: 363.05, end: 363.60 },    // 186
    { word: 'выглядит', start: 363.60, end: 364.10 },     // 187
    { word: 'гораздо', start: 364.10, end: 364.45 },      // 188
    { word: 'интересней', start: 364.45, end: 366.05 },   // 189 — drop ends, must be FULLY removed
    { word: 'это', start: 366.05, end: 366.59 },          // 190 — keep resumes here
    { word: 'и', start: 366.59, end: 366.75 },            // 191 — must survive intact
  ];
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, words);
  const pairsFile = path.join(wd, 'pairs.json');
  // SKILL.md Шаг 6 п.5 format: {"pairs": [...]} — a wrapped object, not a
  // bare array. local indices: drop "это"(2)..."интересней"(7), keep "это"(8).
  writeJson(pairsFile, { pairs: [[2, 8]] });
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 368.0, hop: 0.01, energyHop: 0.01, db: [],
    // one continuous speech region spanning the whole excerpt — no VAD pause
    // anywhere, matching Андрей's diagnosis ("между дублями нет паузы").
    regions: [[360.0, 368.0]], fine: [[360.0, 368.0]], support: [[360.0, 368.0]],
  });

  const { retakes, status, stdout } = runRefineCuts(wd, wordsFile, pairsFile);
  assert(status === 0, 'refine_cuts exits 0 (no BOUNDARY INVARIANT VIOLATED)');
  assert(!!retakes, 'retakes.json was written');
  const [cut] = retakes?.cuts ?? [];
  assert(!!cut, 'exactly one cut was produced');
  if (cut) {
    assert(Math.abs(cut[0] - 362.41) < 0.01, `start snaps to the word boundary (362.41), got ${cut[0]}`);
    assert(Math.abs(cut[1] - 366.05) < 0.01, `end snaps to the word boundary (366.05), got ${cut[1]}`);
    assert(cut[0] <= 362.41 + 1e-3, '"ткани" (ends 362.41) is not clipped by the start boundary');
    assert(cut[1] >= 366.05 - 1e-3, '"интересней" (ends 366.05) is fully inside the cut, none of it survives');
  }
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test B — control: a real VAD pause on both sides of the abandoned take
// must still use the pause midpoint / PREROLL run-up exactly as before —
// this class of retake was already correct, must not regress.
// ---------------------------------------------------------------------------
function testRealPauseUnaffected() {
  console.log('\n[B] real VAD pause on both sides still uses pause-midpoint + PREROLL (control, must not regress)');
  const wd = mkWorkDir('pause');
  const words = [
    { word: 'мяса', start: 0.0, end: 0.5 },      // kept, before
    { word: 'чувак', start: 2.0, end: 2.4 },     // drop starts, own isolated region
    { word: 'не', start: 2.4, end: 2.55 },
    { word: 'гони', start: 2.55, end: 2.9 },     // drop ends
    { word: 'больше', start: 5.0, end: 5.5 },    // keep resumes, own isolated region
  ];
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, words);
  const pairsFile = path.join(wd, 'pairs.json');
  writeJson(pairsFile, [[1, 4]]);  // bare-array shape — doubles as the back-compat check for Test C
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 6.0, hop: 0.01, energyHop: 0.01, db: [],
    regions: [[0.0, 0.5], [2.0, 2.9], [5.0, 5.5]],
    fine: [[0.0, 0.5], [2.0, 2.9], [5.0, 5.5]], support: [[0.0, 0.5], [2.0, 2.9], [5.0, 5.5]],
  });

  const { retakes, status, stdout } = runRefineCuts(wd, wordsFile, pairsFile);
  assert(status === 0, 'refine_cuts exits 0');
  const [cut] = retakes?.cuts ?? [];
  assert(!!cut, 'exactly one cut was produced');
  if (cut) {
    assert(Math.abs(cut[0] - 1.25) < 0.01, `start is the pause midpoint (0.5..2.0 → 1.25), got ${cut[0]}`);
    assert(Math.abs(cut[1] - 4.94) < 0.01, `end donates PREROLL from the real pause (5.0 - 0.06 = 4.94), got ${cut[1]}`);
  }
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test C — pairs.json shape. SKILL.md Шаг 6 п.5 instructs writing the
// WRAPPED object {"pairs": [...]}; a bare array must keep working too (Test
// B already exercises it). Both empty forms must produce an empty (not
// crashing) retakes.json — Шаг 6 п.6 explicitly runs this script even when
// no duplicates were found, never hand-writes retakes.json instead.
// ---------------------------------------------------------------------------
function testPairsJsonShape() {
  console.log('\n[C] pairs.json accepts both {"pairs":[...]} and a bare array, including empty');
  const words = [{ word: 'a', start: 0.0, end: 0.3 }];
  const vad = {
    schemaVersion: 2, engine: 'energy', duration: 1.0, hop: 0.01, energyHop: 0.01, db: [],
    regions: [[0.0, 0.3]], fine: [[0.0, 0.3]], support: [[0.0, 0.3]],
  };
  for (const [label, pairsContent] of [
    ['wrapped empty', { pairs: [] }],
    ['bare empty', []],
  ]) {
    const wd = mkWorkDir('shape');
    const wordsFile = path.join(wd, 'words.json');
    writeJson(wordsFile, words);
    const pairsFile = path.join(wd, 'pairs.json');
    writeJson(pairsFile, pairsContent);
    writeJson(path.join(wd, 'vad.json'), vad);
    const { retakes, status } = runRefineCuts(wd, wordsFile, pairsFile);
    assert(status === 0, `${label}: refine_cuts exits 0 (no crash on this pairs.json shape)`);
    assert(Array.isArray(retakes?.cuts) && retakes.cuts.length === 0, `${label}: wrote an empty cuts list`);
  }
}

// ---------------------------------------------------------------------------
// Test D — words.json shape. scripts/transcribe_groq.py (Шаг 6 п.1, groq
// engine) writes words.json wrapped as {"words": [...]}, matching the
// Python-side convention (cut_silence.py/remap_words.py/
// find_repeat_candidates.py all unwrap that already) — the JS side didn't,
// so the Groq path broke everything downstream of transcription. Same class
// of defect as Test C, found in the same report, 2026-08-29.
// ---------------------------------------------------------------------------
function testGroqShapedWordsJson() {
  console.log('\n[D] words.json accepts the Groq-shaped {"words":[...]} wrapper, not just a bare array');
  const wd = mkWorkDir('groqshape');
  const words = [
    { word: 'мяса', start: 0.0, end: 0.5 },
    { word: 'чувак', start: 2.0, end: 2.4 },
    { word: 'не', start: 2.4, end: 2.55 },
    { word: 'гони', start: 2.55, end: 2.9 },
    { word: 'больше', start: 5.0, end: 5.5 },
  ];
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, { words });  // exactly what transcribe_groq.py writes
  const pairsFile = path.join(wd, 'pairs.json');
  writeJson(pairsFile, { pairs: [[1, 4]] });
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 6.0, hop: 0.01, energyHop: 0.01, db: [],
    regions: [[0.0, 0.5], [2.0, 2.9], [5.0, 5.5]],
    fine: [[0.0, 0.5], [2.0, 2.9], [5.0, 5.5]], support: [[0.0, 0.5], [2.0, 2.9], [5.0, 5.5]],
  });

  const { retakes, status, stdout } = runRefineCuts(wd, wordsFile, pairsFile);
  assert(status === 0, 'refine_cuts exits 0 on Groq-shaped words.json (no crash)');
  const [cut] = retakes?.cuts ?? [];
  assert(!!cut, 'exactly one cut was produced (proves words[] indexing worked, not undefined)');
  if (cut) assert(Math.abs(cut[0] - 1.25) < 0.01, `boundary computed correctly, got ${cut[0]}`);
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test E — vad-snap-forward + word retiming. Even after Test A's fix, the
// boundary is still built from ASR word timestamps, which can themselves be
// wrong by 1s+. Here the computed end lands inside the DROPPED take's own
// vad.json region (not a defect in the boundary logic, a defect in the ASR
// timestamp it trusted) — must push forward to the real next region, and
// retime the keep word whose reported start undershoots the real audio
// (found live 2026-08-29 by a parallel test session: "жирненько" reported at
// 166.50, real audio at 168.4 — lost from the output entirely without this).
// ---------------------------------------------------------------------------
function testVadSnapForwardWithRetiming() {
  console.log('\n[E] end lands inside the DROPPED take\'s own region -> snap forward + retime the lagging keep word');
  const wd = mkWorkDir('snapfwd');
  const words = [
    { word: 'штука', start: 159.9, end: 160.3 },       // 0 — always kept
    { word: 'чувак', start: 163.0, end: 163.9 },       // 1 — drop starts (dropIdx=1)
    { word: 'штуку', start: 164.0, end: 166.29 },      // 2 — lastDropped
    { word: 'жирненько', start: 166.50, end: 166.65 }, // 3 — keep (keepIdx=3), ASR undershoots real audio by 1.8s
    { word: 'печень', start: 168.50, end: 168.90 },    // 4 — trustworthy anchor, already past real boundary
  ];
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, words);
  const pairsFile = path.join(wd, 'pairs.json');
  writeJson(pairsFile, { pairs: [[1, 3]] });
  // boundaryBefore's acoustic-minimum search needs real energy data to find a
  // point — a monotonically rising db across the search window puts the
  // minimum at the window's start (166.29s), solidly inside the DROPPED
  // take's own region [163.0, 166.3] — reproducing the real defect: the raw
  // boundary is computed correctly by word-edge logic, but the WORD EDGE
  // ITSELF (keep.start=166.50) is wrong, sitting inside real silence
  // (166.3-168.3) rather than at the true onset (168.4-ish).
  const hop = 0.01;
  const db = Array.from({ length: 17001 }, (_, i) => i * 0.001);
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 170.0, hop, energyHop: hop, db,
    regions: [[159.9, 160.3], [163.0, 166.3], [168.3, 169.0]],
    fine: [[159.9, 160.3], [163.0, 166.3], [168.3, 169.0]],
    support: [[159.9, 160.3], [163.0, 166.3], [168.3, 169.0]],
  });

  const { retakes, status, stdout } = runRefineCuts(wd, wordsFile, pairsFile);
  assert(status === 0, 'refine_cuts exits 0 (vad-snap-forward resolves cleanly, no hard invariant failure)');
  const [cut] = retakes?.cuts ?? [];
  assert(!!cut, 'exactly one cut was produced');
  if (cut) {
    assert(Math.abs(cut[1] - 168.24) < 0.01, `end pushed forward to the real region start minus PREROLL (168.24), got ${cut[1]}`);
  }
  const rewordsRaw = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
  const rewords = Array.isArray(rewordsRaw) ? rewordsRaw : rewordsRaw.words;
  const zhirnenko = rewords.find((w) => w.word === 'жирненько');
  assert(!!zhirnenko && Math.abs(zhirnenko.start - 168.24) < 0.01,
    `"жирненько" retimed forward to the real boundary (168.24), got ${zhirnenko?.start}`);
  assert(!!zhirnenko && Math.abs(zhirnenko.end - 168.50) < 0.01,
    `"жирненько" retimed to end at the trustworthy anchor's start (168.50), got ${zhirnenko?.end}`);
  const pechen = rewords.find((w) => w.word === 'печень');
  assert(!!pechen && pechen.start === 168.50 && pechen.end === 168.90,
    '"печень" (already-trustworthy anchor) is left untouched');
  assert(/vad-snap-forward/.test(stdout), 'log mentions vad-snap-forward');
  assert(/retimed 1 word/.test(stdout), 'log reports exactly 1 word retimed');
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test F — vad-snap-back + softened invariant. An inflated ASR `end` on the
// last dropped word can push the raw boundary past the true kept-take onset,
// swallowing a real word whole (the [134,144] class from the same live
// report: "по-разному." end inflated to 319.19, swallowing "При" 318.53-
// 318.73 entirely). Must snap BACK to the real region's start, and the
// resulting invariant "violation" against the (known-unreliable) inflated
// ASR end must be an informational note, not a hard pipeline failure.
// ---------------------------------------------------------------------------
function testVadSnapBackSoftensInvariant() {
  console.log('\n[F] end lands inside the KEPT take\'s own region (inflated ASR end swallowed a word) -> snap back, invariant note not a failure');
  const wd = mkWorkDir('snapback');
  const words = [
    { word: 'штука', start: 99.0, end: 99.5 },          // 0 — always kept
    { word: 'х', start: 100.0, end: 100.4 },            // 1 — drop starts (dropIdx=1)
    { word: 'поразному', start: 100.5, end: 103.2 },    // 2 — lastDropped, ASR end INFLATED into the kept region
    { word: 'При', start: 102.6, end: 102.9 },          // 3 — keep (keepIdx=3), real word almost swallowed whole
    { word: 'делаем', start: 103.0, end: 103.4 },       // 4
  ];
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, words);
  const pairsFile = path.join(wd, 'pairs.json');
  writeJson(pairsFile, { pairs: [[1, 3]] });
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 105.0, hop: 0.01, energyHop: 0.01, db: [],
    regions: [[99.0, 99.5], [100.0, 102.0], [102.5, 106.0]],
    fine: [[99.0, 99.5], [100.0, 102.0], [102.5, 106.0]],
    support: [[99.0, 99.5], [100.0, 102.0], [102.5, 106.0]],
  });

  const { retakes, status, stdout } = runRefineCuts(wd, wordsFile, pairsFile);
  assert(status === 0, 'refine_cuts exits 0 (vad-snap-back resolves cleanly, invariant note does not fail the run)');
  const [cut] = retakes?.cuts ?? [];
  assert(!!cut, 'exactly one cut was produced');
  if (cut) {
    assert(Math.abs(cut[1] - 102.44) < 0.01, `end snapped back to the real kept-region start minus PREROLL (102.44), got ${cut[1]}`);
  }
  assert(/vad-snap-back/.test(stdout), 'log mentions vad-snap-back');
  assert(/boundary note \(resolved via vad\.json/.test(stdout), 'log shows the softened informational note');
  assert(!/BOUNDARY INVARIANT VIOLATED/.test(stdout), 'the ASR-inflated-end violation is NOT reported as a hard failure');
  if (status !== 0) console.log(stdout);
}

testContiguousBoundarySnap();
testRealPauseUnaffected();
testPairsJsonShape();
testGroqShapedWordsJson();
testVadSnapForwardWithRetiming();
testVadSnapBackSoftensInvariant();

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
