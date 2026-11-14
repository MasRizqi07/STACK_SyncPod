---
name: SyncPod Technical Cockpit
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#89ceff'
  on-secondary: '#00344d'
  secondary-container: '#00a2e6'
  on-secondary-container: '#00344e'
  tertiary: '#d0bcff'
  on-tertiary: '#3c0091'
  tertiary-container: '#b090ff'
  on-tertiary-container: '#4600a7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-code-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.02em
  label-code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-code-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1rem
  margin: 1rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes a high-density, architectural workspace calibrated for technical university sprint sessions. The design language rejects generic SaaS tropes, frivolous decorative flourishes, and neon AI gradients in favor of an instrumentation aesthetic: precise, dependable, and intensely focused.

### Core Philosophy
- **High-Density Cockpit:** Information architecture mirrors avionics and terminal consoles—compact data presentation, tabular figures, and minimal structural deadweight.
- **Architectural Bento:** Structural layouts follow disciplined, asymmetric bento grids where spatial hierarchy communicates operational priorities without decorative chrome.
- **Instrumental Focus:** Motion and interaction provide clear operational feedback rather than theatrical flair. All icons utilize disciplined 1.5px strokes; emojis are strictly excluded from interface elements.
- **Indonesian Technical Register:** Interface copy is strictly written in modern Indonesian technical vernacular (e.g., *Mulai Sesi*, *Pusat Kendali Pod*, *Pemeriksaan Kesiapan*, *Siklus Fokus*).

## Colors

The palette operates strictly in dark mode, balancing low-strain obsidian backgrounds against crisp, purposeful indicators.

### Surface Tiers
- **Primary Canvas (`--bg-primary`):** `#090D16` — Deep obsidian slate, non-reflective base plane.
- **Elevated Cockpit Base (`--bg-elevated`):** `#0F172A` — Deep slate structural shell for navigation sidebars and control panels.
- **Card Surface (`--surface-card`):** `#111827` — Rich charcoal slate for active bento tiles.
- **Interactive Surface Hover:** `#1E293B` — Discrete feedback state for clickable containers and row selections.

### State & Mode Accents
- **Focus Sprint (`--accent-primary`):** `#10B981` (Crisp Emerald) — Active sprint phases, completed checklist metrics, and operational readiness.
- **Break Mode:** `#0EA5E9` (Sky Cyan) — Cooldown intervals, audio synchronization states, and peer ping requests.
- **Socratic Copilot:** `#8B5CF6` (Solid Violet) and `#C084FC` (Text) — Strictly isolated to the AI sprint assistant module. Never rendered as a gradient; AI output is presented as an authoritative, deliberate instrument.
- **Urgency / Warning (`--status-warning`):** `#F59E0B` (Amber) — Final 60 seconds of a sprint interval, participant idle alerts, and reconnecting states.
- **Critical / Danger (`--status-danger`):** `#EF4444` (Crimson) — Session disconnections, dropped audio feeds, and abort triggers.

### Typography & Border Hierarchy
- **Text Primary:** `#F8FAFC` — High legibility for primary indicators and active prompts.
- **Text Secondary:** `#CBD5E1` — Structural labels and active peer metadata.
- **Text Muted:** `#8393A8` — Technical readouts, timestamps, and inactive controls (maintains WCAG AA ≥ 4.5:1 against card backgrounds).
- **Subtle Outline (`--border-subtle`):** `1px solid rgba(255, 255, 255, 0.08)`.
- **Focused Instrument Outline (`--border-active`):** `1px solid rgba(56, 189, 248, 0.30)`.

## Typography

The typographic hierarchy separates structural titles, narrative explanations, and numeric instrumentation.

- **Display & Section Headers (`Bricolage Grotesque`):** Used for sprint phases, workspace headers, and bento block titles. Features tight tracking (`-0.02em`) and compact line-heights (`1.1` to `1.2`) to maintain high information density.
- **Narrative & Controls (`Plus Jakarta Sans`):** Balanced, legible sans-serif for sprint objectives, peer notes, and button actions. Provides high legibility in low-light environments without visual fatigue.
- **Instrumentation & Metrics (`JetBrains Mono`):** Applied to sprint timers, bandwidth stats, peer status codes, keybindings, and telemetry. All instances enforce `font-variant-numeric: tabular-nums` to eliminate jitter when digits update.

## Layout & Spacing

The layout is built upon an asymmetric 12-column bento structure optimized for desktop split-views (sprint cockpit, shared terminal, and Socratic panel) while gracefully stacking on narrower viewports.

