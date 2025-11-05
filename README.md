Meno — Socratic Math Tutor
==========================

Meno is an AI-powered math tutor inspired by Plato’s *Meno*. It guides 1–4 learners through problems using Socratic dialogue, multimodal collaboration, and a hidden solution plan that keeps the conversation purposeful.

## Highlights

- Socratic chat that adapts to each student’s intent, tone, and progress.
- Hidden Solution Plan (HSP) service that pre-computes structured steps, hints, and validation checks.
- Multimodal collaboration: shared whiteboard, real-time presence, voice input/output with captions.
- Safety rails for aporia detection, humor relevance, and interruption management.
- Analytics and telemetry hooks for classroom pilots.

## System Architecture

- **Frontend:** Next.js (App Router) with TypeScript, Tailwind, Zustand state.
- **Dialogue Engine:** Orchestrates HSP-driven questioning, aporia detection, humor, and recap logic.
- **Realtime Layer:** Supabase Realtime / WebSocket + Yjs for chat, presence, and CRDT-based whiteboard sync.
- **AI Services:** OpenAI Assistants API for dialogue + planning, MathPix / Vision OCR, Whisper STT, neural TTS.
- **Math & Validation:** SymPy microservice for symbolic checks, KaTeX renderer for crisp math output.
- **Telemetry:** Mixpanel, OpenTelemetry, and Sentry integrations (planned) for insight and reliability.

## Getting Started (Planned Scaffold)

```bash
git clone meno
cd meno
npm install
cp .env.example .env.local
npx supabase start
npm run dev
```

### Environment Variables

See `meno-web/.env.example` for API keys and service configuration. Key variables include:

- `OPENAI_API_KEY`
- `MATHPIX_APP_ID` / `MATHPIX_APP_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- `HSP_TABLE_NAME`
- `DIALOGUE_TABLE_NAME`
- `PRESENCE_TABLE_NAME`
- `SYMPY_SERVICE_URL`
- `NEXT_PUBLIC_APP_URL`
- `