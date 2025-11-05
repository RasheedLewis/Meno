"use client";

import { usePathname } from "next/navigation";

import { PresenceCorners } from "@/components/Presence/PresenceCorners";
import { useSessionStore } from "@/lib/store/session";

interface PresenceOverlayProps {
  className?: string;
}

export function PresenceOverlay({ className }: PresenceOverlayProps) {
  const pathname = usePathname();
  const sessionId = useSessionStore((state) => state.sessionId);
  const phase = useSessionStore((state) => state.phase);

  const shouldRender = Boolean(
    pathname?.startsWith("/chat") && sessionId && phase !== "idle",
  );

  if (!shouldRender) {
    return null;
  }

  return <PresenceCorners className={className} />;
}