### Grid & Density Rules
- **Desktop (≥ 1024px):** 12-column layout with 16px (`1rem`) gutters and 24px (`1.5rem`) outer canvas margins. Bento modules occupy asymmetric spans: Pod telemetry & timer (4 cols), sprint canvas & objective tracking (5 cols), Socratic copilot/peer rail (3 cols).
- **Tablet (768px - 1023px):** 8-column layout with 12px (`0.75rem`) gutters; copilot transitions to a bottom drawer or collapsible tray.
- **Mobile (< 768px):** Single-column stacked stream with 16px outer margin. Top priority pinned to the central `PodRing` timer, followed by contextual action cards.

Spacing density adheres to an 8/10 rating: internal component paddings favor `space-sm` (8px) and `space-md` (12px), eliminating superfluous padding while retaining clear visual groupings.

## Elevation & Depth

Depth is established strictly through architectural surface stacking and crisp hairline borders rather than heavy ambient blurs or drop shadows.

- **Layer 0 (Canvas):** `#090D16` base.
- **Layer 1 (Card Bento Surfaces):** `#111827` bound by `1px solid rgba(255, 255, 255, 0.08)`.
- **Layer 2 (Floating Cockpit Controls & Menus):** `#0F172A` with `1px solid rgba(255, 255, 255, 0.14)` and a compact drop shadow: `0 4px 16px -2px rgba(0, 0, 0, 0.6)`.
- **Focused State:** Border transitions to `rgba(56, 189, 248, 0.35)` with zero glow diffusion. AI panels substitute this with a solid `1px solid rgba(139, 92, 246, 0.4)`.

## Shapes

The interface balances precision-engineered interior controls with structured framing containers.

- **Containers & Bento Tiles:** Fixed at `14px` border radius (`rounded-lg`), establishing clean spatial boundaries.
- **Interactive Controls, Badges & Inputs:** Fixed at `8px` (`0.5rem`, `roundedness: 2`), reflecting a sharp, technical instrumentation feel.
- **Avatars & Orbit Indicators:** Full circles (`50%`), specifically within the PodRing architecture.

## Components

### 1. The PodRing (Signature SVG Component)
A multi-modal central instrument rendered as a pure SVG geometric assembly with clean CSS ring animations:
- **Structure:** Dual concentric rings. Outer track displays session progress with a high-contrast stroke (`#10B981` during focus, `#0EA5E9` during break, switching to `#F59E0B` during the final 60 seconds). Inner ring houses four seat nodes positioned at 12, 3, 6, and 9 o'clock.
- **Radar Matchmaking Mode:** Continuous single-line sweep (`stroke-width: 1.5px`) rotating at 3s linear intervals scanning for peers. Unoccupied nodes pulse faintly (`rgba(255, 255, 255, 0.2)`).
- **Cockpit Mode:** Displays active audio indicators, microphone states, and task completion rings for each student node. Center displays large tabular timer digits (`JetBrains Mono`).

### 2. Buttons & Action Triggers
- **Primary Control (`Mulai Sprint`):** Solid `#10B981` background, `#090D16` bold text, 8px radius, 36px total height, horizontal padding 14px.
- **Secondary Action (`Sinkronisasi`):** `#111827` surface, `1px solid rgba(255, 255, 255, 0.12)`, `#F8FAFC` text. Hover shifts background to `#1E293B`.
- **Destructive / Abort:** Border `#EF4444` at 40% opacity, transparent background, text `#EF4444`.

### 3. Socratic Copilot Module
- Self-contained technical drawer. Uses solid `#8B5CF6` for badge indicators and active thought tags.
- Query inputs feature a monospaced prefix (`> `) with placeholder `Tanyakan konsep atau periksa kode...`. Zero gradient fills; output is formatted in clean code blocks or high-contrast markdown.

### 4. Status Badges & Telemetry Chips
- Compact height (22px), `JetBrains Mono` 10px uppercase, padding 2px 8px, 4px border radius.
- States: `LIVE 25:00` (Emerald border & dot), `ISTIRAHAT 05:00` (Sky Cyan), `SIAGA` (Slate), `TERPUTUS` (Crimson).

### 5. Form Controls & Checklist Items
- Inputs use background `#0F172A`, border `1px solid rgba(255, 255, 255, 0.1)`, padding 8px 12px, font size 13px. Focus: `1px solid rgba(56, 189, 248, 0.5)`.
- Sprint Task Checkboxes: Square 16px controls with 4px inner radius. Active checkmark is a solid 2px emerald stroke.

### 6. Iconography Rules
- Lucide SVG icons exclusively, set to `1.5px` stroke, 16px box dimension. Never use emojis or multicolor illustrations within any interface surface.