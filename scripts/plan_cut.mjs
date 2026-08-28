// Plans the edit WITHOUT touching the media: emits the list of kept spans on the
// original timeline plus the word list re-timed onto the cut timeline. Remotion
// then plays those spans straight from the source file, so there is no
// per-segment encode, no concat, and therefore no A/V drift and no accumulated
// duration error — the three defects the ffmpeg-concat route produced.
//
// node scripts/plan_cut.mjs <workDir> <wordsJson> <retakesJson> <outJson>
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const [workDir, wordsFile, retakesFile, outFile] = process.argv.slice(2);

const GAP = Number(process.env.GAP ?? 1.5);    // only pauses longer than this are removed
const PAD = Number(process.env.PAD ?? 0.35);   // breathing room kept around speech
const MERGE = Number(process.env.MERGE ?? 0.8);// kept spans closer than this: don't cut between them
const MIN_SEG = 0.70;  // a shorter span reads as a glitch — grown, never dropped
const PREROLL = 0.08;  // run-up preserved before a kept word

const src = path.join(workDir, 'audio16k.wav');
const dur = parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries',
  'format=duration', '-of', 'csv=p=0', src], { encoding: 'utf8' }).stdout.trim());

const run = (d, db = 32) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-af',
    `silencedetect=noise=-${db}dB:d=${d}`, '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const out = (r.stderr ?? '') + (r.stdout ?? '');
  const sil = []; const re = /silence_start: ([0-9.]+)[\s\S]*?silence_end: ([0-9.]+)/g;
  let m; while ((m = re.exec(out)) !== null) sil.push([parseFloat(m[1]), parseFloat(m[2])]);
  return sil;
};

const longSil = run(GAP);   // pauses worth cutting

// --- snap retake spans so no fragment of a dropped word survives -----------
// Measured on this material: DTW word starts lag the true acoustic onset by
// median 0.26s, p90 0.40s, max 0.45s (103 samples). Cutting at word.start
// therefore leaves a quarter-second of the dropped word attached to the previous
// segment — which is exactly what "чтобы… чтобы" / "хотя… хотя" were.
//
// Both ends of a retake span are DTW starts and share that lag, so shifting both
// earlier removes the dropped onset without clipping the kept word's attack.
// Where a real pause exists we snap to it (exact); otherwise we back off by the
// measured worst-case lag, floored so we never eat the previous word.
const LAG = 0.45;
const fine = run(0.02, 45);   // fine map: catches inter-word gaps, not just pauses

const pauseEndingNear = (t, tol) => {
  let best = null;
  for (const [ps, pe] of fine) {
    if (pe <= t + 0.05 && t - pe <= tol) best = [ps, pe];
    if (ps > t + 0.05) break;
  }
  return best;
};

const wordsAll = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
const prevWordStart = (t) => {
  let b = 0;
  for (const w of wordsAll) { if (w.start < t - 0.02) b = w.start; else break; }
  return b;
};

const { cuts: rawCuts } = JSON.parse(fs.readFileSync(retakesFile, 'utf8'));
// With PRESNAPPED the spans already come from scripts/refine_cuts.mjs, which
// places them against the speech-activity map (scripts/vad.py) — the DTW-lag
// guesswork below is then not just unnecessary but harmful.
const retakes = process.env.PRESNAPPED
  ? rawCuts
  : rawCuts.map(([a, b]) => {
      const pa = pauseEndingNear(a, 0.6);
      const pb = pauseEndingNear(b, 0.6);
      const aFloor = prevWordStart(a) + 0.15;
      const a2 = Math.max(aFloor, pa ? (pa[0] + pa[1]) / 2 : a - LAG);
      const b2 = pb ? Math.max(a2 + 0.1, pb[1] - PREROLL) : Math.max(a2 + 0.1, b - LAG);
      return [a2, b2];
    });

// --- kept spans = everything except long pauses and retakes -----------------
let keep = [];
let cur = 0;
for (const [s, e] of longSil) {
  const from = Math.max(0, cur - (cur > 0 ? 0 : 0));
  if (s - cur > 0.05) keep.push([Math.max(0, from - 0), Math.min(dur, s + PAD)]);
  cur = Math.max(0, e - PAD);
}
if (dur - cur > 0.05) keep.push([cur, dur]);
keep = keep.map(([s, e]) => [Math.max(0, s), Math.min(dur, e)]).filter(([s, e]) => e > s);

