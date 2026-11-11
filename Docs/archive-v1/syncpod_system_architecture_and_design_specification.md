# SyncPod Design System & Technical Architecture Specification
**Synthesized from:** UI/UX Pro Max & Anthropic Frontend Design Framework  
**Theme Identity:** Modern Technical / Focused Academic Cockpit  
**Target Platform:** Next.js 14+ App Router, Tailwind CSS, TypeScript, Socket.IO  

---

## 1. Design System & Token Mapping

### 1.1 Design Dials Configuration
* **Density Dial (6.5 / 10 - Balanced Product Cockpit):**
  * Section spacing: `--space-section: clamp(2rem, 4vw, 3.5rem)`
  * Card padding: `--space-card: 1.25rem`
  * Grid gaps: `--space-gap: 1rem`
  * Table/Queue padding: Compact vertical `0.625rem`, spacious horizontal `1rem`.
* **Motion Dial (5.0 / 10 - Purposeful Micro-Interactions):**
  * Transitions: `200ms cubic-bezier(0.16, 1, 0.3, 1)` untuk state hover tombol, card elevation, dan pill toggles.
  * Staggered load: `@keyframes fadeUp` (`14px` delta) dengan `delay: calc(var(--stagger, 0) * 50ms)`.
  * Timer pulse: Glow halus saat 60 detik terakhir sprint.

### 1.2 Typography Hierarchy
Import via Google Fonts: `Bricolage Grotesque` (Headings) + `Plus Jakarta Sans` (Body UI) + `JetBrains Mono` (Code & Timers).

