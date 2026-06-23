# Pragma Content Studio

An editorial content studio for planning and generating LinkedIn-style posts,
implemented from the Claude Design handoff (`Pragma Content Studio.dc.html`).

## Features

- **Post Calendar** — a June 2026 editorial calendar with approved/published
  posts, a "today" marker, weekend styling, a weekly-refresh banner, and
  drag-to-reschedule of post cards between days.
- **Content Generation** — opens a selected post and shows three AI-generated
  versions (Pyramid Principle, Storytelling, and numbered-proof methods). Each
  version supports inline editing, regeneration, a collapsible "why it works"
  rationale, approve, and schedule.
- **Version history & diff** — every edit/regenerate is logged; a history modal
  lets you compare any prior version against the current one (word-level diff)
  and revert.
- **Writing-style profile** — a voice/reference panel that "feeds" generation.
- **Light / dark theme** toggle with a glassmorphic header, toasts, and modals.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- All styling is inline (ported faithfully from the design) plus a small global
  stylesheet for fonts, keyframes, and interaction states.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```
