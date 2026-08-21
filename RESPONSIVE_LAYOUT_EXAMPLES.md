# Responsive Layout Visual Reference

Visual breakdown of how your LIA interface adapts to different screen sizes.

---

## Mobile Phone (375px - 414px)

### Login Screen
```
┌─────────────────────┐
│  LIA v2.0 Platform  │ ← Title scaled down (text-lg)
├─────────────────────┤
│                     │
│  [COMPANION SETUP]  │ ← Compact section header
│                     │
│  Avatar Glow Name   │ ← 2-column grid (gap-2)
│  [▼]    [  ]       │
│                     │
│  Hair   Color      │
│  [▼]    [▼]        │
│                     │
│  Voice  Accent     │
│  [▼]    [▼]        │
│                     │
│  [LOG-IN]          │
│                     │
│  Username          │
│  [👤 _____]        │ ← Left-aligned icon
│                     │
│  Secret Word       │
│  [🔒 _____]        │
│                     │
│ [≡ LAUNCH LIA ≡]   │ ← Full-width button
│                     │
│ Privacy-first data │ ← Small footer text
└─────────────────────┘

Avatar 3D Preview: HIDDEN
Left Side Panel: NOT SHOWN
```

### Authenticated Dashboard
```
┌─────────────────────┐
│ [≡] [💬] [<>] [📅]  │ ← Horizontal nav (p-2, h-14)
│ [🎨] [⚡] [⚙️] [📝] │
│ [👤]                │
├─────────────────────┤
│                     │
│  Chat Messages Here │ ← Full-width content
│                     │
│  [Type message...]  │
│                     │
│ [📤 Send]          │
│                     │
└─────────────────────┘

Sidebar: HORIZONTAL at top
Avatar Pod: HIDDEN (save space)
Split View: NOT USED
```

---

## Tablet Portrait (768px)

### Authenticated Dashboard
```
┌─────────────────────────────────────┐
│ [≡] [💬] [<>] [📅] [🎨] [⚡] [⚙️]   │ ← Still horizontal
│ [📝] [👤]                           │
├─────────────────────────────────────┤
│                                     │
│  Chat Messages Here                 │
│  (Full width, single column)        │
│                                     │
│  [Type message...]                  │
│  [📤 Send]                          │
│                                     │
└─────────────────────────────────────┘

Sidebar: HORIZONTAL at top
Avatar Pod: HIDDEN (still portrait)
Split View: NOT ACTIVE
```

---

## Tablet Landscape (1024px)

### Authenticated Dashboard with Split View
```
┌──────┬────────────────────────────────────────┐
│ [≡]  │                                        │
│ [💬] │  Chat Messages / Active Panel          │
│ [<>] │                                        │
│ [📅] │  └────────────────────────────────────┘│
│ [🎨] │  Character Customizer / Voice Settings│
│ [⚡] │  (Responsive Grid: 2+ columns)        │
│ [⚙️] │                                        │
│ [📝] │                                        │
│ [👤] │                                        │
└──────┴────────────────────────────────────────┘

Sidebar: VERTICAL on left (w-16, h-screen)
Avatar Pod: NOT SHOWN (need more space for content)
Split View: ACTIVE with full-width panels
```

---

## Desktop (1920px)

### Authenticated Dashboard with Avatar

```
┌──────┬───────────────────┬────────────────────────────────────┐
│ [≡]  │                   │                                    │
│ [💬] │  ┌───────────────┐│  Chat Room / Active Panel          │
│ [<>] │  │               ││                                    │
│ [📅] │  │               ││  └──────────────────────────────┘│
│ [🎨] │  │  LIA 3D CORE  ││                                  │
│ [⚡] │  │               ││  Character Customizer             │
│ [⚙️] │  │  (Avatar)     ││  - Hair: Long                     │
│ [📝] │  │               ││  - Color: Black                   │
│ [👤] │  │               ││  - Outfit: Cyan                   │
│      │  │               ││                                  │
│      │  └───────────────┘│  [Back to Chat Room]              │
│      │  [Return to Chat] │                                    │
└──────┴───────────────────┴────────────────────────────────────┘

Sidebar: VERTICAL on left (w-16, h-screen)
Avatar Pod: VISIBLE on left side (w-64, split view)
Split View: OPTIMAL 3-column layout
LIA 3D: RENDERED and interactive
```

---

## Smart TV (1920px+ or Cast)

