# Pragma Content Studio

A functional editorial content studio for planning and generating LinkedIn-style
posts, powered by your own Claude account. Implemented from the Claude Design
handoff (`Pragma Content Studio.dc.html`) and wired up to the Anthropic API.

## Features

- **Connect your Claude account** — paste your Anthropic API key once; it is
  stored only in your browser (`localStorage`) and used to call Claude directly
  from the page. Pick the model (Opus 4.8 / Sonnet 4.6 / Haiku 4.5).
- **Post Calendar** — month view anchored to the real current date (today is
  always marked), drag-to-reschedule, and a **New post** flow that creates real
  posts.
- **Refresh topics** — Claude proposes a **weekly agenda** (topics, angles,
  formats, priorities) and drops them onto this week's calendar.
- **This week's focus** — surfaces the topics in active rotation for the week.
- **Content Generation** — generates three on-brand versions of a post with
  Claude (different rhetorical methods), each with inline editing, per-version
  regeneration, a "why it works" rationale, approve, and schedule.
- **Topic Briefs** — Claude-generated plain-language explainers (summary, why it
  matters, key points) for the week's topics, on demand.
- **Writing-style profile** — a saved voice/reference profile that feeds every
  generation.
- **Version history & diff** — every edit/regenerate is logged; compare any prior
  version against the current one (word-level diff) and revert.
- **Persistence** — posts, writing style, and settings persist in `localStorage`.
- **Liquid-glass UI** — translucent surfaces, drifting ambient background, a
  sliding tab indicator, fluid view transitions, and light/dark themes.

## How the Claude integration works

This is a static site (no backend), so it calls the Anthropic Messages API
directly from the browser using the official
`anthropic-dangerous-direct-browser-access` header and your API key. The key
never leaves your browser except in requests to `api.anthropic.com`.

Get an API key at [console.anthropic.com](https://console.anthropic.com) → API
keys, then click **Connect Claude** in the app header.

> Note: a browser-stored API key is convenient for a personal tool but is not
> appropriate for a shared/public deployment. For multi-user use, put the key
> behind a small server proxy instead.

## Tech stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- `src/anthropic.ts` — browser client for the Messages API
- `src/store.ts` — `localStorage` persistence
- Inline styling ported from the design + a small global stylesheet

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```
