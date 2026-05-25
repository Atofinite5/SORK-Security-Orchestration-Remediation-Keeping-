/**
 * SORK Pastel Color Palette
 * All colors are desaturated, soft — never bright or harsh.
 */

import chalk from 'chalk';

export const c = {
  // ── Semantic ─────────────────────────────────────────────
  critical: (s: string) => chalk.hex('#ffadad')(s), // pastel red
  high: (s: string) => chalk.hex('#ffcb8e')(s), // pastel amber
  medium: (s: string) => chalk.hex('#fff3a3')(s), // pastel yellow
  low: (s: string) => chalk.hex('#b5d5ff')(s), // pastel blue
  ok: (s: string) => chalk.hex('#aadfb4')(s), // pastel green
  info: (s: string) => chalk.hex('#c8c8ff')(s), // pastel lavender
  accent: (s: string) => chalk.hex('#a8e6ef')(s), // pastel cyan

  // ── Neutrals ─────────────────────────────────────────────
  white: (s: string) => chalk.hex('#dce1e7')(s), // off-white
  label: (s: string) => chalk.hex('#b0b8c1')(s), // label grey
  dim: (s: string) => chalk.hex('#5c6672')(s), // muted grey
  faint: (s: string) => chalk.hex('#3d444c')(s), // very dark grey

  // ── Backgrounds (for badges) ──────────────────────────────
  bgCritical: (s: string) => chalk.bgHex('#5c2020').hex('#ffadad')(s),
  bgHigh: (s: string) => chalk.bgHex('#4a2e0a').hex('#ffcb8e')(s),
  bgOk: (s: string) => chalk.bgHex('#0d3318').hex('#aadfb4')(s),

  // ── Named pastel shades ───────────────────────────────────
  red: (s: string) => chalk.hex('#ffadad')(s),
  amber: (s: string) => chalk.hex('#ffcb8e')(s),
  yellow: (s: string) => chalk.hex('#fff3a3')(s),
  green: (s: string) => chalk.hex('#aadfb4')(s),
  teal: (s: string) => chalk.hex('#a8e6ef')(s),
  blue: (s: string) => chalk.hex('#b5d5ff')(s),
  purple: (s: string) => chalk.hex('#d4bdff')(s),
  pink: (s: string) => chalk.hex('#ffbde0')(s),
  grey: (s: string) => chalk.hex('#b0b8c1')(s),
};

// Severity → pastel color
export function sevColor(severity: string): (s: string) => string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return c.critical;
    case 'HIGH':
      return c.high;
    case 'MEDIUM':
      return c.medium;
    case 'LOW':
      return c.low;
    default:
      return c.dim;
  }
}

// Severity → pastel badge  [CRITICAL]
export function sevBadge(severity: string): string {
  const col = sevColor(severity);
  return col(`[${severity.toLowerCase()}]`);
}

export function rule(width = 58, char = '─'): string {
  return c.faint(char.repeat(width));
}

export function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
