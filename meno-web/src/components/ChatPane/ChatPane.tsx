"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { PresenceBar } from "@/components/Presence/PresenceBar";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { chatClient } from "@/lib/chat/client";
import { presenceClient } from "@/lib/presence/client";
import { fetchRealtimeSnapshot } from "@/lib/realtime/api";
import { createChatMessage, useChatStore } from "@/lib/store/chat";
import { usePresenceStore } from "@/lib/store/presence";
import { useSessionStore } from "@/lib/store/session";
import type {
  DialogueContextTurn,
  HeavyValidationRecord,
  ErrorCategory,
  DialogueRecap,
  StudentTurnFeedback,
} from "@/lib/dialogue/types";
import {
  extractQuickCheckConfig,
  runQuickChecks,
  type QuickCheckConfig,
} from "@/lib/validate/client";
import type { QuickCheckResult } from "@/lib/dialogue/types";
import type { HspStep } from "@/lib/hsp/schema";

import { MessageBubble } from "./Message";

const buildStatus = (isStreaming: boolean, isInitializing: boolean) => {
  if (isInitializing) {
    return "Initializing Socratic dialogue…";
  }
  return isStreaming ? "Meno is thinking…" : "Type Shift+Enter for a new line";
};

interface DialogueResponse {
  step: HspStep | null;
  promptTemplate: string | null;
  stepIndex: number;
  totalSteps: number;
  completedStepIds: string[];
  done: boolean;
  goal: string;
  summary?: string;
  hintLevel: number;
  hint: string | null;
  attemptCount: number;
  instructions: string;
  recap?: DialogueRecap;
  errorCategories: ErrorCategory[];
}

const DEFAULT_NOTE = "Socratic Session";