```css
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

:root {
  --font-display: 'Bricolage Grotesque', sans-serif;
  --font-body: 'Plus Jakarta Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

* **Rules:** Seluruh angka timer countdown, statistik sesi, dan timestamp wajib menggunakan `font-mono` dengan CSS `font-variant-numeric: tabular-nums` agar layout tidak bergetar (*anti-jitter*).

### 1.3 Semantic Color Tokens (Crisp Technical Dark/Light)

```css
:root {
  /* Surface Tokens (Clean Crisp Dark Base) */
  --bg-canvas: #090D16;          /* Deep Void */
  --bg-surface: #0F172A;         /* Primary Card Surface */
  --bg-surface-elevated: #1E293B;/* Modal / Hover Surface */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-active: rgba(56, 189, 248, 0.3);

  /* Brand & Status Accents */
  --color-primary: #38BDF8;      /* Electric Sky (Focus Accent) */
  --color-primary-hover: #0EA5E9;
  --color-accent-amber: #F59E0B; /* Break State / Pomodoro Alert */
  --color-accent-emerald: #10B981;/* Active Presence / Completed Task */
  --color-accent-purple: #A855F7;/* Google Gemini Socratic AI badge */

  /* Text Contrast */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
}
```

---

## 2. Core UI Layout & Screen Architectures

### 2.1 View A: Matchmaking & Bottleneck Selector (Pre-Sprint)
* **Hero Banner:** Status aktif kampus ("28 students currently sprinting").
* **Step 1: Course & Module Picker:** Hierarchical pills (`Informatika` -> `Struktur Data` -> `Graph Traversal & Dijkstra`).
* **Step 2: Availability Window:** Quick toggle chips (`Now (25m)`, `Next 1 Hour`, `Custom`).
* **Match Radar Card:** Animated pulsing ring showing matching progress ("Matching with peers studying Graph Algorithms... 3/4 found").

### 2.2 View B: The Sprint Cockpit (Three-Column Split Layout)
Tampilan layar utama saat sesi berlangsung:

```
+---------------------------------------------------------------------------------------+
|  SyncPod Header: [CS201: Graph Algorithms]  |  Pod #042  |  [Leave Sprint]           |
+----------------------+----------------------------------------+-----------------------+
| LEFT PANEL (25%)     | CENTER WORKSPACE (50%)                 | RIGHT COPILOT (25%)   |
|                      |                                        |                       |
| [ SYNCED TIMER ]     | [ SHARED SCRATCHPAD ]                  | [ GEMINI SOCRATIC ]   |
|     24:18            | # Session Goals                        | "How would you model  |
|   FOCUS SPRINT 1     | - Implement priority queue             | edges with negative   |
| [||] Pause  [>] Skip | - Compare Dijkstra vs Bellman-Ford     | weights?"             |
|                      |                                        |                       |
| [ POD MEMBERS ]      | ```cpp                                 | [Ask Socratic Guide]  |
| * Rizqi (ITATS) [Mic]| struct Node { int v, w; };             | (Input prompt...)     |
| * Rifqi (ITATS) [Typ]| ```                                    |                       |
| * Farhan (ITATS)     |                                        | [ QUESTION QUEUE ]    |
| * Rivan (ITATS)      | [Markdown Auto-saved to Cloud]         | Q1: Relaxing logic    |
+----------------------+----------------------------------------+-----------------------+
```

---

## 3. Technical Architecture & Database Schema

### 3.1 High-Level Architecture Diagram
```
[ Browser Clients (Next.js 14) ]
             |
             +---- HTTP/REST & Server Actions ----> [ Next.js API Routes / NestJS ]
             |                                             |
             +---- WebSocket (ws://) -------------> [ Socket.IO Gateway ]
                                                           |
                                         +-----------------+-----------------+
                                         |                                   |
                                [ PostgreSQL (Prisma) ]             [ Google Gemini API ]
                                (Users, Pods, Courses)           (Contextual Socratic AI)
```

### 3.2 Database Schema (Prisma ORM Format)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id             String         @id @default(cuid())
  email          String         @unique
  name           String
  university     String         @default("Institut Teknologi Adhi Tama Surabaya")
  karmaScore     Int            @default(100)
  createdAt      DateTime       @default(now())
  podMemberships PodMember[]
}

model CourseTopic {
  id           String      @id @default(cuid())
  code         String      // e.g. "IF204"
  title        String      // e.g. "Struktur Data & Algoritma"
  moduleName   String      // e.g. "Graph Traversal & Shortest Path"
  sprintPods   SprintPod[]
}

model SprintPod {
  id           String        @id @default(cuid())
  topicId      String
  topic        CourseTopic   @relation(fields: [topicId], references: [id])
  status       PodStatus     @default(MATCHING) // MATCHING, ACTIVE_SPRINT, BREAK, COMPLETED
  currentTimer Int           @default(1500)     // in seconds (25 mins)
  isTimerRunning Boolean     @default(false)
  sharedNotes  String        @db.Text @default("")
  createdAt    DateTime      @default(now())
  members      PodMember[]
  questions    Question[]
}

model PodMember {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  podId     String
  pod       SprintPod @relation(fields: [podId], references: [id])
  role      String    @default("MEMBER") // LEADER, MEMBER
  joinedAt  DateTime  @default(now())

  @@unique([userId, podId])
}

model Question {
  id        String    @id @default(cuid())
  podId     String
  pod       SprintPod @relation(fields: [podId], references: [id])
  authorName String
  query     String
  aiHint    String?   @db.Text
  isResolved Boolean   @default(false)
  createdAt DateTime  @default(now())
}

enum PodStatus {
  MATCHING
  ACTIVE_SPRINT
  BREAK
  COMPLETED
}
```

### 3.3 Real-Time WebSocket Event Contract (Socket.IO)

* `client -> pod:join` : `{ podId, userId }` -> Mengaitkan soket ke room pod spesifik.
* `server -> timer:tick` : `{ remainingSeconds, status }` -> Broadcast interval 1 detik tersinkronisasi.
* `client -> timer:toggle` : `{ action: 'PAUSE' | 'RESUME' | 'RESET' }` -> Kontrol timer kelompok.
* `client -> notes:update` : `{ patch, fullText }` -> Sinkronisasi teks catatan bersama.
* `client -> socratic:ask` : `{ podId, topic, questionText, currentNotes }` -> Memicu integrasi Google Gemini API dengan prompt Sokratik sistem.