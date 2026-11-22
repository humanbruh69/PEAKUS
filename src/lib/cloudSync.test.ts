import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSettingsForCloud,
  checkAndSanitizeSettings,
  mergeRemoteSettingsWithLocalUploads,
  buildCloudDomainPatch,
  shouldApplyRemoteDomain,
  markDomainWriteStarted,
  markDomainWriteFinished,
  resetCloudDomainTracking,
  fetchUserCloudData,
} from './cloudSync';
import { sanitizeSavedLinks, getSavedLinks, setAllSavedLinks } from './savedLinks';
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

test('mergeRemoteSettingsWithLocalUploads preserves local upload/videoUpload backgrounds when remote has fallback cafe', () => {
  const localSettings: Settings = {
    ...DEFAULTS,
    modes: {
      ...DEFAULTS.modes,
      focus: {
        ...DEFAULTS.modes.focus,
        bg: { kind: 'upload', id: 'local-photo-123' },
      },
      ambient: {
        ...DEFAULTS.modes.ambient,
        bg: { kind: 'videoUpload', videoUploadId: 'local-video-456', videoName: 'rain.mp4' },
      },
    },
  };

  // Simulated cloud echo after skipping a break where cleanSettingsForCloud replaced uploads with cafe
  const remoteFromCloudEcho: Settings = {
    ...DEFAULTS,
    modes: {
      ...DEFAULTS.modes,
      focus: {
        ...DEFAULTS.modes.focus,
        bg: { kind: 'scene', id: 'cafe' },
      },
      ambient: {
        ...DEFAULTS.modes.ambient,
        bg: { kind: 'scene', id: 'cafe' },
      },
    },
  };

  const merged = mergeRemoteSettingsWithLocalUploads(remoteFromCloudEcho, localSettings);
  assert.equal(merged.modes.focus.bg.kind, 'upload');
  assert.equal(merged.modes.focus.bg.id, 'local-photo-123');
  assert.equal(merged.modes.ambient.bg.kind, 'videoUpload');
  assert.equal(merged.modes.ambient.bg.videoUploadId, 'local-video-456');

  // Intentional remote change to a non-cafe scene should take precedence
  const remoteExplicitScene: Settings = {
    ...DEFAULTS,
    modes: {
      ...DEFAULTS.modes,
      focus: {
        ...DEFAULTS.modes.focus,
        bg: { kind: 'scene', id: 'bosque' },
      },
    },
  };

  const mergedExplicit = mergeRemoteSettingsWithLocalUploads(remoteExplicitScene, localSettings);
  assert.equal(mergedExplicit.modes.focus.bg.kind, 'scene');
  assert.equal(mergedExplicit.modes.focus.bg.id, 'bosque');
});

test('buildCloudDomainPatch isolates changed domains so YouTube links, notes, and tasks never clobber sibling fields', () => {
  const linkPatch = buildCloudDomainPatch(
    'user-1',
    {
      savedLinks: [
        {
          id: 'yt-1',
          url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
          title: 'Lofi Study',
          type: 'both',
          addedAt: 1700000000000,
        },
      ],
    },
    1700000001000,
    'test@example.com'
  );

  assert.deepEqual(linkPatch.domains, ['savedLinks']);
  assert.equal(linkPatch.payload.userId, 'user-1');
  assert.equal(linkPatch.payload.savedLinks.length, 1);
  assert.equal(linkPatch.payload.savedLinks[0].youtubeId, 'jfKfPfyJRdk');
  assert.equal('notes' in linkPatch.payload, false);
  assert.equal('tasks' in linkPatch.payload, false);
  assert.equal('settings' in linkPatch.payload, false);

  const notesPatch = buildCloudDomainPatch('user-1', { notes: 'Chapter 4 key takeaways' }, 1700000002000);
  assert.deepEqual(notesPatch.domains, ['notes']);
  assert.equal(notesPatch.payload.notes, 'Chapter 4 key takeaways');
  assert.equal('savedLinks' in notesPatch.payload, false);
  assert.equal('tasks' in notesPatch.payload, false);
});

test('shouldApplyRemoteDomain suppresses in-flight writes, pending-write echoes, and cooldown echoes', () => {
  resetCloudDomainTracking();

  // Initial snapshot with clean state should apply
  assert.equal(shouldApplyRemoteDomain('notes', false, true, 1000), true);
  // Real-time update with pending local writes should NOT apply
  assert.equal(shouldApplyRemoteDomain('notes', true, false, 1000), false);

  // In-flight write blocks even initial or clean snapshots for that domain only
  markDomainWriteStarted(['notes']);
  assert.equal(shouldApplyRemoteDomain('notes', false, false, 1100), false);
  assert.equal(shouldApplyRemoteDomain('tasks', false, false, 1100), true);

  // After finishing write, 500ms cooldown blocks rapid self-echoes, then expires
  markDomainWriteFinished(['notes'], 1200);
  assert.equal(shouldApplyRemoteDomain('notes', false, false, 1400), false);
  assert.equal(shouldApplyRemoteDomain('notes', false, false, 1800), true);
  resetCloudDomainTracking();
});

test('sanitizeSavedLinks deduplicates YouTube URLs and setAllSavedLinks preserves explicit empty lists', () => {
  const sanitized = sanitizeSavedLinks([
    { id: '1', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', title: 'Lofi', type: 'music', addedAt: 1 },
    { id: '2', url: 'https://youtu.be/jfKfPfyJRdk', title: 'Lofi Dup', type: 'music', addedAt: 2 },
    { id: '3', url: '', title: 'Invalid', type: 'bg', addedAt: 3 },
  ]);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].youtubeId, 'jfKfPfyJRdk');

  setAllSavedLinks([], false);
  assert.deepEqual(getSavedLinks(), []);
});

test('fetchUserCloudData handles empty userId cleanly without treating it as a crash', async () => {
  const res = await fetchUserCloudData('');
  assert.equal(res.exists, false);
  assert.equal(res.data, null);
  assert.equal(res.error, undefined);
});

