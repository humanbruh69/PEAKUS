import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeRichNotesHtml,
  plainTextToRichHtml,
  normalizeNotesInput,
  extractPlainTextFromNotes,
  getNotesStats,
  appendLineToRichNotes,
  isRichNotesEmpty,
} from './notesEngine';

test('sanitizeRichNotesHtml strips dangerous scripts, event handlers, and keeps allowed formatting', () => {
  const dirty =
    '<h1 onclick="alert(1)" style="color:red; text-align: center">Heading</h1>' +
    '<script>evil()</script>' +
    '<p onmouseover="hack()"><b>Bold</b> <i>Italic</i> <u>Under</u> <s>Strike</s></p>' +
    '<ul class="notes-checklist"><li class="notes-check-item" data-checked="true"><input type="checkbox" checked onerror="x()">Done</li></ul>';

  const clean = sanitizeRichNotesHtml(dirty);
  assert.ok(!clean.includes('<script>'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('onmouseover'));
  assert.ok(!clean.includes('onerror'));
  assert.ok(!clean.includes('color:red'));
  assert.ok(clean.includes('<h1 style="text-align: center">Heading</h1>'));
  assert.ok(clean.includes('<b>Bold</b>'));
  assert.ok(clean.includes('<i>Italic</i>'));
  assert.ok(clean.includes('<u>Under</u>'));
  assert.ok(clean.includes('<s>Strike</s>'));
  assert.ok(clean.includes('class="notes-checklist"'));
  assert.ok(clean.includes('type="checkbox"'));
});

test('plainTextToRichHtml escapes HTML characters safely and preserves lines', () => {
  const html = plainTextToRichHtml('2 < 3 & 4 > 1\nSecond line');
  assert.equal(html, '<p>2 &lt; 3 &amp; 4 &gt; 1</p><p>Second line</p>');
  assert.equal(extractPlainTextFromNotes(html), '2 < 3 & 4 > 1\nSecond line');
});

test('getNotesStats computes accurate words and characters for empty and rich content', () => {
  assert.deepEqual(getNotesStats(''), { words: 0, characters: 0 });
  assert.deepEqual(getNotesStats('<p><br></p>'), { words: 0, characters: 0 });
  assert.equal(isRichNotesEmpty('<p><br></p>'), true);

  const sample = '<h1>Study Plan</h1><p>Read <b>Chapter 4</b> &amp; solve 5 problems</p>';
  const stats = getNotesStats(sample);
  assert.equal(stats.words, 9); // Study Plan Read Chapter 4 & solve 5 problems
  assert.equal(stats.characters, 'Study Plan'.length + 'Read Chapter 4 & solve 5 problems'.length);
});

test('appendLineToRichNotes merges plain text and existing rich notes cleanly', () => {
  const first = appendLineToRichNotes('', '24 * 7 = 168');
  assert.equal(first, '<p>24 * 7 = 168</p>');

  const second = appendLineToRichNotes('<h1>Math</h1>', 'sin(30) = 0.5');
  assert.equal(second, '<h1>Math</h1><p>sin(30) = 0.5</p>');
  assert.equal(normalizeNotesInput('legacy plain note'), '<p>legacy plain note</p>');
});
