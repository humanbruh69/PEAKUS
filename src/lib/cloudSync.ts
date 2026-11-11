import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Settings, TimerState, Task, HistoryState, Session } from '../types';
import { getSavedLinks, setAllSavedLinks, SavedLinkItem } from './savedLinks';
import { PomodoroPreset, getCustomPresets, setAllCustomPresets, DEFAULT_PRESETS } from './presets';
import { DEFAULTS } from './constants';
import { Store } from './store';

export interface CloudUserData {
  userId: string;
  email?: string;
  displayName?: string;
  settings?: any;
  savedLinks?: SavedLinkItem[];
  tasks?: Task[];
  history?: {
    sessions?: Session[];
    taskDone?: any[];
    clearedAt?: number;
  };
  notes?: string;
  presets?: PomodoroPreset[];
  timer?: {
    status?: string;
    phase?: string;
    remainingMs?: number;
    durationMs?: number;
    cycle?: number;
  } | null;
  pomodoro?: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    targetTally: number;
    selectedTallyIcon: string;
    cycleTally: number;
    focusStats: Record<string, any>;
  };
  updatedAt: number;
}

export interface SanitizedSettingsResult {
  settings: Settings;
  hadOfflineBackground: boolean;
}

/**
 * Checks and sanitizes background settings:
 * Replaces device-local blobs or uploads with safe scenes when on a device where they are missing.
 */
export function checkAndSanitizeSettings(rawSettings: any): SanitizedSettingsResult {
  const normalized = Store.normSettings(rawSettings || DEFAULTS);
  const settings: Settings = JSON.parse(JSON.stringify(normalized));
  let hadOfflineBackground = false;

  if (settings.modes) {
    (['home', 'focus', 'ambient'] as const).forEach(mode => {
      const modeCfg = settings.modes[mode];
      const bg = modeCfg?.bg;
      if (!bg) return;

      const isLocalBlob =
        (bg as any).url?.startsWith('blob:') ||
        (bg as any).url?.startsWith('data:');
      const isLocalUpload =
        bg.kind === 'upload' ||
        bg.kind === 'videoUpload';

      if (isLocalBlob || isLocalUpload) {
        hadOfflineBackground = true;
        // Reset to default cafe scene
        settings.modes[mode].bg = { kind: 'scene', id: 'cafe' };
      }
    });
  }

  return { settings, hadOfflineBackground };
}

/**
 * Filter out local blob: and data: URLs before syncing to Cloud
 */
export function cleanSettingsForCloud(settings: Settings): Settings {
  const clean: Settings = JSON.parse(JSON.stringify(settings));

  if (clean.modes) {
    (['home', 'focus', 'ambient'] as const).forEach(mode => {
      const bg = clean.modes[mode]?.bg;
      if (bg) {
        if ((bg as any).kind === 'video' && ((bg as any).url?.startsWith('blob:') || (bg as any).url?.startsWith('data:'))) {
          clean.modes[mode].bg = { kind: 'scene', id: 'cafe' };
        } else if ((bg as any).kind === 'image' && ((bg as any).url?.startsWith('blob:') || (bg as any).url?.startsWith('data:'))) {
          clean.modes[mode].bg = { kind: 'scene', id: 'cafe' };
        } else if (bg.kind === 'upload' || bg.kind === 'videoUpload') {
          // Do not store offline device uploads in cloud settings
          clean.modes[mode].bg = { kind: 'scene', id: 'cafe' };
        }
      }
    });
  }

  return clean;
}

/**
 * Check if a user document exists in Firestore
 */
export async function fetchUserCloudData(userId: string): Promise<CloudUserData | null> {
  try {
    if (!userId) return null;
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as CloudUserData;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching user cloud data:', err);
    return null;
  }
}

/**
 * Completely wipe all user-specific local state and cache from this device.
 * Used during logout and account switching to guarantee zero cross-account data leaks.
 */
