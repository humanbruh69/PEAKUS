/**
 * Manages persisted user-pasted YouTube links & videos in browser localStorage.
 */
import { extractYouTubeId, isDirectVideoUrl } from './youtube';

export interface SavedLinkItem {
  id: string;
  url: string;
  youtubeId?: string;
  title: string;
  type: 'bg' | 'music' | 'both';
  addedAt: number;
}

const STORAGE_KEY = 'peakus.saved_youtube_links';

let memoryStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  } catch {
    return memoryStorage[key] || null;
  }
}

function safeSetItem(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
    }
    memoryStorage[key] = val;
  } catch {
    memoryStorage[key] = val;
  }
}

function dispatchSavedUpdate(data: SavedLinkItem[]): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('peakus:saved-links-updated', { detail: data }));
    }
  } catch {}
}

// Initial curated links so users have pleasant suggestions immediately
export const INITIAL_SAVED_LINKS: SavedLinkItem[] = [
  {
    id: 'yt-init-1',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    youtubeId: 'jfKfPfyJRdk',
    title: 'Lofi Girl - Relax / Study Beats',
    type: 'both',
    addedAt: 1700000000000,
  },
  {
    id: 'yt-init-2',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    youtubeId: '4xDzrJKXOOY',
    title: 'Synthwave Chill / Cyberpunk Radio',
    type: 'both',
    addedAt: 1700000010000,
  },
  {
    id: 'yt-init-3',
    url: 'https://www.youtube.com/watch?v=WPni755-Krg',
    youtubeId: 'WPni755-Krg',
    title: 'Warm Fireplace in Cozy Library',
    type: 'bg',
    addedAt: 1700000020000,
  },
  {
    id: 'yt-init-4',
    url: 'https://www.youtube.com/watch?v=BNP_4t6p_hM',
    youtubeId: 'BNP_4t6p_hM',
    title: 'Rain on Window & Thunderstorm Ambience',
    type: 'bg',
    addedAt: 1700000030000,
  },
];

export function getSavedLinks(): SavedLinkItem[] {
  try {
    const raw = safeGetItem(STORAGE_KEY);
    if (!raw) {
      safeSetItem(STORAGE_KEY, JSON.stringify(INITIAL_SAVED_LINKS));
      return [...INITIAL_SAVED_LINKS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [...INITIAL_SAVED_LINKS];
  } catch {
    return [...INITIAL_SAVED_LINKS];
  }
}

export function saveLink(
  rawUrl: string,
  title?: string,
  type: 'bg' | 'music' | 'both' = 'both'
): SavedLinkItem | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const ytId = extractYouTubeId(trimmed);
  const isVideo = isDirectVideoUrl(trimmed);

  if (!ytId && !isVideo) {
    return null;
  }

  const current = getSavedLinks();
  const existingIndex = current.findIndex(
    item =>
      (ytId && item.youtubeId === ytId) ||
      item.url.toLowerCase() === trimmed.toLowerCase()
  );

  let targetItem: SavedLinkItem;

  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    const newType: 'bg' | 'music' | 'both' =
      existing.type === type ? existing.type : 'both';
    targetItem = {
      ...existing,
      title: title?.trim() || existing.title,
      type: newType,
      addedAt: Date.now(),
    };
    current.splice(existingIndex, 1);
    current.unshift(targetItem);
  } else {
    const fallbackTitle = ytId
      ? `YouTube: ${ytId}`
      : trimmed.split('/').pop()?.split('?')[0] || 'Custom Video';
    targetItem = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url: trimmed,
      ...(ytId ? { youtubeId: ytId } : {}),
      title: title?.trim() || fallbackTitle,
      type,
      addedAt: Date.now(),
    };
    current.unshift(targetItem);
  }

  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(current));
    dispatchSavedUpdate(current);
  } catch {}

  return targetItem;
}

export function deleteSavedLink(id: string): SavedLinkItem[] {
  const current = getSavedLinks().filter(item => item.id !== id);
  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(current));
    dispatchSavedUpdate(current);
  } catch {}
  return current;
}

export function clearSavedLinks(): void {
  try {
    safeSetItem(STORAGE_KEY, JSON.stringify([]));
    dispatchSavedUpdate([]);
  } catch {}
}

export function setAllSavedLinks(links: SavedLinkItem[], broadcastEvent: boolean = true): void {
  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(links));
    if (broadcastEvent) {
      dispatchSavedUpdate(links);
    } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('peakus:saved-links-local-ui-updated', { detail: links }));
    }
  } catch {}
}

