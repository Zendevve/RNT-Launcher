# Design System: RNT Launcher (Calm Utilitarian Desktop)

<!-- impeccable:design-schema 1 -->

## Design Philosophy

A calm, high-performance desktop utility for Doom players and modders. Inspired by professional tools like Linear, GitHub Desktop, and Prism Launcher. The interface prioritizes earned familiarity, low cognitive load, and instant access to launching games over decorative flair, badge explosions, or toy-like animations.

## Core Rules

1. **No Badge Soup:** A component gets at most one quiet format indicator where necessary. Do not stack format, category, usage count, status, and icon badges on every card.
2. **No Monospace as Costume:** Monospace is reserved exclusively for file paths, CLI arguments, hashes, and technical telemetry. Labels, titles, subtitles, and button text use standard proportional typography.
3. **No Gratuitous Spring Motion:** Animations are crisp, linear or subtle ease-out transitions between 100ms and 150ms. No bouncy scale effects (`active:scale-[0.98]`) or wobbling spring physics that make a desktop app feel like a toy.
4. **No Nested Cards:** Surfaces are organized with clean borders, subtle background tints, and structural alignment rather than cards inside cards inside cards.
5. **Color Discipline:** The canvas is deep obsidian (`#0c0e12`), surfaces are charcoal (`#13161a` and `#181c21`), hairline dividers are subtle (`#22262c` or `rgba(255,255,255,0.06)`). Red (`#dc2626`) is strictly reserved for the primary Launch CTA and destructive actions.

## Typography

- **Font Family:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Monospace Family:** `'JetBrains Mono', 'Fira Code', ui-monospace, monospace` (paths, hashes, CLI args only)
- **Hierarchy:**
  - App Header: 13px font-semibold, letter-spacing -0.01em
  - Section Headings: 14px font-bold, text-zinc-100
  - Item Titles: 13px font-medium, text-zinc-200
  - Body & Subtitles: 12px font-normal, text-zinc-400
  - Meta/Captions: 11px font-normal, text-zinc-500

## Color Palette

- **Background Canvas:** `#0c0e12` (matte obsidian)
- **Sidebar Surface:** `#101317`
- **Panel / Card Surface:** `#14171c`
- **Raised / Hover Surface:** `#1b1f26`
- **Border Hairline:** `#22262d` (subtle contrast)
- **Accent Primary (Launch):** `#dc2626` (Crimson, hover `#ef4444`, active `#b91c1c`)
- **Semantic Ready / Success:** `#10b981` (Emerald)
- **Semantic Warning:** `#f59e0b` (Amber)
- **Semantic Error:** `#ef4444` (Red)
- **Text Primary:** `#f4f4f5` (Zinc 100)
- **Text Secondary:** `#a1a1aa` (Zinc 400)
- **Text Muted:** `#71717a` (Zinc 500)

## Component Standards

- **Buttons:**
  - Primary (Launch): Crimson background `#dc2626`, bold white text, subtle shadow, 100ms transition.
  - Secondary: `#1c2026` surface, `#2a2f38` border, text-zinc-200, hover `#242a33`.
  - Ghost: Transparent background, text-zinc-400, hover text-zinc-200 hover bg-white/[0.04].
- **Inputs & Selects:**
  - Background `#0e1014`, border `#242830`, text-zinc-100, focus border `#dc2626` with no glaring glow.
- **Mod Load Order Table:**
  - Clean rows with drag handle, sequence number, enabled checkbox, mod name, quiet format pill, and trash action.
  - Generous target areas, clear drag highlight, and instant feedback.