### Full Screen Optimized
```
┌──────┬──────────────────────────────────────────────────────┐
│ [≡]  │                                                      │
│ [💬] │  LIA AI Companion                                   │
│ [<>] │  Chat Messages (Large text, 18px+)                  │
│ [📅] │  ┌────────────────────────────────────────────────┐ │
│ [🎨] │  │                                                │ │
│ [⚡] │  │  User: Hello LIA!                              │ │
│ [⚙️] │  │  LIA: I'm listening... how can I help?        │ │
│ [📝] │  │                                                │ │
│ [👤] │  └────────────────────────────────────────────────┘ │
│      │                                                      │
│      │  [Type message or speak...] [🎤 Send] [⚙️ Settings]│
│      │                                                      │
└──────┴──────────────────────────────────────────────────────┘

Sidebar: VERTICAL (larger padding for remote control)
Avatar Pod: VISIBLE (rendered at high quality)
Text Size: 18px+ for viewing distance
Buttons: Large (50px+ height for remote)
Navigation: Arrow keys work (remote control)
```

---

## Responsive Component Examples

### Login Form - How It Changes

#### Mobile (375px):
```
┌─────────────────────┐
│ [AVATAR BASE]       │
│ [Female ▼]  [Name]  │ ← 2 columns, tight spacing
│                     │
│ [Hair ▼]  [Color ▼] │
│                     │
│ [ACCENT]            │
│ [US ▼]              │ ← Full width
│                     │
│ [USERNAME]          │
│ [👤 _____]          │
│                     │
│ [LAUNCH LIA]        │ ← Full width button
└─────────────────────┘
```

#### Tablet (768px):
```
┌──────────────────────────┐
│ [COMPANION CUSTOMIZATION] │
│                          │
│ [Avatar ▼] [Name ___]    │ ← Still 2 columns
│ [Hair ▼]   [Color ▼]     │
│ [Voice ▼]  [Glow ▼]      │
│                          │
│ [ACCENT]                 │
│ [US ▼]                   │ ← Now full width
│                          │
│ [LOG-IN]                 │
│ [Username ___]           │ ← Larger fields
│ [Display _____]          │
│ [Secret ___]             │
│                          │
│ [LAUNCH LIA]             │ ← Larger button
└──────────────────────────┘
```

#### Desktop (1920px):
```
┌──────────────────────────────────────┐
│ 3D AVATAR PREVIEW ON LEFT            │
│ ┌──────────────┐ ┌──────────────────┐│
│ │              │ │[COMPANION CUSTOM]││
│ │   LIA 3D     │ │                  ││
│ │   AVATAR     │ │ [Avatar ▼][Name] ││
│ │              │ │ [Hair ▼][Color ▼]││
│ │              │ │ [Voice ▼][Glow ▼]││
│ │              │ │ [ACCENT]         ││
│ │              │ │ [US ▼]           ││
│ │              │ │                  ││
│ │              │ │ [LOG-IN]         ││
│ │              │ │ [Username ___]   ││
│ │              │ │ [Secret ___]     ││
│ │              │ │ [LAUNCH LIA]     ││
│ │              │ │                  ││
│ └──────────────┘ └──────────────────┘│
└──────────────────────────────────────┘
```

---

## Navigation Bar Transformation

### Mobile & Tablet (< 1024px)
```
Horizontal Layout:
┌─────────────────────────────────────┐
│ [≡] [💬] [<>] [📅] [🎨] [⚡] [⚙️] [👤]│ ← Scrollable left-right
│ [📝] [more...]                      │
└─────────────────────────────────────┘

Height: 56px (h-14)
Width: 100% (w-full)
Direction: flex row
Overflow: scroll-x
Icon Size: 20×20px (w-5 h-5)
Padding: 8px each side (p-2)
```

### Desktop (≥ 1024px)
```
Vertical Layout:
┌──────┐
│ [≡]  │
│ [💬] │ ← Stack vertically
│ [<>] │
│ [📅] │
│ [🎨] │
│ [⚡] │
│ [⚙️] │
│ [📝] │
│ [👤] │
│      │
└──────┘

Width: 64px (w-16)
Height: 100vh (h-screen)
Direction: flex column
Overflow: none
Icon Size: 20×20px (w-5 h-5)
Padding: 24px top/bottom (py-6)
Spacing: 16px between items (space-y-4)
```

---

## Split View Evolution

### Mobile (Hidden):
```
┌─────────────────────┐
│                     │
│  Active Panel Only  │
│  (Full Width)       │
│                     │
│  Character Creator  │
│  Voice Settings     │
│  Memory Manager     │
│                     │
└─────────────────────┘

Avatar Pod: HIDDEN (hidden lg:flex)
Panel Width: 100%
```

### Tablet (Hidden still):
```
┌──────────────────────────┐
│                          │
│  Active Panel Only       │
│  (Full Width)            │
│                          │
│  More space for content  │
│  Better touch targets    │
│                          │
└──────────────────────────┘

Avatar Pod: HIDDEN (wait for lg)
Panel Width: 100%
```

