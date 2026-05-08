# ExamSync Brand Guide
**Version 2.0 — Full Design System**

---

## Logo & Mark

| Asset | File | Usage |
|-------|------|-------|
| Full logo (dark bg) | `logo-primary-dark.svg` | Auth pages, dark splash screens |
| Full logo (light bg) | `logo-primary-light.svg` | Light mode splash screens |
| Wordmark dark bg | `wordmark-dark.svg` | Dark marketing materials |
| Wordmark light bg | `wordmark-light.svg` | Light marketing materials |
| Mark 64px | `mark-64px.svg` | Large icon uses, onboarding |
| Mark 40px | `mark-40px.svg` | Sidebar header, loading screens |
| Mark 28px | `mark-28px.svg` | Topbar mobile, small contexts |
| Favicon | `favicon-16px.svg` | Browser tab |

**Rules:** Always maintain clear space = half the mark height. Do not recolor the mark.  
**Wordmark:** "Exam" uses `--foreground`, "Sync" uses `--primary`.

---

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display / Headings (`font-display`) | Nunito Sans Variable | 700–800 | h1: 2rem, h2: 1.75rem, h3: 1.25rem |
| Body / UI (`font-sans`) | Plus Jakarta Sans Variable | 400–600 | base: 14px, sm: 12px |

Apply `font-display` to: page titles, section headings, card titles, stat numbers, logo wordmark.  
Apply `font-sans` (default) to: all body text, labels, table content, descriptions.

---

## Color System

Colors are defined as CSS variables in `src/index.css`. Use semantic tokens, not raw hex values.

### Light Mode (cool, icy blue-white)
| Token | Value | Role |
|-------|-------|------|
| `--background` | `oklch(0.972 0.013 238)` | Page background |
| `--foreground` | `oklch(0.13 0.022 265)` | Primary text |
| `--card` | `oklch(1 0 0)` | Card / panel surface |
| `--border` | `oklch(0.838 0.015 244)` | Borders |
| `--muted-foreground` | `oklch(0.508 0.016 264)` | Secondary text |
| `--primary` | `oklch(0.635 0.167 228)` | Sky-500 `#0EA5E9` |
| `--sidebar` | `oklch(0.985 0.005 240)` | Sidebar background |

### Dark Mode (warm, indigo-tinted slate)
| Token | Value | Role |
|-------|-------|------|
| `--background` | `oklch(0.127 0.021 265)` | Page background `#0D0F1A` |
| `--foreground` | `oklch(0.953 0.006 240)` | Primary text |
| `--card` | `oklch(0.163 0.022 265)` | Card / panel surface `#151929` |
| `--border` | `oklch(0.275 0.032 265)` | Borders |
| `--muted-foreground` | `oklch(0.606 0.012 264)` | Secondary text |
| `--primary` | `oklch(0.732 0.147 225)` | Sky-400 `#38BDF8` |
| `--sidebar` | `oklch(0.145 0.022 265)` | Sidebar background |

### Semantic Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--success` | emerald-500 | emerald-500 | Success states, green metrics |
| `--warning` | amber-500 | amber-500 | Warning states |
| `--destructive` | red-500 | red-400 | Error states, destructive actions |

---

## Surface Style — Tinted Panels (Style D)

Use `border border-border` as the base, then apply a tint class for contextual panels.  
Tint classes use `color-mix()` and adapt automatically to light/dark mode.

| Class | Tint | Use case |
|-------|------|----------|
| *(default)* | None | Standard cards |
| `.panel-info` | Primary/sky | Info callouts, hints |
| `.panel-success` | Success/emerald | Positive results, confirmations |
| `.panel-warning` | Warning/amber | Caution notices |
| `.panel-error` | Destructive/red | Error states, unscheduled exams |

In `PageSection`: `<PageSection variant="info">`, `variant="success"`, etc.

---

## Exam Schedule Color Coding

Academic year level → card accent color:

| Year | Codes | Color | Classes |
|------|-------|-------|---------|
| Year 1 | CE1xx | Sky / Blue | `bg-sky-500/10 border-sky-500/25` |
| Year 2 | CE2xx | Emerald / Green | `bg-emerald-500/10 border-emerald-500/25` |
| Year 3 | CE3xx | Amber / Orange | `bg-amber-500/10 border-amber-500/25` |
| Year 4 | CE4xx | Violet / Purple | `bg-violet-500/10 border-violet-500/25` |

---

## Animation Guidelines

| Type | Implementation | Notes |
|------|----------------|-------|
| Theme switch | `transition: background-color 0.2s ease, color 0.2s ease` on `body` | Smooth mode toggle |
| Interactive hover | `transition-colors` Tailwind utility | All interactive elements |
| Loading skeleton | `animate-pulse` on muted bg blocks | Data loading states |
| Loading overlay | Bouncing dots + pulsing mark | Full-page async operations |
| Page transitions | *(planned)* | Route-level fade-in |
| Data bars | `transition-all` on width | Schedule metrics bar chart |

---

## Component Conventions

- **Radii:** `rounded-lg` (8px) for inputs/chips, `rounded-xl` (10px) for cards, `rounded-2xl` (14px) for modals/auth cards
- **Spacing:** 8px grid. Sections separated by `space-y-8`. Within cards: `p-5` or `p-6`
- **Headings:** Always `font-display font-bold`
- **Eyebrow text:** `text-xs font-medium uppercase tracking-widest text-muted-foreground`
- **Table headers:** `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- **Status badges:** `rounded-full border border-border px-2.5 py-1 text-xs capitalize`
