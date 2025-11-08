# PR-10: Companion Mode (Web + Tablet + Server)

## Objective

Enable a shared real-time handwriting workspace between the **web app** (host/teacher) and the **tablet app** (student companion). Both canvases stay synchronized via **Yjs** and server signals for solver results, hints, and leasing.

---

## Architecture Overview

| Layer           | Responsibility                                     | Tech                 |
| --------------- | -------------------------------------------------- | -------------------- |
| Shared CRDT     | Strokes, erases, awareness                         | **Yjs**              |
| Control channel | Leases, checks, hints                              | WebSocket (non-CRDT) |
| Storage         | Persisted attempts, problem specs, thumbnails      | Supabase / Firestore |
| Solver          | Line checking (CameraMath → fallback WolframAlpha) | Server API           |
| Auth            | Join tokens, roles (host, companion, teacher)      | JWT                  |

---

## Implementation Sequence

### PR-10a — Yjs Infrastructure

**Goal:** Establish real-time collaborative document layer.

- [x] Add **y-websocket** service behind BFF (`/yws/:sessionId`).
- [ ] Implement JWT-guarded session join (roles: host, companion, teacher).
- [x] Create shared `Y.Doc` schema:

  ```ts
  Y.Doc {
    steps: Y.Array<Y.Subdoc>,
    sessionMeta: Y.Map,
    events: Y.Array,
  }
  ```
- Each step subdoc: `strokes`, `ops`, `meta`.
- [x] Add **awareness** support (tool, color, lane, role).
- [x] Local persistence:

  * Web: `y-indexeddb`
  * Tablet: custom `y-asyncstorage` adapter
- [ ] **Tests:** multi-client consistency, awareness presence, reconnect replay.

---

### PR-10b — Shared Canvas Layer

**Goal:** Both platforms render Yjs strokes with conflict-free updates.

- [x] Implement `useYCanvas()` hook for both platforms.
- [x] Integrate with Skia renderer (tablet) and `<Canvas>` (web).
- [x] Add stroke batching (`Y.transact` every 16 points).
- [x] Add erase op + GC (squash into thumbnail).
- [x] Awareness cursors & color indicators.
- [ ] **Tests:** frame latency < 20 ms, undo/redo fidelity, cross-client draw parity.

---

### PR-10c — Session Join & Presence

**Goal:** Let tablet join a web session.

* Host can **create session** (`/sessions/new`).
* Host shows QR with join token.
* Tablet scans → deep-link `meno://join?sid=<sessionId>&jt=<JWT>`.
* WebSocket auto-joins Yjs doc + control stream.
* Presence list shows avatars, latency, tool state.
* **Tests:** token TTLs, reconnect flow, expired session rejection.

---

### PR-10d — Lease & Control Channel

**Goal:** Enforce single active line authority.

* Server maintains `activeLine` map `{stepIndex, leaseTo}`.
* Tablet must hold lease to submit.
* Host can “Take Lease”.
* Control messages (non-CRDT):

  ```
  control.state
  lease.grant|release
  line.submit
  check.result
  hint.update
  ```
* **Tests:** race conditions, lease expiry, reconnect recovery.

---

### PR-10e — Solver Integration

**Goal:** Full correctness/usefulness pipeline shared between clients.

* Tablet → `line.submit` → upload raster.
* Server → CameraMath → broadcast `check.result`.
* Add local fallback mathjs (for numeric quick checks).
* Server stores outcomes under attempt.
* **Tests:** latency budget (<1.2 s), deterministic outcomes, vendor failover.

---

### PR-10f — Hint FSM Synchronization

**Goal:** Centralized, teacher-safe hint logic.

* Host runs finite-state machine: concept → directional → micro-step.
* Tablet triggers `hint.request`.
* Server/Host advances state and emits `hint.update`.
* Tablet and web render hints identically (toast + speech).
* **Tests:** FSM state transitions, cooldowns, accessibility (voice ≤ 3 s).

---

### PR-10g — Teacher Write-Through

**Goal:** Let teacher annotate directly on student canvas.

* Teacher joins session with elevated JWT.
* Teacher strokes tagged `origin:"teacher"`.
* Render dashed/ghosted style on tablet.
* Host toggle: “Include teacher ink in checks”.
* **Tests:** multi-origin rendering, raster inclusion/exclusion correctness.

---

### PR-10h — Cross-Device Storage & Replay

**Goal:** Persist synced attempts.

* Each attempt = `{problemId, steps[], outcomes[]}`.
* Save Yjs snapshot + thumbnails to cloud.
* Host and tablet can replay identical session.
* **Tests:** replay determinism, missing step recovery, thumbnail sync.

---

### PR-10i — UI Polish & QA

**Goal:** Seamless user experience across roles.

* Companion mode banner (Linked to Host X).
* Sync indicators (✅ connected / ⚠️ lagging / 🔴 offline).
* Host dashboard: lease status, live thumbnails.
* Tutorial overlay explaining roles.
* **Tests:** UX flows, orientation handling, session leave/rejoin.

---

### PR-10j — Performance & Telemetry

**Goal:** Validate scalability and latency.

* Add metrics:

  * Stroke RTT
  * Solver response time
  * Hint latency
* Optimize batch size, GC intervals.
* Record anonymized event metrics.
* **Tests:** 2-device 60 fps stress test, 30 min soak (no drift), offline replay.

---

## Deliverables

| Artifact                  | Description                  |
| ------------------------- | ---------------------------- |
| `protocol.y.ts`           | Shared schema definitions    |
| `useYCanvas()`            | Hook for Yjs canvas sync     |
| `y-websocket` service     | Server with JWT auth         |
| `LeaseController`         | Server control layer         |
| `SolverAdapter`           | CameraMath + fallback        |
| `HintFSM`                 | Host-side escalation engine  |
| `CompanionJoinScreen.tsx` | Tablet join view             |
| `HostDashboard.tsx`       | Web host controls            |
| Integration tests         | Web+Tablet consistency suite |

---

## Definition of Done

✅ Tablet joins session via QR
✅ Shared ink syncs within < 80 ms
✅ Solver & hint results broadcast in real-time
✅ Active line lease prevents conflicts
✅ Teacher annotations visible on both sides
✅ Attempts persisted and replayable
✅ Offline resilience verified
