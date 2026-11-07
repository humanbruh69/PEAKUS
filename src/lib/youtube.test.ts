import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeId,
  buildYouTubeWatchUrl,
  buildBackgroundEmbedUrl,
  isDirectVideoUrl,
  YOUTUBE_BG_PRESETS,
  YOUTUBE_MUSIC_PRESETS,
  DIRECT_VIDEO_PRESETS,
} from './youtube';
import { t, TRANSLATIONS, MULTILINGUAL_QUOTES } from './i18n';

test('extractYouTubeId extracts ID from full youtube.com/watch?v= URLs', () => {
  assert.equal(
    extractYouTubeId('https://www.youtube.com/watch?v=jfKfPfyJRdk'),
    'jfKfPfyJRdk'
  );
  assert.equal(
    extractYouTubeId('https://www.youtube.com/watch?v=M0W27N5U1mE&t=120s'),
    'M0W27N5U1mE'
  );
});

test('extractYouTubeId extracts ID from youtu.be short links', () => {
  assert.equal(
    extractYouTubeId('https://youtu.be/4xDzrJKXOOY'),
    '4xDzrJKXOOY'
  );
  assert.equal(
    extractYouTubeId('http://youtu.be/BNP_4t6p_hM?si=123'),
    'BNP_4t6p_hM'
  );
});

test('extractYouTubeId extracts ID from embed and shorts links', () => {
  assert.equal(
    extractYouTubeId('https://www.youtube.com/embed/fJ9rUzIMcZQ'),
    'fJ9rUzIMcZQ'
  );
  assert.equal(
    extractYouTubeId('https://www.youtube.com/shorts/5qap5aO4i9A'),
    '5qap5aO4i9A'
  );
});

test('extractYouTubeId accepts raw 11-char ID', () => {
  assert.equal(extractYouTubeId('jfKfPfyJRdk'), 'jfKfPfyJRdk');
});

test('extractYouTubeId returns null for invalid input', () => {
  assert.equal(extractYouTubeId(''), null);
  assert.equal(extractYouTubeId('not-a-valid-url'), null);
  assert.equal(extractYouTubeId('https://vimeo.com/12345678'), null);
});

test('isDirectVideoUrl accurately detects video URLs', () => {
  assert.equal(isDirectVideoUrl('https://example.com/video.mp4'), true);
  assert.equal(isDirectVideoUrl('https://example.com/stream.webm?token=abc'), true);
  assert.equal(isDirectVideoUrl('blob:http://localhost:3000/123-abc'), true);
  assert.equal(isDirectVideoUrl('https://youtube.com/watch?v=12345678901'), false);
  assert.equal(isDirectVideoUrl('https://example.com/image.jpg'), false);
});

test('buildBackgroundEmbedUrl generates correct embed parameters with youtube.com', () => {
  const url = buildBackgroundEmbedUrl('jfKfPfyJRdk');
  assert.ok(url.includes('/embed/jfKfPfyJRdk'));
  assert.ok(url.includes('autoplay=1'));
  assert.ok(url.includes('mute=1'));
  assert.ok(url.includes('loop=1'));
});

test('presets exist and have valid YouTube IDs and video URLs', () => {
  assert.ok(YOUTUBE_BG_PRESETS.length >= 6);
  assert.ok(YOUTUBE_MUSIC_PRESETS.length >= 6);
  assert.ok(DIRECT_VIDEO_PRESETS.length >= 4);
  for (const preset of [...YOUTUBE_BG_PRESETS, ...YOUTUBE_MUSIC_PRESETS]) {
    assert.equal(extractYouTubeId(preset.url), preset.id);
  }
  for (const video of DIRECT_VIDEO_PRESETS) {
    assert.ok(isDirectVideoUrl(video.url));
  }
});

test('translations dictionary has all keys defined for English and Tamil', () => {
  const enKeys = Object.keys(TRANSLATIONS.en);
  const taKeys = Object.keys(TRANSLATIONS.ta);
  assert.equal(enKeys.length, taKeys.length);
  assert.equal(t('appName', 'en'), 'Peakus');
  assert.equal(t('appName', 'ta'), 'Peakus');
  assert.equal(t('tagline', 'en'), 'max your focus');
  assert.ok(t('tagline', 'ta').length > 0);
  assert.equal(t('creditsHandle', 'en'), 'human.exr');
  assert.equal(t('creditsHandle', 'ta'), 'human.exr');
  assert.equal(t('creditsHandle', 'es'), 'human.exr');
});

test('quotes exist for English, Tamil and Spanish', () => {
  assert.ok(MULTILINGUAL_QUOTES.en.length >= 20);
  assert.ok(MULTILINGUAL_QUOTES.ta.length >= 15);
  assert.ok(MULTILINGUAL_QUOTES.es.length >= 20);
});

import { getSavedLinks, saveLink, deleteSavedLink, clearSavedLinks } from './savedLinks';

test('savedLinks saves and retrieves user pasted YouTube links correctly', () => {
  clearSavedLinks();
  const initial = getSavedLinks();
  assert.ok(Array.isArray(initial));

  const saved = saveLink('https://www.youtube.com/watch?v=M0W27N5U1mE', 'Custom Cyberpunk Stream', 'music');
  assert.ok(saved);
  assert.equal(saved?.youtubeId, 'M0W27N5U1mE');
  assert.equal(saved?.title, 'Custom Cyberpunk Stream');

  const links = getSavedLinks();
  assert.equal(links[0].youtubeId, 'M0W27N5U1mE');

  // Deleting link works
  deleteSavedLink(saved!.id);
  const afterDelete = getSavedLinks();
  assert.ok(!afterDelete.some(l => l.id === saved!.id));
});

