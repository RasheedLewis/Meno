# Meno Web

The web experience for **Meno**, a Socratic math tutor. This Next.js app delivers the instructor console, chat pane, whiteboard, and companion interactions described in the product roadmap.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS (via `tailwindcss` 4 preview)
- Zustand for UI/session state
- Zod-based environment validation (`src/env.ts`)

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

The dev server runs at [http://localhost:3000](http://localhost:3000). The `/ui` route previews all core UI primitives and the Zustand stores.

## Environment Variables

Environment variables are validated at runtime by `src/env.ts`. Missing or malformed values will throw during boot.

| Variable | Scope | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server | LLM orchestration (Hidden Solution Plan + Dialogue) |
| `MATHPIX_APP_ID` / `MATHPIX_APP_KEY` | Server | OCR provider credentials for problem ingestion |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Server-side Supabase operations (presence, transcripts) |
| `AWS_REGION` | Server | AWS region for HSP DynamoDB persistence |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Server | AWS credentials (omit if using instance roles) |
| `HSP_TABLE_NAME` | Server | DynamoDB table for hidden solution plans |
| `DIALOGUE_TABLE_NAME` | Server | DynamoDB table for dialogue state & step progress |
| `PRESENCE_TABLE_NAME` | Server | DynamoDB table for presence + typing indicators |
| `CHAT_TABLE_NAME` | Server | DynamoDB table for chat transcripts |
| `SESSION_TABLE_NAME` | Server | DynamoDB table for session registry |
| `WHITEBOARD_TABLE_NAME` | Server | DynamoDB table storing per-session whiteboard snapshots |
| `SYMPY_SERVICE_URL` | Server | URL for the SymPy validation microservice |
| `YJS_WEBSOCKET_URL` | Server | Optional; absolute URL for the production Yjs websocket bridge |
| `NEXT_PUBLIC_APP_URL` | Client | Base URL used for links and share targets |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase project URL for realtime/presence |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Public anon key for Supabase client |
| `NEXT_PUBLIC_YJS_WEBSOCKET_URL` | Client | Websocket endpoint the browser should use for whiteboard sync |

> Copy `.env.example` → `.env.local` and update values per environment. Optional variables can remain blank during early development; validation only enforces format when provided.
> DynamoDB: create the table referenced by `HSP_TABLE_NAME` with a partition key `planId` (string).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint over the codebase |
| `npm run yjs:dev` | Launch the local Yjs websocket bridge on `ws://localhost:1234/yjs` |

## Project Structure

```
src/
├─ app/          # App Router routes (layout, pages, UI showcase, etc.)
├─ components/   # Reusable UI primitives and system helpers
├─ lib/
│  ├─ store/     # Zustand stores for UI + session state
│  └─ ...        # Upcoming dialogue + realtime libraries
└─ env.ts        # Runtime environment validation
```

## Next Steps

- Flesh out the chat pane and problem ingestion workflows (PR-02 / PR-03).
- Wire OCR, HSP, and dialogue services to the validated env keys.
- Expand tests and add Playwright flows once UI primitives stabilize.