const subtract = (spans, [cs, ce]) => spans.flatMap(([s, e]) => {
  if (ce <= s || cs >= e) return [[s, e]];
  const out = [];
  if (cs > s) out.push([s, cs]);
  if (ce < e) out.push([ce, e]);
  return out;
});
for (const c of retakes) keep = subtract(keep, c);

// merge spans separated by less than MERGE (a cut that short is not worth making)
const merged = [];
for (const sp of keep.sort((a, b) => a[0] - b[0])) {
  const last = merged[merged.length - 1];
  if (last && sp[0] - last[1] < MERGE) last[1] = Math.max(last[1], sp[1]);
  else merged.push([...sp]);
}
// Never DROP a short span — it may carry speech (an earlier version of this
// filter silently ate 23 words). Grow it to MIN_SEG instead, then re-merge.
const grown = merged.map(([s, e]) => {
  if (e - s >= MIN_SEG) return [s, e];
  const need = (MIN_SEG - (e - s)) / 2;
  return [Math.max(0, s - need), Math.min(dur, e + need)];
});
const final = [];
for (const sp of grown) {
  const last = final[final.length - 1];
  if (last && sp[0] - last[1] < MERGE) last[1] = Math.max(last[1], sp[1]);
  else final.push([...sp]);
}

const words = wordsAll;

// --- assign words, drop speech-less spans, re-time -------------------------
// Membership is decided by the word's START, not its midpoint. DTW starts lag and
// the end is a synthetic cap, so a midpoint test put every sentence-final word
// inside the following silence and silently dropped 21 of them.
const owner = (t, segs) => segs.findIndex(([a, b]) => t >= a - 0.05 && t <= b);

let kept = final.map(([a, b]) => ({ a, b, words: [] }));
for (const w of words) {
  const i = owner(w.start, final);
  if (i !== -1) kept[i].words.push(w);
}
// A span carrying no speech is dead b-roll from the silent stretch — 14 of them
// (12.9s) survived the earlier "grow, never drop" rule and opened the edit with
// three seconds of nothing.
kept = kept.filter((k) => k.words.length > 0);

let acc2 = 0;
const segsOut = [];
const cutWords = [];
for (const k of kept) {
  const at = acc2;
  segsOut.push([+k.a.toFixed(3), +k.b.toFixed(3)]);
  for (const w of k.words) {
    const start = at + Math.max(0, w.start - k.a);
    const end = at + Math.min(k.b - k.a, w.end - k.a);
    cutWords.push({ word: w.word, start: +start.toFixed(3),
                    end: +Math.max(start + 0.12, end).toFixed(3) });
  }
  acc2 += k.b - k.a;
}
const offsets2 = (() => { let a = 0; return kept.map((k) => { const o = a; a += k.b - k.a; return +o.toFixed(3); }); })();

// --- verification: a junction must not repeat a word ------------------------
// This is the defect the author kept hearing ("чтобы… чтобы", "хотя… хотя",
// "Как по мне… как по мне"): a dropped word's onset survives on the tail of the
// previous span and is then spoken again at the head of the next. Checked here
// so it can never ship unnoticed again.
const norm = (x) => String(x || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
const problems = [];
for (let i = 1; i < kept.length; i++) {
  const prev = kept[i - 1].words;
  const next = kept[i].words;
  if (!prev.length || !next.length) continue;
  if (norm(prev[prev.length - 1].word) === norm(next[0].word)) {
    problems.push(`junction ${i}: "${prev[prev.length - 1].word}" repeats at ${kept[i].a.toFixed(2)}s`);
  }
}

fs.writeFileSync(outFile, JSON.stringify({
  segments: segsOut, offsets: offsets2, duration: +acc2.toFixed(3), words: cutWords,
}, null, 2));

const lens = segsOut.map(([a, b]) => b - a).sort((x, y) => x - y);
console.log(`segments: ${segsOut.length}`);
console.log(`duration: ${acc2.toFixed(2)}s`);
console.log(`segment length: min ${lens[0].toFixed(2)}s | median ${lens[Math.floor(lens.length / 2)].toFixed(2)}s | max ${lens[lens.length - 1].toFixed(2)}s`);
console.log(`words kept: ${cutWords.length} of ${words.length}`);
if (problems.length) {
  console.log(`VERIFY FAILED — ${problems.length} repeated word(s) at junctions:`);
  for (const p of problems) console.log('  ' + p);
} else {
  console.log('verify: no word repeats across any junction');
}
