import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomCode, normalizeRoomCode } from './studyRooms';

test('generateRoomCode produces valid 6-char uppercase code without ambiguous letters', () => {
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    assert.equal(code.includes('0'), false);
    assert.equal(code.includes('O'), false);
    assert.equal(code.includes('1'), false);
    assert.equal(code.includes('I'), false);
  }
});

test('normalizeRoomCode cleans punctuation, spaces, and forces uppercase', () => {
  assert.equal(normalizeRoomCode('study-8'), 'STUDY8');
  assert.equal(normalizeRoomCode('  focus 99  '), 'FOCUS99');
  assert.equal(normalizeRoomCode('p#e@a$k!9*9'), 'PEAK99');
  assert.equal(normalizeRoomCode('abcdefghijk'), 'ABCDEFGH'); // max 8 chars
});
