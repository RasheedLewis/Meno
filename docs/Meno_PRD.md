# Product Requirements Document (PRD)
## Meno: The Classical Socratic Math Tutor

### 1. Overview
**Meno** is an AI-powered Socratic math tutor inspired by Plato’s *Meno* — a dialogue exploring how knowledge is recalled through questioning. This system guides students to discover mathematical truths rather than receive them, combining classical pedagogy with modern multimodal AI.

### 2. Objective
To build an AI tutor that guides students through math problems using **Socratic dialogue**, **real-time collaboration**, and **multimodal communication** (voice + chat + whiteboard).

### 3. Success Criteria
- Guides students through **5+ problem types** without giving direct answers.
- Maintains conversational context and supports **multi-turn reasoning**.
- Adapts to student understanding and tone.
- Supports **1–4 students** in real-time collaboration.
- Offers **voice and captioned dialogue** for accessibility and engagement.

## 4. Brand Philosophy
**Meno** draws its name from Plato’s dialogue, where Socrates leads Meno from confusion (*aporia*) to understanding. The product mirrors this method — transforming confusion into clarity through guided discovery.

**Core Ethos**
- **Guidance over answers**
- **Clarity over complexity**
- **Humanistic AI**
- **Timeless learning**

**Aesthetic Direction**
- Parchment-white background, navy/black text, Garamond or Georgia.
- Subtle classical motifs (laurel, compass, Ionic).
- Encouraging, calm tone.

**Taglines**
- “Guided by Questions.”
- “Learning through Dialogue.”
- “The Socratic Tutor for Mathematics.”

## 5. Collaborative Session Layout
**Mode:** 1–4 students per session, guided by a single AI tutor.

**Layout**
- **Top Center:** Meno (AI tutor)
- **Corners:** Student avatars (local student bottom-right)
- **Center:** Shared whiteboard
- **Bottom:** Toolbar (pen, shapes, color, equations)

**Flow**
1. Meno presents a problem.
2. Students respond via voice/chat.
3. Guided questioning sequence.
4. Annotated reasoning.
5. Meno summarizes.

## 6. System Architecture and Synchronization
- **Frontend:** React / Next.js
- **Collaboration Layer:** Supabase Realtime or Yjs
- **AI Layer:** OpenAI Assistants API
- **Math Engine:** SymPy, KaTeX, OCR (MathPix)
- **Latency target:** ≤150 ms

## 7. Platform and Deployment
**Platform:** Web (React + Next.js)
**Stack:** React + Tailwind + Supabase + Node.js
**Devices:** Desktop, tablet (Companion Mode), mobile (view-only).

## 8. Companion Mode (Tablet)
Dedicated tablet UI for drawing and writing on shared board.
- Canvas-first UI, QR pairing, low latency.
- Tokens expire 2–5 minutes.
- Works single or multi-student.
- Optional view-only.

## 9. Multimodal Communication: Voice + Captions
Meno speaks and displays synchronized captions; students respond by voice or chat.

**Architecture**
- WebRTC + Whisper (STT) + Neural TTS.
- Word-timed captions.
- Push-to-talk and chat toggle.
- Humor context-aware.
- Voice consent dialog; opt-in audio storage.

## 10. Hidden Solution Plan (HSP)
Hidden plan for each problem guiding Meno’s questioning.

**Structure**
- Multi-step, tagged with concept, prompt, check, hints.
- Adaptive to student level.

**Sample**
```json
{"problem_id":"eq-2x-plus-5","steps":[{"statement":"Subtract 5 from both sides.","concept":"inverse operations","prompt":"Which should we undo first, +5 or ×2—and why?","check":"lhs=='2x' && rhs==8"}]}
```

## 11. Meno Questioning Guidelines
**Principles**
- Concise, interruptible, collaborative.
- Imaginative, logical, occasionally witty.
- Focus on assumptions, implications, and clarity.

**Types**
| Type | Function | Example |
|------|-----------|----------|
| Definitional | Clarify meaning | “What does isolating x mean?” |
| Analytical | Examine structure | “What connects these two terms?” |
| Proportional | Explore relations | “If this doubles, what happens there?” |
| Spectral | Consider extremes | “What if this were zero?” |
| Evaluative | Reasoned judgment | “Is this approach consistent with our goal?” |

**Pedagogical Arc:** Curiosity → Exploration → Aporia → Illumination → Recap.

## 12. Dialogue Engine Design
**Pipeline**
1. Intent Parsing
2. Question Selector
3. Response Evaluation
4. Aporia Detection
5. Interruption Handling
6. Humor Layer
7. Recap

**Tools**
| Area | Tools |
|-------|-------|
| LLM | OpenAI Assistants API |
| NLP | spaCy / fastText |
| Math | SymPy |
| Voice | Whisper + Neural TTS |
| Sync | WebRTC + Yjs |
| Analytics | Mixpanel + OpenTelemetry |

**Aporia Mode**
- Encourages confusion as insight.
- Positive reinforcement.
- Simplified reframing questions.

## 13. Technical Implementation Roadmap
| Phase | Timeline | Deliverables |
|--------|-----------|--------------|
| 1 | Weeks 1–2 | Chat + OCR + KaTeX |
| 2 | Weeks 3–4 | HSP + validation |
| 3 | Weeks 4–5 | Collaboration + Companion |
| 4 | Weeks 6–7 | Voice + captions |
| 5 | Weeks 8–9 | Aporia + humor logic |
| 6 | Weeks 10–11 | QA + launch |

## 14. Evaluation Criteria
| Category | Weight | Description |
|-----------|---------|-------------|
| Pedagogy | 35% | Socratic depth |
| Technical | 30% | Stable sync, low latency |
| UX | 20% | Clear, inclusive |
| Innovation | 15% | Humor + aporia detection |

## 15. Appendices
### A. Build-Ready Integrations
- Next.js, Supabase, Yjs, tldraw, Whisper, OpenAI, SymPy, Mixpanel, RNNoise.
### B. npm Set
```bash
npm i next react react-dom typescript yjs @tldraw/tldraw supabase-js openai sympy mixpanel-browser
```
### C. Implementation Notes
- Humor relevance filter.
- CRDT batching.
- Focus Lock interruptions.
- Caption fallback active.
- QR pairing expiration.

### D. Engineer Quick-Start / README
```bash
git clone meno
npm install
cp .env.example .env.local
npx supabase start
npm run dev
```
**Happy Path:** “Solve 2x + 5 = 13.” → Meno: “What are we trying to find?” → Student: “x.”

**Checklist**
- Latency ≤150ms
- Voice RTT ≤1s
- Accessibility ≥95% WCAG AA

---
**Summary:**  
Meno unites classical philosophy and modern AI. It teaches not by giving answers but by provoking thought, turning *aporia* into understanding through dialogue, humor, and collaboration.
