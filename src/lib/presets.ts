/**
 * Manages 3 custom Pomodoro presets stored in browser localStorage.
 */
import type { Settings } from '../types';

export interface PomodoroPreset {
  id: string;
  name: string;
  focus: number; // in minutes
  short: number; // in minutes
  long: number;  // in minutes
  cycles: number;
}

export const PRESETS_STORAGE_KEY = 'peakus.custom_pomodoro_presets';

export const DEFAULT_PRESETS: PomodoroPreset[] = [
  {
    id: 'preset-1',
    name: 'Classic 25/5',
    focus: 25,
    short: 5,
    long: 15,
    cycles: 4,
  },
  {
    id: 'preset-2',
    name: 'Deep Work 50/10',
    focus: 50,
    short: 10,
    long: 20,
    cycles: 4,
  },
  {
    id: 'preset-3',
    name: 'Sprint 90/20',
    focus: 90,
    short: 15,
    long: 30,
    cycles: 3,
  },
];

let memoryPresetsStorage: string | null = null;

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryPresetsStorage;
  } catch {
    return memoryPresetsStorage;
  }
}

function safeSet(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
    memoryPresetsStorage = val;
  } catch {
    memoryPresetsStorage = val;
  }
}

export function getCustomPresets(): PomodoroPreset[] {
  try {
    const raw = safeGet(PRESETS_STORAGE_KEY);
    if (!raw) {
      safeSet(PRESETS_STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS));
      return [...DEFAULT_PRESETS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure exactly 3 presets exist
      const presets: PomodoroPreset[] = [];
      for (let i = 0; i < 3; i++) {
        const fallback = DEFAULT_PRESETS[i];
        const item = parsed[i];
        if (item) {
          presets.push({
            id: item.id || fallback.id,
            name: String(item.name || fallback.name).trim() || fallback.name,
            focus: Math.max(1, Math.min(240, Number(item.focus) || fallback.focus)),
            short: Math.max(1, Math.min(60, Number(item.short) || fallback.short)),
            long: Math.max(1, Math.min(120, Number(item.long) || fallback.long)),
            cycles: Math.max(1, Math.min(12, Number(item.cycles) || fallback.cycles)),
          });
        } else {
          presets.push(fallback);
        }
      }
      return presets;
    }
    return [...DEFAULT_PRESETS];
  } catch {
    return [...DEFAULT_PRESETS];
  }
}

export function saveCustomPreset(preset: PomodoroPreset): PomodoroPreset[] {
  const current = getCustomPresets();
  const index = current.findIndex(p => p.id === preset.id);
  const sanitized: PomodoroPreset = {
    id: preset.id,
    name: preset.name.trim() || 'Custom Preset',
    focus: Math.max(1, Math.min(240, Number(preset.focus) || 25)),
    short: Math.max(1, Math.min(60, Number(preset.short) || 5)),
    long: Math.max(1, Math.min(120, Number(preset.long) || 15)),
    cycles: Math.max(1, Math.min(12, Number(preset.cycles) || 4)),
  };

  if (index >= 0) {
    current[index] = sanitized;
  } else {
    current.push(sanitized);
  }

  const result = current.slice(0, 3);
  try {
    safeSet(PRESETS_STORAGE_KEY, JSON.stringify(result));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('peakus:presets-updated', { detail: result }));
    }
  } catch {}
  return result;
}

export function applyPresetToSettings(
  a: Settings | PomodoroPreset,
  b: PomodoroPreset | Settings
): Settings {
  const settings = ('timer' in a ? a : b) as Settings;
  const preset = ('focus' in a && 'short' in a ? a : b) as PomodoroPreset;

  return {
    ...settings,
    timer: {
      ...settings.timer,
      focus: preset.focus,
      short: preset.short,
      long: preset.long,
      cycles: preset.cycles,
    },
  };
}
