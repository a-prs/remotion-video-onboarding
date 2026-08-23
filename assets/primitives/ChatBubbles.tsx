import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { style } from "../stylekit";

/**
 * ChatBubbles (vertical) — a chat dialogue that types itself out, ported from the
 * 16:9 branch to the 9:16 bank (Andrey, 2026-06-27). User bubbles pop in from the
 * right; AI bubbles type out character-by-character on a frosted card with a soft
 * glow. Phone-readable: full width, big type, avatars.
 *
 * Frame convention mirrors Terminal: global frame + `delaySec` = act.at; each
 * message appears at delaySec + (msg.at ?? i*stepSec).
 */
export type ChatMessage = {
  from: "user" | "ai";
  text: string;
  at?: number; // seconds from the component's start; falls back to i*stepSec
};

type Props = {
  messages?: ChatMessage[];
  delaySec?: number;
  /** Auto-stagger between messages when `at` is omitted. */
  stepSec?: number;
};

const DEFAULT_MESSAGES: ChatMessage[] = [
  { from: "user", text: "Сделай за меня рутину" },
  { from: "ai", text: "Готово. Что дальше?" },
];

export const ChatBubbles: React.FC<Props> = ({
  messages = DEFAULT_MESSAGES,
  delaySec = 0,
  stepSec = 1.6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(delaySec * fps);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      {messages.map((msg, i) => {
        const at = start + Math.round((msg.at ?? i * stepSec) * fps);
        if (frame < at) return null;
        const local = frame - at;

        const enter = spring({ frame: local, fps, config: { damping: 16, mass: 0.7, stiffness: 120 } });
        const enterScale = interpolate(enter, [0, 1], [0.85, 1]);
        const opacity = interpolate(local, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        const isUser = msg.from === "user";
        const floatPhase = Math.max(0, local - 20);
        const floatY = floatPhase > 0 ? Math.sin(floatPhase * 0.04 + i * 1.5) * 2 : 0;

        // AI messages type out char-by-char; user messages appear whole.
        let displayText = msg.text;
        if (!isUser) {
          const visible = Math.min(Math.floor(local * 1.1), msg.text.length);
          displayText = msg.text.slice(0, visible) + (visible < msg.text.length ? "▊" : "");
        }

        const glowPhase = Math.max(0, local - 15);
        const glow = !isUser && glowPhase > 0 ? Math.sin(glowPhase * 0.08 + i) * 0.15 + 0.3 : 0;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: isUser ? "flex-end" : "flex-start",
              opacity,
              transform: `scale(${enterScale}) translateY(${floatY}px)`,
              transformOrigin: isUser ? "right center" : "left center",
            }}
          >
            {!isUser && (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${style.colors.primary}, ${style.colors.accent})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: style.fonts.heading,
                  fontWeight: 800,
                  fontSize: 26,
                  color: "#fff",
                  flexShrink: 0,
                  marginRight: 18,
                  boxShadow: `0 0 ${16 * (glow + 0.3)}px ${style.glow.color}`,
                }}
              >
                AI
              </div>
            )}

            <div
              style={{
                maxWidth: "74%",
                padding: "26px 32px",
                borderRadius: isUser ? "28px 28px 6px 28px" : "28px 28px 28px 6px",
                background: isUser ? "rgba(124,92,252,0.22)" : style.glass.bg,
                border: `1px solid ${isUser ? "rgba(124,92,252,0.45)" : style.glass.border}`,
                backdropFilter: `blur(${style.glass.blur}px)`,
                WebkitBackdropFilter: `blur(${style.glass.blur}px)`,
                boxShadow: !isUser
                  ? `0 0 ${24 * glow}px ${style.glow.color}, inset 0 1px 0 ${style.glass.innerHighlight}`
                  : `inset 0 1px 0 ${style.glass.innerHighlight}`,
                fontSize: 38,
                fontFamily: style.fonts.body,
                color: style.colors.textPrimary,
                lineHeight: 1.45,
              }}
            >
              {displayText}
            </div>

            {isUser && (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(124,92,252,0.3)",
                  border: "1px solid rgba(124,92,252,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  flexShrink: 0,
                  marginLeft: 18,
                }}
              >
                👤
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
