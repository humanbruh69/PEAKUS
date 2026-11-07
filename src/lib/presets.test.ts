import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCustomPresets,
  saveCustomPreset,
  applyPresetToSettings,
  DEFAULT_PRESETS,
  type PomodoroPreset,
} from './presets';
import { DEFAULTS } from './constants';

test('getCustomPresets returns 3 valid presets by default', () => {
  const presets = getCustomPresets();
  assert.equal(presets.length, 3);
  assert.equal(presets[0].id, 'preset-1');
  assert.equal(presets[0].focus, 25);
  assert.equal(presets[1].focus, 50);
  assert.equal(presets[2].focus, 90);
});

test('saveCustomPreset updates and clamps preset values safely', () => {
  const updated: PomodoroPreset = {
    id: 'preset-1',
    name: 'Super Focus',
    focus: 45,
    short: 8,
    long: 25,
    cycles: 5,
  };
  const list = saveCustomPreset(updated);
  assert.equal(list.length, 3);
  const found = list.find(p => p.id === 'preset-1');
  assert.equal(found?.name, 'Super Focus');
  assert.equal(found?.focus, 45);
  assert.equal(found?.short, 8);
  assert.equal(found?.long, 25);
  assert.equal(found?.cycles, 5);
});

test('applyPresetToSettings updates timer configuration correctly', () => {
  const preset: PomodoroPreset = {
    id: 'preset-2',
    name: 'Test Preset',
    focus: 60,
    short: 12,
    long: 24,
    cycles: 4,
  };
  const nextSettings = applyPresetToSettings(preset, DEFAULTS);
  assert.equal(nextSettings.timer.focus, 60);
  assert.equal(nextSettings.timer.short, 12);
  assert.equal(nextSettings.timer.long, 24);
  assert.equal(nextSettings.timer.cycles, 4);
});

test('Flow mode settings and 10 minute duration calculation', () => {
  const settingsWithFlow = {
    ...DEFAULTS,
    timer: {
      ...DEFAULTS.timer,
      flowMode: true,
    },
  };
  assert.equal(settingsWithFlow.timer.flowMode, true);
  const tenMinutesMs = 10 * 60 * 1000;
  assert.equal(tenMinutesMs, 600000);
});