export function clearLocalDeviceWorkspace(): void {
  try {
    setAllSavedLinks([], false);
    Store.saveSessions([]);
    Store.saveTaskItems([]);
    Store.saveNotes('', 0);
    setAllCustomPresets(DEFAULT_PRESETS, false);
    Store.saveSettings(DEFAULTS);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('peakus.saved_youtube_links');
      localStorage.removeItem('peakus.task_items');
      localStorage.removeItem('peakus.sessions');
      localStorage.removeItem('peakus.notes');
      localStorage.removeItem('peakus.custom_pomodoro_presets');
      localStorage.removeItem('peakus.settings');
      localStorage.removeItem('peakus.studybot.messages');
      localStorage.removeItem('peakus.focus_stats.v1');
    }
    Store.saveFocusStats({});
  } catch (err) {
    console.warn('Error clearing local workspace:', err);
  }
}

/**
 * Initialize a brand-new user document in Firestore with pristine clean defaults.
 * CRITICAL: NEVER inherits or copies whatever was in this device's localStorage!
 */
export async function initializeNewUserCloud(userId: string): Promise<void> {
  try {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);

    const initialData: CloudUserData = {
      userId,
      email: auth.currentUser?.email || undefined,
      displayName: auth.currentUser?.displayName || undefined,
      settings: cleanSettingsForCloud(DEFAULTS),
      savedLinks: [],
      tasks: [],
      history: { sessions: [] },
      notes: '',
      presets: DEFAULT_PRESETS,
      timer: null,
      pomodoro: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        targetTally: 4,
        selectedTallyIcon: 'growing_tree',
        cycleTally: 0,
        focusStats: {},
      },
      updatedAt: Date.now(),
    };
    await setDoc(userRef, JSON.parse(JSON.stringify(initialData)));
  } catch (err) {
    console.warn('Error initializing new user cloud doc:', err);
  }
}

/**
 * Real-time push of user changes to Firestore in the background
 */
export async function pushAllToCloud(
  userId: string,
  currentSettings: Settings,
  currentTimer: TimerState,
  options?: {
    customHistory?: { sessions: Session[] } | HistoryState;
    customTasks?: Task[];
    customNotes?: string;
    customSavedLinks?: SavedLinkItem[];
    customPresets?: PomodoroPreset[];
    customDisplayName?: string;
    customFocusStats?: Record<string, any>;
  }
): Promise<void> {
  try {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);

    // Sync timer ONLY if paused or idle
    const timerToSync =
      currentTimer.status === 'paused' || currentTimer.status === 'idle'
        ? {
            status: currentTimer.status,
            phase: currentTimer.phase,
            remainingMs: currentTimer.remainingMs,
            durationMs: currentTimer.durationMs,
            cycle: currentTimer.cycle,
          }
        : null;

    const userSessions = options?.customHistory?.sessions ?? Store.loadSessions();
    const userTasks = options?.customTasks ?? Store.loadTaskItems();
    const rawUserLinks = options?.customSavedLinks ?? getSavedLinks();
    const userLinks = rawUserLinks.map(link => {
      const item: any = {
        id: String(link.id || `link_${Date.now()}`),
        url: String(link.url || ''),
        title: String(link.title || 'Video Link'),
        type: link.type === 'bg' || link.type === 'music' ? link.type : 'both',
        addedAt: Number(link.addedAt) || Date.now(),
      };
      if (link.youtubeId) {
        item.youtubeId = String(link.youtubeId);
      }
      return item;
    });
    const userNotes = options?.customNotes ?? Store.loadNotes();
    const userPresets = options?.customPresets ?? getCustomPresets();
    const userDisplayName =
      options?.customDisplayName ??
      auth.currentUser?.displayName ??
      currentSettings.name ??
      undefined;

    const payload: Partial<CloudUserData> = {
      userId,
      email: auth.currentUser?.email || undefined,
      displayName: userDisplayName,
      settings: cleanSettingsForCloud(currentSettings),
      savedLinks: userLinks,
      tasks: userTasks,
      history: { sessions: userSessions },
      notes: userNotes,
      presets: userPresets,
      updatedAt: Date.now(),
    };

    if (timerToSync !== undefined) {
      payload.timer = timerToSync;
    }

    // Persist Flocus Pomodoro settings, cycleTally, and daily focusStats
    const currentFocusStats = options?.customFocusStats ?? Store.loadFocusStats();
    payload.pomodoro = {
      focusMinutes: Number(currentSettings.timer?.focus) || 25,
      shortBreakMinutes: Number(currentSettings.timer?.short) || 5,
      longBreakMinutes: Number(currentSettings.timer?.long) || 15,
      targetTally: Number(currentSettings.timer?.cycles) || 4,
      selectedTallyIcon: String(currentSettings.timer?.tallyTheme || 'growing_tree'),
      cycleTally: Number(currentTimer?.cycle) || 0,
      focusStats: currentFocusStats || {},
    };

    // Deep sanitize to guarantee zero undefined properties in any nested structure
    const sanitized = JSON.parse(JSON.stringify(payload));
    await setDoc(userRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Peakus cloud push failed:', err);
  }
}

