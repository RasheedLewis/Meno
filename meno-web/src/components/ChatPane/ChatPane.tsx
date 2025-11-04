"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { useChatStore, createChatMessage } from "@/lib/store/chat";

import { MessageBubble } from "./Message";

const demoResponses = [
  "Interesting. What’s the first move that would undo what’s happening to x?",
  "Let’s peel it back carefully. What operation is paired with the +5?",
  "Try narrating the inverse steps aloud—what do we do before dividing?",
  "Suppose we had the answer already. How could we check it quickly?",
];

const getDemoResponse = () =>
  demoResponses[Math.floor(Math.random() * demoResponses.length)] ?? demoResponses[0];

const buildStatus = (isStreaming: boolean) =>
  isStreaming ? "Meno is thinking…" : "Type Shift+Enter for a new line";

export function ChatPane({ className }: { className?: string }) {
  const messages = useChatStore((state) => state.messages);
  const addMessage = useChatStore((state) => state.addMessage);
  const startStreaming = useChatStore((state) => state.startStreaming);
  const stopStreaming = useChatStore((state) => state.stopStreaming);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const isStreaming = useChatStore((state) => state.isStreaming);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = useMemo(() => buildStatus(isStreaming), [isStreaming]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => {
    if (streamer.current) {
      clearTimeout(streamer.current);
    }
  }, []);

  const scheduleDemoResponse = () => {
    if (streamer.current) {
      clearTimeout(streamer.current);
    }

    streamer.current = setTimeout(() => {
      const menoMessage = createChatMessage("meno", getDemoResponse(), {
        source: "chat",
        channel: "public",
        tags: ["demo"],
      });
      addMessage(menoMessage);
      stopStreaming();
      streamer.current = null;
    }, 900 + Math.random() * 1200);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    const studentMessage = createChatMessage("student", trimmed, {
      source: "chat",
      channel: "public",
    });

    addMessage(studentMessage);
    setInput("");
    startStreaming();
    scheduleDemoResponse();
  };

  const handleStop = () => {
    if (streamer.current) {
      clearTimeout(streamer.current);
      streamer.current = null;
    }
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
    clearMessages();
  };

  return (
    <section
      className={cn(
        "flex h-[620px] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--paper)]/95 shadow-strong",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/70 px-6 py-4">
        <div className="flex flex-col">
          <h2 className="font-serif text-2xl text-[var(--ink)]">Dialogue</h2>
          <span className="font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Socratic Session
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center font-sans text-sm text-[var(--muted)]">
            <p>
              No messages yet. Share a thought, a question, or a stuck point to begin the dialogue.
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>

      <footer className="border-t border-[var(--border)] bg-[var(--card)]/80 px-6 py-4">
        <div className="flex flex-col gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Type your reasoning or question..."
            className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--paper)]/90 px-4 py-3 font-sans text-sm text-[var(--ink)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--card)]"
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
                disabled={!input.trim() || isStreaming}
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

