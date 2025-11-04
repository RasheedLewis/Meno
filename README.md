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
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Roadmap

The implementation roadmap is expressed as pull requests with detailed file plans and subtasks. Key phases include:

1. **Core Scaffold:** Next.js app layout, design system, Zustand stores.
2. **Chat Foundations:** Message model, session state, OCR ingestion, KaTeX rendering.
3. **Reasoning Services:** Hidden Solution Plan API, dialogue manager, validation engine.
4. **Collaboration Suite:** Presence, chat sync, shared whiteboard, tablet companion.
5. **Voice & Accessibility:** STT uplink, TTS playback, captions, accessibility polish.
6. **Delight & QA:** Aporia detection, contextual humor, analytics, release prep.

For the complete breakdown, see `docs/Meno_Roadmap_PRs.md`.

## Key Documents

- `docs/Meno_PRD.md` — Product requirements, brand philosophy, success criteria.
- `docs/dialog_engine.md` — Dialogue engine pipeline, aporia handling, humor safeguards.
- `docs/Meno_Roadmap_PRs.md` — Step-by-step technical roadmap organized as PRs.

## Project Structure (Expected)

```
meno/
├─ meno-web/           # Next.js app (App Router) for tutor experience
│  ├─ src/app/         # Routes, layout, UI showcase
│  ├─ src/components/  # Design system, system helpers
│  ├─ src/lib/         # Zustand stores & forthcoming services
│  └─ src/env.ts       # Environment schema (zod)
└─ docs/               # Product docs and demos
```

## Contributing

1. Review the PR roadmap to identify the feature you plan to implement.
2. Align with the Socratic ethos: guidance over answers, clarity over complexity.
3. Maintain accessibility and latency targets (≤150 ms UI latency, ≤1 s voice RTT).
4. Add tests, instrumentation, and documentation alongside feature work.

## License

License to be determined. Please add one before external distribution.


