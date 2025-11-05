"use client";

import { useMemo } from "react";

import { cn } from "@/components/ui/cn";
import { usePresenceStore } from "@/lib/store/presence";

const STATUS_LABEL: Record<string, string> = {
  online: "is here.",
  typing: "is typing…",
  speaking: "is speaking.",
  disconnected: "lost connection.",
};

const statusRingClass = (status: string) => {
  switch (status) {
    case "typing":
      return "after:animate-pulse after:bg-current after:opacity-40";
    case "speaking":
      return "after:animate-[ping_1s_ease-in-out_infinite] after:bg-current after:opacity-50";
    case "disconnected":
      return "opacity-40";
    default:
      return "";
  }
};

const roleSortWeight = (role: string) => {
  switch (role) {
    case "teacher":
      return 0;
    case "student":
      return 1;
    case "observer":
      return 2;
    default:
      return 3;
  }
};

interface PresenceBarProps {
  className?: string;
}

export function PresenceBar({ className }: PresenceBarProps) {
  const { participants, typingSummary, typingIds, connectionState } = usePresenceStore((state) => state);

  const ordered = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.status === "disconnected" && b.status !== "disconnected") return 1;
        if (b.status === "disconnected" && a.status !== "disconnected") return -1;
        const roleDiff = roleSortWeight(a.role) - roleSortWeight(b.role);
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name);
      }),
    [participants],
  );

  const typingNames = useMemo(() => {
    if (typingIds.length === 0) return "";
    const typing = ordered.filter((participant) => typingIds.includes(participant.participantId));
    return typing.map((participant) => participant.name).join(" & ");
  }, [ordered, typingIds]);

  if (connectionState === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 shadow-soft backdrop-blur",
        className,
      )}
      aria-live="polite"
    >
      {ordered.length === 0 && connectionState === "connecting" ? (
        <span className="text-xs font-sans text-[var(--muted)]">Connecting to presence…</span>
      ) : null}

      {ordered.map((participant) => (
        <div
          key={participant.participantId}
          className="flex items-center gap-2 text-xs font-sans"
          style={{ opacity: participant.status === "disconnected" ? 0.4 : 1 }}
        >
          <span
            className={cn(
              "relative grid h-7 w-7 place-items-center rounded-full text-[var(--paper)] after:absolute after:-inset-1 after:rounded-full after:opacity-0 after:content-['']",
              statusRingClass(participant.status),
            )}
            style={{ color: participant.color }}
            title={`${participant.name} ${STATUS_LABEL[participant.status] ?? "is here."}`}
            aria-label={`${participant.name} ${STATUS_LABEL[participant.status] ?? "is here."}`}
          >
            <span
              className="h-6 w-6 rounded-full border border-white/50 shadow-inner"
              style={{ background: participant.color }}
            />
          </span>
          <span className="font-medium text-[var(--ink)]">{participant.name}</span>
        </div>
      ))}

      {typingSummary !== "none" ? (
        <span className="text-xs font-sans text-[var(--muted)]">
          {typingSummary === "multiple"
            ? "Several students are typing…"
            : typingNames
            ? `${typingNames} is typing…`
            : "Someone is typing…"}
        </span>
      ) : null}
    </div>
  );
}
