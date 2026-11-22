import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUI_SCALE_OPTIONS,
  cycleGuiScale,
  formatGuiScaleLabel,
  normalizeGuiScale,
  resolveGuiScaleFactor,
} from './guiScale.ts';
import { Store } from './store.ts';

test('normalizeGuiScale accepts auto and numeric levels 1..4, falling back to auto', () => {
  assert.equal(normalizeGuiScale('auto'), 'auto');
  assert.equal(normalizeGuiScale('AUTO'), 'auto');
  assert.equal(normalizeGuiScale(1), 1);
  assert.equal(normalizeGuiScale('2'), 2);
  assert.equal(normalizeGuiScale(3), 3);
  assert.equal(normalizeGuiScale('4'), 4);
  assert.equal(normalizeGuiScale(0), 'auto');
  assert.equal(normalizeGuiScale(5), 'auto');
  assert.equal(normalizeGuiScale(null), 'auto');
  assert.equal(normalizeGuiScale('giant'), 'auto');
});

test('cycleGuiScale advances sequentially like Minecraft Video Settings', () => {
  assert.equal(cycleGuiScale('auto'), 1);
  assert.equal(cycleGuiScale(1), 2);
  assert.equal(cycleGuiScale(2), 3);
  assert.equal(cycleGuiScale(3), 4);
  assert.equal(cycleGuiScale(4), 'auto');
  assert.equal(cycleGuiScale(undefined), 1);
});

test('resolveGuiScaleFactor maps discrete levels and auto viewport breakpoints accurately', () => {
  assert.equal(resolveGuiScaleFactor(1, 1440, 900), 0.82);
  assert.equal(resolveGuiScaleFactor(2, 1440, 900), 1);
  assert.equal(resolveGuiScaleFactor(3, 1440, 900), 1.15);
  assert.equal(resolveGuiScaleFactor(4, 1440, 900), 1.3);

  // Auto stays 1.0 on standard desktop & mobile
  assert.equal(resolveGuiScaleFactor('auto', 1440, 900), 1);
  assert.equal(resolveGuiScaleFactor('auto', 1920, 1080), 1);
  assert.equal(resolveGuiScaleFactor('auto', 390, 844), 1);

  // Auto scales down gently on cramped screens and scales up on 2K/4K
  assert.equal(resolveGuiScaleFactor('auto', 320, 640), 0.9);
  assert.equal(resolveGuiScaleFactor('auto', 844, 420), 0.9);
  assert.equal(resolveGuiScaleFactor('auto', 2560, 1440), 1.25);
  assert.equal(resolveGuiScaleFactor('auto', 2200, 1200), 1.15);
});

test('formatGuiScaleLabel formats readable labels for all options', () => {
  assert.equal(GUI_SCALE_OPTIONS.length, 5);
  assert.equal(formatGuiScaleLabel('auto', 1440, 900), 'Auto (100%)');
  assert.equal(formatGuiScaleLabel('auto', 2560, 1440), 'Auto (125%)');
  assert.equal(formatGuiScaleLabel(1, 1440, 900), '1 · Small (82%)');
  assert.equal(formatGuiScaleLabel(2, 1440, 900), '2 · Normal (100%)');
  assert.equal(formatGuiScaleLabel(3, 1440, 900), '3 · Large (115%)');
  assert.equal(formatGuiScaleLabel(4, 1440, 900), '4 · XL (130%)');
});

test('Store.normSettings preserves numeric guiScale values instead of falling back to string default', () => {
  for (const level of ['auto', 1, 2, 3, 4] as const) {
    const normalized = Store.normSettings({ appearance: { guiScale: level } });
    assert.equal(normalized.appearance.guiScale, level);
  }
});
