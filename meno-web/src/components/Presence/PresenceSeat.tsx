"use client";

import { cn } from "@/components/ui/cn";

type PresenceSeatState =
  | "idle"
  | "typing"
  | "speaking"
  | "muted"
  | "disconnected"
  | "reconnecting";

interface PresenceSeatProps {
  name: string | null;
  color: string;
  state: PresenceSeatState;
  role?: "student" | "teacher" | "observer";
  isLocal?: boolean;
  addressed?: boolean;
  caption?: string | null;
  className?: string;
}

const glyphs: Record<PresenceSeatState, string | null> = {
  idle: null,
  typing: "…",
  speaking: "˜",
  muted: "⨯",
  disconnected: "⚠",
  reconnecting: "↻",
};

const stateLabel: Record<PresenceSeatState, string> = {
  idle: "online",
  typing: "typing",
  speaking: "speaking",
  muted: "muted",
  disconnected: "disconnected",
  reconnecting: "reconnecting",
};

const buildRingStyle = (color: string, state: PresenceSeatState, addressed: boolean | undefined) => {
  const shadow: string[] = [`0 0 0 2px ${color}`];

  if (state === "speaking") {
    shadow.push(`0 0 0 8px color-mix(in_oklab, ${color} 25%, transparent)`);
  }

  if (addressed) {
    shadow.push(`0 0 0 12px color-mix(in_oklab, ${color} 12%, transparent)`);
  }

  return shadow.join(", ");
};

const getStateClass = (state: PresenceSeatState) => {
  switch (state) {
    case "typing":
      return "animate-[presence_typing_1.2s_ease-in-out_infinite]";
    case "reconnecting":
      return "animate-[presence_reconnect_2s_linear_infinite] opacity-60";
    case "disconnected":
      return "opacity-40";
    case "muted":
      return "opacity-60";
    default:
      return "";
  }
};

const fallbackColors = ["#C2B19C", "#8996C5", "#B28CBF", "#91A889"];

const avatarBackground = (name: string | null) => {
  if (!name) {
    return fallbackColors[0];
  }
  const code = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return fallbackColors[code % fallbackColors.length];
};

export function PresenceSeat({
  name,
  color,
  state,
  role = "student",
  isLocal,
  addressed,
  caption,
  className,
}: PresenceSeatProps) {
  const initials = name ? name.trim().slice(0, 1).toUpperCase() : "?";
  const ringStyle = { boxShadow: buildRingStyle(color, state, addressed) } as React.CSSProperties;
  const glyph = glyphs[state];

  return (
    <div
      className={cn(
        "relative flex w-[min(160px,28vw)] flex-col items-center gap-2 text-center font-sans text-xs text-[var(--muted)]",
        className,
      )}
      aria-label={`${name ?? "Unknown participant"}, ${stateLabel[state]}`}
    >
      <div className={cn("relative grid place-items-center", "pointer-events-none")}
        style={{ color }}
      >
        <div
          className={cn(
            "relative grid h-12 w-12 place-items-center rounded-full bg-[var(--card)] text-[var(--ink)] transition-all",
            isLocal && "ring-2 ring-[var(--accent)]",
            getStateClass(state),
          )}
          style={ringStyle}
        >
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold"
            style={{ background: avatarBackground(name ?? null), color: "var(--bg)" }}
          >
            {initials}
          </span>
          {glyph ? (
            <span className="absolute -bottom-1 right-[2px] grid h-5 w-5 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-medium text-[var(--muted)]">
              {glyph}
            </span>
          ) : null}
          {addressed ? (
            <span className="pointer-events-none absolute -bottom-2 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className={cn("max-w-[8rem] truncate font-medium text-[var(--ink)]", isLocal && "text-[var(--accent)]")}
        >
          {name ?? "Waiting…"}
        </span>
        <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
          {role === "teacher" ? "Facilitator" : "Learner"}
        </span>
      </div>
      {caption ? (
        <div className="mt-1 max-w-[18ch] rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left text-[11px] leading-snug text-[var(--fg)] shadow-sm">
          {caption}
        </div>
      ) : null}
    </div>
  );
}
