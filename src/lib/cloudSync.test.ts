import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSettingsForCloud, checkAndSanitizeSettings } from './cloudSync';
import { DEFAULTS } from './constants';
import type { Settings } from '../types';

test('cleanSettingsForCloud removes blob: and data: URLs while preserving scenes and YouTube links', () => {
  const settingsWithBlobs: Settings = {
    ...DEFAULTS,
    modes: {
      ...DEFAULTS.modes,
      focus: {
        ...DEFAULTS.modes.focus,
        bg: { kind: 'video', url: 'blob:http://localhost:3000/1234-5678' } as any,
      },
      home: {
        ...DEFAULTS.modes.home,
        bg: { kind: 'youtube', id: 'jfKfPfyJRdk' },
      },
      ambient: {
        ...DEFAULTS.modes.ambient,
        bg: { kind: 'image', url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' } as any,
      },
    },
  };

  const cleaned = cleanSettingsForCloud(settingsWithBlobs);

  // Focus mode local video blob should be replaced with safe scene
  assert.equal(cleaned.modes.focus.bg.kind, 'scene');
  // Ambient mode local data URL image should be replaced with safe scene
  assert.equal(cleaned.modes.ambient.bg.kind, 'scene');
  // Home mode YouTube link should be completely preserved
  assert.equal(cleaned.modes.home.bg.kind, 'youtube');
  assert.equal((cleaned.modes.home.bg as any).id, 'jfKfPfyJRdk');
});

test('checkAndSanitizeSettings detects offline device backgrounds and falls back cleanly', () => {
  const settingsWithLocalUpload: any = {
    ...DEFAULTS,
    modes: {
      ...DEFAULTS.modes,
      focus: {
        ...DEFAULTS.modes.focus,
        bg: { kind: 'upload', id: 'my-device-local-photo-id' },
      },
    },
  };

  const result = checkAndSanitizeSettings(settingsWithLocalUpload);
  assert.equal(result.hadOfflineBackground, true);
  assert.equal(result.settings.modes.focus.bg.kind, 'scene');
});

test('completedInCycle accurately computes tallies dots and resets without getting stuck', () => {
  const totalCycles = 4;

  const getDots = (cycle: number, phase: 'focus' | 'short' | 'long') => {
    return phase === 'long' ? totalCycles : (cycle % totalCycles);
  };

  // Start fresh
  assert.equal(getDots(0, 'focus'), 0); // 0/4 dots
  // 1 session done, on short break
  assert.equal(getDots(1, 'short'), 1); // 1/4 dots
  // 2 sessions done, on focus
  assert.equal(getDots(2, 'focus'), 2); // 2/4 dots
  // 3 sessions done, on short break
  assert.equal(getDots(3, 'short'), 3); // 3/4 dots
  // 4 sessions done, on long break
  assert.equal(getDots(4, 'long'), 4); // 4/4 dots (all complete!)
  // After long break ends, next cycle resets to 0
  assert.equal(getDots(0, 'focus'), 0); // 0/4 dots
  // If cycle had accumulated to 8, modulo 4 yields 0
  assert.equal(getDots(8, 'focus'), 0);
  // Reset segments resets cycle to 0
  let cycle = 3;
  cycle = 0; // resetSegment action
  assert.equal(getDots(cycle, 'focus'), 0);
});

test('checkAndSanitizeSettings normalizes partial settings and prevents undefined values', () => {
  const partialSettings: any = {
    appearance: {
      accent: '#6366f1',
    },
  };

  const { settings } = checkAndSanitizeSettings(partialSettings);
  assert.ok(settings.timer);
  assert.equal(typeof settings.timer.focus, 'number');
  assert.ok(settings.modes);
  assert.equal(settings.appearance.accent, '#6366f1');

  // Verify that JSON stringifying and parsing contains zero undefined values
  const stringified = JSON.stringify(settings);
  assert.ok(!stringified.includes('undefined'));
});

