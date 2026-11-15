import test from 'node:test';
import assert from 'node:assert/strict';
import { TOXIC_MOTIVATION_QUOTES, getActiveQuoteList, selectStageQuote } from './toxicQuotes';

test('TOXIC_MOTIVATION_QUOTES contains all 35 English and Tamil entries', () => {
  assert.equal(TOXIC_MOTIVATION_QUOTES.length, 35);
  for (const item of TOXIC_MOTIVATION_QUOTES) {
    assert.ok(item.english.trim().length > 0);
    assert.ok(item.tamil.trim().length > 0);
  }
});

test('getActiveQuoteList returns Tamil or English toxic quotes when enabled', () => {
  const enToxic = getActiveQuoteList('en', true);
  const taToxic = getActiveQuoteList('ta', true);
  assert.equal(enToxic.length, 35);
  assert.equal(taToxic.length, 35);
  assert.equal(enToxic[0], 'You are supposed to suffer.');
  assert.equal(taToxic[0], 'நீ கஷ்டப்பட வேண்டியவன்தான்.');

  const enNormal = getActiveQuoteList('en', false);
  assert.ok(!enNormal.includes('You are supposed to suffer.'));
});

test('selectStageQuote respects toxicMotivation toggle and custom quote override', () => {
  const now = new Date('2026-11-15T10:00:00Z');
  const toxicQuote = selectStageQuote(
    { show: true, rotation: 'daily', custom: '', useCustom: false, toxicMotivation: true },
    'en',
    now
  );
  assert.ok(TOXIC_MOTIVATION_QUOTES.some(q => q.english === toxicQuote));

  const customOverride = selectStageQuote(
    { show: true, rotation: 'daily', custom: 'Stay locked in', useCustom: true, toxicMotivation: true },
    'en',
    now
  );
  assert.equal(customOverride, 'Stay locked in');
});
