import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FALLBACK_HUMILIATION_LINES,
  HUMILIATION_JSON_PATH,
  pickRandomHumiliationLine,
} from './humiliation';

test('humiliation lines match attached humiliation_f970ee98.json asset', () => {
  const assetPath = path.resolve(process.cwd(), 'public' + HUMILIATION_JSON_PATH);
  const raw = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
  assert.equal(raw.lines.length, 20);
  assert.equal(FALLBACK_HUMILIATION_LINES.length, 20);
  assert.equal(FALLBACK_HUMILIATION_LINES[0].english, raw.lines[0].english);
  assert.equal(FALLBACK_HUMILIATION_LINES[19].tamil, raw.lines[19].tamil);
});

test('pickRandomHumiliationLine picks deterministically within pool bounds', () => {
  const first = pickRandomHumiliationLine(FALLBACK_HUMILIATION_LINES, () => 0);
  assert.equal(first.id, 1);

  const last = pickRandomHumiliationLine(FALLBACK_HUMILIATION_LINES, () => 0.9999);
  assert.equal(last.id, 20);

  const fallback = pickRandomHumiliationLine([], () => 0.25);
  assert.ok(fallback.english.length > 0);
});
