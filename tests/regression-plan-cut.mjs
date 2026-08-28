// Regression suite for scripts/plan_cut.mjs, covering the three defect
// classes found while unifying the pipeline on a single VAD source (see
// references/audio-pipeline.md and the Silero-unification patch CHANGELOG
// entry). Runs plan_cut.mjs as a real subprocess against handcrafted
// workDir fixtures (vad.json/words.json/retakes.json) — deterministic, no
// audio decoding involved, so these stay fast and exact.
//
// Run: node tests/regression-plan-cut.mjs

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'plan_cut.mjs');

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error(`  ✗ ${msg}`); failures++; }
  else console.log(`  ✓ ${msg}`);
};

const mkWorkDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `plan-cut-test-${name}-`));

const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj));

const runPlanCut = (workDir, wordsFile, retakesFile, env = {}) => {
  const outFile = path.join(workDir, 'plan.json');
  let stdout = '', status = 0;
  try {
    stdout = execFileSync('node', [SCRIPT, workDir, wordsFile, retakesFile, outFile],
      { encoding: 'utf8', env: { ...process.env, ...env } });
  } catch (e) {
    stdout = (e.stdout ?? '') + (e.stderr ?? '');
    status = e.status ?? 1;
  }
  const plan = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null;
  return { stdout, status, plan };
};

