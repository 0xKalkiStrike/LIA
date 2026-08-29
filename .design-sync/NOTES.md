# Design-sync notes for LIA

## What's synced

This repo (`C:\hacker\LIA`) is the LIA personal-AI app, not a design-system repo. It has
no Storybook and no publishable component package. The only legitimate sync target is
`frontend/src/components/ui/` - a small set of prop-driven UI primitives (Button,
IconButton, Badge, Panel, TextInput, StatusDot, ChatBubble) extracted specifically to
give this sync something real to work with. Everything else under `frontend/src/components/`
(Dashboard, CodeWorkspace, VoiceSettings, ThreeCanvas, etc.) is excluded on purpose -
those are full app screens wired directly to `useApp()` (live WebSocket + `:8001` backend
calls), not reusable/prop-driven, and would not render standalone.

## Build approach

No `dist/` build exists for `ui/` (it's not a standalone package, just a folder inside
the Next.js app). Using **synth-entry mode**: `--entry` points directly at
`frontend/src/components/ui/index.ts` (the barrel file) instead of a compiled dist
entry. `--node-modules` points at `frontend/node_modules`. This means weaker `.d.ts`
extraction than a real build would give - acceptable for 7 simple, mostly-scalar-prop
components.

## Re-sync risks

- If `frontend/src/components/ui/index.ts` stops re-exporting a component (renamed,
  deleted, folded into another), the sync silently drops it - always re-check the
  component count against `ls frontend/src/components/ui/*.tsx` after a re-sync.
- The CSS tokens these components reference (`--accent-cyan`, `--accent-violet`,
  `--bg-card`, `--text-primary`, `--border-light`/`--border-mid`, etc.) live in
  `frontend/src/app/globals.css`. If that file is edited (renamed vars, removed
  tokens), previews will silently go unstyled - the build's `[TOKENS_MISSING]` /
  `[CSS_*]` diagnostics are the tripwire.
- These components were authored, not scraped from an existing DS - "usage examples"
  for `.prompt.md` synthesis come only from the `.d.ts` prop shapes and previews
  authored in this campaign, not from a pre-existing docs site.
- `frontend/` is a Next.js app (not this converter's usual npm-package shape); if a
  future re-sync tries to auto-detect a `dist`/`main`/`exports` entry it will find
  none and should fall back to the same synth-entry approach documented here.
