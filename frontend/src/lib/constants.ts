/**
 * RNT Launcher - Brand & System Constants
 * 
 * Core Brand Promise:
 * "Beautifully simple. Designed from the very start to be as visually minimal and space efficient as possible.
 * No cluttered interface. Fast and lightweight opens practically instantly, and switching is just as quick,
 * all while having low memory and CPU usage. Fully-featured minimalism doesn't have to be a compromise.
 * Configurable features a myriad of configurable preferences to ensure the best experience for as many people
 * as possible. Supports all common formats."
 */

export const BRAND_TAGLINE =
  "Beautifully simple. Designed from the very start to be as visually minimal and space efficient as possible. No cluttered interface. Fast and lightweight opens practically instantly, and switching is just as quick, all while having low memory and CPU usage. Fully-featured minimalism doesn't have to be a compromise. Configurable features a myriad of configurable preferences to ensure the best experience for as many people as possible. Supports all common formats.";

export const BRAND_SUMMARY =
  'Fast, lightweight, and beautifully simple Doom source port & mod launcher with zero clutter and instant response.';

export const SUPPORTED_FORMATS = [
  '.wad',
  '.pk3',
  '.pk7',
  '.ipk3',
  '.zip',
  '.deh',
  '.bex',
] as const;

export type SupportedFormatExtension = (typeof SUPPORTED_FORMATS)[number];

export const FORMAT_DESCRIPTIONS: Record<string, { label: string; description: string; badgeColor: string }> = {
  '.wad': {
    label: 'WAD / PWAD',
    description: 'Standard Doom binary lump package',
    badgeColor: 'bg-sky-950/60 text-sky-400 border-sky-800/50',
  },
  '.pk3': {
    label: 'PK3 Archive',
    description: 'ZIP-compressed mod archive with directory structure',
    badgeColor: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50',
  },
  '.pk7': {
    label: 'PK7 / 7Z',
    description: '7-Zip high-compression archive',
    badgeColor: 'bg-amber-950/60 text-amber-400 border-amber-800/50',
  },
  '.ipk3': {
    label: 'IPK3 Game Archive',
    description: 'Standalone game or standalone mod package',
    badgeColor: 'bg-teal-950/60 text-teal-400 border-teal-800/50',
  },
  '.zip': {
    label: 'ZIP Archive',
    description: 'Standard ZIP package containing lumps or assets',
    badgeColor: 'bg-purple-950/60 text-purple-400 border-purple-800/50',
  },
  '.deh': {
    label: 'DEH Patch',
    description: 'DeHackEd engine behavior modification patch',
    badgeColor: 'bg-rose-950/60 text-rose-400 border-rose-800/50',
  },
  '.bex': {
    label: 'BEX Patch',
    description: 'Extended Boom DeHackEd modification patch',
    badgeColor: 'bg-pink-950/60 text-pink-400 border-pink-800/50',
  },
};

export const BRAND_PILLARS = [
  {
    title: 'Beautifully Simple',
    subtitle: 'Zero Clutter',
    description: 'Designed from the start to be as visually minimal and space efficient as possible without visual noise.',
  },
  {
    title: 'Fast & Lightweight',
    subtitle: 'Instant Response',
    description: 'Opens practically instantly, switches views seamlessly, with ultra-low memory and CPU consumption.',
  },
  {
    title: 'Fully-Featured Minimalism',
    subtitle: 'No Compromise',
    description: 'Clean aesthetics combined with professional multi-engine, IWAD, and load-order management.',
  },
  {
    title: 'Deeply Configurable',
    subtitle: 'Tailored Experience',
    description: 'Granular density modes, format visibility controls, and path disclosures to fit your workflow.',
  },
  {
    title: 'Universal Format Support',
    subtitle: 'All Common Formats',
    description: 'Full compatibility with WAD, PK3, PK7, IPK3, ZIP, DEH, and BEX packages.',
  },
] as const;
