import { useCurrentFrame, useVideoConfig } from "remotion";
import { style } from "../stylekit";

/**
 * SubtitleTrack — karaoke subtitles rendered IN Remotion (not the official
 * /remotion-captions burn-in): the active spoken word is a colored pill on a
 * frosted card, the rest of the phrase is plain white, the whole line sits on
 * a frosted backing so it reads on any footage.
 *
 * Ported from the battle-tested production component (Andrey's internal
 * talking-head pipeline) — grouping tuned on real speech so phrases don't
 * read as choppy one/two-word fragments: up to 3 words per line, a new line
 * starts on a >0.7s gap or once the line has been on screen 2.8s.
 *
 * Feed it the SAME `cut_words.json` that `cut_silence.py --audio` writes
 * (word list re-timed onto the cut timeline) — drop it as an absolutely
 * positioned overlay on top of your main composition:
 *   <SubtitleTrack words={cutWords} />
 */

export type SubWord = { word: string; start: number; end: number };
type Props = { words?: SubWord[] };

const MAX_WORDS = 3; // words shown at once
const MAX_GAP = 0.7; // sec gap → new phrase
const MAX_DUR = 2.8; // max sec a phrase stays
const RADIUS = 14;

function clean(w: string): string {
  return (w || "").trim();
}

function group(words: SubWord[]): SubWord[][] {
  const lines: SubWord[][] = [];
  let cur: SubWord[] = [];
  for (const w of words) {
    const t = clean(w.word);
    if (!t) continue;
    if (
      cur.length &&
      (cur.length >= MAX_WORDS ||
        w.start - cur[cur.length - 1].end > MAX_GAP ||
        w.end - cur[0].start > MAX_DUR)
    ) {
      lines.push(cur);
      cur = [];
    }
    cur.push({ ...w, word: t });
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export const SubtitleTrack: React.FC<Props> = ({ words = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (!words.length) return null;

  const accent = style.colors.accent;
  const phrases = group(words);
  // active phrase = the one whose span covers t (or just passed)
  let phrase: SubWord[] | null = null;
  for (const p of phrases) {
    const ps = p[0].start;
    const pe = p[p.length - 1].end;
    if (t >= ps && t <= pe + 0.15) {
      phrase = p;
      break;
    }
  }
  if (!phrase) return null;

  const base: React.CSSProperties = {
    fontFamily: style.fonts.heading,
    fontWeight: 900,
    fontSize: 64,
    color: "#fff",
    letterSpacing: -0.5,
    textShadow: "0 2px 10px rgba(0,0,0,0.55)",
    lineHeight: 1.18,
  };

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 300, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 12px",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: 940,
          padding: "16px 26px",
          background: "rgba(10,10,13,0.42)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderRadius: 22,
        }}
      >
        {phrase.map((w, i) => {
          const active = t >= w.start && t <= w.end + 0.05;
          if (!active) return <span key={i} style={base}>{w.word}</span>;
          return (
            <span
              key={i}
              style={{
                ...base,
                color: accent,
                background: "rgba(16,16,21,0.7)",
                borderRadius: RADIUS,
                border: `1px solid ${accent}66`,
                padding: "2px 14px",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
