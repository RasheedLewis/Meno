import { env } from "@/env";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getYjsWebsocketBaseUrl = () => {
  const configured = env.NEXT_PUBLIC_YJS_WEBSOCKET_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/^http/i, "ws");
    return `${trimTrailingSlash(origin)}/api/yws`;
  }

  const fallback =
    env.NEXT_PUBLIC_APP_URL?.replace(/^https?/i, "ws") ?? "ws://localhost:3000";
  return `${trimTrailingSlash(fallback)}/api/yws`;
};

