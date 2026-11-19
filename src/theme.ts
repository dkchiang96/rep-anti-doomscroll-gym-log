import type { TextStyle } from 'react-native';

// Design tokens — DESIGN-SPEC.md §2 (colour) and §3 (type).
// No component may contain a literal hex value or a literal font family string;
// everything comes from here.

export const fontFamily = {
  display: 'BebasNeue-Regular',
  body: 'Inter-Regular',
  bodySemiBold: 'Inter-SemiBold',
} as const;

export const color = {
  bg: '#0D0D0D',
  bar: '#1A1A1A',
  slabPrimary: '#F2F24B',
  slabSecondary: '#A5E838',
  onSlab: '#000000',
  textPrimary: '#FFFFFF',
  textMuted: '#8A8A8A',
  divider: '#2A2A2A',
  danger: '#E5484D',
} as const;

// §3 scale. `size` in dp, `lineHeight` pre-multiplied per the spec's ratio.
// `timer` has no fixed size — Clock self-calibrates against viewport width,
// see components/ui/Clock.tsx.
const UPPERCASE = { textTransform: 'uppercase' } as const;

export const type = {
  display1: { fontFamily: fontFamily.display, fontSize: 64, lineHeight: 64 * 0.9, ...UPPERCASE },
  display2: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 40 * 1.0, ...UPPERCASE },
  heading: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 28 * 1.1, ...UPPERCASE },
  label: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 18 * 1.2, ...UPPERCASE },
  caption: { fontFamily: fontFamily.display, fontSize: 14, lineHeight: 14 * 1.3, ...UPPERCASE },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 16 * 1.5 },
} as const;

// Not `as const`: RN's TextStyle wants a mutable FontVariant[], and a
// readonly tuple isn't assignable to it.
export const tabularNums: Pick<TextStyle, 'fontVariant'> = { fontVariant: ['tabular-nums'] };

// §4/§5 fixed dp sizes. Everything else is a percentage or a flex ratio.
export const size = {
  topBar: 56,
  bottomSlab: 80,
  listRow: 72,
  listRowPadding: 24,
  setRow: 88,
  stepper: 72,
  warmupToggle: 56,
  transportLarge: 120,
  transportSmall: 56,
  divider: 1,
  minTouchTarget: 56,
} as const;

// §5.1 zone mapping for the live workout screen, resolved against the
// measured Timer Plus reference (see plan doc) rather than the spec's
// unreconciled 20–25% canvas figure. Top bar and bottom slab are fixed dp;
// the remainder splits by this ratio.
export const liveZoneFlex = {
  yellow: 40,
  lime: 18,
  canvas: 38,
} as const;

export const theme = {
  color,
  type,
  size,
  fontFamily,
  tabularNums,
  liveZoneFlex,
  minTouchTarget: size.minTouchTarget,
} as const;
