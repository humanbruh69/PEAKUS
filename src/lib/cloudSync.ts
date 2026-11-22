import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Settings, TimerState, Task, HistoryState, Session, TodoItem, TodoNotificationPrefs } from '../types';
import { getSavedLinks, setAllSavedLinks, sanitizeSavedLinks, INITIAL_SAVED_LINKS, SavedLinkItem } from './savedLinks';
import { PomodoroPreset, getCustomPresets, setAllCustomPresets, DEFAULT_PRESETS } from './presets';
import { DEFAULTS } from './constants';
import { Store } from './store';
import { DEFAULT_TODO_PREFS, sanitizeTodoItems, sanitizeTodoPrefs } from './todoEngine';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const user = auth?.currentUser;
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type CloudSyncDomain =
  | 'settings'
  | 'savedLinks'
  | 'tasks'
  | 'todos'
  | 'todoPrefs'
  | 'history'
  | 'notes'
  | 'presets'
  | 'timer'
  | 'pomodoro'
  | 'displayName';

export interface CloudSyncStatusState {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: number | null;
  lastError: string | null;
}

const syncStatusListeners = new Set<(s: CloudSyncStatusState) => void>();
let currentSyncStatus: CloudSyncStatusState = {
  status: 'idle',
  lastSyncedAt: null,
  lastError: null,
};

function updateSyncStatus(partial: Partial<CloudSyncStatusState>): void {
  currentSyncStatus = { ...currentSyncStatus, ...partial };
  syncStatusListeners.forEach(fn => {
    try {
      fn(currentSyncStatus);
    } catch {}
  });
}

export function getCloudSyncStatus(): CloudSyncStatusState {
  return currentSyncStatus;
}

export function subscribeCloudSyncStatus(fn: (s: CloudSyncStatusState) => void): () => void {
  syncStatusListeners.add(fn);
  fn(currentSyncStatus);
  return () => {
    syncStatusListeners.delete(fn);
  };
}

// Per-domain echo/race protection
const domainInFlight = new Map<CloudSyncDomain, number>();
const domainCooldownUntil = new Map<CloudSyncDomain, number>();
let writeChain: Promise<void> = Promise.resolve();

export function resetCloudDomainTracking(): void {
  domainInFlight.clear();
  domainCooldownUntil.clear();
  updateSyncStatus({ status: 'idle', lastSyncedAt: null, lastError: null });
}

export function markDomainWriteStarted(domains: CloudSyncDomain[]): void {
  for (const d of domains) {
    domainInFlight.set(d, (domainInFlight.get(d) || 0) + 1);
  }
}

export function markDomainWriteFinished(domains: CloudSyncDomain[], now = Date.now()): void {
  for (const d of domains) {
    const next = Math.max(0, (domainInFlight.get(d) || 1) - 1);
    if (next === 0) {
      domainInFlight.delete(d);
    } else {
      domainInFlight.set(d, next);
    }
    domainCooldownUntil.set(d, now + 500);
  }
}

export function shouldApplyRemoteDomain(
  domain: CloudSyncDomain,
  hasPendingWrites: boolean,
  isInitialSnapshot: boolean,
  now = Date.now()
): boolean {
  if ((domainInFlight.get(domain) || 0) > 0) return false;
  if (!isInitialSnapshot && hasPendingWrites) return false;
  const cooldown = domainCooldownUntil.get(domain) || 0;
  if (!isInitialSnapshot && now < cooldown) return false;
  return true;
}

