/**
 * Slate Framer brand tokens — exact extraction
 * Source of truth for Tailwind + CSS vars + JS usage.
 */

export const colors = {
  bg: '#09090b',
  primary: '#5e7ce2',
  surface: '#f4f4f5',
  neutral: '#a1a1aa',
  neutralMuted: '#71717a',
  accent: '#2d2d34',
} as const

export const cssVars = {
  bg: 'var(--bg)',
  primary: 'var(--primary)',
  surface: 'var(--surface)',
  neutral: 'var(--neutral)',
  neutralMuted: 'var(--neutral-muted)',
  accent: 'var(--accent)',
} as const

export const font = {
  geist: 'var(--font-geist)',
  weight: 500,
  family: '"Geist", sans-serif',
} as const

/** 8px spacing system — 1 = 0.25rem (4px), 2 = 0.5rem (8px) */
export const spacing = {
  px: '1px',
  0: '0px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const

export const radii = {
  div: '2px',
  sm: '2px',
  DEFAULT: '8px',
  button: '8px',
  card: '8px',
  md: '8px',
  lg: '12px',
  outer: '12px',
  xl: '12px',
} as const

export const motion = {
  duration: '0.001s',
  ease: 'ease',
  transition: '0.001s ease',
} as const

export const tokens = {
  colors,
  cssVars,
  font,
  spacing,
  radii,
  motion,
} as const

export default tokens
