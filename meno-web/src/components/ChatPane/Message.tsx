import { cn } from "@/components/ui/cn";
import type { ChatMessage } from "@/lib/types/chat";
import { isMenoMessage, isStudentMessage } from "@/lib/types/chat";

const formatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const displayNameByRole: Record<ChatMessage["role"], string> = {
  system: "System",
  meno: "Meno",
  student: "Student",
  teacher: "Teacher",
  observer: "Observer",
};

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isStudent = isStudentMessage(message);
  const isAssistant = isMenoMessage(message);
  const alignClass = isStudent ? "justify-end" : "justify-start";

  return (
    <div className={cn("flex w-full", alignClass)}>
      <article
        className={cn(
          "max-w-[75%] rounded-2xl border px-4 py-3 shadow-soft",
          "transition-colors",
          isStudent
            ? "border-transparent bg-[var(--accent)] text-[var(--accent-contrast)]"
            : isAssistant
              ? "border-[var(--border)] bg-[var(--card)] text-[var(--ink)]"
              : "border-dashed border-[var(--border)] bg-[var(--paper)]/80 text-[var(--muted)]",
        )}
      >
        <header className="mb-2 flex items-center justify-between gap-4 text-xs font-medium uppercase tracking-wide">
          <span>
            {displayNameByRole[message.role] ?? message.role}
            {message.meta?.tags?.includes("hint") ? " · Hint" : null}
          </span>
          <time dateTime={message.createdAt} className="opacity-70">
            {formatter.format(new Date(message.createdAt))}
          </time>
        </header>
        <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {message.content}
        </p>
        {message.meta?.attachments && message.meta.attachments.length > 0 ? (
          <footer className="mt-3 space-y-2 text-xs">
            {message.meta.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                className="block rounded-lg border border-[var(--border)] bg-[var(--paper)]/80 px-3 py-2 text-[var(--accent)] underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {attachment.type.toUpperCase()} · {attachment.url}
              </a>
            ))}
          </footer>
        ) : null}
      </article>
    </div>
  );
}

