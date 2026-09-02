import { Transition, Variants } from 'motion/react';

/**
 * Apple Design System Spring & Motion Tokens
 * Derived from WWDC Fluid Interfaces & macOS Human Interface Guidelines
 */

// Critically damped spring (ζ = 1.0, Response = 0.35s) - No overshoot, calm and authoritative
export const springDefault: Transition = {
  type: 'spring',
  damping: 30,
  stiffness: 300,
  mass: 0.8,
};

// Snappy micro-interaction spring (Response = 0.25s) - Buttons, toggles, tab pills
export const springSnappy: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 420,
  mass: 0.6,
};

// Drawer and Sheet spring (Response = 0.38s) - Fluid slide with gentle settle
export const springSheet: Transition = {
  type: 'spring',
  damping: 34,
  stiffness: 280,
  mass: 1.0,
};

// Momentum throw spring - Used when user flick/momentum precedes settling
export const springMomentum: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 240,
  mass: 0.9,
};

// Modal popover scale-and-fade
export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springDefault },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.15, ease: [0.32, 0, 0.67, 0] } },
};

// Drawer slide variants
export const drawerVariants: Variants = {
  initial: { x: '100%', opacity: 0.6 },
  animate: { x: 0, opacity: 1, transition: springSheet },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] } },
};

// Scrim backdrop variants
export const scrimVariants: Variants = {
  initial: { opacity: 0, backdropFilter: 'blur(0px)' },
  animate: { opacity: 1, backdropFilter: 'blur(12px)', transition: { duration: 0.25, ease: [0, 0, 0.2, 1] } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

// Toast notification spring
export const toastVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springSnappy },
  exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};
