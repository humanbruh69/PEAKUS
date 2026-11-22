import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampVolume,
  clampSeekSeconds,
  fmtMediaTime,
  computeProgressRatio,
  isLiveYouTubeStream,
} from './ytMusicMath';

test('clampVolume bounds volume cleanly between 0 and 100', () => {
  assert.equal(clampVolume(-15), 0);
  assert.equal(clampVolume(0), 0);
  assert.equal(clampVolume(42.6), 43);
  assert.equal(clampVolume(140), 100);
  assert.equal(clampVolume(Number.NaN), 70);
});

test('clampSeekSeconds constrains seek timestamp to valid media duration', () => {
  assert.equal(clampSeekSeconds(-10, 300), 0);
  assert.equal(clampSeekSeconds(125, 300), 125);
  assert.equal(clampSeekSeconds(450, 300), 300);
});

test('fmtMediaTime formats seconds cleanly including hour-long study mixes', () => {
  assert.equal(fmtMediaTime(0), '0:00');
  assert.equal(fmtMediaTime(65), '1:05');
  assert.equal(fmtMediaTime(3661), '1:01:01');
  assert.equal(fmtMediaTime(-5), '0:00');
});

test('computeProgressRatio and live detection behave safely', () => {
  assert.equal(computeProgressRatio(50, 200), 0.25);
  assert.equal(computeProgressRatio(250, 200), 1);
  assert.equal(computeProgressRatio(10, 0), 0);
  assert.equal(isLiveYouTubeStream(0), true);
  assert.equal(isLiveYouTubeStream(1800, false), false);
  assert.equal(isLiveYouTubeStream(1800, true), true);
});
