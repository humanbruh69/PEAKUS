import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALLY_THEMES, getTallyTheme, resolveTallyEmojis } from './tallyThemes';

test('TALLY_THEMES contains at least 15 rich emoji progression themes', () => {
  assert.ok(TALLY_THEMES.length >= 15);
  for (const theme of TALLY_THEMES) {
    assert.ok(theme.id);
    assert.ok(theme.name);
    assert.equal(theme.emojis.length, 4);
    for (const emoji of theme.emojis) {
      assert.ok(typeof emoji === 'string' && emoji.length > 0);
    }
  }
});

test('getTallyTheme returns matching theme or default', () => {
  const tree = getTallyTheme('growing_tree');
  assert.equal(tree.id, 'growing_tree');
  assert.deepEqual(tree.emojis, ['🌰', '🌱', '🌿', '🌳']);

  const space = getTallyTheme('space_voyage');
  assert.equal(space.id, 'space_voyage');
  assert.deepEqual(space.emojis, ['🧑‍🚀', '🚀', '🌙', '🪐']);

  const fallback = getTallyTheme('non_existent');
  assert.equal(fallback.id, 'growing_tree');
});

test('resolveTallyEmojis returns 4 emojis for standard 4-cycle pomodoro', () => {
  const emojis = resolveTallyEmojis('flower_bloom', undefined, 4);
  assert.deepEqual(emojis, ['🌱', '🌼', '🌷', '🌸']);
});

test('resolveTallyEmojis supports custom emojis', () => {
  const custom = ['🐱', '🐶', '🦊', '🦁'];
  const emojis = resolveTallyEmojis('custom', custom, 4);
  assert.deepEqual(emojis, custom);
});

test('resolveTallyEmojis scales smoothly to arbitrary cycle counts', () => {
  const twoCycles = resolveTallyEmojis('growing_tree', undefined, 2);
  assert.equal(twoCycles.length, 2);
  assert.equal(twoCycles[0], '🌰');
  assert.equal(twoCycles[1], '🌳');

  const sixCycles = resolveTallyEmojis('growing_tree', undefined, 6);
  assert.equal(sixCycles.length, 6);
  assert.equal(sixCycles[0], '🌰');
  assert.equal(sixCycles[5], '🌳');
});
