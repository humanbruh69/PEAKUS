/**
 * YouTube Utility & Presets for Background Videos and Music Streams
 */

export interface YouTubePreset {
  id: string;
  title: string;
  category: 'lofi' | 'nature' | 'rain' | 'ambient' | 'tamil' | 'piano' | 'synth';
  url: string;
  author?: string;
}

export interface DirectVideoPreset {
  id: string;
  title: string;
  url: string;
  category: string;
}

export const DIRECT_VIDEO_PRESETS: DirectVideoPreset[] = [
  {
    id: 'rain-loop',
    title: 'Rain Drops on Window (HD Loop)',
    url: '/videos/rain-loop.mp4',
    category: 'rain',
  },
  {
    id: 'fireplace-loop',
    title: 'Cozy Fireplace Wood Fire (HD Loop)',
    url: '/videos/fireplace-loop.mp4',
    category: 'ambient',
  },
  {
    id: 'waves-loop',
    title: 'Sunset Ocean Waves (HD Loop)',
    url: '/videos/waves-loop.mp4',
    category: 'nature',
  },
  {
    id: 'aurora-loop',
    title: 'Northern Lights Aurora (HD Loop)',
    url: '/videos/aurora-loop.mp4',
    category: 'ambient',
  },
];

export const YOUTUBE_BG_PRESETS: YouTubePreset[] = [
  {
    id: '5qap5aO4i9A',
    title: 'Lofi Girl - Beats to relax/study to',
    category: 'lofi',
    url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    author: 'Lofi Girl',
  },
  {
    id: 'yIQd2Ya0Ziw',
    title: 'Rainstorm Sounds for Deep Focus',
    category: 'rain',
    url: 'https://www.youtube.com/watch?v=yIQd2Ya0Ziw',
    author: 'Calm Nature',
  },
  {
    id: 'eKFTSSKCzWA',
    title: 'Forest Stream & Waterfall',
    category: 'nature',
    url: 'https://www.youtube.com/watch?v=eKFTSSKCzWA',
    author: 'Nature Sound',
  },
  {
    id: 'UgHKb_7884o',
    title: 'Cozy Fireplace Crackling Ambience',
    category: 'ambient',
    url: 'https://www.youtube.com/watch?v=UgHKb_7884o',
    author: 'Fireplace Cozy',
  },
  {
    id: '4xDzrJKXOOY',
    title: 'Synthwave Radio - Beats to Chill',
    category: 'synth',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    author: 'Lofi Girl',
  },
  {
    id: 'lCOF9LN_Zxs',
    title: 'Peaceful Piano Focus',
    category: 'piano',
    url: 'https://www.youtube.com/watch?v=lCOF9LN_Zxs',
    author: 'Peder B. Helland',
  },
  {
    id: '11rbWfSMev0',
    title: 'Tamil Lofi Chill Melodies (தமிழ் லோஃபை)',
    category: 'tamil',
    url: 'https://www.youtube.com/watch?v=11rbWfSMev0',
    author: 'eternaL',
  },
  {
    id: 'MIa10YEvqnw',
    title: 'A.R. Rahman Soulful Tamil Melodies',
    category: 'tamil',
    url: 'https://www.youtube.com/watch?v=MIa10YEvqnw',
    author: 'Akash Justin',
  },
];

export const YOUTUBE_MUSIC_PRESETS: YouTubePreset[] = [
  {
    id: '5qap5aO4i9A',
    title: 'Lofi Girl - Beats to relax/study to',
    category: 'lofi',
    url: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
    author: 'Lofi Girl',
  },
  {
    id: 'lCOF9LN_Zxs',
    title: 'Peaceful Piano Focus',
    category: 'piano',
    url: 'https://www.youtube.com/watch?v=lCOF9LN_Zxs',
    author: 'Peder B. Helland',
  },
  {
    id: '11rbWfSMev0',
    title: 'Tamil Lofi & Chill Melodies (தமிழ் லோஃபை)',
    category: 'tamil',
    url: 'https://www.youtube.com/watch?v=11rbWfSMev0',
    author: 'eternaL',
  },
  {
    id: 'MIa10YEvqnw',
    title: 'A.R. Rahman Soulful Tamil Instrumental',
    category: 'tamil',
    url: 'https://www.youtube.com/watch?v=MIa10YEvqnw',
    author: 'Akash Justin',
  },
  {
    id: '4xDzrJKXOOY',
    title: 'Synthwave Radio - Chill Synth',
    category: 'synth',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    author: 'Lofi Girl',
  },
  {
    id: 'yIQd2Ya0Ziw',
    title: 'Gentle Rainstorm Ambience',
    category: 'rain',
    url: 'https://www.youtube.com/watch?v=yIQd2Ya0Ziw',
    author: 'Calm Nature',
  },
  {
    id: 'WPni755-Krg',
    title: 'Deep Focus Alpha Waves 432Hz',
    category: 'ambient',
    url: 'https://www.youtube.com/watch?v=WPni755-Krg',
    author: 'Binaural Study',
  },
];

/**
 * Extracts the 11-character YouTube video ID from various URL formats
 */
export function extractYouTubeId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const clean = urlOrId.trim();

  // If already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // Handle standard youtu.be/ID
  const youtuBeMatch = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  if (youtuBeMatch && youtuBeMatch[1]) {
    return youtuBeMatch[1];
  }

  // Handle youtube.com/watch?v=ID (with possible extra query parameters)
  const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  return null;
}

/**
 * Checks if a string is a direct URL to a video file (.mp4, .webm, .mov, etc.)
 */
export function isDirectVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.startsWith('blob:') ||
    clean.startsWith('data:video') ||
    /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(clean) ||
    clean.includes('.mp4?') ||
    clean.includes('.webm?')
  );
}

/**
 * Formats a clean standard YouTube URL from a video ID
 */
export function buildYouTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Builds the URL for background video iframe embedding
 */
export function buildBackgroundEmbedUrl(videoId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&showinfo=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(origin)}`;
}

/**
 * Builds the URL for music stream iframe embedding
 */
export function buildMusicEmbedUrl(videoId: string, volume: number = 70): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&playsinline=1&enablejsapi=1`;
}
