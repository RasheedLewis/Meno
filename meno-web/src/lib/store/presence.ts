import { create } from "zustand";

import type { PresenceBroadcast, PresenceRecord } from "@/lib/presence/types";
import { useSessionStore } from "@/lib/store/session";

export type PresenceConnectionState = "idle" | "connecting" | "open" | "error" | "closed";

export interface PresenceState {
    participants: PresenceRecord[];
    typingSummary: PresenceBroadcast["typingSummary"];
    typingIds: string[];
    connectionState: PresenceConnectionState;
    setParticipants: (participants: PresenceRecord[], typingSummary: PresenceBroadcast["typingSummary"], typingIds: string[]) => void;
    setConnectionState: (state: PresenceConnectionState) => void;
    reset: () => void;
}

const initialState = {
    participants: [] as PresenceRecord[],
    typingSummary: "none" as PresenceBroadcast["typingSummary"],
    typingIds: [] as string[],
    connectionState: "idle" as PresenceConnectionState,
};

export const usePresenceStore = create<PresenceState>((set) => ({
    ...initialState,
    setParticipants: (participants, typingSummary, typingIds) =>
        set(() => {
            const offlineStatuses = new Set(["disconnected"]);
            const sessionParticipants = participants.map((participant) => ({
                id: participant.participantId,
                name: participant.name,
                role: participant.role,
                presence: offlineStatuses.has(participant.status) ? "offline" : "online",
            }));

            useSessionStore.getState().setParticipants(sessionParticipants);

            return { participants, typingSummary, typingIds };
        }),
    setConnectionState: (connectionState) => set({ connectionState }),
    reset: () => set({ ...initialState, connectionState: "closed" }),
}));
