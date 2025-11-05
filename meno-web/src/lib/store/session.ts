import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { HspPlan } from "@/lib/hsp/schema";

export type ParticipantRole = "student" | "teacher" | "observer";
export type SessionPhase = "idle" | "joining" | "active" | "completed";
export type SessionDifficulty = "beginner" | "intermediate" | "advanced";

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  presence: "online" | "offline";
}

interface SessionState {
  sessionId: string | null;
  sessionName: string | null;
  participantId: string | null;
  participantName: string;
  role: ParticipantRole;
  phase: SessionPhase;
  participants: Participant[];
  difficulty: SessionDifficulty;
  hspPlanId: string | null;
  hspPlan?: HspPlan | null;
  isLoading: boolean;
  error: string | null;
  setSessionId: (sessionId: string | null) => void;
  setParticipant: (payload: {
    id: string;
    name: string;
    role?: ParticipantRole;
  }) => void;
  setPhase: (phase: SessionPhase) => void;
  setSessionMeta: (meta: {
    sessionName?: string | null;
    difficulty?: SessionDifficulty;
  }) => void;
  setParticipants: (list: Participant[]) => void;
  upsertParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  setHspPlan: (plan: HspPlan | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  hydrateFromServer: (payload: {
    sessionId: string;
    sessionName?: string | null;
    difficulty?: SessionDifficulty | null;
    participants?: Participant[];
  }) => void;
  resetSession: () => void;
}

type SessionBaseState = {
  sessionId: string | null;
  sessionName: string | null;
  participantId: string | null;
  participantName: string;
  role: ParticipantRole;
  phase: SessionPhase;
  difficulty: SessionDifficulty;
  participants: Participant[];
  hspPlanId: string | null;
  hspPlan?: HspPlan | null;
  isLoading: boolean;
  error: string | null;
};

const baseSession: SessionBaseState = {
  sessionId: null,
  sessionName: null,
  participantId: null,
  participantName: "",
  role: "student" as ParticipantRole,
  phase: "idle" as SessionPhase,
  difficulty: "beginner" as SessionDifficulty,
  participants: [],
  hspPlanId: null,
  hspPlan: null,
  isLoading: false,
  error: null,
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
      setSessionMeta: ({ sessionName, difficulty }) =>
        set((state) => ({
          sessionName:
            sessionName !== undefined ? sessionName : state.sessionName,
          difficulty: difficulty ?? state.difficulty,
        })),
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
      setHspPlan: (plan) =>
        set({
          hspPlanId: plan?.id ?? null,
          hspPlan: plan ?? null,
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      hydrateFromServer: ({ sessionId, sessionName, difficulty, participants }) =>
        set((state) => ({
          sessionId,
          sessionName: sessionName ?? state.sessionName,
          difficulty: difficulty ?? state.difficulty,
          participants: participants ?? state.participants,
        })),
      resetSession: () => set({ ...baseSession, participants: [] }),
    }),
    {
      name: "meno-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        sessionName: state.sessionName,
        participantId: state.participantId,
        participantName: state.participantName,
        role: state.role,
        difficulty: state.difficulty,
        hspPlanId: state.hspPlanId,
      }),
    },
  ),
);

