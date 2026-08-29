# LIA UI conventions

This is a small, hand-authored primitives kit (7 components) extracted from the LIA
personal-AI app: `Button`, `IconButton`, `Badge`, `Panel`, `TextInput`, `StatusDot`,
`ChatBubble`. There is no separate design-system package - these ship straight from
the app's own source, so what you get here is exactly what LIA's real UI runs.

## Setup

No provider or root wrapper is required - every component is a plain, stateless
function component driven entirely by props. Just import from the bundle and render.

**The one real constraint: everything here is built for a dark host background.**
LIA's app body is permanently dark (`background: var(--bg-darker)`, `color:
var(--text-primary)` - there is no light mode). `Button`'s `secondary` and `ghost`
variants and `IconButton` are deliberately transparent/subtle so they blend into that
background; on a light canvas their text reads as low-contrast or invisible. Wrap any
composition in a dark surface, e.g.:

```jsx
<div style={{ background: "var(--bg-darker)", padding: 24, borderRadius: 12 }}>
  {/* your composition */}
</div>
```

## Styling idiom: CSS custom-property tokens + Tailwind utilities

Every component is styled with Tailwind utility classes, but all **color** comes from
CSS custom properties defined in `:root` (never Tailwind's built-in palette, never a
hardcoded hex) - reach for the same tokens in any layout glue you write:

| Token | Use |
|---|---|
| `--accent-cyan` / `--accent-violet` | brand accent colors (LIA's signature cyan-to-violet gradient) |
| `--bg-dark` / `--bg-darker` / `--bg-card` | background surfaces, darkest to lightest |
| `--text-primary` / `--text-secondary` / `--text-tertiary` | foreground text, highest to lowest emphasis |
| `--border-light` / `--border-mid` / `--border-strong` | border opacity steps |
| `--gradient-primary` / `--gradient-secondary` | the two brand gradients, as CSS `background` values |
| `--shadow-sm` … `--shadow-glow` | elevation and the signature cyan/violet glow |

Apply a token via Tailwind's arbitrary-value syntax, exactly as the components
themselves do: `bg-[var(--bg-card)]`, `text-[var(--text-secondary)]`,
`border-[var(--border-light)]`, `bg-gradient-to-r from-[var(--accent-cyan)]
to-[var(--accent-violet)]`.

Component APIs are the preferred vocabulary before reaching for raw classes:
`Button`'s `variant` (`primary`/`secondary`/`danger`/`ghost`) and `size` (`sm`/`md`),
`Badge`'s `tone` (`cyan`/`violet`/`amber`/`emerald`/`red`/`slate`), `StatusDot`'s
`state` (`online`/`offline`/`busy`/`speaking`). Use these instead of restyling a
component from outside.

## Where the truth lives

- `styles.css` (and its `@import` closure) carries every token and utility class -
  read it before styling anything these components don't already cover.
- Each component's `<Name>.prompt.md` and `<Name>.d.ts` under `components/general/`
  are the authoritative prop contract and usage reference.

## Example composition

```jsx
<div style={{ background: "var(--bg-darker)", padding: 16, borderRadius: 16 }}>
  <div className="flex items-center justify-between mb-3">
    <span className="text-sm font-semibold text-[var(--text-primary)]">LIA</span>
    <Badge tone="emerald">Online</Badge>
  </div>
  <Button variant="primary" icon={<PhoneIcon />}>Start Call</Button>
</div>
```