export interface CloudUserData {
  userId: string;
  email?: string;
  displayName?: string;
  settings?: any;
  savedLinks?: SavedLinkItem[];
  tasks?: Task[];
  todos?: TodoItem[];
  todoPrefs?: TodoNotificationPrefs;
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
    focusMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    targetTally?: number;
    selectedTallyIcon?: string;
    cycleTally?: number;
    focusStats?: Record<string, any>;
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
 * Preserve device-local uploaded backgrounds (photo/video in IndexedDB) when incoming
 * cloud settings only hold the sanitized 'cafe' fallback from cleanSettingsForCloud.
 */
export function mergeRemoteSettingsWithLocalUploads(
  remoteSettings: Settings,
  localSettings: Settings
): Settings {
  const merged = JSON.parse(JSON.stringify(remoteSettings)) as Settings;
  (['home', 'focus', 'ambient'] as const).forEach(mode => {
    const localBg = localSettings?.modes?.[mode]?.bg;
    const remoteBg = merged?.modes?.[mode]?.bg;
    const isLocalBg = localBg?.kind === 'upload' || localBg?.kind === 'videoUpload';
    const isFallbackCafe = !remoteBg || (remoteBg.kind === 'scene' && remoteBg.id === 'cafe');
    if (isLocalBg && isFallbackCafe) {
      merged.modes[mode].bg = JSON.parse(JSON.stringify(localBg));
    }
  });
  return merged;
}

export interface CloudDomainPatch {
  settings?: Settings;
  savedLinks?: SavedLinkItem[];
  tasks?: Task[];
  todos?: TodoItem[];
  todoPrefs?: TodoNotificationPrefs;
  history?: { sessions: Session[] };
  notes?: string;
  presets?: PomodoroPreset[];
  timer?: TimerState | null;
  pomodoro?: CloudUserData['pomodoro'];
  displayName?: string;
}

export function buildCloudDomainPatch(
  userId: string,
  patch: CloudDomainPatch,
  now = Date.now(),
  email?: string | null
): { payload: Record<string, any>; domains: CloudSyncDomain[] } {
  const payload: Record<string, any> = {
    userId,
    updatedAt: now,
  };
  if (email) {
    payload.email = email;
  }

  const domains: CloudSyncDomain[] = [];

  if (patch.settings !== undefined) {
    payload.settings = cleanSettingsForCloud(patch.settings);
    domains.push('settings');
  }
  if (patch.savedLinks !== undefined) {
    payload.savedLinks = sanitizeSavedLinks(patch.savedLinks);
    domains.push('savedLinks');
  }
  if (patch.tasks !== undefined) {
    payload.tasks = Array.isArray(patch.tasks) ? patch.tasks : [];
    domains.push('tasks');
  }
  if (patch.todos !== undefined) {
    payload.todos = sanitizeTodoItems(patch.todos);
    domains.push('todos');
  }
  if (patch.todoPrefs !== undefined) {
    payload.todoPrefs = sanitizeTodoPrefs(patch.todoPrefs);
    domains.push('todoPrefs');
  }
  if (patch.history !== undefined) {
    payload.history = {
      sessions: Array.isArray(patch.history.sessions) ? patch.history.sessions : [],
    };
    domains.push('history');
  }
  if (patch.notes !== undefined) {
    payload.notes = String(patch.notes).slice(0, 20000);
    domains.push('notes');
  }
  if (patch.presets !== undefined) {
    payload.presets = Array.isArray(patch.presets) ? patch.presets : DEFAULT_PRESETS;
    domains.push('presets');
  }
  if (patch.timer !== undefined) {
    if (patch.timer === null) {
      payload.timer = null;
    } else if (patch.timer.status === 'paused' || patch.timer.status === 'idle') {
      payload.timer = {
        status: patch.timer.status,
        phase: patch.timer.phase,
        remainingMs: patch.timer.remainingMs,
        durationMs: patch.timer.durationMs,
        cycle: patch.timer.cycle,
      };
    }
    if ('timer' in payload) {
      domains.push('timer');
    }
  }
  if (patch.pomodoro !== undefined) {
    payload.pomodoro = patch.pomodoro;
    domains.push('pomodoro');
  }
  if (patch.displayName !== undefined) {
    payload.displayName = String(patch.displayName);
    domains.push('displayName');
  }

  const sanitized = JSON.parse(JSON.stringify(payload));
  return { payload: sanitized, domains };
}

export interface FetchCloudResult {
  exists: boolean;
  data: CloudUserData | null;
  error?: unknown;
}

/**
 * Safely check and fetch a user document in Firestore, distinguishing missing doc vs read error.
 */
export async function fetchUserCloudData(userId: string): Promise<FetchCloudResult> {
  if (!userId) return { exists: false, data: null };
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { exists: true, data: snap.data() as CloudUserData };
    }
    return { exists: false, data: null };
  } catch (err) {
    const errInfo = buildFirestoreErrorInfo(err, OperationType.GET, path);
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    updateSyncStatus({
      status: 'error',
      lastError: err instanceof Error ? err.message : 'Unable to read cloud workspace.',
    });
    return { exists: false, data: null, error: err };
  }
}

