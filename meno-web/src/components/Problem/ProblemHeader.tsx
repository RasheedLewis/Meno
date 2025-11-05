"use client";
import type { SVGProps } from "react";

import { RichMathText } from "@/components/Math/RichMathText";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import type { ProblemMeta } from "@/lib/types/problem";
import type { ReactElement } from "react";
import { showToast } from "@/components/ui/Toast";

interface ProblemHeaderProps {
  meta: ProblemMeta;
  className?: string;
}

export function ProblemHeader({ meta, className }: ProblemHeaderProps) {
  const difficultyLabel = resolveDifficulty(meta.context?.difficulty);

  return (
    <Card className={cn("space-y-6", className)}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-sans uppercase tracking-[0.3em] text-[var(--muted)]">
          {meta.context?.domain ? (
            <ContextBadge icon={DomainIcon} label={formatDomain(meta.context.domain)} />
          ) : null}
          {difficultyLabel ? (
            <ContextBadge icon={GaugeIcon} label={difficultyLabel} />
          ) : null}
          {meta.context?.source ? (
            <ContextBadge icon={BookmarkIcon} label={meta.context.source} />
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl text-[var(--ink)]">{meta.title}</h1>
          {meta.description ? (
            <p className="font-sans text-sm leading-relaxed text-[var(--muted)]">
              {meta.description}
            </p>
          ) : null}
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <InfoGroup
          title="Knowns"
          icon={CheckIcon}
          items={meta.knowns}
          emptyLabel="No knowns recorded."
        />
        <InfoGroup
          title="Unknowns"
          icon={QuestionIcon}
          items={meta.unknowns}
          emptyLabel="No unknowns identified."
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--paper)]/80 px-5 py-4">
        <header className="mb-2 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          <TargetIcon className="h-4 w-4" />
          Goal
        </header>
        <p className="font-serif text-lg leading-relaxed text-[var(--ink)]">
          {meta.goal}
        </p>
        <CopyControls className="mt-3" plain={meta.goal} latex={meta.goal} />
      </section>

      {meta.hints && meta.hints.length > 0 ? (
        <section className="space-y-2">
          <header className="flex items-center gap-2 font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            <SparkleIcon className="h-4 w-4" /> Hints
          </header>
          <ul className="space-y-2">
            {meta.hints.map((hint, index) => (
              <li key={index} className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3 font-sans text-sm text-[var(--muted)]">
                {hint}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <FooterMeta meta={meta} />
    </Card>
  );
}

const InfoGroup = ({
  title,
  icon: Icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: IconComponent;
  items: Array<{ label: string; value: string }>;
  emptyLabel: string;
}) => (
  <div className="space-y-3">
    <header className="flex items-center gap-2 font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
      <Icon className="h-4 w-4" />
      {title}
    </header>
    <ul className="space-y-3">
      {items.length > 0 ? (
        items.map((item, index) => (
          <li key={index} className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/80 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  {item.label}
                </p>
                <RichMathText text={item.value} className="font-serif text-base text-[var(--ink)]" />
              </div>
              <CopyButtons plain={item.value} latex={item.value} />
            </div>
          </li>
        ))
      ) : (
        <li className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--paper)]/60 px-4 py-3 font-sans text-sm text-[var(--muted)]">
          {emptyLabel}
        </li>
      )}
    </ul>
  </div>
);

const CopyButtons = ({
  plain,
  latex,
  className,
}: {
  plain: string;
  latex?: string;
  className?: string;
}) => <CopyControls plain={plain} latex={latex} className={className} />;

const CopyControls = ({
  plain,
  latex,
  className,
}: {
  plain: string;
  latex?: string;
  className?: string;
}) => (
  <div className={cn("flex flex-wrap gap-2", className)}>
    <CopyButton
      label="Copy plain text"
      icon={DocumentIcon}
      payload={plain}
      success="Copied text"
    />
    {latex ? (
      <CopyButton
        label="Copy LaTeX"
        icon={BracesIcon}
        payload={latex}
        success="Copied LaTeX"
        variant="accent"
      />
    ) : null}
  </div>
);

const CopyButton = ({
  label,
  icon: Icon,
  payload,
  success,
  variant,
}: {
  label: string;
  icon: IconComponent;
  payload: string;
  success: string;
  variant?: "default" | "accent";
}) => {
  const handleCopy = async () => {
    try {
      await copyToClipboard(payload);
      showToast({ variant: "success", title: success });
    } catch (error) {
      console.error("Copy failed", error);
      showToast({ variant: "error", title: "Copy failed" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center rounded-full border p-2 transition",
        variant === "accent"
          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20"
          : "border-[var(--border)] bg-[var(--paper)] text-[var(--muted)] hover:bg-[var(--paper)]/80",
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
};

const copyToClipboard = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const FooterMeta = ({ meta }: { meta: ProblemMeta }) => {
  const keywords = meta.keywords ?? [];
  const related = meta.relatedConcepts ?? [];
  const hasEvaluation = meta.evaluation && (meta.evaluation.rubric || meta.evaluation.metrics);
  const hasFooterContent = keywords.length || related.length || hasEvaluation || meta.metadata?.author;

  if (!hasFooterContent) return null;

  return (
    <footer className="grid gap-4 md:grid-cols-2">
      {keywords.length ? (
        <BadgeList title="Keywords" icon={TagIcon} items={keywords} />
      ) : null}
      {related.length ? (
        <BadgeList title="Related" icon={LinkIcon} items={related} />
      ) : null}
      {hasEvaluation ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3 font-sans text-sm text-[var(--muted)] md:col-span-2">
          <header className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
            <ScaleIcon className="h-4 w-4" /> Evaluation
          </header>
          {meta.evaluation?.rubric ? (
            <p className="text-sm text-[var(--muted)]">{meta.evaluation.rubric}</p>
          ) : null}
          {meta.evaluation?.metrics ? (
            <ul className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {Object.entries(meta.evaluation.metrics).map(([metric, value]) => (
                <li key={metric} className="flex justify-between rounded-lg border border-[var(--border)] bg-[var(--paper)] px-2 py-1">
                  <span className="uppercase tracking-[0.2em] text-[var(--muted)]">{metric}</span>
                  <span className="font-semibold text-[var(--ink)]">{value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {meta.metadata?.author || meta.metadata?.createdAt ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/60 px-4 py-3 font-sans text-xs text-[var(--muted)] md:col-span-2">
          <div className="flex flex-wrap gap-4">
            {meta.metadata.author ? (
              <span className="flex items-center gap-2">
                <FeatherIcon className="h-3 w-3" /> {meta.metadata.author}
              </span>
            ) : null}
            {meta.metadata.createdAt ? <span>Created: {formatDate(meta.metadata.createdAt)}</span> : null}
            {meta.metadata.updatedAt ? <span>Updated: {formatDate(meta.metadata.updatedAt)}</span> : null}
          </div>
        </div>
      ) : null}
    </footer>
  );
};

const BadgeList = ({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: IconComponent;
  items: string[];
}) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]/70 px-4 py-3 font-sans text-sm text-[var(--muted)]">
    <header className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em]">
      <Icon className="h-4 w-4" /> {title}
    </header>
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--paper)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
        >
          {item}
        </span>
      ))}
    </div>
  </div>
);

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

const ContextBadge = ({ icon: Icon, label }: { icon: IconComponent; label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--paper)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
    <Icon className="h-3 w-3" />
    {label}
  </span>
);

const formatDomain = (domain: ProblemMeta["context"]["domain"]) => {
  switch (domain) {
    case "math":
      return "Mathematics";
    case "logic":
      return "Logic";
    case "language":
      return "Language";
    case "philosophy":
      return "Philosophy";
    default:
      return "Custom";
  }
};

const resolveDifficulty = (
  difficulty?: ProblemMeta["context"]["difficulty"],
) => {
  if (!difficulty) return null;
  if (typeof difficulty === "string") {
    return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  }
  const scale = ["Introductory", "Early", "Intermediate", "Advanced", "Expert"];
  return scale[Math.min(Math.max(difficulty - 1, 0), scale.length - 1)];
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

// Icon set (simple stroked SVGs)
const CheckIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M16.5 5.75l-7.5 8-4-3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const QuestionIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M9.5 14h1" strokeLinecap="round" />
    <path d="M10 11.5c0-2 2.5-1.75 2.5-4 0-1.5-1.25-2.5-2.5-2.5S7.5 6 7.5 7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="8.25" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TargetIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <circle cx="10" cy="10" r="7.25" />
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.75v2.5M10 14.75v2.5M2.75 10h2.5M14.75 10h2.5" strokeLinecap="round" />
  </svg>
);

const SparkleIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path
      d="M10 2.5l1.25 3.75 3.75 1.25-3.75 1.25L10 12.5l-1.25-3.75-3.75-1.25 3.75-1.25L10 2.5zM3.5 13l.75 2.25L6.5 16l-2.25.75L3.5 19l-.75-2.25L.5 16l2.25-.75L3.5 13zm13-1l.75 2.25L19.5 15l-2.25.75L16.5 18l-.75-2.25L13.5 15l2.25-.75L16.5 12z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TagIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M11 2.75l6.25 6.25a1.5 1.5 0 010 2.12l-4.38 4.38a1.5 1.5 0 01-2.12 0L4.5 11V2.75H11z" />
    <circle cx="7.5" cy="6" r="1" />
  </svg>
);

const LinkIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path
      d="M7.5 12.5l-1 1a3 3 0 104.24 4.24l1.5-1.5a3 3 0 000-4.24l-.75-.75M12.5 7.5l1-1a3 3 0 10-4.24-4.24l-1.5 1.5a3 3 0 000 4.24l.75.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M7.5 12.5l5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DocumentIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M6 2.75h5.5L16.5 8v9.25a1 1 0 01-1 1H6a1 1 0 01-1-1V3.75a1 1 0 011-1z" />
    <path d="M11.5 2.75V7H16.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BracesIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M7.25 3C5.5 3 5 4.5 5 6c0 1.5-.5 3-2 3 1.5 0 2 .5 2 2 0 1.5.5 3 2.25 3M12.75 3C14.5 3 15 4.5 15 6c0 1.5.5 3 2 3-1.5 0-2 .5-2 2 0 1.5-.5 3-2.25 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GaugeIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M3.5 15.5a7.5 7.5 0 1113 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 10l3 3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="10" r=".75" fill="currentColor" />
  </svg>
);

const BookmarkIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M5.5 3.25A1.5 1.5 0 017 1.75h6a1.5 1.5 0 011.5 1.5V17l-4.5-2.5L5.5 17V3.25z" />
  </svg>
);

const DomainIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M2.5 10h15M10 2.5c2 2 3 4.5 3 7.5s-1 5.5-3 7.5M10 2.5c-2 2-3 4.5-3 7.5s1 5.5 3 7.5" />
  </svg>
);

const ScaleIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M10 2.5v15" strokeLinecap="round" />
    <path d="M4.5 6l-3 6.5a3 3 0 006 0L4.5 6zm11 0l-3 6.5a3 3 0 006 0L15.5 6z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FeatherIcon: IconComponent = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <path d="M16 4.5l-7.5 7.5M4 16l6.5-1.5L16 4.5 12.5 1 4 9.5 2.5 15z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

