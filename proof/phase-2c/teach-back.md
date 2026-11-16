# SyncPod Phase 2C: Teach-Back & Architectural Review Answers

Documenting the official technical reviewer responses to the architectural questions raised during the Phase 2C closeout audit, including the explicit correction of mistaken premises in Questions 1 and 2.

---

## 1. Questions & Verbatim Reviewer Answers

### Q1: Realtime Timer Architecture & Distributed Split-Brain Risks
> *Original Question:* When scaling the real-time backend from the deterministic in-memory FakeWorldStore to the multi-node Redis/Postgres infrastructure planned for Phase 3/4, what distributed locking and serialization mechanism will guarantee that an abrupt client disconnect during a sprint transition cannot leave the authoritative timer in an unrecoverable split-brain state?

**REVIEWER ANSWER (VERBATIM):**
Premise wrong: the design is a single realtime instance with in-memory pod state persisted to Postgres at each transition (PRD section 7); no Redis, no multi-node. The server stores phaseEndsAt, never a countdown; clients compute remaining = phaseEndsAt - (Date.now() + offset). A disconnect changes only presence and focusedSec, never the timer, so split-brain is structurally impossible. Real risks: async transition handlers interleaving (fix: per-pod mutex) and two server processes running (fix: pg_try_advisory_lock at boot). Open gap now tracked in Phase 4: recovery when phaseEndsAt is already past after a restart.

---

### Q2: Drawer Focus Trap & Dynamic Streaming DOM Updates
> *Original Question:* In CockpitShell.tsx, how does the current responsive drawer focus trap behave if an assistive technology user dynamically navigates between the mobile tab list (pod vs notes vs queue) while a high-frequency Socratic streaming event updates the DOM?

**REVIEWER ANSWER (VERBATIM):**
Premise wrong: B9 is non-streaming; socratic:result arrives once. getFocusableElements re-queries focusables on every Tab, so new DOM is covered. Remaining weakness: the trap relies on keydown only; the background is not inert, so screen-reader virtual-cursor navigation can leave the drawer. Tracked in Phase 9.

---

### Q3: Runtime Defenses for Forced Colors & System Accessibility Modes
> *Original Question:* Given that measure-contrast.mjs validates static token-pair ratios at build time, what runtime defenses prevent contrast degradation when users enable native browser high-contrast mode, forced colors, or custom operating system accessibility zoom factors?

**REVIEWER ANSWER (VERBATIM):**
No runtime defense exists. grep forced-colors is empty. measure-contrast.mjs checks static token pairs only. SVG strokes driven by CSS variables may vanish in forced-colors mode. Tracked in Phase 9.

---

## 2. Tracking in Roadmap (Docs/PHASES_3-9.md)

1. **Phase 4 Addition (a):** Server restart recovery rule for expired `phaseEndsAt`.
2. **Phase 4 Addition (b):** Per-pod async mutex to prevent transition handler interleaving.
3. **Phase 4 Addition (c):** Single-instance guard with `pg_try_advisory_lock`.
4. **Phase 9 Addition (a):** `@media (forced-colors: active)` fallback for PodRing arcs and seat dots (`CanvasText`/`Highlight`).
5. **Phase 9 Addition (b):** Inert page background while the drawer is open.
6. **Phase 9 Addition (c):** Real Axe / Lighthouse automated accessibility runs on dynamic interactive states.