/**
 * Completely wipe all user-specific local state and cache from this device.
 * Used during logout and account switching to guarantee zero cross-account data leaks.
 */
export function clearLocalDeviceWorkspace(): void {
  try {
    resetCloudDomainTracking();
    setAllSavedLinks([], false);
    Store.saveSessions([]);
    Store.saveTaskItems([]);
    Store.saveTodos([]);
    Store.saveTodoPrefs(DEFAULT_TODO_PREFS);
    Store.saveNotes('', 0);
    setAllCustomPresets(DEFAULT_PRESETS, false);
    Store.saveSettings(DEFAULTS);
    Store.saveTimer({
      status: 'idle',
      phase: 'focus',
      remainingMs: (DEFAULTS.timer.focus || 25) * 60000,
      durationMs: (DEFAULTS.timer.focus || 25) * 60000,
      cycle: 0,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
    });
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('peakus.task_items');
      localStorage.removeItem('peakus.sessions');
      localStorage.removeItem('peakus.notes');
      localStorage.removeItem('peakus.custom_pomodoro_presets');
      localStorage.removeItem('peakus.settings');
      localStorage.removeItem('peakus.studybot.messages');
      localStorage.removeItem('peakus.focus_stats.v1');
      localStorage.removeItem('peakus.room_code');
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
export async function initializeNewUserCloud(userId: string): Promise<boolean> {
  if (!userId) return false;
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const initialData: CloudUserData = {
      userId,
      email: auth.currentUser?.email || undefined,
      displayName: auth.currentUser?.displayName || undefined,
      settings: cleanSettingsForCloud(DEFAULTS),
      savedLinks: INITIAL_SAVED_LINKS,
      tasks: [],
      todos: [],
      todoPrefs: DEFAULT_TODO_PREFS,
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
    await setDoc(userRef, JSON.parse(JSON.stringify(initialData)), { merge: true });
    updateSyncStatus({ status: 'synced', lastSyncedAt: Date.now(), lastError: null });
    return true;
  } catch (err) {
    const errInfo = buildFirestoreErrorInfo(err, OperationType.CREATE, path);
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    updateSyncStatus({
      status: 'error',
      lastError: err instanceof Error ? err.message : 'Failed to initialize cloud account.',
    });
    return false;
  }
}

/**
 * Push ONLY the changed domain fields to Firestore so unrelated edits never clobber other devices/domains.
 */
export async function pushCloudDomains(
  userId: string,
  patch: CloudDomainPatch
): Promise<boolean> {
  if (!userId) return false;
  const { payload, domains } = buildCloudDomainPatch(
    userId,
    patch,
    Date.now(),
    auth.currentUser?.email
  );
  if (domains.length === 0) return true;

  const path = `users/${userId}`;
  markDomainWriteStarted(domains);
  updateSyncStatus({ status: 'syncing', lastError: null });

  let succeeded = false;
  const runWrite = async () => {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, payload, { merge: true });
      succeeded = true;
      updateSyncStatus({ status: 'synced', lastSyncedAt: Date.now(), lastError: null });
    } catch (err) {
      const errInfo = buildFirestoreErrorInfo(err, OperationType.WRITE, path);
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      updateSyncStatus({
        status: 'error',
        lastError: err instanceof Error ? err.message : 'Cloud sync failed.',
      });
    } finally {
      markDomainWriteFinished(domains);
    }
  };

  writeChain = writeChain.then(runWrite, runWrite);
  await writeChain;
  return succeeded;
}