// ---------------------------------------------------------------------------
// Test A — the "quiet punchline" word-loss class (Блокер 2 / the original
// "Жирненько" bug). A word ASR believes exists, with SOME acoustic support
// (Silero/energy `support[]`) but not enough to clear the stricter `fine`
// bar, must survive a pause-cut that would otherwise swallow it whole — and
// the real silence around it must still get cut.
// ---------------------------------------------------------------------------
function testWordProtection() {
  console.log('\n[A] quiet-word-in-a-pause protection (Блокер 2 / "Жирненько" class)');
  const wd = mkWorkDir('wordloss');
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 9.0, hop: 0.01, energyHop: 0.01, db: [],
    fine: [[0, 3], [6, 9]], regions: [[0, 3], [6, 9]],
    support: [[0, 3], [5.0, 5.3], [6, 9]],
  });
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, [
    { word: 'a', start: 0.5, end: 1.0 },
    { word: 'жирненько', start: 5.0, end: 5.3 },
    { word: 'b', start: 6.5, end: 7.0 },
  ]);
  const retakesFile = path.join(wd, 'retakes.json');
  writeJson(retakesFile, { cuts: [], source: 'refine_cuts', schemaVersion: 2 });

  const { plan, status, stdout } = runPlanCut(wd, wordsFile, retakesFile);
  assert(status === 0, 'plan_cut exits 0 (no VERIFY FAILED)');
  assert(!!plan, 'plan.json was written');
  const words = plan?.words?.map((w) => w.word) ?? [];
  assert(words.includes('жирненько'), `quiet word survives (got words: ${JSON.stringify(words)})`);
  assert(plan && plan.duration < 9.0, `real silence around it still got cut (duration ${plan?.duration}s < 9s)`);
  assert(plan?.meta?.spansClippedByWordProtection >= 1, 'meta reports at least one span clipped by word protection');
  assert(plan?.meta?.wordCounts?.confirmedLost === 0, 'V3: zero confirmed words lost');
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test B — short retake spans must actually disappear (Блокер 3). Before the
// fix, subtract(retakes) → merge(MERGE≈0.8) silently undid any retake cut
// shorter than MERGE — almost every real false start ("чувак я", "чтобы").
// ---------------------------------------------------------------------------
function testShortRetakesSurvive() {
  console.log('\n[B] short retake spans are not silently undone (Блокер 3)');
  const wd = mkWorkDir('retakes');
  const duration = 100;
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration, hop: 0.01, energyHop: 0.01, db: [],
    fine: [[0, duration]], regions: [[0, duration]], support: [[0, duration]],
  });
  // one continuous speech region — isolates retake handling from pause handling
  const retakeSpans = [
    [10.0, 10.30],  // 0.30s
    [20.0, 20.50],  // 0.50s
    [30.0, 30.79],  // 0.79s
    [40.0, 40.80],  // 0.80s — the exact float-rounding edge case from the original find
    [50.0, 51.20],  // 1.20s
  ];
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, [5, 15, 25, 35, 45, 60].map((t, i) => ({ word: `w${i}`, start: t, end: t + 0.3 })));
  const retakesFile = path.join(wd, 'retakes.json');
  writeJson(retakesFile, { cuts: retakeSpans, source: 'refine_cuts', schemaVersion: 2 });

  const { plan, status, stdout } = runPlanCut(wd, wordsFile, retakesFile);
  assert(status === 0, 'plan_cut exits 0 (no VERIFY FAILED)');
  assert(!!plan, 'plan.json was written');
  assert(plan?.segments?.length === 6, `6 fragments survive around the 5 cuts (got ${plan?.segments?.length})`);
  for (const [cs, ce] of retakeSpans) {
    const overlapping = (plan?.segments ?? []).find(([a, b]) => ce > a && cs < b);
    assert(!overlapping, `retake [${cs}, ${ce}] has zero overlap with final segments` +
      (overlapping ? ` (overlaps [${overlapping}])` : ''));
  }
  assert(plan?.meta?.retakeSecondsCut > 0, 'meta reports nonzero retake seconds cut');
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test C — ASR hallucinations in a long silent stretch must not block
// cutting that silence, and must be reported (V4) rather than treated as a
// V3 failure (which is reserved for words that DO have acoustic support).
// ---------------------------------------------------------------------------
function testHallucinationsDontBlockCut() {
  console.log('\n[C] unconfirmed (hallucinated) words in real silence — V4, not V3');
  const wd = mkWorkDir('halluc');
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 20.0, hop: 0.01, energyHop: 0.01, db: [],
    fine: [[0, 2], [18, 20]], regions: [[0, 2], [18, 20]],
    support: [[0, 2], [18, 20]],  // no acoustic support anywhere in the 16s gap
  });
  const words = [{ word: 'real1', start: 1.0, end: 1.4 }];
  for (let i = 0; i < 20; i++) {
    const t = 3 + i * 0.7;  // spread 3..16.3, comfortably >0.8s from either fine/support edge
    words.push({ word: `hallucinated${i}`, start: t, end: t + 0.3 });
  }
  words.push({ word: 'real2', start: 19.0, end: 19.4 });
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, words);
  const retakesFile = path.join(wd, 'retakes.json');
  writeJson(retakesFile, { cuts: [], source: 'refine_cuts', schemaVersion: 2 });

  const { plan, status, stdout } = runPlanCut(wd, wordsFile, retakesFile);
  assert(status === 0, 'plan_cut exits 0 (hallucinations must not fail VERIFY)');
  assert(!!plan, 'plan.json was written');
  assert(plan && plan.duration < 6, `the 16s silent stretch still got cut (duration ${plan?.duration}s, well under 20s)`);
  assert(plan?.meta?.wordCounts?.unconfirmed === 20, `all 20 hallucinated words land in V4/unconfirmed (got ${plan?.meta?.wordCounts?.unconfirmed})`);
  assert(plan?.meta?.wordCounts?.confirmedLost === 0, 'V3: zero confirmed words lost (hallucinations are not confirmed words)');
  const keptWords = plan?.words?.map((w) => w.word) ?? [];
  assert(keptWords.includes('real1') && keptWords.includes('real2'), 'the two real words survive');
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test D — a correctly-snapped retake boundary ("ткани"/"интересней" class,
// see tests/regression-refine-cuts.mjs for the refine_cuts.mjs side of this)
// must not truncate the surviving neighbor word or leak the tail of the
// fully-dropped word. V6 exists specifically to catch this if it ever
// regresses — assert it stays at zero on the known-good boundary.
// ---------------------------------------------------------------------------
function testNoTruncationAtRetakeBoundary() {
  console.log('\n[D] correctly-snapped retake boundary truncates nothing (V6, "ткани"/"интересней" class)');
  const wd = mkWorkDir('truncation');
  const words = [
    { word: 'мышечной', start: 361.39, end: 362.03 },
    { word: 'ткани', start: 362.03, end: 362.41 },
    { word: 'это', start: 362.41, end: 362.93 },
    { word: 'и', start: 362.93, end: 363.05 },
    { word: 'визуально', start: 363.05, end: 363.60 },
    { word: 'выглядит', start: 363.60, end: 364.10 },
    { word: 'гораздо', start: 364.10, end: 364.45 },
    { word: 'интересней', start: 364.45, end: 366.05 },
    { word: 'это', start: 366.05, end: 366.59 },
    { word: 'и', start: 366.59, end: 366.75 },
  ];
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 368.0, hop: 0.01, energyHop: 0.01, db: [],
    fine: [[360.0, 368.0]], regions: [[360.0, 368.0]], support: [[360.0, 368.0]],
  });
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, words);
  const retakesFile = path.join(wd, 'retakes.json');
  writeJson(retakesFile, { cuts: [[362.41, 366.05]], source: 'refine_cuts', schemaVersion: 2 });

  const { plan, status, stdout } = runPlanCut(wd, wordsFile, retakesFile);
  assert(status === 0, 'plan_cut exits 0 (no VERIFY FAILED)');
  assert(!!plan, 'plan.json was written');
  const outWords = plan?.words?.map((w) => w.word) ?? [];
  assert(outWords.includes('ткани'), `"ткани" survives whole (got words: ${JSON.stringify(outWords)})`);
  assert(!outWords.includes('интересней'), '"интересней" (fully dropped) does not leak into the output');
  assert(plan?.meta?.wordsTruncatedByCut === 0, `V6: zero words truncated by a cut (got ${plan?.meta?.wordsTruncatedByCut})`);
  if (status !== 0) console.log(stdout);
}

