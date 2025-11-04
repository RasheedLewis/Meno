"use client";

import {
  DragEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { useSessionStore } from "@/lib/store/session";
import { RichMathText } from "@/components/Math/RichMathText";
import { KaTeXBlock } from "@/components/Math/KaTeXBlock";

type UploadStatus = "queued" | "processing" | "succeeded" | "failed";

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  result?: {
    canonicalText: string;
    latex?: string;
    plainText: string;
    mathSegments?: Array<{ id: string; content: string; display?: boolean }>;
  };
  error?: string;
}

interface UploadBoxProps {
  onResult?: (result: UploadItem["result"], file: File) => void;
  className?: string;
}

const imageMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export function UploadBox({ onResult, className }: UploadBoxProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useSessionStore((state) => state.sessionId);

  const processingUpload = uploads.find((upload) => upload.status === "processing");
  const queuedUpload = useMemo(
    () => uploads.find((upload) => upload.status === "queued"),
    [uploads],
  );

  const processUpload = useCallback(
    async (upload: UploadItem) => {
      setUploads((prev) => prev.map((item) => (item.id === upload.id ? { ...item, status: "processing" } : item)));

      try {
        const base64 = await fileToBase64(upload.file);
        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            fileName: upload.file.name,
            sessionId,
          }),
        });

        const data = (await response.json()) as
          | { ok: true; data: { canonicalText: string; latex?: string; plainText: string } }
          | { ok: false; error: string };

        if (!response.ok || !data.ok) {
          throw new Error(data.ok ? "OCR request failed" : data.error);
        }

        setUploads((prev) =>
          prev.map((item) =>
            item.id === upload.id
              ? { ...item, status: "succeeded", result: data.data }
              : item,
          ),
        );

        onResult?.(data.data, upload.file);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        setUploads((prev) =>
          prev.map((item) =>
            item.id === upload.id ? { ...item, status: "failed", error: message } : item,
          ),
        );
      }
    },
    [onResult, sessionId],
  );

  useEffect(() => {
    if (!processingUpload && queuedUpload) {
      processUpload(queuedUpload).catch((error) => {
        console.error("Upload processing failed", error);
      });
    }
  }, [processingUpload, queuedUpload, processUpload]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter((file) => imageMimeTypes.has(file.type));

    if (files.length === 0) {
      return;
    }

    setUploads((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        status: "queued" as UploadStatus,
      })),
    ]);
  };

  const onDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer?.files ?? null);
  };

  const onDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const reset = () => {
    setUploads([]);
    setIsDragging(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <Card className={cn("space-y-4", className)}>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
          isDragging
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-[var(--border)] bg-[var(--paper)]/70",
        )}
      >
        <p className="font-serif text-xl text-[var(--ink)]">Upload a problem image</p>
        <p className="font-sans text-sm text-[var(--muted)]">
          Drop an image or select one to transcribe. Uploads are processed one at a time to keep the queue steady.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="mt-2"
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {uploads.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-sans uppercase tracking-[0.3em] text-[var(--muted)]">
            <span>Queue</span>
            <button
              type="button"
              onClick={reset}
              className="text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-3">
            {uploads.map((upload) => (
              <li
                key={upload.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--paper)]/80 px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-sans text-sm text-[var(--ink)]">{upload.file.name}</p>
                    <p className="font-sans text-xs text-[var(--muted)]">
                      {(upload.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <StatusBadge status={upload.status} />
                </div>
                {upload.status === "failed" && upload.error ? (
                  <p className="mt-2 font-sans text-xs text-[#b94a44]">{upload.error}</p>
                ) : null}
                {upload.status === "succeeded" && upload.result ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-2">
                    <p className="font-sans text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                      Canonical Text
                    </p>
                    <RichMathText
                      text={upload.result.canonicalText}
                      className="font-serif text-sm leading-relaxed text-[var(--ink)] whitespace-pre-wrap"
                    />
                    {upload.result.mathSegments && upload.result.mathSegments.length ? (
                      <div className="space-y-2 text-xs text-[var(--muted)]">
                        <span className="font-sans uppercase tracking-[0.3em] text-[var(--muted)]">
                          Extracted Equations
                        </span>
                        <ul className="space-y-2">
                          {upload.result.mathSegments.map((segment) => (
                            <li key={segment.id} className="rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2">
                              <KaTeXBlock
                                expression={segment.content}
                                displayMode={segment.display}
                                inline={!segment.display}
                                className="font-serif text-base text-[var(--ink)]"
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function StatusBadge({ status }: { status: UploadStatus }) {
  const label =
    status === "queued"
      ? "Queued"
      : status === "processing"
      ? "Processing"
      : status === "succeeded"
      ? "Complete"
      : "Failed";

  const tone =
    status === "queued"
      ? "border-[var(--border)] bg-[var(--paper)] text-[var(--muted)]"
      : status === "processing"
      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
      : status === "succeeded"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
      : "border-[#b94a44]/40 bg-[#b94a44]/10 text-[#b94a44]";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