### Desktop/Large Tablet (Visible):
```
┌─────────┬──────────────────────┐
│ ┌─────┐ │ Active Panel         │
│ │ LIA │ │ (Character Creator   │
│ │3D   │ │  Voice Settings      │
│ │CORE │ │  Memory Manager)     │
│ │     │ │                      │
│ │     │ │                      │
│ └─────┘ │                      │
│[Return] │                      │
└─────────┴──────────────────────┘

Avatar Pod: VISIBLE (lg:flex w-64)
Panel Width: flex-1
Split: 64px avatar + flexible panel
```

---

## Responsive Grid Examples

### Product/Card Grid
```
Mobile (1 column):
┌──────┐
│Card 1│
├──────┤
│Card 2│
├──────┤
│Card 3│
└──────┘

Tablet (2 columns):
┌──────┬──────┐
│Card 1│Card 2│
├──────┼──────┤
│Card 3│Card 4│
└──────┴──────┘

Desktop (3 columns):
┌──────┬──────┬──────┐
│Card 1│Card 2│Card 3│
├──────┼──────┼──────┤
│Card 4│Card 5│Card 6│
└──────┴──────┴──────┘

CSS Classes:
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4
```

---

## Font Size Progression

```
Heading (h1):
Mobile:  18px (text-lg)
Tablet:  20px (text-xl)
Desktop: 24px (text-2xl)

Body Text:
Mobile:  14px (text-sm)
Tablet:  16px (text-base)
Desktop: 16px (text-base)

Labels:
Mobile:  12px (text-xs)
Tablet:  12px (text-xs)
Desktop: 12px (text-xs)

Buttons:
Mobile:  14px (text-sm)
Tablet:  14px (text-sm)
Desktop: 14px (text-sm)
```

---

## Padding/Spacing Progression

```
Container Padding:
Mobile:  p-3 (12px)
Tablet:  p-6 (24px)
Desktop: p-8 (32px)

Gap Between Items:
Mobile:  gap-2 (8px)
Tablet:  gap-4 (16px)
Desktop: gap-4 (16px)

Form Input Padding:
Mobile:  px-2.5 py-2 (10px, 8px)
Tablet:  px-3 py-2 (12px, 8px)
Desktop: px-3 py-2 (12px, 8px)

Button Padding:
Mobile:  py-2 (8px)
Tablet:  py-2 (8px)
Desktop: py-2.5 (10px)
```

---

## Touch Target Sizes

```
Button Min Size:     44×44px (Mobile), 48×48px (Tablet)
Input Height:        44px (Mobile), 48px (Tablet)
Tap Area Spacing:    8px minimum between targets
Icon Size:           20×20px (clickable area: 44×44px)
```

---

## Testing Checklist with Visuals

### ✅ Mobile Check
- [ ] Text readable without zoom
- [ ] Horizontal nav bar visible at top
- [ ] Avatar NOT visible (space saved)
- [ ] Forms in single column
- [ ] Buttons easily tappable (44px+)
- [ ] No horizontal scrolling

### ✅ Tablet Check  
- [ ] Horizontal nav still at top
- [ ] Enough space for content
- [ ] Could show split view if scrolled
- [ ] Text size comfortable for distance
- [ ] Landscape/portrait both work

### ✅ Desktop Check
- [ ] Vertical sidebar on left
- [ ] Avatar visible in split view
- [ ] Optimal use of wide screen
- [ ] All controls easily accessible
- [ ] Multi-column grids working

### ✅ TV Check
- [ ] Text large enough from couch
- [ ] Navigation easy with remote
- [ ] Buttons big enough to press/select
- [ ] 3D avatar renders smoothly
- [ ] No content cut off at edges

---

## CSS Classes Reference

### Display Responsiveness
```tsx
className="hidden lg:flex"        // Hidden mobile/tablet, show desktop+
className="flex lg:hidden"        // Shown mobile/tablet, hide desktop+
className="hidden md:block"       // Hide mobile, show tablet+
className="block sm:hidden"       // Show mobile, hide tablet+
```

### Width Responsiveness
```tsx
className="w-full sm:w-64 lg:w-80"  // 100%, then 256px, then 320px
className="max-w-full md:max-w-2xl" // Full, then fixed max
```

### Padding Responsiveness
```tsx
className="p-3 sm:p-6 lg:p-8"    // 12px → 24px → 32px
className="px-2 sm:px-4"         // Horizontal padding
className="py-1 sm:py-2"         // Vertical padding
```

### Text Responsiveness
```tsx
className="text-sm sm:text-base lg:text-lg"  // Font size
className="leading-tight sm:leading-normal"  // Line height
className="tracking-normal sm:tracking-wide" // Letter spacing
```

---

## Summary

Your LIA interface now seamlessly adapts:
- **Mobile (375px)**: Optimized for thumbs, hidden avatar, single column
- **Tablet (768px)**: Good balance, more space, touch-friendly
- **Desktop (1920px)**: Optimal features, split view, sidebar
- **TV (1920px+)**: Large text, big buttons, remote control friendly

All without changing a single component—pure responsive CSS! 🎨