/**
 * Full-workspace push to Firestore (used for explicit "Sync Now" and comprehensive fallback syncs).
 */
export async function pushAllToCloud(
  userId: string,
  currentSettings: Settings,
  currentTimer: TimerState,
  options?: {
    customHistory?: { sessions: Session[] } | HistoryState;
    customTasks?: Task[];
    customTodos?: TodoItem[];
    customTodoPrefs?: TodoNotificationPrefs;
    customNotes?: string;
    customSavedLinks?: SavedLinkItem[];
    customPresets?: PomodoroPreset[];
    customDisplayName?: string;
    customFocusStats?: Record<string, any>;
  }
): Promise<boolean> {
  if (!userId) return false;
  const userSessions = options?.customHistory?.sessions ?? Store.loadSessions();
  const userTasks = options?.customTasks ?? Store.loadTaskItems();
  const userTodos = options?.customTodos ?? Store.loadTodos();
  const userTodoPrefs = options?.customTodoPrefs ?? Store.loadTodoPrefs();
  const userLinks = options?.customSavedLinks ?? getSavedLinks();
  const userNotes = options?.customNotes ?? Store.loadNotes();
  const userPresets = options?.customPresets ?? getCustomPresets();
  const userDisplayName =
    options?.customDisplayName ??
    auth.currentUser?.displayName ??
    currentSettings.name ??
    undefined;
  const currentFocusStats = options?.customFocusStats ?? Store.loadFocusStats();

  return pushCloudDomains(userId, {
    ...(userDisplayName ? { displayName: userDisplayName } : {}),
    settings: currentSettings,
    savedLinks: userLinks,
    tasks: userTasks,
    todos: userTodos,
    todoPrefs: userTodoPrefs,
    history: { sessions: userSessions },
    notes: userNotes,
    presets: userPresets,
    timer:
      currentTimer.status === 'paused' || currentTimer.status === 'idle'
        ? currentTimer
        : undefined,
    pomodoro: {
      focusMinutes: Number(currentSettings.timer?.focus) || 25,
      shortBreakMinutes: Number(currentSettings.timer?.short) || 5,
      longBreakMinutes: Number(currentSettings.timer?.long) || 15,
      targetTally: Number(currentSettings.timer?.cycles) || 4,
      selectedTallyIcon: String(currentSettings.timer?.tallyTheme || 'growing_tree'),
      cycleTally: Number(currentTimer?.cycle) || 0,
      focusStats: currentFocusStats || {},
    },
  });
}

/**
 * Real-time listener for remote changes from Firestore
 */
