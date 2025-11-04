import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ParticipantRole = "student" | "teacher" | "observer";
export type SessionPhase = "idle" | "joining" | "active" | "completed";

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  presence: "online" | "offline";
}

interface SessionState {
  sessionId: string | null;
  participantId: string | null;
  participantName: string;
  role: ParticipantRole;
  phase: SessionPhase;
  participants: Participant[];
  setSessionId: (sessionId: string | null) => void;
  setParticipant: (payload: {
    id: string;
    name: string;
    role?: ParticipantRole;
  }) => void;
  setPhase: (phase: SessionPhase) => void;
  setParticipants: (list: Participant[]) => void;
  upsertParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  resetSession: () => void;
}

type SessionBaseState = {
  sessionId: string | null;
  participantId: string | null;
  participantName: string;
  role: ParticipantRole;
  phase: SessionPhase;
  participants: Participant[];
};

const baseSession: SessionBaseState = {
  sessionId: null,
  participantId: null,
  participantName: "",
  role: "student" as ParticipantRole,
  phase: "idle" as SessionPhase,
  participants: [],
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      ...baseSession,
      setSessionId: (sessionId) => set({ sessionId }),
      setParticipant: ({ id, name, role }) =>
        set((state) => ({
          participantId: id,
          participantName: name,
          role: role ?? state.role,
        })),
      setPhase: (phase) => set({ phase }),
      setParticipants: (list) => set({ participants: list }),
      upsertParticipant: (participant) =>
        set((state) => {
          const exists = state.participants.findIndex((p) => p.id === participant.id);
          if (exists >= 0) {
            const updated = [...state.participants];
            updated[exists] = participant;
            return { participants: updated };
          }
          return { participants: [...state.participants, participant] };
        }),
      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((p) => p.id !== id),
        })),
      resetSession: () => set({ ...baseSession, participants: [] }),
    }),
    {
      name: "meno-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        participantId: state.participantId,
        participantName: state.participantName,
        role: state.role,
      }),
    },
  ),
);

