# Design System: Slate Brand World (https://slate-template.framer.website/)

<!-- impeccable:design-schema 1 -->

## Design Philosophy

The visual world of Slate: an ultra-refined, deep space dark mode characterized by matte absolute blacks (`#09090b`), periwinkle blue primary accents (`#5e7ce2`), ghost neutral surfaces (`#f4f4f5` at low opacity, `#101010`, `#0e0e11`), subtle borders (`#2d2d34`), Geist Medium typography, and instantaneous 0.001s ease transitions.

## Brand Tokens (from Slate Extraction)

- **Canvas Background:** `#09090b` (rgb(9, 9, 11))
- **Primary Accent:** `#5e7ce2` (rgb(94, 124, 226))
- **Text Foreground:** `#f4f4f5` (rgb(244, 244, 245))
- **Neutral Subtext:** `#a1a1aa` (rgb(161, 161, 170))
- **Neutral Muted:** `#71717a` (rgb(113, 113, 122))
- **Dark Neutral / Borders:** `#2d2d34` (rgb(45, 45, 52), hover `#36363e`)
- **Card / Surface Background:** `#0f0f12` (rgb(15, 15, 18)), `#0c0c0f` (rgb(12, 12, 15)), `#101010` (rgb(16, 16, 16))
- **Ghost Surface:** `rgba(255, 255, 255, 0.05)` on dark backdrops

## Typography

- **Font Family:** `Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Default Weight:** 500 (Medium)
- **Hierarchy Scale:**
  - Heading 1: 52px (weight 500, leading tight)
  - Heading 2: 40px (weight 500)
  - Heading 4: 32px (weight 500)
  - Body Large: 18px
  - Body: 16px, 14px
  - Caption: 12px, 10px (letter-spacing: 0.08em)

## Spacing & Rhythm

- **8px System:** 4px (0.25rem), 6px (0.38rem), 8px (0.5rem), 12px (0.75rem), 16px (1.0rem), 20px (1.25rem), 24px (1.5rem), 32px (2.0rem), 48px (3.0rem), 64px (4.0rem)

## Border Radius

- Inner/div: `2px`
- Standard buttons / controls: `8px` / `9px` / `14px`
- Outer cards / containers: `12px`
- Pill badges: `32px`

## Motion

- Scale: `0.001s ease`
- Transition timing: instantaneous responsiveness (`0.001s ease` color shift on hover, no sluggish delays)

## Component Specifications

- **Buttons:**
  - Primary / Action: `#5e7ce2` periwinkle background, dark `#09090b` text, radius 8px / 14px.
  - Dark Action: `#0f0f12` background, `#f4f4f5` text, `#2d2d34` border, radius 8px / 14px.
  - Secondary / Ghost: `#0c0c0f` background, `#a1a1aa` text, hover `#f4f4f5`.
- **Inputs:**
  - Background `#09090b`, text `#f4f4f5`, border 1px solid `#2d2d34`, focus border `#5e7ce2`, radius 8px.
- **Cards & Panes:**
  - Background `#0f0f12` or `#101010`, border 1px solid `#2d2d34`, radius 12px.
- **Sidebar & Shell:**
  - Sidebar `#101010` with `#2d2d34` border, active indicator `#5e7ce2` accent bar with `rgba(255,255,255,0.05)` pill.