// ---------------------------------------------------------------------------
// Test E — words.json shape. scripts/transcribe_groq.py writes words.json
// wrapped as {"words": [...]} (matching the Python-side convention every
// other consumer already unwraps) — plan_cut.mjs didn't, so the Groq engine
// broke this step too. Found alongside the pairs.json unwrap bug, 2026-08-29.
// ---------------------------------------------------------------------------
function testGroqShapedWordsJson() {
  console.log('\n[E] words.json accepts the Groq-shaped {"words":[...]} wrapper, not just a bare array');
  const wd = mkWorkDir('groqshape');
  writeJson(path.join(wd, 'vad.json'), {
    schemaVersion: 2, engine: 'energy', duration: 9.0, hop: 0.01, energyHop: 0.01, db: [],
    fine: [[0, 3], [6, 9]], regions: [[0, 3], [6, 9]], support: [[0, 3], [6, 9]],
  });
  const wordsFile = path.join(wd, 'words.json');
  writeJson(wordsFile, { words: [{ word: 'a', start: 0.5, end: 1.0 }, { word: 'b', start: 6.5, end: 7.0 }] });
  const retakesFile = path.join(wd, 'retakes.json');
  writeJson(retakesFile, { cuts: [], source: 'refine_cuts', schemaVersion: 2 });

  const { plan, status, stdout } = runPlanCut(wd, wordsFile, retakesFile);
  assert(status === 0, 'plan_cut exits 0 on Groq-shaped words.json (no crash)');
  const outWords = plan?.words?.map((w) => w.word) ?? [];
  assert(outWords.includes('a') && outWords.includes('b'), `both words survive (got: ${JSON.stringify(outWords)})`);
  if (status !== 0) console.log(stdout);
}

testWordProtection();
testShortRetakesSurvive();
testHallucinationsDontBlockCut();
testNoTruncationAtRetakeBoundary();
testGroqShapedWordsJson();

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