export function subscribeToCloud(
  userId: string,
  handlers: {
    onLoaded?: (hasData: boolean) => void;
    onError?: (error: unknown) => void;
    onSettings?: (settings: Settings, hadOfflineBg: boolean) => void;
    onSavedLinks?: (links: SavedLinkItem[]) => void;
    onTasks?: (tasks: Task[]) => void;
    onTodos?: (todos: TodoItem[]) => void;
    onTodoPrefs?: (prefs: TodoNotificationPrefs) => void;
    onHistory?: (sessions: Session[]) => void;
    onNotes?: (notes: string) => void;
    onPresets?: (presets: PomodoroPreset[]) => void;
    onDisplayName?: (displayName: string) => void;
    onPausedTimer?: (timer: any) => void;
    onPomodoro?: (pomodoro: any) => void;
  },
  isLocalTimerRunning: () => boolean
): Unsubscribe {
  const path = `users/${userId}`;
  const userRef = doc(db, 'users', userId);
  let isInitialSnapshot = true;

  return onSnapshot(
    userRef,
    snap => {
      try {
        const hasPendingWrites = snap.metadata.hasPendingWrites;
        const initial = isInitialSnapshot;
        isInitialSnapshot = false;

        if (!snap.exists()) {
          if (handlers.onLoaded) handlers.onLoaded(false);
          return;
        }

        const data = snap.data() as CloudUserData;
        updateSyncStatus({
          status: hasPendingWrites ? 'syncing' : 'synced',
          ...(hasPendingWrites ? {} : { lastSyncedAt: Date.now(), lastError: null }),
        });

        if (handlers.onLoaded) {
          handlers.onLoaded(true);
        }

        if (
          data.displayName &&
          typeof data.displayName === 'string' &&
          handlers.onDisplayName &&
          shouldApplyRemoteDomain('displayName', hasPendingWrites, initial)
        ) {
          handlers.onDisplayName(data.displayName);
        }

        if (
          data.settings &&
          handlers.onSettings &&
          shouldApplyRemoteDomain('settings', hasPendingWrites, initial)
        ) {
          const { settings, hadOfflineBackground } = checkAndSanitizeSettings(data.settings);
          handlers.onSettings(settings, hadOfflineBackground);
        }

        if (
          data.savedLinks &&
          Array.isArray(data.savedLinks) &&
          handlers.onSavedLinks &&
          shouldApplyRemoteDomain('savedLinks', hasPendingWrites, initial)
        ) {
          const cleanLinks = sanitizeSavedLinks(data.savedLinks);
          setAllSavedLinks(cleanLinks, false);
          handlers.onSavedLinks(cleanLinks);
        }

        if (
          data.tasks &&
          Array.isArray(data.tasks) &&
          handlers.onTasks &&
          shouldApplyRemoteDomain('tasks', hasPendingWrites, initial)
        ) {
          handlers.onTasks(data.tasks);
        }

        if (
          data.todos &&
          Array.isArray(data.todos) &&
          handlers.onTodos &&
          shouldApplyRemoteDomain('todos', hasPendingWrites, initial)
        ) {
          handlers.onTodos(sanitizeTodoItems(data.todos));
        }

        if (
          data.todoPrefs &&
          typeof data.todoPrefs === 'object' &&
          handlers.onTodoPrefs &&
          shouldApplyRemoteDomain('todoPrefs', hasPendingWrites, initial)
        ) {
          handlers.onTodoPrefs(sanitizeTodoPrefs(data.todoPrefs));
        }

        if (
          data.history &&
          Array.isArray(data.history.sessions) &&
          handlers.onHistory &&
          shouldApplyRemoteDomain('history', hasPendingWrites, initial)
        ) {
          handlers.onHistory(data.history.sessions);
        }

        if (
          typeof data.notes === 'string' &&
          handlers.onNotes &&
          shouldApplyRemoteDomain('notes', hasPendingWrites, initial)
        ) {
          handlers.onNotes(data.notes);
        }

        if (
          data.presets &&
          Array.isArray(data.presets) &&
          handlers.onPresets &&
          shouldApplyRemoteDomain('presets', hasPendingWrites, initial)
        ) {
          setAllCustomPresets(data.presets, false);
          handlers.onPresets(data.presets);
        }

        if (
          data.pomodoro &&
          handlers.onPomodoro &&
          shouldApplyRemoteDomain('pomodoro', hasPendingWrites, initial)
        ) {
          handlers.onPomodoro(data.pomodoro);
        }

        // Sync timer if remote timer exists AND local timer is not actively running
        if (
          data.timer &&
          handlers.onPausedTimer &&
          shouldApplyRemoteDomain('timer', hasPendingWrites, initial)
        ) {
          if (!isLocalTimerRunning()) {
            handlers.onPausedTimer(data.timer);
          }
        }
      } catch (err) {
        console.warn('Error handling cloud sync snapshot:', err);
      }
    },
    error => {
      const errInfo = buildFirestoreErrorInfo(error, OperationType.GET, path);
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      updateSyncStatus({
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Cloud sync listener disconnected.',
      });
      if (handlers.onError) {
        handlers.onError(error);
      }
    }
  );
}