export function ChatPane({ className }: { className?: string }) {
  const messages = useChatStore((state) => state.messages);
  const addMessage = useChatStore((state) => state.addMessage);
  const startStreaming = useChatStore((state) => state.startStreaming);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const isStreaming = useChatStore((state) => state.isStreaming);

  const sessionId = useSessionStore((state) => state.sessionId);
  const hspPlan = useSessionStore((state) => state.hspPlan);
  const hspPlanId = useSessionStore((state) => state.hspPlanId);
  const participantId = useSessionStore((state) => state.participantId);
  const participantName = useSessionStore((state) => state.participantName);
  const participantRole = useSessionStore((state) => state.role);
  const planId = hspPlan?.id ?? hspPlanId;
  useEffect(() => {
    if (!sessionId) {
      clearMessages();
      usePresenceStore.getState().reset();
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    clearMessages();
    usePresenceStore.getState().reset();
    usePresenceStore.getState().setConnectionState("connecting");

    (async () => {
      try {
        const snapshot = await fetchRealtimeSnapshot(sessionId, { signal: controller.signal });
        if (cancelled) {
          return;
        }

        useChatStore.getState().setMessages(snapshot.chat.messages ?? []);

        const presenceRecords = (snapshot.presence.participants ?? []).map((participant) => ({
          ...participant,
          name: participant.name ?? "Participant",
          role: participant.role ?? "student",
          color: participant.color ?? "#B47538",
          lastSeen: participant.lastSeen ?? new Date().toISOString(),
        }));

        usePresenceStore
          .getState()
          .setParticipants(
            presenceRecords,
            snapshot.presence.typingSummary,
            snapshot.presence.typingIds,
          );
        usePresenceStore.getState().setConnectionState("open");
        useSessionStore.getState().setActiveLine(snapshot.activeLine ?? null);
      } catch (error) {
        if (controller.signal.aborted || cancelled) {
          return;
        }
        console.error("[ChatPane] Failed to hydrate realtime snapshot", error);
        usePresenceStore.getState().setConnectionState("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, clearMessages]);


  const [input, setInput] = useState("");
  const [instructions, setInstructions] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentStep, setCurrentStep] = useState<DialogueResponse["step"]>(null);
  const [lastQuickCheck, setLastQuickCheck] = useState<QuickCheckResult | null>(null);
  const [heavyResult, setHeavyResult] = useState<HeavyValidationRecord | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPlanRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = useMemo(
    () => buildStatus(isStreaming, isInitializing),
    [isStreaming, isInitializing],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionId || !planId) {
      return;
    }

    if (lastPlanRef.current === planId) {
      return;
    }

    lastPlanRef.current = planId;
    resetDialogueState();
    initializeDialogue(sessionId, planId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, planId]);

  const skippedFirstCleanupRef = useRef(false);

  useEffect(() => {
    if (!sessionId || !participantId || !participantName) {
      return;
    }

    presenceClient.connect({
      sessionId,
      participantId,
      name: participantName,
      role: participantRole,
    });
    chatClient.connect({
      sessionId,
      participantId,
      name: participantName,
      role: participantRole,
    });

    return () => {
      if (!skippedFirstCleanupRef.current) {
        skippedFirstCleanupRef.current = true;
        return;
      }
      presenceClient.disconnect();
      chatClient.disconnect();
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [sessionId, participantId, participantName, participantRole]);

  const resetDialogueState = () => {
    clearMessages();
    setInstructions(null);
    setHint(null);
    setStepTitle(null);
    setDone(false);
    setCurrentStep(null);
    setLastQuickCheck(null);
    setHeavyResult(null);
  };

  const initializeDialogue = async (session: string, plan: string) => {
    setIsInitializing(true);
    startStreaming();
    try {
      const response = await fetch("/api/meno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session, planId: plan, transcript: buildTranscript() }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to start dialogue (${response.status}): ${message || "Unknown error"}`);
      }

      const payload = await response.json();
      if (payload?.ok) {
        handleDialogueResponse(payload.data, { replace: true });
      } else {
        showToast({ variant: "error", title: payload?.error ?? "Failed to start dialogue" });
      }
    } catch (error) {
      console.error("Dialogue initialization failed", error);
      showToast({ variant: "error", title: "Failed to start dialogue" });
    } finally {
      setIsInitializing(false);
      stopStreaming();
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isInitializing || !sessionId || !planId) {
      return;
    }

    const studentMessage = createChatMessage("student", trimmed, {
      source: "chat",
      channel: "public",
      sessionId,
      participantId: participantId ?? undefined,
      payload: {
        senderName: participantName,
      },
    });

    addMessage(studentMessage);
    setInput("");
    startStreaming();
    presenceClient.setTyping(false);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    const quickCheckConfig = extractQuickCheckConfig(currentStep ?? null);
    const quickCheck = quickCheckConfig ? runQuickChecks(trimmed, quickCheckConfig) : null;
    if (quickCheck) {
      setLastQuickCheck(quickCheck);
      if (quickCheck.outcome === "pass") {
        showToast({ variant: "success", title: quickCheck.message ?? "Looks good." });
      } else if (quickCheck.outcome === "fail") {
        showToast({ variant: "error", title: quickCheck.message ?? "Let’s tweak that answer." });
      }
    } else {
      setLastQuickCheck(null);
    }
    if (quickCheckConfig?.referenceExpression) {
      triggerHeavyValidation(trimmed, quickCheckConfig);
    } else {
      setHeavyResult(null);
    }
    chatClient.sendMessage({
      id: studentMessage.id,
      content: studentMessage.content,
      role: studentMessage.role,
      createdAt: studentMessage.createdAt,
      meta: studentMessage.meta,
    });
    sendTurn(trimmed, sessionId, planId, quickCheck ?? undefined);
  };

  const handleStop = () => {
    stopStreaming();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    handleStop();
    resetDialogueState();
  };

  const signalTyping = () => {
    presenceClient.setTyping(true);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      presenceClient.setTyping(false);
      typingTimerRef.current = null;
    }, 2500);
  };

  const handleAdvanceStep = async () => {
    if (!sessionId || !planId || isStreaming || isInitializing) return;
    startStreaming();
    try {
      const response = await fetch("/api/meno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, planId, advance: true, transcript: buildTranscript() }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Failed to advance step (${response.status}): ${message || "Unknown error"}`);
      }

      const payload = await response.json();
      if (payload?.ok) {
        handleDialogueResponse(payload.data, { replace: false });
      } else {
        showToast({ variant: "error", title: payload?.error ?? "Failed to advance step" });
      }
    } catch (error) {
      console.error("Advance step failed", error);
      showToast({ variant: "error", title: "Failed to advance step" });
    } finally {
      stopStreaming();
    }
  };

  const sendTurn = async (
    content: string,
    session: string,
    plan: string,
    quickCheck?: QuickCheckResult,
  ) => {
    const feedback: StudentTurnFeedback = {
      outcome: determineOutcome(content),
      content,
    };

    try {
      const response = await fetch("/api/meno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session,
          planId: plan,
          studentTurn: feedback,
          transcript: buildTranscript(),
          quickCheck,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Dialogue turn failed (${response.status}): ${message || "Unknown error"}`);
      }

      const payload = await response.json();
      if (payload?.ok) {
        handleDialogueResponse(payload.data);
      } else {
        showToast({ variant: "error", title: payload?.error ?? "Dialogue turn failed" });
      }
    } catch (error) {
      console.error("Dialogue turn failed", error);
      showToast({ variant: "error", title: "Dialogue turn failed" });
    } finally {
      stopStreaming();
    }
  };

  const handleDialogueResponse = (data: DialogueResponse, options?: { replace?: boolean }) => {
    setInstructions(data.instructions ?? null);
    setHint(data.hint ?? null);
    setDone(data.done);

    if (data.step?.title) {
      setStepTitle(data.step.title);
    }
    setCurrentStep(data.step);

    if (data.done && data.recap) {
      const recapMessage = createChatMessage(
        "meno",
        buildRecapMessage(data.recap),
        {
          source: "system",
          channel: "public",
          tags: ["recap"],
        },
      );
      if (options?.replace) {
        clearMessages();
      }
      addMessage(recapMessage);
      return;
    }

    if (!data.promptTemplate || !data.step) {
      return;
    }

    const menoMessage = createChatMessage("meno", buildMenoPrompt(data.promptTemplate), {
      source: "chat",
      channel: "public",
      tags: ["prompt"],
      sessionId: sessionId ?? undefined,
      payload: {
        senderName: "Meno",
      },
    });

    if (options?.replace) {
      clearMessages();
    }
    addMessage(menoMessage);
    chatClient.sendMessage({
      id: menoMessage.id,
      content: menoMessage.content,
      role: menoMessage.role,
      createdAt: menoMessage.createdAt,
      meta: menoMessage.meta,
    });
  };

  const determineOutcome = (content: string): StudentTurnFeedback["outcome"] => {
    if (/\b(done|next|complete|proceed)\b/i.test(content)) {
      return "productive";
    }
    if (/\b(stuck|confused|don't know|not sure|lost)\b/i.test(content)) {
      return "unproductive";
    }
    return "inconclusive";
  };

  const buildMenoPrompt = (template: string) => template;

  const formatCategory = (category: ErrorCategory) => category.charAt(0).toUpperCase() + category.slice(1);

  const buildRecapMessage = (recap: DialogueRecap) => {
    const highlights = recap.highlights?.length
      ? `Highlights:\n• ${recap.highlights.join("\n• ")}`
      : null;
    const errorSummary = recap.errorCategories?.length
      ? `Common trouble spots: ${recap.errorCategories.map(formatCategory).join(", ")}`
      : null;
    return [
      "Recap",
      recap.summary,
      highlights,
      recap.nextFocus ? `Next focus: ${recap.nextFocus}` : null,
      errorSummary,
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const buildTranscript = (): DialogueContextTurn[] =>
    useChatStore
      .getState()
      .messages.map((message) => ({
        role: message.role === "meno" || message.role === "system" ? message.role : "student",
        content: message.content,
      }));

  const renderHeaderNote = () => {
    if (!planId) {
      return "Upload a problem to begin";
    }
    if (done) {
      return "Plan complete";
    }
    if (stepTitle) {
      return stepTitle;
    }
    return DEFAULT_NOTE;
  };

  const triggerHeavyValidation = async (content: string, config: QuickCheckConfig | null) => {
    if (!sessionId || !planId || !config?.referenceExpression) {
      setHeavyResult(null);
      return;
    }
    setIsValidating(true);
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          planId,
          referenceExpression: config.referenceExpression,
          studentExpression: content,
          expectedUnits: config.expectedUnits,
        }),
      });
      const payload = await response.json();
      if (payload?.ok) {
        setHeavyResult(payload.data);
      } else {
      showToast({ variant: "error", title: payload?.error ?? "Validation failed" });
        setHeavyResult(null);
      }
    } catch (error) {
      console.error("Heavy validation failed", error);
      showToast({ variant: "error", title: "Validation service unavailable" });
      setHeavyResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <section
      className={cn(
        "relative flex h-[620px] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--paper)]/95 shadow-strong",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/70 px-6 py-4">
        <div className="flex flex-col">
          <h2 className="font-serif text-2xl text-[var(--ink)]">Dialogue</h2>
          <span className="font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {renderHeaderNote()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PresenceBar />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAdvanceStep}
            disabled={!planId || isStreaming || isInitializing || done}
          >
            Next Step
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center font-sans text-sm text-[var(--muted)]">
            <p>
              {planId
                ? "No messages yet. Share a thought to begin the dialogue."
                : "Upload a problem to generate a conversation."}
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>

      {instructions ? (
        <div className="border-t border-[var(--border)] bg-[var(--card)]/60 px-6 py-3 font-sans text-xs text-[var(--muted)]">
          {instructions}
        </div>
      ) : null}

      {hint ? (
        <div className="border-t border-[var(--border)] bg-[var(--card)]/60 px-6 py-3 font-sans text-xs text-[var(--accent)]">
          Hint: {hint}
        </div>
      ) : null}

      {lastQuickCheck ? (
        <div
          className={cn(
            "border-t border-[var(--border)] px-6 py-3 font-sans text-xs",
            lastQuickCheck.outcome === "pass"
              ? "text-emerald-600 bg-emerald-500/10"
              : lastQuickCheck.outcome === "fail"
              ? "text-[#b94a44] bg-[#b94a44]/10"
              : "text-[var(--muted)] bg-[var(--card)]/60",
          )}
        >
          Quick check: {lastQuickCheck.message ?? lastQuickCheck.code}
        </div>
      ) : null}

      {isValidating ? (
        <div className="border-t border-[var(--border)] bg-[var(--card)]/60 px-6 py-3 font-sans text-xs text-[var(--muted)]">
          Running symbolic validation…
        </div>
      ) : heavyResult ? (
        <div
          className={cn(
            "border-t border-[var(--border)] px-6 py-3 font-sans text-xs",
            heavyResult.equivalent && heavyResult.unitsMatch
              ? "text-emerald-600 bg-emerald-500/10"
              : "text-[#b94a44] bg-[#b94a44]/10",
          )}
        >
          {heavyResult.equivalent ? heavyResult.equivalenceDetail : heavyResult.equivalenceDetail}
          {!heavyResult.unitsMatch && heavyResult.unitsDetail ? ` — ${heavyResult.unitsDetail}` : null}
          {heavyResult.unitsMatch && !heavyResult.unitsDetail ? " — Units look consistent." : null}
        </div>
      ) : null}

      <footer className="border-t border-[var(--border)] bg-[var(--card)]/80 px-6 py-4">
        <div className="flex flex-col gap-3">
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (event.target.value.trim().length > 0) {
                signalTyping();
              } else {
                presenceClient.setTyping(false);
                if (typingTimerRef.current) {
                  clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = null;
                }
              }
            }}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Type your reasoning or question..."
            className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--paper)]/90 px-4 py-3 font-sans text-sm text-[var(--ink)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--card)]"
            disabled={!planId || isStreaming || isInitializing || done}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 font-sans text-xs text-[var(--muted)]">
            <span>{status}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleStop} disabled={!isStreaming}>
                Stop
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || isInitializing || !planId || done}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}