/**
 * Real-time listener for remote changes from Firestore
 */
export function subscribeToCloud(
  userId: string,
  handlers: {
    onLoaded?: (hasData: boolean) => void;
    onSettings?: (settings: Settings, hadOfflineBg: boolean) => void;
    onSavedLinks?: (links: SavedLinkItem[]) => void;
    onTasks?: (tasks: Task[]) => void;
    onHistory?: (sessions: Session[]) => void;
    onNotes?: (notes: string) => void;
    onPresets?: (presets: PomodoroPreset[]) => void;
    onDisplayName?: (displayName: string) => void;
    onPausedTimer?: (timer: any) => void;
    onPomodoro?: (pomodoro: any) => void;
  },
  isLocalTimerRunning: () => boolean
): Unsubscribe {
  const userRef = doc(db, 'users', userId);

  return onSnapshot(userRef, snap => {
    try {
      if (!snap.exists()) {
        if (handlers.onLoaded) handlers.onLoaded(false);
        return;
      }

      const data = snap.data() as CloudUserData;
      if (handlers.onLoaded) {
        handlers.onLoaded(true);
      }

      if (data.displayName && typeof data.displayName === 'string' && handlers.onDisplayName) {
        handlers.onDisplayName(data.displayName);
      }

      if (data.settings && handlers.onSettings) {
        const { settings, hadOfflineBackground } = checkAndSanitizeSettings(data.settings);
        handlers.onSettings(settings, hadOfflineBackground);
      }

      if (data.savedLinks && Array.isArray(data.savedLinks) && handlers.onSavedLinks) {
        setAllSavedLinks(data.savedLinks, false);
        handlers.onSavedLinks(data.savedLinks);
      }

      if (data.tasks && Array.isArray(data.tasks) && handlers.onTasks) {
        handlers.onTasks(data.tasks);
      }

      if (data.history && Array.isArray(data.history.sessions) && handlers.onHistory) {
        handlers.onHistory(data.history.sessions);
      }

      if (typeof data.notes === 'string' && handlers.onNotes) {
        handlers.onNotes(data.notes);
      }

      if (data.presets && Array.isArray(data.presets) && handlers.onPresets) {
        setAllCustomPresets(data.presets, false);
        handlers.onPresets(data.presets);
      }

      if (data.pomodoro && handlers.onPomodoro) {
        handlers.onPomodoro(data.pomodoro);
      }

      // Sync timer if remote timer exists AND local timer is not actively running
      if (data.timer && handlers.onPausedTimer) {
        if (!isLocalTimerRunning()) {
          handlers.onPausedTimer(data.timer);
        }
      }
    } catch (err) {
      console.warn('Error handling cloud sync snapshot:', err);
    }
  });
}
