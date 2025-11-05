import { create } from "zustand";

import type { PresenceBroadcast, PresenceRecord } from "@/lib/presence/types";

export type PresenceConnectionState = "idle" | "connecting" | "open" | "error" | "closed";

interface PresenceState {
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
        set({ participants, typingSummary, typingIds }),
    setConnectionState: (connectionState) => set({ connectionState }),
    reset: () => set({ ...initialState, connectionState: "closed" }),
}));
