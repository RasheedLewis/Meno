# Meno — Technical Implementation Roadmap as PRs

This document translates the roadmap into **actionable pull requests** with subtasks and an explicit file plan.
Paths assume a Next.js + TypeScript web app using the `/app` directory and `pages/api` for server routes (as scaffolded earlier).

> Conventions: **(A)** = add new file, **(M)** = modify existing file.

---

## PR-01: Project Scaffold & Core Design System

**Goal:** Ready-to-run Next.js app with Tailwind, routing, base layout, and classical styling tokens.

**Subtasks**
- [ ] Initialize Next.js + TypeScript, Tailwind, and basic ESLint/Prettier.
- [ ] Create global layout (serif typography, parchment theme).
- [ ] Add core UI primitives: Button, Input, Card, Modal, Sheet.
- [ ] Set up Zustand store for UI/session state.
- [ ] Add environment variable schema and `README` bootstrap.

**Files**
- (A) `app/layout.tsx` — global fonts, theme, metadata
- (A) `app/page.tsx` — landing (Start Session CTA)
- (A) `styles/globals.css` — Tailwind base + classical tokens
- (A) `components/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `Sheet.tsx`
- (A) `lib/store/ui.ts` — Zustand UI store
- (A) `.env.example`, `README.md`, `.eslintrc.js`, `prettier.config.js`
- (A) `tailwind.config.js`, `postcss.config.js`

---

## PR-02: Chat Pane & Session State

**Goal:** Functional chat panel (no LLM yet) with local session state and message model.

**Subtasks**
- [ ] Message model (role, content, ts, meta).
- [ ] Chat pane with scroll, input box, send/stop.
- [ ] System prompt banner (Socratic ethos).
- [ ] Session join flow (enter name/code).

**Files**
- (A) `components/ChatPane/ChatPane.tsx`
- (A) `components/ChatPane/Message.tsx`
- (A) `lib/types/chat.ts`
- (A) `lib/store/session.ts`
- (M) `app/page.tsx` — integrate session join + chat

---

## PR-03: OCR Ingestion (Images → Text)

**Goal:** Upload images (problem screenshots) and extract math text via OCR.

**Subtasks**
- [ ] Image uploader (drag/drop).
- [ ] Server route to call MathPix or Vision.
- [ ] Return canonical text and raw LaTeX if available.
- [ ] Error/timeout handling and retry.

**Files**
- (A) `components/Problem/UploadBox.tsx`
- (A) `pages/api/ocr.ts` — calls OCR provider
- (A) `lib/ocr/providers.ts`
- (A) `lib/ocr/normalizer.ts`
- (M) `components/ChatPane/ChatPane.tsx` — post OCR messages

---

## PR-04: Math Rendering (KaTeX) & Problem Header

**Goal:** Render equations crisply and show active problem meta.

**Subtasks**
- [ ] KaTeX renderer component with SSR-safe hydration.
- [ ] Problem header: title, knowns/unknowns, goal.
- [ ] Copy-to-LaTeX and copy-to-plain buttons.

**Files**
- (A) `components/Math/KaTeXBlock.tsx`
- (A) `components/Problem/ProblemHeader.tsx`
- (A) `lib/math/latex.ts`
- (M) `styles/globals.css` — KaTeX styles import

---

## PR-05: Hidden Solution Plan (HSP) Service

**Goal:** Server-side HSP generator that plans steps before any dialogue.

**Subtasks**
- [ ] Define HSP schema (steps, branches, tags, checks).
- [ ] Build `/api/hsp` endpoint to compose plan from OCR/canonical text.
- [ ] Store HSP snapshot to DB; return plan id.
- [ ] Basic branching support (alternate methods).

**Files**
- (A) `pages/api/hsp.ts`
- (A) `lib/hsp/schema.ts`
- (A) `lib/hsp/generate.ts` — calls LLM to plan
- (A) `lib/db/schema.sql` — tables: sessions, problems, hsp_plans, hsp_steps
- (M) `lib/store/session.ts` — attach `hspPlanId`

---

## PR-06: Dialogue Manager (Plan → Questions)

**Goal:** Run Socratic dialogue driven by HSP; vary question types; track progress.

**Subtasks**
- [ ] Dialogue loop that pulls the next step and `prompt_template`.
- [ ] Map taxonomy: definitional/analytical/proportional/spectral/evaluative.
- [ ] Enforce brevity; escalate hints after 2 unproductive turns.
- [ ] Summarize at completion.

**Files**
- (A) `lib/meno/dialogue.ts`
- (A) `lib/meno/taxonomy.ts`
- (A) `pages/api/meno.ts` — main orchestrator
- (M) `components/ChatPane/ChatPane.tsx` — hook to orchestrator

---

## PR-07: Validation Engine (Quick Checks + SymPy)

**Goal:** Validate answers quickly on client and with server-side symbolic checks.

**Subtasks**
- [ ] Client quick checks (regex/number equality/unit).
- [ ] Server “heavy” checks with SymPy microservice.
- [ ] Error categories for recap (algebraic, arithmetic, units).

**Files**
- (A) `lib/validate/client.ts`
- (A) `pages/api/validate.ts`
- (A) `services/sympy/Dockerfile`, `services/sympy/server.py`
- (M) `lib/hsp/schema.ts` — add `check` descriptors

---

## PR-08: Realtime Presence & Chat Sync

**Goal:** Multi-student chat and presence via Supabase Realtime (or WS).

**Subtasks**
- [ ] Session registry backend (DynamoDB table + env wiring).
- [ ] Session create/join API (persist codes, participants, expiry).
- [ ] Client join flow integration (validate codes, hydrate session store).
- [ ] Presence (who’s online, typing).
- [ ] Chat streams (pub/sub room per session).
- [ ] Turn metadata broadcast (who Meno is addressing).
- [ ] Latency instrumentation.

**Files**
- (A) `lib/realtime/client.ts`
- (A) `lib/realtime/events.ts`
- (M) `lib/store/session.ts` — presence state
- (M) `components/ChatPane/ChatPane.tsx` — stream messages in real time

---

## PR-09: Whiteboard (tldraw) + CRDT

**Goal:** Shared canvas with drawing tools; CRDT-based sync.

**Subtasks**
- [ ] Add tldraw canvas with minimal toolset (pen, eraser, shapes, color picker).
- [x] Split chat/whiteboard layout on `/chat` page.
- [ ] Share identity colors/cursors with presence participants.
- [x] Stand up y-websocket service (dev + prod) and wire client URL env.
- [x] Sync scene via Yjs provider (auto-save + reconnection).
- [x] Persist whiteboard document per session (DynamoDB snapshot + load).
- [ ] Export full-scene PNG download.

**Files**
- (A) `components/Whiteboard/Whiteboard.tsx`
- (A) `lib/whiteboard/yjsProvider.ts`
- (A) `lib/whiteboard/tools.ts`
- (A) `services/yjs-websocket/server.js` (y-websocket host)
- (A) `lib/whiteboard/persistence.ts`
- (M) `app/page.tsx` — layout split (chat + board)
- (M) `src/env.ts` — whiteboard env vars

---

## PR-10: Companion Mode (Tablet Pairing)

**Goal:** Pair a tablet as a dedicated drawing surface for the current student.

**Subtasks**
- [ ] `/pair` route with QR and code entry.
- [ ] Short-lived pairing token (JWT).
- [ ] Mirror identity and throttle tools if muted.
- [ ] Local stroke buffering for offline and rejoin.

**Files**
- (A) `app/pair/page.tsx`
- (A) `components/Pairing/QrPanel.tsx`
- (A) `pages/api/pair.ts` — token mint/verify
- (A) `lib/pair/jwt.ts`
- (M) `components/Whiteboard/Whiteboard.tsx` — accept paired device input

---

## PR-10d: Realtime Channel via API Gateway WebSockets

**Goal:** Move chat, presence, and lease control onto an AWS API Gateway WebSocket backed by Lambda + DynamoDB, replacing the in-process Next.js sockets.

**Subtasks**
- [x] Lock down websocket message schema (chat, presence, control) and connection metadata contract.
- [x] Provision infrastructure (API Gateway WebSocket, Lambda handlers, DynamoDB tables) via CDK/CloudFormation.
- [x] Implement Lambda `$connect` / `$disconnect` / route handlers (persist connection, chat messages, presence, leases).
- [x] Broadcast events using API Gateway Management API; handle stale connections.
- [x] Expose REST hydrators (chat history, presence snapshot, lease state) for new clients.
- [x] Wire web + tablet clients to hydrate from `/api/realtime/session/[sessionId]` and clear legacy state on join.
- [x] Switch web + tablet clients to broadcast/consume realtime actions (`chat.send`, `presence.update`, `control.lease.*`) end-to-end; drop deprecated `/api/chat` websocket usage.
- [x] Remove Next.js chat/presence websocket routes and legacy client code once the new path is stable.
- [ ] Document environment variables / deployment steps for the new realtime channel (web + tablet).

**Files**
- (A) `infrastructure/realtime/*` — CDK/SAM templates + lambda source
- (A) `lambda/realtime/*` — handler logic (chat, presence, control)
- (M) `src/lib/chat/client.ts`, `src/lib/presence/client.ts`, `src/lib/store/session.ts` — AWS WebSocket integration
- (M) `src/components/ChatPane/ChatPane.tsx`, `src/components/Presence/*` — payload handling
- (M) `src/components/session/SessionJoinFlow.tsx` — hydrate + reset logic
- (M) `docs/PR_10_Tablet.md`, `docs/Meno_Roadmap_PRs.md` — updated architecture notes

---

## PR-10e.1: Handwriting Solver Integration (Step Checks)

**Goal:** Translate each submitted line into structured math, validate it, and display immediate feedback.

**Subtasks**
- [x] Capture the highlighted band to an off-screen canvas and include the cropped PNG with `lines/:stepIndex/submit`.
- [ ] Add `/api/solver/line` endpoint that forwards snapshots to handwriting OCR (e.g., Mathpix) and normalizes expressions for the solver.
- [ ] Persist solver outcomes with `SessionLineAttempt` (expression, correctness, usefulness, confidence).
- [ ] Update web host UI to show success/failure states, trigger hints, and auto-advance highlight on success.
- [ ] Mirror the feedback flow on the tablet client (toast/overlay, retry path).
- [ ] Tests: OCR golden set, solver regression on decoded expressions, UI states for pass/fail.

**Files**
- (M) `meno-web/src/components/Whiteboard/*`, `lib/api/lease.ts`, `lib/store/session.ts`
- (A) `meno-web/src/app/api/solver/line/route.ts`
- (M) `docs/PR_10_Tablet.md`
- (M) `meno-companion/` submit handlers (tablet parity)

---

## PR-11: Voice Input (STT) — WebRTC Uplink

**Goal:** Students speak; streaming STT returns partials with timestamps + diarization.

**Subtasks**
- [ ] Mic permission + push-to-talk control.
- [ ] WebRTC stream to `/api/stt-stream`.
- [ ] Whisper streaming integration; partial and final transcripts.
- [ ] Per-student diarization and caption bubbles.

**Files**
- (A) `components/Voice/PushToTalk.tsx`
- (A) `components/Voice/CaptionBubble.tsx`
- (A) `pages/api/stt-stream.ts`
- (A) `lib/voice/webrtc.ts`, `lib/voice/vad.ts`
- (M) `lib/types/chat.ts` — add `source: 'voice'|'chat'`

---

## PR-12: Meno Voice (TTS) + Captions

**Goal:** Meno speaks with synchronized captions and audio ducking on interruption.

**Subtasks**
- [ ] TTS provider integration (viseme/phoneme timing).
- [ ] Global caption row; word/phrase highlight.
- [ ] Auto-ducking when a student speaks; resume on pause.
- [ ] Settings for rate/pitch/voice.

**Files**
- (A) `components/Voice/MenoSpeaker.tsx`
- (A) `components/Voice/Captions.tsx`
- (A) `pages/api/tts.ts`
- (M) `lib/meno/dialogue.ts` — emit TTS + caption payloads

---

## PR-13: Interruption Handling & Focus Lock

**Goal:** Allow clarifying interjections without chaos; resume plan cleanly.

**Subtasks**
- [ ] Interruption queue (“parking lot”).
- [ ] Short clarify responses; auto-resume previous step.
- [ ] Focus Lock after 3 consecutive interrupts with banner UX.
- [ ] Teacher override to drain queue.

**Files**
- (A) `lib/meno/interrupts.ts`
- (M) `lib/meno/dialogue.ts` — integrate queue
- (M) `components/ChatPane/ChatPane.tsx` — UI for Focus Lock + queued items

---

## PR-14: Aporia Detection & Humor Guard (Context-Relevant)

**Goal:** Detect constructive confusion; deliver context-relevant humor sparingly.

**Subtasks**
- [ ] Aporia signals: contradictions, hedging, long pauses.
- [ ] Mode shift: reframe with simpler analogy or visual.
- [ ] Humor filter: age/tone-aware; ≤1 per 5–7 turns; session opt-out.
- [ ] Telemetry: aporia flags, humor frequency.

**Files**
- (A) `lib/meno/aporia.ts`
- (A) `lib/meno/humor.ts`
- (M) `lib/meno/dialogue.ts`
- (M) `components/ChatPane/Message.tsx` — display mode tags

---

## PR-15: Analytics, Telemetry, and Error Reporting

**Goal:** Observe performance (latency, jitter), learning signals, and failures.

**Subtasks**
- [ ] Mixpanel events: session_start, hint_used, aporia_flag, voice_toggle.
- [ ] OpenTelemetry traces: STT partial latency, WS jitter, CRDT ops.
- [ ] Sentry for FE/BE errors.
- [ ] Dashboard starter for classroom pilots.

**Files**
- (A) `lib/analytics/mixpanel.ts`
- (A) `lib/analytics/otel.ts`
- (A) `lib/analytics/sentry.ts`
- (M) `app/layout.tsx` — init providers
- (M) `pages/api/*` — wrap handlers with tracing

---

## PR-16: Accessibility & UX Polish

**Goal:** WCAG AA compliance and ergonomic defaults.

**Subtasks**
- [ ] Keyboard PTT, captions scaling, high-contrast theme.
- [ ] Screen reader labels for tools and status.
- [ ] Reduce motion setting; prefers-reduced-motion handling.
- [ ] Auditory/visual cues for addressed student.

**Files**
- (M) `components/Voice/PushToTalk.tsx` — keyboard shortcuts + ARIA
- (M) `components/Voice/Captions.tsx` — scaling controls
- (M) `components/Whiteboard/Whiteboard.tsx` — labels + focus rings
- (M) `styles/globals.css` — contrast tokens

---

## PR-17: Documentation, Demo, and Release

**Goal:** Ship v1.0 with a 5-minute demo and clear setup docs.

**Subtasks**
- [ ] README quick-start, env var table, and troubleshooting.
- [ ] Demo script: 2x+5 problem, voice, captions, Companion.
- [ ] Record and link demo video.
- [ ] Changelog and version tag.

**Files**
- (M) `README.md`
- (A) `docs/demo_script.md`
- (A) `docs/changelog.md`
- (A) `public/examples/eq_2x_plus_5.png`

---

### Notes
- Use feature flags to progressively enable Voice and Companion during QA.
- Keep audio opt-in and caption fallback always available.
- Maintain consistency with the **Hidden Solution Plan** as the source of truth for dialogue sequencing.
