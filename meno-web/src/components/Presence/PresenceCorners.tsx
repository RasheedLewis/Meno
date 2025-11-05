"use client";

import { useMemo } from "react";

import { PresenceSeat } from "@/components/Presence/PresenceSeat";
import { cn } from "@/components/ui/cn";
import { usePresenceStore, type PresenceState } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";

const cornerPositions: Record<string, string> = {
  topLeft: "top-[max(1.25rem,env(safe-area-inset-top)+1rem)] left-[max(1.25rem,env(safe-area-inset-left)+1rem)]",
  topRight:
    "top-[max(1.25rem,env(safe-area-inset-top)+1rem)] right-[max(1.25rem,env(safe-area-inset-right)+1rem)]",
  bottomLeft:
    "bottom-[max(1.25rem,env(safe-area-inset-bottom)+1rem)] left-[max(1.25rem,env(safe-area-inset-left)+1rem)]",
  bottomRight:
    "bottom-[max(1.25rem,env(safe-area-inset-bottom)+1rem)] right-[max(1.25rem,env(safe-area-inset-right)+1rem)]",
};

const fallbackParticipant = (label: string, index = 0) => ({
  participantId: label,
  name: null,
  color: fallbackColors[index % fallbackColors.length],
  state: "idle" as const,
  role: "student" as const,
});

const fallbackColors = ["#C2B19C", "#8996C5", "#B28CBF", "#91A889"];

interface SeatData {
  participantId: string;
  name: string | null;
  color: string;
  role: "student" | "teacher" | "observer";
  caption?: string | null;
  state: "idle" | "typing" | "speaking" | "muted" | "disconnected" | "reconnecting";
  addressed?: boolean;
  isLocal?: boolean;
}

const toSeatState = (record: PresenceState["participants"][number]): SeatData => {
  let derivedState: SeatData["state"] = "idle";
  if (record.status === "disconnected") {
    derivedState = "disconnected";
  } else if (record.status === "reconnecting") {
    derivedState = "reconnecting";
  } else if (record.muted || record.status === "muted") {
    derivedState = "muted";
  } else if (record.isSpeaking || record.status === "speaking") {
    derivedState = "speaking";
  } else if (record.isTyping || record.status === "typing") {
    derivedState = "typing";
  }

  return {
    participantId: record.participantId,
    name: record.name,
    color: record.color,
    role: record.role,
    caption: record.caption,
    state: derivedState,
    addressed: record.addressed,
  };
};

interface PresenceCornersProps {
  className?: string;
}

export function PresenceCorners({ className }: PresenceCornersProps) {
  const presenceParticipants = usePresenceStore((state) => state.participants);
  const sessionParticipants = useSessionStore((state) => state.participants);
  const localParticipantId = useSessionStore((state) => state.participantId);

  const seats = useMemo(() => {
    const presenceMap = new Map<string, SeatData>();
    presenceParticipants.forEach((record) => {
      presenceMap.set(record.participantId, toSeatState(record));
    });

    const sourceParticipants = sessionParticipants.length > 0 ? sessionParticipants : presenceParticipants.map((record) => ({
      id: record.participantId,
      name: record.name,
      role: record.role,
      presence: record.status === "disconnected" ? "offline" : "online",
    }));

    const seatsList: SeatData[] = sourceParticipants.map((participant, index) => {
      const fromPresence = participant.id ? presenceMap.get(participant.id) : undefined;

      if (fromPresence) {
        return {
          ...fromPresence,
          color: fromPresence.color || fallbackColors[index % fallbackColors.length],
          isLocal: fromPresence.participantId === localParticipantId,
        };
      }

      return {
        participantId: participant.id ?? `participant-${index}`,
        name: participant.name ?? null,
        color: fallbackColors[index % fallbackColors.length],
        role: (participant.role as SeatData["role"]) ?? "student",
        state: participant.presence === "offline" ? "reconnecting" : "idle",
        isLocal: participant.id === localParticipantId,
      } satisfies SeatData;
    });

    const localSeat = seatsList.find((seat) => seat.participantId === localParticipantId) ?? (localParticipantId
      ? {
          participantId: localParticipantId,
          name: sessionParticipants.find((participant) => participant.id === localParticipantId)?.name ?? null,
          color: "var(--accent)",
          role: sessionParticipants.find((participant) => participant.id === localParticipantId)?.role ?? "student",
          state: "idle" as const,
          isLocal: true,
        }
      : null);

    const remoteSeats = seatsList.filter((seat) => seat.participantId !== localParticipantId);

    const placeholdersNeeded = Math.max(0, 3 - remoteSeats.length);
    for (let index = 0; index < placeholdersNeeded; index += 1) {
      remoteSeats.push({
        ...fallbackParticipant(`placeholder-${index}`, index),
      });
    }

    return {
      topLeft: remoteSeats[0] ?? null,
      topRight: remoteSeats[1] ?? null,
      bottomLeft: remoteSeats[2] ?? null,
      bottomRight: localSeat,
    };
  }, [localParticipantId, presenceParticipants, sessionParticipants]);

  if (!localParticipantId) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none",
        "fixed inset-0 z-40",
        "[--presence-gap:clamp(1.5rem,4vw,2.25rem)]",
        className,
      )}
      aria-live="polite"
    >
      {seats.topLeft ? (
        <div className={cn("absolute", cornerPositions.topLeft)}>
          <PresenceSeat
            name={seats.topLeft.name}
            color={seats.topLeft.color}
            state={seats.topLeft.state}
            role={seats.topLeft.role}
            addressed={seats.topLeft.addressed}
            caption={seats.topLeft.caption}
          />
        </div>
      ) : null}
      {seats.topRight ? (
        <div className={cn("absolute", cornerPositions.topRight)}>
          <PresenceSeat
            name={seats.topRight.name}
            color={seats.topRight.color}
            state={seats.topRight.state}
            role={seats.topRight.role}
            addressed={seats.topRight.addressed}
            caption={seats.topRight.caption}
          />
        </div>
      ) : null}
      {seats.bottomLeft ? (
        <div className={cn("absolute", cornerPositions.bottomLeft)}>
          <PresenceSeat
            name={seats.bottomLeft.name}
            color={seats.bottomLeft.color}
            state={seats.bottomLeft.state}
            role={seats.bottomLeft.role}
            addressed={seats.bottomLeft.addressed}
            caption={seats.bottomLeft.caption}
          />
        </div>
      ) : null}
      {seats.bottomRight ? (
        <div className={cn("absolute", cornerPositions.bottomRight)}>
          <PresenceSeat
            name={seats.bottomRight.name}
            color={seats.bottomRight.color ?? "var(--accent)"}
            state={seats.bottomRight.state}
            role={seats.bottomRight.role}
            addressed={seats.bottomRight.addressed}
            isLocal
            caption={seats.bottomRight.caption}
          />
        </div>
      ) : null}
    </div>
  );
}
