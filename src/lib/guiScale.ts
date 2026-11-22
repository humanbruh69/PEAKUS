import type { GuiScaleSetting } from '../types';

export interface GuiScaleOption {
  value: GuiScaleSetting;
  shortLabel: string;
  minecraftName: string;
  factor: number | null;
}

export const GUI_SCALE_OPTIONS: readonly GuiScaleOption[] = [
  { value: 'auto', shortLabel: 'Auto', minecraftName: 'Auto', factor: null },
  { value: 1, shortLabel: '1 · Small', minecraftName: 'Small', factor: 0.82 },
  { value: 2, shortLabel: '2 · Normal', minecraftName: 'Normal', factor: 1 },
  { value: 3, shortLabel: '3 · Large', minecraftName: 'Large', factor: 1.15 },
  { value: 4, shortLabel: '4 · XL', minecraftName: 'Extra Large', factor: 1.3 },
] as const;

export const GUI_SCALE_ORDER: readonly GuiScaleSetting[] = ['auto', 1, 2, 3, 4];

/**
 * Normalizes any persisted/untrusted guiScale value to a valid Minecraft-style GUI scale setting.
 */
export function normalizeGuiScale(value: unknown): GuiScaleSetting {
  if (value === 'auto' || value === 'AUTO') return 'auto';
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (num === 1 || num === 2 || num === 3 || num === 4) {
    return num;
  }
  return 'auto';
}

/**
 * Cycles through GUI scale modes just like clicking Minecraft's "GUI Scale" button:
 * Auto -> 1 (Small) -> 2 (Normal) -> 3 (Large) -> 4 (Extra Large) -> Auto
 */
export function cycleGuiScale(current: unknown): GuiScaleSetting {
  const normalized = normalizeGuiScale(current);
  const idx = GUI_SCALE_ORDER.indexOf(normalized);
  const nextIdx = (idx + 1) % GUI_SCALE_ORDER.length;
  return GUI_SCALE_ORDER[nextIdx];
}

/**
 * Resolves the concrete numeric CSS scale factor for a GUI scale setting and viewport size.
 * In `'auto'` mode, standard laptop/desktop/mobile viewports stay at `1`, ultra-compact
 * viewports scale down gently (`0.9`) for breathing room, and 2K/4K displays scale up (`1.15`/`1.25`).
 */
export function resolveGuiScaleFactor(
  mode: unknown,
  viewportWidth = 1440,
  viewportHeight = 900
): number {
  const normalized = normalizeGuiScale(mode);
  if (normalized === 1) return 0.82;
  if (normalized === 2) return 1;
  if (normalized === 3) return 1.15;
  if (normalized === 4) return 1.3;

  const w = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1440;
  const h = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 900;

  if (w < 360 || h < 540) return 0.9;
  if (w >= 2560 && h >= 1350) return 1.25;
  if (w >= 2000 && h >= 1100) return 1.15;
  return 1;
}

/**
 * Formats the Minecraft-style cycle button label, e.g. "GUI Scale: Auto (100%)" or "GUI Scale: 3 · Large (115%)".
 */
export function formatGuiScaleLabel(
  mode: unknown,
  viewportWidth = 1440,
  viewportHeight = 900
): string {
  const normalized = normalizeGuiScale(mode);
  const factor = resolveGuiScaleFactor(normalized, viewportWidth, viewportHeight);
  const pct = Math.round(factor * 100);
  if (normalized === 'auto') {
    return `Auto (${pct}%)`;
  }
  const opt = GUI_SCALE_OPTIONS.find(o => o.value === normalized);
  return `${opt ? opt.shortLabel : normalized} (${pct}%)`;
}
