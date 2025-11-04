export type ChatRole =
  | "system"
  | "meno"
  | "student"
  | "teacher"
  | "observer";

export type MessageSource = "chat" | "voice" | "ocr" | "system" | "import";

export type MessageChannel = "public" | "private" | "broadcast";

export interface ChatAttachment {
  id: string;
  type: "image" | "audio" | "transcript" | "whiteboard" | "file";
  url: string;
  thumbnailUrl?: string;
  meta?: Record<string, unknown>;
}

export interface MessageMeta {
  /** Session identifier to correlate across realtime + persistence layers */
  sessionId?: string;
  /** Participant identifier for student/teacher messages */
  participantId?: string;
  /** Source modality for analytics (chat, voice, OCR, etc.) */
  source?: MessageSource;
  /** Delivery channel (public session, private whisper, etc.) */
  channel?: MessageChannel;
  /** Hidden Solution Plan step reference */
  hspStepId?: string;
  /** Optional tags for pedagogy analytics (aporia, hint, recap) */
  tags?: string[];
  /** Reference to message being replied to */
  replyTo?: string;
  /** Attachments such as OCR text, images, or whiteboard snapshots */
  attachments?: ChatAttachment[];
  /** Latency or duration metrics for telemetry */
  latencyMs?: number;
  /** Arbitrary structured payloads */
  payload?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string; // ISO8601 timestamp
  meta?: MessageMeta;
}

export type ChatTranscript = ChatMessage[];

export const isMenoMessage = (message: ChatMessage) => message.role === "meno";

export const isStudentMessage = (message: ChatMessage) => message.role === "student";

