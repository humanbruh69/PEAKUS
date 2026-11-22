import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Settings,
  ModeKey,
  Task,
  Session,
  TimerState,
  TimerPhase,
  TimerStatus,
  TodoItem,
  TodoNotificationPrefs,
} from './types';
import { Store } from './lib/store';
import { audioX } from './lib/audio';
import { sync } from './lib/sync';
import {
  hexToRgb,
  normalizeHex,
  getContrastTextColor,
  fmtClock,
  fmtDur,
  uid,
  dayKey,
  startOfDay,
  addDays,
} from './lib/utils';
import { DEFAULTS } from './lib/constants';
import { t } from './lib/i18n';
import { normalizeGuiScale, resolveGuiScaleFactor } from './lib/guiScale';
import { appendLineToRichNotes } from './lib/notesEngine';
import {
  enqueueTodoInFocusQueue,
  removeTodoFromFocusQueue,
  syncTaskChangesToTodos,
  syncTodoChangesToTasks,
} from './lib/focusQueueSync';
import {
  type PomodoroPreset,
  getCustomPresets,
  saveCustomPreset,
  applyPresetToSettings,
  DEFAULT_PRESETS,
} from './lib/presets';

import { Background } from './components/Background';
import { Stage } from './components/Stage';
import { TasksPopover } from './components/TasksPopover';
import { SoundsPopover } from './components/SoundsPopover';
import { NotesPopover } from './components/NotesPopover';
import { MusicPopover } from './components/MusicPopover';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmModal, type ConfirmState } from './components/ConfirmModal';
import { ToastList, type ToastItem } from './components/ToastList';
import { ProPrankModal, PRO_PRANK_KEY } from './components/ProPrankModal';
import { FlowPromptModal } from './components/FlowPromptModal';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, testConnection } from './lib/firebase';
import {
  pushAllToCloud,
  pushCloudDomains,
  subscribeToCloud,
  initializeNewUserCloud,
  fetchUserCloudData,
  clearLocalDeviceWorkspace,
  mergeRemoteSettingsWithLocalUploads,
  type CloudDomainPatch,
  type CloudSyncDomain,
} from './lib/cloudSync';
import { AuthGatewayModal } from './components/AuthGatewayModal';
import { ResetSegmentModal } from './components/ResetSegmentModal';
import { OfflineBackgroundModal } from './components/OfflineBackgroundModal';
import {
  broadcastRoomTimer,
  updateMemberPresence,
  subscribeToStudyRoom,
  subscribeToRoomMembers,
  subscribeToRoomMessages,
  sendRoomMessage,
  joinStudyRoom,
  updateRoomSettings,
  getCurrentUserName,
  type StudyRoom,
  type RoomMember,
  type RoomMessage,
} from './lib/studyRooms';
import {
  extractInviteRoomCode,
  computeSyncedTimerDisplay,
  formatSprintCountdown,
  computeUnreadMessagesCount,
} from './lib/roomEngine';
import { StudyRoomModal } from './components/StudyRoomModal';
import { getSavedLinks, setAllSavedLinks, SavedLinkItem } from './lib/savedLinks';
import { computeStats } from './lib/statsEngine';
import { StudyBotPopover } from './components/StudyBotPopover';
import {
  YouTubeMusicPlayer,
  type YouTubeMusicPlayerHandle,
  type MusicPlaybackTelemetry,
} from './components/YouTubeMusicPlayer';
import { CalculatorPopover } from './components/CalculatorPopover';
import { TodoPopover } from './components/TodoPopover';
import {
  DEFAULT_TODO_PREFS,
  findDueTodoReminders,
  formatReminderPayload,
} from './lib/todoEngine';
import { clampVolume } from './lib/ytMusicMath';
import {
  toLocalDateKey,
  recordPartialFocusStat,
  canPauseTimer,
  HARDCORE_REQUIRED_SESSIONS,
} from './lib/pomodoroEngine';
import {
  loadHumiliationLines,
  pickRandomHumiliationLine,
  type HumiliationLine,
} from './lib/humiliation';
import { HardcoreHumiliationModal } from './components/HardcoreHumiliationModal';
import type { SettingsSectionKey } from './components/SettingsModal';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(() => Store.loadSettings());
  const [tasks, setTasks] = useState<Task[]>(() => Store.loadTaskItems());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const [todos, setTodos] = useState<TodoItem[]>(() => Store.loadTodos());
  const todosRef = useRef(todos);
  todosRef.current = todos;
  const [todoPrefs, setTodoPrefs] = useState<TodoNotificationPrefs>(() => Store.loadTodoPrefs());
  const todoPrefsRef = useRef(todoPrefs);
  todoPrefsRef.current = todoPrefs;
  const [activeReminderAlert, setActiveReminderAlert] = useState<{
    todoId: string | null;
    title: string;
    body: string;
  } | null>(null);
  const [sessions, setSessions] = useState<Session[]>(() => Store.loadSessions());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const [notes, setNotes] = useState<string>(() => Store.loadNotes());
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const [statsVersion, setStatsVersion] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);

  // Mandatory Auth & Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Reset Segment Modal & Offline Background Modal State
  const [showResetSegmentModal, setShowResetSegmentModal] = useState<boolean>(false);
  const [showOfflineBgModal, setShowOfflineBgModal] = useState<boolean>(false);
  const [humiliationModal, setHumiliationModal] = useState<{
    open: boolean;
    line: HumiliationLine | null;
    completedSessions: number;
  }>({ open: false, line: null, completedSessions: 0 });

  // Flow Continuation State
  const [showFlowPrompt, setShowFlowPrompt] = useState(false);
  const flowExtendedRef = useRef(false);
  const pendingBreakRef = useRef<{
    nextPhase: TimerPhase;
    durationMs: number;
    autoStart: boolean;
    nextCycle: number;
  } | null>(null);

  // Zen Mode state (HUD hidden across all 3 tabs)
  const [zenMode, setZenMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('peakus.zen_mode') === 'true';
    } catch {
      return false;
    }
  });

  // 3 Custom Pomodoro Presets
  const [presets, setPresets] = useState<PomodoroPreset[]>(() => getCustomPresets());
  const presetsRef = useRef(presets);
  presetsRef.current = presets;

  const handleToggleZen = useCallback(() => {
    setZenMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('peakus.zen_mode', String(next));
      } catch {}
      return next;
    });
  }, []);

  // First-time opening pro prank modal
  const isLocalPreviewBypass =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [showProPrank, setShowProPrank] = useState(() => {
    if (isLocalPreviewBypass) return false;
    try {
      return !localStorage.getItem(PRO_PRANK_KEY);
    } catch {
      return false;
    }
  });

  // Popovers & Modal State
  const [tasksOpen, setTasksOpen] = useState(false);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenRef = useRef(settingsOpen);
  settingsOpenRef.current = settingsOpen;
  const [requestedSettingsSection, setRequestedSettingsSection] = useState<SettingsSectionKey | null>(null);
  const [studyBotOpen, setStudyBotOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicTelemetry, setMusicTelemetry] = useState<MusicPlaybackTelemetry>({
    currentTime: 0,
    duration: 0,
    isLive: false,
    ready: false,
    buffering: false,
  });
  const musicPlayerRef = useRef<YouTubeMusicPlayerHandle>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const roomsOpenRef = useRef(roomsOpen);
  roomsOpenRef.current = roomsOpen;
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem('peakus.room_code') || null;
    } catch {
      return null;
    }
  });
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const activeRoomRef = useRef<StudyRoom | null>(null);
  activeRoomRef.current = activeRoom;
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const roomMessagesRef = useRef<RoomMessage[]>([]);
  roomMessagesRef.current = roomMessages;
  const [activeRoomTab, setActiveRoomTab] = useState<'members' | 'chat'>('members');
  const activeRoomTabRef = useRef(activeRoomTab);
  activeRoomTabRef.current = activeRoomTab;
  const [lastRoomReadAt, setLastRoomReadAt] = useState<number>(() => Date.now());
  const [roomChatMuted, setRoomChatMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('peakus.room_chat_muted') === 'true';
    } catch {
      return false;
    }
  });
  const roomChatMutedRef = useRef(roomChatMuted);
  roomChatMutedRef.current = roomChatMuted;
  const [roomBreakOnlyChat, setRoomBreakOnlyChat] = useState<boolean>(() => {
    try {
      return localStorage.getItem('peakus.room_break_only_chat') === 'true';
    } catch {
      return false;
    }
  });
  const roomBreakOnlyChatRef = useRef(roomBreakOnlyChat);
  roomBreakOnlyChatRef.current = roomBreakOnlyChat;
  const queuedBreakChatCountRef = useRef(0);
  const seenRoomMessageCutoffRef = useRef(Date.now());
  const seenRoomMessageIdsRef = useRef<Set<string>>(new Set());
  const [floatingReactionPop, setFloatingReactionPop] = useState<{
    id: string;
    senderName: string;
    text: string;
  } | null>(null);
  const reactionPopTimerRef = useRef<any>(null);
  const [pendingInviteRoomCode, setPendingInviteRoomCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractInviteRoomCode(window.location.search);
  });
  const [sprintCountdownSec, setSprintCountdownSec] = useState(0);
  const firedSprintsRef = useRef<Set<number>>(new Set());
  const [ownRoomTaskText, setOwnRoomTaskText] = useState<string | undefined>(undefined);
  const [ownRoomTaskDone, setOwnRoomTaskDone] = useState<boolean>(false);

  // Active Task
  const activeTask = tasks.find(item => item.active && !item.deleted && !item.done);
  const lang = settings.language || 'en';

  // Calculate duration for a phase
  const getPhaseDuration = useCallback(
    (phase: TimerPhase, currentSettings: Settings) => {
      const tSettings = currentSettings.timer;
      if (tSettings.mode === 'countdown') {
        return tSettings.countdown * 60000;
      }
      if (phase === 'focus') {
        if (tSettings.etaMode && activeTask && activeTask.estimate) {
          const focusedMs = sessions
            .filter(s => s.taskId === activeTask.id && s.kind === 'focus')
            .reduce((sum, s) => sum + s.ms, 0);
          const rem = activeTask.estimate * 60000 - focusedMs;
          if (rem > 0) return rem;
        }
        return tSettings.focus * 60000;
      }
      if (phase === 'short') return tSettings.short * 60000;
      return tSettings.long * 60000;
    },
    [activeTask, sessions]
  );

  // Timer State
  const [timerState, setTimerState] = useState<TimerState>(() => {
    const saved = Store.loadTimer();
    const phase: TimerPhase = saved?.phase || 'focus';
    const status: TimerStatus = saved?.status || 'idle';
    const duration = getPhaseDuration(phase, settings);
    const rem = saved && typeof saved.remainingMs === 'number' && saved.remainingMs > 0 ? saved.remainingMs : duration;
    const rawCycle = saved?.cycle || 0;
    const maxCycles = settings.timer.cycles || 4;
    const normCycle = rawCycle >= maxCycles && phase !== 'long' ? 0 : rawCycle;
    return {
      status,
      phase,
      remainingMs: rem,
      durationMs: duration,
      cycle: normCycle,
      startedAt: saved?.startedAt || null,
      sessionStartedAt: saved?.sessionStartedAt || null,
      interrupted: !!saved?.interrupted,
    };
  });

  const timerRef = useRef(timerState);
  timerRef.current = timerState;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cloudLoadedUserRef = useRef<string | null>(null);
  const settingsSaveTimerRef = useRef<any>(null);
  const dirtyDomainsRef = useRef<Set<CloudSyncDomain>>(new Set());

  const buildPomodoroSnapshot = useCallback(
    (s: Settings, tState: TimerState, focusStats?: Record<string, any>) => ({
      focusMinutes: Number(s.timer?.focus) || 25,
      shortBreakMinutes: Number(s.timer?.short) || 5,
      longBreakMinutes: Number(s.timer?.long) || 15,
      targetTally: Number(s.timer?.cycles) || 4,
      selectedTallyIcon: String(s.timer?.tallyTheme || 'growing_tree'),
      cycleTally: Number(tState?.cycle) || 0,
      focusStats: focusStats ?? Store.loadFocusStats(),
    }),
    []
  );

  const queueOrPushDomains = useCallback((patch: CloudDomainPatch) => {
    const user = auth.currentUser;
    if (!user) return;
    if (cloudLoadedUserRef.current === user.uid) {
      pushCloudDomains(user.uid, patch);
      return;
    }
    (Object.keys(patch) as (keyof CloudDomainPatch)[]).forEach(k => {
      if (patch[k] !== undefined) {
        dirtyDomainsRef.current.add(k as CloudSyncDomain);
      }
    });
  }, []);

  const handleForceSync = useCallback(async (): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }
    return pushAllToCloud(user.uid, settingsRef.current, timerRef.current, {
      customHistory: { sessions: sessionsRef.current },
      customTasks: tasksRef.current,
      customTodos: todosRef.current,
      customTodoPrefs: todoPrefsRef.current,
      customNotes: notesRef.current,
      customSavedLinks: getSavedLinks(),
      customPresets: presetsRef.current,
      customFocusStats: Store.loadFocusStats(),
    });
  }, []);

  // Add Toast helper
  const addToast = useCallback(
    (msg: string, type: 'err' | '' = '', action?: { label: string; fn: () => void }) => {
      const id = uid('toast');
      setToasts(prev => [...prev.slice(-2), { id, msg, type, action }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(item => item.id !== id));
      }, type === 'err' ? 6500 : 4500);
    },
    []
  );

  // Ask Confirm helper
  const askConfirm = useCallback(
    (
      title: string,
      text: string,
      okLabel: string,
      fn: () => void,
      danger = true
    ) => {
      setConfirmModal({
        open: true,
        title,
        text,
        okText: okLabel,
        danger,
        onConfirm: () => {
          setConfirmModal(null);
          fn();
        },
        onCancel: () => setConfirmModal(null),
      });
    },
    []
  );

  // Apply Appearance CSS Variables
  useEffect(() => {
    const s = settings;
    const r = document.documentElement.style;
    const accent = normalizeHex(s.appearance.accent) || '#5e6ad2';
    const clockColor = normalizeHex(s.clock.color) || '#ffffff';
    const [R, G, B] = hexToRgb(accent);
    r.setProperty('--accent', accent);
    r.setProperty('--accent-rgb', `${R}, ${G}, ${B}`);
    r.setProperty('--accent-soft', `rgba(${R}, ${G}, ${B}, 0.22)`);
    r.setProperty('--accent-glow', `rgba(${R}, ${G}, ${B}, 0.5)`);
    r.setProperty('--accent-border', `rgba(${R}, ${G}, ${B}, 0.45)`);
    r.setProperty('--accent-dark', `rgba(${R}, ${G}, ${B}, 0.12)`);
    const mix = (v: number) => Math.round(v + (255 - v) * 0.45);
    r.setProperty('--accent-text', `rgb(${mix(R)}, ${mix(G)}, ${mix(B)})`);
    r.setProperty('--accent-contrast', getContrastTextColor(accent));
    r.setProperty('--clock-color', clockColor);
    r.setProperty('--clock-scale', String(s.clock.size / 100));
  }, [settings.appearance.accent, settings.clock.color, settings.clock.size]);

  // Apply Minecraft-style GUI Scale CSS variable (and respond to resize in 'auto' mode)
  useEffect(() => {
    const mode = normalizeGuiScale(settings.appearance.guiScale);
    const applyGuiScale = () => {
      const factor = resolveGuiScaleFactor(mode, window.innerWidth, window.innerHeight);
      document.documentElement.style.setProperty('--gui-scale', String(factor));
      document.documentElement.dataset.guiScale = String(mode);
    };
    applyGuiScale();
    if (mode === 'auto') {
      window.addEventListener('resize', applyGuiScale);
      return () => window.removeEventListener('resize', applyGuiScale);
    }
  }, [settings.appearance.guiScale]);

  // Audio master update
  useEffect(() => {
    audioX.setMaster(settings.sounds.master);
  }, [settings.sounds.master]);

  // Sync callbacks setup
  useEffect(() => {
    sync.setCallbacks({
      getSettings: () => settingsRef.current,
      onRemoteSettings: nextSettings => {
        const merged = Store.normSettings(
          mergeRemoteSettingsWithLocalUploads(nextSettings, settingsRef.current)
        );
        setSettings(merged);
      },
      onRemoteTasks: nextTasks => {
        setTasks(nextTasks);
        Store.saveTaskItems(nextTasks);
      },
      onRemoteHistory: nextSessions => {
        setSessions(nextSessions);
        Store.saveSessions(nextSessions);
      },
      onRemoteNotes: () => {},
    });
    sync.start();
  }, []);

  // Firebase Firestore Connection Test and Realtime Cloud Sync
  useEffect(() => {
    testConnection().catch(() => {});

    let unsubCloud: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async user => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }

      if (!user) {
        if (settingsSaveTimerRef.current) {
          clearTimeout(settingsSaveTimerRef.current);
          settingsSaveTimerRef.current = null;
        }
        dirtyDomainsRef.current.clear();
        if (!isLocalPreviewBypass) {
          clearLocalDeviceWorkspace();
          setSettings(DEFAULTS);
          setSessions([]);
          setTasks([]);
          setTodos([]);
          setTodoPrefs(DEFAULT_TODO_PREFS);
          setNotes('');
          setPresets(DEFAULT_PRESETS);
          sessionsRef.current = [];
          setStudyBotOpen(false);
          setTodoOpen(false);
        }
        setCurrentUser(null);
        setAuthChecking(false);
        cloudLoadedUserRef.current = null;
        return;
      }

      // If switching from another user, wipe previous user's workspace so no cross-account contamination occurs
      if (cloudLoadedUserRef.current && cloudLoadedUserRef.current !== user.uid) {
        if (settingsSaveTimerRef.current) {
          clearTimeout(settingsSaveTimerRef.current);
          settingsSaveTimerRef.current = null;
        }
        dirtyDomainsRef.current.clear();
        clearLocalDeviceWorkspace();
        setSettings(DEFAULTS);
        setSessions([]);
        setTasks([]);
        setTodos([]);
        setTodoPrefs(DEFAULT_TODO_PREFS);
        setNotes('');
        setPresets(DEFAULT_PRESETS);
        sessionsRef.current = [];
      }

      setCurrentUser(user);

      // Verify if user already has data in Firestore; only initialize on confirmed missing doc (never on read error)
      try {
        const cloudRes = await fetchUserCloudData(user.uid);
        if (cloudRes.error) {
          addToast('Unable to fetch cloud workspace right now. Retrying in background...', 'err');
        } else if (!cloudRes.exists) {
          await initializeNewUserCloud(user.uid);
        }
      } catch (err) {
        console.warn('Initial cloud check:', err);
      }

      // Subscribe to remote changes (Cloud is sole source of truth; per-domain echo guard protects local edits)
      unsubCloud = subscribeToCloud(
        user.uid,
        {
          onLoaded: () => {
            const wasLoaded = cloudLoadedUserRef.current === user.uid;
            cloudLoadedUserRef.current = user.uid;
            setAuthChecking(false);
            if (!wasLoaded && dirtyDomainsRef.current.size > 0) {
              const queued = Array.from(dirtyDomainsRef.current);
              dirtyDomainsRef.current.clear();
              const pendingPatch: CloudDomainPatch = {};
              for (const domain of queued) {
                if (domain === 'settings') pendingPatch.settings = settingsRef.current;
                if (domain === 'savedLinks') pendingPatch.savedLinks = getSavedLinks();
                if (domain === 'tasks') pendingPatch.tasks = tasksRef.current;
                if (domain === 'todos') pendingPatch.todos = todosRef.current;
                if (domain === 'todoPrefs') pendingPatch.todoPrefs = todoPrefsRef.current;
                if (domain === 'history') pendingPatch.history = { sessions: sessionsRef.current };
                if (domain === 'notes') pendingPatch.notes = notesRef.current;
                if (domain === 'presets') pendingPatch.presets = presetsRef.current;
                if (domain === 'timer') pendingPatch.timer = timerRef.current;
                if (domain === 'pomodoro') {
                  pendingPatch.pomodoro = buildPomodoroSnapshot(settingsRef.current, timerRef.current);
                }
              }
              pushCloudDomains(user.uid, pendingPatch);
            }
          },
          onError: () => {
            setAuthChecking(false);
            addToast('Cloud sync listener interrupted. Changes will retry automatically.', 'err');
          },
          onSettings: (remoteSettings, hadOfflineBg) => {
            if (dirtyDomainsRef.current.has('settings')) return;
            const mergedRemote = mergeRemoteSettingsWithLocalUploads(
              remoteSettings,
              settingsRef.current
            );
            const normalized = Store.normSettings(mergedRemote);
            setSettings(normalized);
            Store.saveSettings(normalized);
            const hasLocalUpload = (['home', 'focus', 'ambient'] as const).some(
              m =>
                normalized.modes[m]?.bg?.kind === 'upload' ||
                normalized.modes[m]?.bg?.kind === 'videoUpload'
            );
            if (hadOfflineBg && !hasLocalUpload) {
              setShowOfflineBgModal(true);
            }
          },
          onSavedLinks: remoteLinks => {
            if (dirtyDomainsRef.current.has('savedLinks')) return;
            if (Array.isArray(remoteLinks)) {
              setAllSavedLinks(remoteLinks, false);
            }
          },
          onTasks: remoteTasks => {
            if (dirtyDomainsRef.current.has('tasks')) return;
            const userTasks = Array.isArray(remoteTasks) ? remoteTasks : [];
            setTasks(userTasks);
            Store.saveTaskItems(userTasks);
          },
          onTodos: remoteTodos => {
            if (dirtyDomainsRef.current.has('todos')) return;
            setTodos(remoteTodos);
            Store.saveTodos(remoteTodos);
          },
          onTodoPrefs: remotePrefs => {
            if (dirtyDomainsRef.current.has('todoPrefs')) return;
            setTodoPrefs(remotePrefs);
            Store.saveTodoPrefs(remotePrefs);
          },
          onHistory: remoteSessions => {
            if (dirtyDomainsRef.current.has('history')) return;
            const userSessions = Array.isArray(remoteSessions) ? remoteSessions : [];
            setSessions(userSessions);
            Store.saveSessions(userSessions);
          },
          onPausedTimer: remoteTimer => {
            if (dirtyDomainsRef.current.has('timer')) return;
            // Apply paused remote timer only if local timer is not actively running
            if (remoteTimer && timerRef.current.status !== 'running') {
              setTimerState(prev => ({
                ...prev,
                status: remoteTimer.status || 'idle',
                phase: remoteTimer.phase || 'focus',
                remainingMs: remoteTimer.remainingMs,
                durationMs: remoteTimer.durationMs,
                cycle: remoteTimer.cycle || 0,
              }));
            }
          },
          onPomodoro: remotePomodoro => {
            if (dirtyDomainsRef.current.has('pomodoro')) return;
            if (remotePomodoro) {
              if (remotePomodoro.focusStats) {
                Store.saveFocusStats(remotePomodoro.focusStats);
                setStatsVersion(v => v + 1);
              }
              if (typeof remotePomodoro.cycleTally === 'number' && timerRef.current.status !== 'running') {
                setTimerState(prev => ({
                  ...prev,
                  cycle: remotePomodoro.cycleTally,
                }));
              }
            }
          },
          onNotes: remoteNotes => {
            if (dirtyDomainsRef.current.has('notes')) return;
            if (typeof remoteNotes === 'string') {
              setNotes(remoteNotes);
              Store.saveNotes(remoteNotes);
            }
          },
          onPresets: remotePresets => {
            if (dirtyDomainsRef.current.has('presets')) return;
            if (Array.isArray(remotePresets) && remotePresets.length > 0) {
              setPresets(remotePresets);
            }
          },
          onDisplayName: remoteName => {
            if (dirtyDomainsRef.current.has('displayName')) return;
            if (typeof remoteName === 'string' && remoteName.trim()) {
              setSettings(prev => {
                if (prev.name === remoteName) return prev;
                const next = { ...prev, name: remoteName };
                Store.saveSettings(next);
                return next;
              });
            }
          },
        },
        () => timerRef.current.status === 'running'
      );
    });

    // Real-time synchronization of saved YouTube links whenever user adds or deletes links
    const handleSavedLinksChanged = (e: any) => {
      const updatedLinks = e.detail || getSavedLinks();
      queueOrPushDomains({ savedLinks: updatedLinks });
    };
    window.addEventListener('peakus:saved-links-updated', handleSavedLinksChanged);

    return () => {
      if (unsubCloud) unsubCloud();
      unsubAuth();
      window.removeEventListener('peakus:saved-links-updated', handleSavedLinksChanged);
    };
  }, [addToast, buildPomodoroSnapshot, queueOrPushDomains]);

  // Update Document Title
  useEffect(() => {
    if (timerState.status === 'running') {
      const rem = fmtClock(timerState.remainingMs);
      const act = activeTask ? activeTask.title : settings.timer.label || 'Focus';
      document.title = `${rem} • ${act} • Peakus`;
    } else {
      document.title = 'Peakus - max your focus';
    }
  }, [timerState.status, timerState.remainingMs, activeTask, settings.timer.label]);

  // Calculate Streak using tested Stats Engine
  // Calculate Stats using tested Stats Engine
  const computedStats = React.useMemo(() => {
    void statsVersion;
    return computeStats(sessions, tasks, settings.timer.streakGoal);
  }, [sessions, tasks, settings.timer.streakGoal, statsVersion]);
  const streakCount = computedStats.currentStreak;

  // Broadcast timer update to room ONLY if user is Host and room is in synced mode
  const broadcastIfHost = useCallback((nextTimer: TimerState) => {
    const r = activeRoomRef.current;
    if (
      currentRoomCode &&
      auth.currentUser &&
      r?.hostId === auth.currentUser.uid &&
      r?.timerMode === 'synced'
    ) {
      broadcastRoomTimer(currentRoomCode, nextTimer).catch(() => {});
    }
  }, [currentRoomCode]);

  // Persist current room code & chat notification prefs
  useEffect(() => {
    try {
      if (currentRoomCode) {
        localStorage.setItem('peakus.room_code', currentRoomCode);
      } else {
        localStorage.removeItem('peakus.room_code');
      }
    } catch {}
  }, [currentRoomCode]);

  useEffect(() => {
    try {
      localStorage.setItem('peakus.room_chat_muted', String(roomChatMuted));
      localStorage.setItem('peakus.room_break_only_chat', String(roomBreakOnlyChat));
    } catch {}
  }, [roomChatMuted, roomBreakOnlyChat]);

  const handleMarkRoomChatRead = useCallback(() => {
    const latestMsgAt = roomMessagesRef.current.reduce(
      (max, m) => Math.max(max, Number(m.createdAt) || 0),
      0
    );
    setLastRoomReadAt(Math.max(Date.now(), latestMsgAt));
    queuedBreakChatCountRef.current = 0;
  }, []);

  // Handle ?room=CODE invite link automatically
  useEffect(() => {
    if (!pendingInviteRoomCode) return;
    if (currentRoomCode === pendingInviteRoomCode) {
      setPendingInviteRoomCode(null);
      return;
    }

    const cleanUrl = () => {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('room')) {
          url.searchParams.delete('room');
          window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        }
      } catch {}
    };

    if (!currentUser) {
      if (isLocalPreviewBypass) {
        setRoomsOpen(true);
      }
      return;
    }

    let cancelled = false;
    const status =
      timerRef.current.status === 'running'
        ? timerRef.current.phase === 'focus'
          ? 'focusing'
          : 'break'
        : 'idle';

    joinStudyRoom(
      pendingInviteRoomCode,
      status,
      activeTask?.title,
      computedStats.todayFocusMs,
      !!settingsRef.current.timer.hardcoreMode
    )
      .then(({ room }) => {
        if (cancelled) return;
        setCurrentRoomCode(room.code);
        setRoomsOpen(true);
        setPendingInviteRoomCode(null);
        cleanUrl();
        addToast(`Joined "${room.name}" via invite link! 🔥`);
      })
      .catch(err => {
        if (cancelled) return;
        setRoomsOpen(true);
        addToast(err?.message || 'Could not auto-join invite room', 'err');
        cleanUrl();
      });

    return () => {
      cancelled = true;
    };
  }, [pendingInviteRoomCode, currentUser, currentRoomCode, isLocalPreviewBypass, activeTask?.title, computedStats.todayFocusMs, addToast]);

  // Live member presence heartbeat while in room
  useEffect(() => {
    if (!currentRoomCode || !auth.currentUser) return;
    const sendPresence = () => {
      const status =
        timerState.status === 'running'
          ? timerState.phase === 'focus'
            ? 'focusing'
            : 'break'
          : 'idle';
      const visibleTask = ownRoomTaskText !== undefined ? ownRoomTaskText : activeTask?.title;
      updateMemberPresence(
        currentRoomCode,
        status,
        visibleTask,
        computedStats.todayFocusMs,
        !!settings.timer.hardcoreMode,
        ownRoomTaskDone
      ).catch(() => {});
    };
    sendPresence();
    const interval = setInterval(sendPresence, 20000);
    return () => clearInterval(interval);
  }, [
    currentRoomCode,
    timerState.status,
    timerState.phase,
    activeTask?.title,
    ownRoomTaskText,
    ownRoomTaskDone,
    computedStats.todayFocusMs,
    settings.timer.hardcoreMode,
  ]);

  // Centralized real-time room, members, and chat subscriptions + notifications
  useEffect(() => {
    if (!currentRoomCode || !auth.currentUser) {
      setActiveRoom(null);
      setRoomMembers([]);
      setRoomMessages([]);
      setSprintCountdownSec(0);
      return;
    }

    seenRoomMessageCutoffRef.current = Date.now() - 2000;
    seenRoomMessageIdsRef.current.clear();

    const unsubRoom = subscribeToStudyRoom(currentRoomCode, remoteRoom => {
      if (!remoteRoom || remoteRoom.closed) {
        setCurrentRoomCode(null);
        setActiveRoom(null);
        setRoomMembers([]);
        setRoomMessages([]);
        addToast('The study room was closed by the host.', 'err');
        return;
      }

      if (remoteRoom.kickedUserIds?.includes(auth.currentUser?.uid || '')) {
        setCurrentRoomCode(null);
        setActiveRoom(null);
        setRoomMembers([]);
        setRoomMessages([]);
        addToast('You were removed from the study room by the host.', 'err');
        return;
      }

      setActiveRoom(remoteRoom);

      // Drift-free synchronized timer follower (protects active personal Hardcore run)
      const localHardcoreRunning =
        !!settingsRef.current.timer.hardcoreMode && timerRef.current.status === 'running';
      if (
        remoteRoom.timerMode === 'synced' &&
        remoteRoom.hostId !== auth.currentUser?.uid &&
        remoteRoom.timer &&
        !localHardcoreRunning
      ) {
        const synced = computeSyncedTimerDisplay(remoteRoom.timer, Date.now());
        if (synced) {
          setTimerState(prev => {
            if (
              prev.status === synced.status &&
              prev.phase === synced.phase &&
              prev.cycle === synced.cycle &&
              Math.abs(prev.remainingMs - synced.remainingMs) < 2000 &&
              prev.targetEndTime === synced.targetEndTime
            ) {
              return prev;
            }
            const nextState: TimerState = {
              ...prev,
              status: synced.status,
              phase: synced.phase,
              remainingMs: synced.remainingMs,
              durationMs: synced.durationMs,
              cycle: synced.cycle,
              startedAt: synced.startedAt,
              targetEndTime: synced.targetEndTime,
            };
            Store.saveTimer(nextState);
            return nextState;
          });
        }
      }
    });

    const unsubMembers = subscribeToRoomMembers(currentRoomCode, list => {
      setRoomMembers(list);
    });

    const unsubMessages = subscribeToRoomMessages(
      currentRoomCode,
      msgList => {
        setRoomMessages(msgList);
        const myUid = auth.currentUser?.uid;

        for (const msg of msgList) {
          if (seenRoomMessageIdsRef.current.has(msg.id)) continue;
          seenRoomMessageIdsRef.current.add(msg.id);

          if (msg.createdAt <= seenRoomMessageCutoffRef.current) continue;
          if (msg.senderId === myUid || msg.type === 'system') continue;

          const chatVisible =
            (roomsOpenRef.current || settingsOpenRef.current) &&
            activeRoomTabRef.current === 'chat';

          if (!roomChatMutedRef.current && (msg.type === 'reaction' || msg.type === 'nudge')) {
            setFloatingReactionPop({
              id: msg.id,
              senderName: msg.senderName,
              text: msg.text,
            });
            if (reactionPopTimerRef.current) clearTimeout(reactionPopTimerRef.current);
            reactionPopTimerRef.current = setTimeout(() => {
              setFloatingReactionPop(null);
            }, 4200);
          }

          if (chatVisible) {
            setLastRoomReadAt(prev => Math.max(prev, Date.now(), Number(msg.createdAt) || 0));
            continue;
          }

          if (roomChatMutedRef.current) continue;

          // Queue notifications during active Focus if Break-Only Chat Alerts is enabled
          if (
            roomBreakOnlyChatRef.current &&
            timerRef.current.status === 'running' &&
            timerRef.current.phase === 'focus'
          ) {
            queuedBreakChatCountRef.current += 1;
            continue;
          }

          audioX.ensure();
          audioX.playMessagePing(Math.min(65, Math.max(35, settingsRef.current.timer.volume || 55)));
          addToast(`💬 ${msg.senderName}: ${msg.text.slice(0, 80)}`);

          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.hidden
          ) {
            try {
              new Notification(`${msg.senderName} • Study Room`, {
                body: msg.text,
                icon: '/icon-192.png',
                tag: `peakus-room-${currentRoomCode}`,
              });
            } catch {}
          }
        }
      },
      () => {
        addToast('Room chat listener had a connection error. Reconnecting...', 'err');
      }
    );

    return () => {
      unsubRoom();
      unsubMembers();
      unsubMessages();
    };
  }, [currentRoomCode, currentUser, addToast]);

  // Flush queued Break-Only chat alerts when entering a Break
  useEffect(() => {
    if (timerState.phase !== 'focus' && queuedBreakChatCountRef.current > 0) {
      const count = queuedBreakChatCountRef.current;
      queuedBreakChatCountRef.current = 0;
      addToast(`💬 ${count} new room message${count === 1 ? '' : 's'} while you were focusing!`);
    }
  }, [timerState.phase, addToast]);

  // Synchronized 60s Sprint Countdown Watcher
  useEffect(() => {
    const sprintAt = activeRoom?.sprintStartAt;
    if (!sprintAt || !currentRoomCode) {
      setSprintCountdownSec(0);
      return;
    }

    const checkSprint = () => {
      const state = formatSprintCountdown(sprintAt, Date.now());
      setSprintCountdownSec(state.secondsLeft);

      if (state.ready && !firedSprintsRef.current.has(sprintAt)) {
        firedSprintsRef.current.add(sprintAt);
        const now = Date.now();
        const dur = getPhaseDuration('focus', settingsRef.current);
        const isHost = activeRoom?.hostId === auth.currentUser?.uid;

        if (isHost) {
          updateRoomSettings(currentRoomCode, { sprintStartAt: null }).catch(() => {});
          const nextState: TimerState = {
            ...timerRef.current,
            status: 'running',
            phase: 'focus',
            remainingMs: dur,
            durationMs: dur,
            targetEndTime: now + dur,
            startedAt: now,
            sessionStartedAt: now,
            interrupted: false,
          };
          setTimerState(nextState);
          Store.saveTimer(nextState);
          if (activeRoom?.timerMode === 'synced') {
            broadcastRoomTimer(currentRoomCode, nextState).catch(() => {});
          }
          addToast('🚀 Synchronized Sprint started — lock in!');
        } else if (activeRoom?.timerMode === 'independent' && timerRef.current.status === 'idle') {
          const nextState: TimerState = {
            ...timerRef.current,
            status: 'running',
            phase: 'focus',
            remainingMs: dur,
            durationMs: dur,
            targetEndTime: now + dur,
            startedAt: now,
            sessionStartedAt: now,
            interrupted: false,
          };
          setTimerState(nextState);
          Store.saveTimer(nextState);
          addToast('🚀 Room Sprint started — lock in!');
        } else {
          addToast('🚀 Room Sprint started!');
        }
      }
    };

    checkSprint();
    const interval = setInterval(checkSprint, 500);
    return () => clearInterval(interval);
  }, [activeRoom?.sprintStartAt, activeRoom?.hostId, activeRoom?.timerMode, currentRoomCode, getPhaseDuration, addToast]);

  const roomUnreadCount = React.useMemo(() => {
    return computeUnreadMessagesCount(roomMessages, currentUser?.uid, lastRoomReadAt);
  }, [roomMessages, currentUser?.uid, lastRoomReadAt]);

  const handleToggleRoomChatMuted = useCallback(() => {
    const nextMuted = !roomChatMutedRef.current;
    setRoomChatMuted(nextMuted);
    if (!nextMuted) {
      audioX.ensure();
      audioX.playMessagePing(Math.min(65, Math.max(35, settingsRef.current.timer.volume || 55)));
    }
  }, []);

  // Segment Completion Handler
  const handleSegmentEnd = useCallback(
    (prevPhase: TimerPhase, durationMs: number) => {
      const currentS = settingsRef.current;
      const tSettings = currentS.timer;
      const currentLang = currentS.language || 'en';
      const now = Date.now();
      const dateKey = toLocalDateKey(now);

      // Record completed session in history
      const newSession: Session = {
        id: uid('s'),
        kind: prevPhase === 'focus' ? 'focus' : 'break',
        phase: prevPhase,
        start: now - durationMs,
        end: now,
        ms: durationMs,
        completed: true,
        taskId: prevPhase === 'focus' && activeTask ? activeTask.id : null,
        title: prevPhase === 'focus' ? (activeTask ? activeTask.title : tSettings.label || 'Focus') : '',
      };
      const nextSessions = [newSession, ...sessionsRef.current];
      setSessions(nextSessions);
      Store.saveSessions(nextSessions);

      // Log completed focus duration and session count to daily historical stats (keyed by YYYY-MM-DD)
      const currentFocusStats = Store.loadFocusStats();
      const existingDayStat = currentFocusStats[dateKey] || {
        date: dateKey,
        focusMinutes: 0,
        focusMs: 0,
        sessionCount: 0,
        breakMinutes: 0,
        breakMs: 0,
      };

      let nextFocusStats = currentFocusStats;
      if (prevPhase === 'focus') {
        const updatedDayStat = {
          ...existingDayStat,
          focusMs: existingDayStat.focusMs + durationMs,
          focusMinutes: Math.round((existingDayStat.focusMs + durationMs) / 60000),
          sessionCount: existingDayStat.sessionCount + 1,
        };
        nextFocusStats = {
          ...currentFocusStats,
          [dateKey]: updatedDayStat,
        };
        Store.saveFocusStats(nextFocusStats);
      } else {
        const updatedDayStat = {
          ...existingDayStat,
          breakMs: existingDayStat.breakMs + durationMs,
          breakMinutes: Math.round((existingDayStat.breakMs + durationMs) / 60000),
        };
        nextFocusStats = {
          ...currentFocusStats,
          [dateKey]: updatedDayStat,
        };
        Store.saveFocusStats(nextFocusStats);
      }

      sync.touch();

      // Play alert sound
      audioX.playAlert(tSettings.sound, tSettings.volume);

      // If flowMode is enabled (and NOT Hardcore Mode) and focus session ended, ask if user wants to continue their flow (+10 min)
      if (prevPhase === 'focus' && tSettings.flowMode && !tSettings.hardcoreMode) {
        let nextBreakPhase: TimerPhase = 'short';
        const nextCycle = timerRef.current.cycle + 1;
        const targetTally = Math.max(1, tSettings.cycles || 4);
        if (tSettings.mode === 'countdown') {
          nextBreakPhase = 'focus';
        } else {
          nextBreakPhase = nextCycle < targetTally ? 'short' : 'long';
        }
        const nextBreakDuration = getPhaseDuration(nextBreakPhase, currentS);
        pendingBreakRef.current = {
          nextPhase: nextBreakPhase,
          durationMs: nextBreakDuration,
          autoStart: tSettings.autoBreak,
          nextCycle,
        };
        // Put timer in paused state at 0 until user chooses
        setTimerState(prev => ({
          ...prev,
          status: 'paused',
          remainingMs: 0,
          targetEndTime: null,
        }));
        setShowFlowPrompt(true);

        if (
          tSettings.notify &&
          'Notification' in window &&
          Notification.permission === 'granted' &&
          (document.hidden || !document.hasFocus())
        ) {
          try {
            new Notification('Session Complete!', {
              body: 'Want to continue your flow (+10 min) or take a break?',
              tag: 'peakus-timer',
            });
          } catch {}
        }
        return;
      }

      // Flocus Pomodoro State Machine Transitions:
      // When FOCUS finishes:
      //   - Increment cycleTally by 1.
      //   - If cycleTally < targetTally -> transition to SHORT_BREAK.
      //   - If cycleTally >= targetTally -> transition to LONG_BREAK.
      // When SHORT_BREAK finishes -> transition back to FOCUS without changing cycleTally.
      // When LONG_BREAK finishes -> reset cycleTally back to 0 and transition to FOCUS.
      let nextPhase: TimerPhase = 'focus';
      let autoStart = false;
      let nextCycle = timerRef.current.cycle;
      const isHardcore = !!tSettings.hardcoreMode;
      const targetTally = isHardcore
        ? HARDCORE_REQUIRED_SESSIONS
        : Math.max(1, tSettings.cycles || 4);

      if (tSettings.mode === 'countdown' && !isHardcore) {
        nextPhase = 'focus';
        autoStart = tSettings.autoBreak;
      } else {
        if (prevPhase === 'focus') {
          nextCycle = timerRef.current.cycle + 1;
          nextPhase = nextCycle < targetTally ? 'short' : 'long';
          autoStart = isHardcore ? true : tSettings.autoBreak;
        } else if (prevPhase === 'long') {
          nextPhase = 'focus';
          nextCycle = 0; // Reset cycleTally to 0 when long break finishes
          autoStart = isHardcore ? true : tSettings.autoFocus;
        } else {
          // SHORT_BREAK finishes: transition back to FOCUS without changing cycleTally
          nextPhase = 'focus';
          nextCycle = timerRef.current.cycle; // Keep unchanged
          autoStart = isHardcore ? true : tSettings.autoFocus;
        }
      }

      const hardcoreJustFinished =
        isHardcore && prevPhase === 'focus' && nextCycle >= HARDCORE_REQUIRED_SESSIONS;

      let effectiveSettings = currentS;
      if (hardcoreJustFinished) {
        effectiveSettings = Store.normSettings({
          ...currentS,
          timer: { ...currentS.timer, hardcoreMode: false },
        });
        setSettings(effectiveSettings);
        Store.saveSettings(effectiveSettings);
      }

      const nextDuration = getPhaseDuration(nextPhase, effectiveSettings);
      const targetEndTime = autoStart ? now + nextDuration : null;
      const nextState: TimerState = {
        status: autoStart ? 'running' : 'idle',
        phase: nextPhase,
        remainingMs: nextDuration,
        durationMs: nextDuration,
        cycle: nextCycle,
        targetEndTime,
        startedAt: autoStart ? now : null,
        sessionStartedAt: autoStart ? now : null,
        interrupted: false,
      };
      setTimerState(nextState);
      Store.saveTimer(nextState);
      broadcastIfHost(nextState);
      queueOrPushDomains({
        history: { sessions: nextSessions },
        timer: nextState,
        pomodoro: buildPomodoroSnapshot(effectiveSettings, nextState, nextFocusStats),
        ...(hardcoreJustFinished ? { settings: effectiveSettings } : {}),
      });

      const nextName =
        nextPhase === 'focus'
          ? t('phaseFocus', currentLang)
          : nextPhase === 'short'
          ? t('phaseShort', currentLang)
          : t('phaseLong', currentLang);

      const toastMsg = hardcoreJustFinished
        ? `Hardcore Complete (4/4)! You focused for ${fmtDur(durationMs)} — controls unlocked for your Long Break!`
        : prevPhase === 'focus'
        ? `Session complete! You focused for ${fmtDur(durationMs)}. ${
            autoStart ? `Starting ${nextName}.` : `Ready for ${nextName}?`
          }`
        : `Break finished. ${
            autoStart ? 'Starting next focus session.' : 'Ready to focus again?'
          }`;

      addToast(toastMsg);

      if (currentRoomCode && auth.currentUser && prevPhase === 'focus') {
        const senderName = getCurrentUserName();
        const mins = Math.max(1, Math.round(durationMs / 60000));
        const milestoneText = hardcoreJustFinished
          ? `🏆 ${senderName} conquered all ${HARDCORE_REQUIRED_SESSIONS}/${HARDCORE_REQUIRED_SESSIONS} Hardcore Focus sessions!`
          : `✅ ${senderName} completed a ${mins}m Focus session!`;
        sendRoomMessage(currentRoomCode, milestoneText, 'system').catch(() => {});
      }
      if (
        tSettings.notify &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        (document.hidden || !document.hasFocus())
      ) {
        try {
          new Notification(
            hardcoreJustFinished
              ? 'Hardcore Complete!'
              : prevPhase === 'focus'
              ? 'Session Complete!'
              : 'Break Finished',
            { body: toastMsg, tag: 'peakus-timer' }
          );
        } catch {}
      }
    },
    [sessions, activeTask, getPhaseDuration, addToast, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]
  );

  // Expose test trigger in window
  useEffect(() => {
    (window as any).__expireTimerForTesting = () => {
      const cur = timerRef.current;
      handleSegmentEnd(cur.phase || 'focus', cur.durationMs || 25 * 60 * 1000);
    };
    return () => {
      delete (window as any).__expireTimerForTesting;
    };
  }, [handleSegmentEnd]);

  // Flow Continuation Handlers
  const handleContinueFlow = useCallback(() => {
    setShowFlowPrompt(false);
    pendingBreakRef.current = null;
    flowExtendedRef.current = true;
    const tenMinutesMs = 10 * 60 * 1000;
    const now = Date.now();
    const nextState: TimerState = {
      ...timerRef.current,
      phase: 'focus',
      status: 'running',
      remainingMs: tenMinutesMs,
      durationMs: tenMinutesMs,
      targetEndTime: now + tenMinutesMs,
      startedAt: now,
      sessionStartedAt: now,
      interrupted: false,
    };
    setTimerState(nextState);
    Store.saveTimer(nextState);
    broadcastIfHost(nextState);
    queueOrPushDomains({ timer: nextState });
    addToast(t('flowAddedToast', settingsRef.current.language || 'en'));
  }, [addToast, broadcastIfHost, queueOrPushDomains]);

  const handleCancelFlow = useCallback(() => {
    setShowFlowPrompt(false);
    flowExtendedRef.current = false;
    const pending = pendingBreakRef.current;
    const now = Date.now();
    const currentS = settingsRef.current;
    const currentLang = currentS.language || 'en';
    const nextPhase: TimerPhase = pending?.nextPhase || 'short';
    const nextDuration = pending?.durationMs || getPhaseDuration(nextPhase, currentS);
    const nextCycle = pending?.nextCycle ?? (timerRef.current.cycle + 1);
    pendingBreakRef.current = null;

    // Taking a break from the Flow prompt (either click or auto-countdown 0s) starts the break immediately
    const nextState: TimerState = {
      status: 'running',
      phase: nextPhase,
      remainingMs: nextDuration,
      durationMs: nextDuration,
      cycle: nextCycle,
      targetEndTime: now + nextDuration,
      startedAt: now,
      sessionStartedAt: now,
      interrupted: false,
    };
    setTimerState(nextState);
    Store.saveTimer(nextState);
    broadcastIfHost(nextState);
    queueOrPushDomains({
      timer: nextState,
      pomodoro: buildPomodoroSnapshot(currentS, nextState),
    });

    const nextName =
      nextPhase === 'focus'
        ? t('phaseFocus', currentLang)
        : nextPhase === 'short'
        ? t('phaseShort', currentLang)
        : t('phaseLong', currentLang);

    addToast(`Starting ${nextName}.`);
  }, [getPhaseDuration, addToast, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]);

  const handleToggleFlowMode = useCallback(() => {
    const nextVal = !settingsRef.current.timer.flowMode;
    const nextSettings = {
      ...settingsRef.current,
      timer: {
        ...settingsRef.current.timer,
        flowMode: nextVal,
      },
    };
    setSettings(nextSettings);
    Store.saveSettings(nextSettings);
    sync.touch();
    queueOrPushDomains({ settings: nextSettings });
    addToast(nextVal ? 'Flow Mode enabled (will ask +10m after focus)' : 'Flow Mode disabled');
  }, [addToast, queueOrPushDomains]);

  // Preset Handlers
  const handleSelectPreset = useCallback(
    (preset: PomodoroPreset) => {
      const nextSettings = applyPresetToSettings(settingsRef.current, preset);
      setSettings(nextSettings);
      Store.saveSettings(nextSettings);
      const phase = timerRef.current.phase;
      const duration = getPhaseDuration(phase, nextSettings);
      let nextTimer = timerRef.current;
      if (timerRef.current.status === 'idle') {
        nextTimer = {
          ...timerRef.current,
          durationMs: duration,
          remainingMs: duration,
        };
        setTimerState(nextTimer);
        Store.saveTimer(nextTimer);
      }
      queueOrPushDomains({
        settings: nextSettings,
        timer: nextTimer,
        pomodoro: buildPomodoroSnapshot(nextSettings, nextTimer),
      });
      addToast(t('presetAppliedToast', nextSettings.language || 'en'));
    },
    [getPhaseDuration, addToast, queueOrPushDomains, buildPomodoroSnapshot]
  );

  const handleSavePreset = useCallback(
    (preset: PomodoroPreset) => {
      const updated = saveCustomPreset(preset);
      setPresets(updated);
      queueOrPushDomains({ presets: updated });
    },
    [queueOrPushDomains]
  );

  const handleUpdateNotes = useCallback(
    (notesText: string) => {
      setNotes(notesText);
      Store.saveNotes(notesText, Date.now());
      queueOrPushDomains({ notes: notesText });
    },
    [queueOrPushDomains]
  );

  const handleAppendCalcToNotes = useCallback(
    (line: string) => {
      const current = notesRef.current || '';
      const nextText = appendLineToRichNotes(current, line);
      handleUpdateNotes(nextText);
    },
    [handleUpdateNotes]
  );

  const handleUpdateTodos = useCallback(
    (nextTodos: TodoItem[]) => {
      setTodos(nextTodos);
      Store.saveTodos(nextTodos);
      const syncedTasks = syncTodoChangesToTasks(nextTodos, tasksRef.current);
      if (syncedTasks !== tasksRef.current) {
        setTasks(syncedTasks);
        Store.saveTaskItems(syncedTasks);
        queueOrPushDomains({ todos: nextTodos, tasks: syncedTasks });
      } else {
        queueOrPushDomains({ todos: nextTodos });
      }
    },
    [queueOrPushDomains]
  );

  const handleUpdateTasksFromQueue = useCallback(
    (nextTasks: Task[]) => {
      setTasks(nextTasks);
      Store.saveTaskItems(nextTasks);
      const syncedTodos = syncTaskChangesToTodos(nextTasks, todosRef.current);
      if (syncedTodos !== todosRef.current) {
        setTodos(syncedTodos);
        Store.saveTodos(syncedTodos);
        queueOrPushDomains({ tasks: nextTasks, todos: syncedTodos });
      } else {
        queueOrPushDomains({ tasks: nextTasks });
      }
    },
    [queueOrPushDomains]
  );

  const handleSendTodoToFocusQueue = useCallback(
    (todo: TodoItem) => {
      const res = enqueueTodoInFocusQueue(todo, tasksRef.current, todosRef.current, {
        focusNow: false,
      });
      setTasks(res.nextTasks);
      setTodos(res.nextTodos);
      Store.saveTaskItems(res.nextTasks);
      Store.saveTodos(res.nextTodos);
      queueOrPushDomains({ tasks: res.nextTasks, todos: res.nextTodos });
      addToast(
        res.wasAlreadyQueued
          ? `Already in Focus Queue: ${todo.title}`
          : `📌 Sent to Focus Queue: ${todo.title}`
      );
    },
    [queueOrPushDomains, addToast]
  );

  const handleRemoveTodoFromFocusQueue = useCallback(
    (todo: TodoItem) => {
      const res = removeTodoFromFocusQueue(todo.id, tasksRef.current, todosRef.current);
      setTasks(res.nextTasks);
      setTodos(res.nextTodos);
      Store.saveTaskItems(res.nextTasks);
      Store.saveTodos(res.nextTodos);
      queueOrPushDomains({ tasks: res.nextTasks, todos: res.nextTodos });
      addToast(`Removed "${todo.title}" from Focus Queue (kept in To-dos)`);
    },
    [queueOrPushDomains, addToast]
  );

  const handleFocusTodoNow = useCallback(
    (todo: TodoItem) => {
      const res = enqueueTodoInFocusQueue(todo, tasksRef.current, todosRef.current, {
        focusNow: true,
      });
      setTasks(res.nextTasks);
      setTodos(res.nextTodos);
      Store.saveTaskItems(res.nextTasks);
      Store.saveTodos(res.nextTodos);

      if (timerRef.current.phase === 'focus') {
        const nextTimer: TimerState = {
          ...timerRef.current,
          taskId: res.queuedTask.id,
          title: res.queuedTask.title,
          updatedAt: Date.now(),
        };
        setTimerState(nextTimer);
        Store.saveTimer(nextTimer);
      }

      let nextModeSettings: Settings | null = null;
      if (settingsRef.current.mode === 'home') {
        nextModeSettings = Store.normSettings({ ...settingsRef.current, mode: 'focus' });
        setSettings(nextModeSettings);
        Store.saveSettings(nextModeSettings);
      }

      queueOrPushDomains({
        tasks: res.nextTasks,
        todos: res.nextTodos,
        ...(nextModeSettings ? { settings: nextModeSettings } : {}),
      });
      setTodoOpen(false);
      addToast(`🎯 Pinned to timer: ${todo.title}`);
    },
    [queueOrPushDomains, addToast]
  );

  const handleUpdateTodoPrefs = useCallback(
    (nextPrefs: TodoNotificationPrefs) => {
      setTodoPrefs(nextPrefs);
      Store.saveTodoPrefs(nextPrefs);
      queueOrPushDomains({ todoPrefs: nextPrefs });
    },
    [queueOrPushDomains]
  );

  const dispatchTodoNotification = useCallback(
    (title: string, body: string, todoId: string | null = null) => {
      const curSettings = settingsRef.current;
      audioX.ensure();
      audioX.playAlert(curSettings.timer.sound, curSettings.timer.volume);
      setActiveReminderAlert({ todoId, title, body });

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const tag = todoId ? `peakus-todo-${todoId}` : 'peakus-todo-preview';
        const notifOptions: NotificationOptions = {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag,
        };
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready
            .then(reg => {
              if (reg && typeof reg.showNotification === 'function') {
                return reg.showNotification(title, notifOptions);
              }
              new Notification(title, notifOptions);
            })
            .catch(() => {
              try {
                new Notification(title, notifOptions);
              } catch {}
            });
        } else {
          try {
            new Notification(title, notifOptions);
          } catch {}
        }
      }
    },
    []
  );

  const handleTestTodoReminder = useCallback(
    (sampleTitle: string) => {
      const curLang = settingsRef.current.language || 'en';
      const payload = formatReminderPayload(
        { title: sampleTitle, note: '' },
        todoPrefsRef.current,
        curLang,
        Math.floor(Date.now() / 1000),
        !!settingsRef.current.quotes.godMode
      );
      dispatchTodoNotification(payload.title, payload.body, null);
    },
    [dispatchTodoNotification]
  );

  // Background Todo Reminder Scheduler (checks every 5s + on tab visibility/focus)
  useEffect(() => {
    const checkDueReminders = () => {
      const now = Date.now();
      const dueList = findDueTodoReminders(todosRef.current, now);
      if (dueList.length === 0) return;

      const dueIds = new Set(dueList.map(d => d.id));
      const updatedTodos = todosRef.current.map(item =>
        dueIds.has(item.id) ? { ...item, remindedAt: now, updatedAt: now } : item
      );
      handleUpdateTodos(updatedTodos);

      const curLang = settingsRef.current.language || 'en';
      const isGodMode = !!settingsRef.current.quotes.godMode;
      dueList.forEach((todo, index) => {
        const payload = formatReminderPayload(
          todo,
          todoPrefsRef.current,
          curLang,
          Math.floor(now / 1000) + index,
          isGodMode
        );
        dispatchTodoNotification(payload.title, payload.body, todo.id);
      });
    };

    checkDueReminders();
    const interval = setInterval(checkDueReminders, 5000);
    const onWake = () => {
      if (!document.hidden) checkDueReminders();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [handleUpdateTodos, dispatchTodoNotification]);

  // Drift-Free Timer Tick Engine using timestamp deltas (targetEndTime - Date.now())
  useEffect(() => {
    if (timerState.status !== 'running') return;

    const tick = () => {
      const cur = timerRef.current;
      if (cur.status !== 'running' || !cur.targetEndTime) return;
      const now = Date.now();
      const remaining = Math.max(0, cur.targetEndTime - now);

      if (remaining <= 0) {
        handleSegmentEnd(cur.phase, cur.durationMs);
      } else {
        setTimerState(prev => (prev.status === 'running' ? { ...prev, remainingMs: remaining } : prev));
      }
    };

    // Immediate sync on tab visibility or window focus
    const handleVisibility = () => {
      if (!document.hidden) {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    const interval = setInterval(tick, 200);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [timerState.status, handleSegmentEnd]);

  // Sync timer duration if settings change while timer is idle
  useEffect(() => {
    if (timerRef.current.status === 'idle') {
      const dur = getPhaseDuration(timerRef.current.phase, settings);
      setTimerState(prev => {
        if (prev.status !== 'idle') return prev;
        if (prev.durationMs === dur && prev.remainingMs === dur) return prev;
        return {
          ...prev,
          durationMs: dur,
          remainingMs: dur,
          targetEndTime: null,
        };
      });
    }
  }, [
    settings.timer.focus,
    settings.timer.short,
    settings.timer.long,
    settings.timer.countdown,
    settings.timer.mode,
    getPhaseDuration,
  ]);

  // Controls Handlers
  const handleToggleTimer = () => {
    audioX.ensure();
    const cur = timerRef.current;
    const now = Date.now();

    if (cur.status === 'running') {
      if (!canPauseTimer(settingsRef.current.timer)) {
        addToast('Hardcore Mode active — pausing is disabled! Finish the 4 sessions or Quit.', 'err');
        return;
      }
      const rem = cur.targetEndTime ? Math.max(0, cur.targetEndTime - now) : cur.remainingMs;
      const next: TimerState = {
        ...cur,
        status: 'paused',
        remainingMs: rem,
        targetEndTime: null,
      };
      setTimerState(next);
      Store.saveTimer(next);
      broadcastIfHost(next);
      queueOrPushDomains({ timer: next });
    } else {
      const dur = getPhaseDuration(cur.phase, settings);
      const effectiveRem = cur.remainingMs <= 0 ? dur : cur.remainingMs;
      const targetEndTime = now + effectiveRem;
      const next: TimerState = {
        ...cur,
        status: 'running',
        remainingMs: effectiveRem,
        durationMs: cur.remainingMs <= 0 ? dur : cur.durationMs,
        targetEndTime,
        startedAt: cur.startedAt || now,
        sessionStartedAt: cur.sessionStartedAt || now,
      };
      setTimerState(next);
      Store.saveTimer(next);
      broadcastIfHost(next);
    }
  };

  const saveElapsedFocusBeforeReset = useCallback((cur: TimerState) => {
    if (settingsRef.current.timer.hardcoreMode) {
      return {
        nextSessions: sessionsRef.current,
        nextFocusStats: Store.loadFocusStats(),
        savedMs: 0,
      };
    }
    const now = Date.now();
    const rem =
      cur.status === 'running' && cur.targetEndTime
        ? Math.max(0, cur.targetEndTime - now)
        : cur.remainingMs;
    const elapsed = Math.max(0, cur.durationMs - rem);
    let nextSessions = sessionsRef.current;
    let nextFocusStats = Store.loadFocusStats();
    let savedMs = 0;

    if (cur.phase === 'focus' && elapsed >= 1000) {
      savedMs = elapsed;
      const partialSession: Session = {
        id: uid('s'),
        kind: 'focus',
        phase: 'focus',
        start: cur.sessionStartedAt || (now - elapsed),
        end: now,
        ms: elapsed,
        completed: false,
        taskId: activeTask ? activeTask.id : null,
        title: activeTask ? activeTask.title : settingsRef.current.timer.label || 'Focus',
      };
      nextSessions = [partialSession, ...sessionsRef.current];
      setSessions(nextSessions);
      Store.saveSessions(nextSessions);

      const statRes = recordPartialFocusStat(nextFocusStats, elapsed, now);
      nextFocusStats = statRes.nextStats;
      Store.saveFocusStats(nextFocusStats);
      sync.touch();
    }

    return { nextSessions, nextFocusStats, savedMs };
  }, [activeTask]);

  const handleResetTimer = useCallback(() => {
    setShowResetSegmentModal(true);
  }, []);

  const handleRequestResetSegments = useCallback(() => {
    setShowResetSegmentModal(true);
  }, []);

  const handleConfirmResetCurrentSegment = useCallback(() => {
    const cur = timerRef.current;
    const isHardcore = !!settingsRef.current.timer.hardcoreMode;
    const { nextSessions, nextFocusStats, savedMs } = saveElapsedFocusBeforeReset(cur);
    flowExtendedRef.current = false;
    pendingBreakRef.current = null;
    setShowFlowPrompt(false);

    const dur = getPhaseDuration(cur.phase, settingsRef.current);
    const next: TimerState = {
      ...cur,
      status: 'idle',
      remainingMs: dur,
      durationMs: dur,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
      interrupted: false,
    };
    setTimerState(next);
    Store.saveTimer(next);
    broadcastIfHost(next);
    addToast(
      isHardcore
        ? 'Resetting is for the weak — elapsed focus discarded (not logged).'
        : savedMs >= 1000
        ? `This part reset (${fmtDur(savedMs)} focus saved).`
        : 'This part reset.'
    );
    queueOrPushDomains({
      timer: next,
      ...(savedMs >= 1000
        ? {
            history: { sessions: nextSessions },
            pomodoro: buildPomodoroSnapshot(settingsRef.current, next, nextFocusStats),
          }
        : {}),
    });
  }, [getPhaseDuration, addToast, saveElapsedFocusBeforeReset, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]);

  const handleConfirmResetAllSegments = useCallback(() => {
    const cur = timerRef.current;
    const isHardcore = !!settingsRef.current.timer.hardcoreMode;
    const prevCycle = Math.max(0, cur.cycle || 0);
    const { nextSessions, nextFocusStats, savedMs } = saveElapsedFocusBeforeReset(cur);
    flowExtendedRef.current = false;
    pendingBreakRef.current = null;
    setShowFlowPrompt(false);

    const dur = getPhaseDuration('focus', settingsRef.current);
    const target = Math.max(1, settingsRef.current.timer.cycles || 4);
    const next: TimerState = {
      ...cur,
      status: 'idle',
      phase: 'focus',
      remainingMs: dur,
      durationMs: dur,
      cycle: 0,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
      interrupted: false,
    };
    setTimerState(next);
    Store.saveTimer(next);
    broadcastIfHost(next);

    let resetMsg = `Whole session reset (ready for 0/${target}).`;
    if (isHardcore) {
      resetMsg = 'Whole session reset — Hardcore Mode discarded unfinished focus time.';
    } else if (prevCycle > 0 && savedMs >= 1000) {
      resetMsg = `Session reset (${prevCycle}/${target} completed cycles & +${fmtDur(savedMs)} saved).`;
    } else if (prevCycle > 0) {
      resetMsg = `Session reset (${prevCycle}/${target} completed cycles saved).`;
    } else if (savedMs >= 1000) {
      resetMsg = `Whole session reset (+${fmtDur(savedMs)} focus saved).`;
    }
    addToast(resetMsg);

    queueOrPushDomains({
      timer: next,
      pomodoro: buildPomodoroSnapshot(settingsRef.current, next, nextFocusStats),
      ...(savedMs >= 1000 ? { history: { sessions: nextSessions } } : {}),
    });
  }, [getPhaseDuration, addToast, saveElapsedFocusBeforeReset, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]);

  const executeSkipTimer = useCallback(() => {
    const cur = timerRef.current;
    const curSettings = settingsRef.current;
    const tSettings = curSettings.timer;
    if (tSettings.hardcoreMode) return;

    const now = Date.now();
    const rem =
      cur.status === 'running' && cur.targetEndTime
        ? Math.max(0, cur.targetEndTime - now)
        : cur.remainingMs;
    const elapsed = Math.max(0, cur.durationMs - rem);

    let nextSessions = sessionsRef.current;
    // Log interrupted partial segment as completed: false if >= 1 minute (never counts as a completed session)
    if (cur.sessionStartedAt && elapsed >= 60000) {
      const interruptedSession: Session = {
        id: uid('s'),
        kind: cur.phase === 'focus' ? 'focus' : 'break',
        phase: cur.phase,
        start: cur.sessionStartedAt,
        end: now,
        ms: elapsed,
        completed: false,
        taskId: cur.phase === 'focus' && activeTask ? activeTask.id : null,
        title: cur.phase === 'focus' ? (activeTask ? activeTask.title : tSettings.label || 'Focus') : '',
      };
      nextSessions = [interruptedSession, ...sessionsRef.current];
      setSessions(nextSessions);
      Store.saveSessions(nextSessions);
      sync.touch();
    }

    let nextPhase: TimerPhase = 'focus';
    let nextCycle = cur.cycle;
    const targetTally = Math.max(1, tSettings.cycles || 4);

    if (tSettings.mode === 'pomodoro') {
      if (cur.phase === 'focus') {
        // Skipping Focus -> Break MUST NOT increment session tally
        nextCycle = cur.cycle;
        nextPhase = cur.cycle + 1 < targetTally ? 'short' : 'long';
      } else if (cur.phase === 'long') {
        nextPhase = 'focus';
        nextCycle = 0;
      } else {
        nextPhase = 'focus';
        nextCycle = cur.cycle;
      }
    }
    const duration = getPhaseDuration(nextPhase, curSettings);
    const next: TimerState = {
      status: 'idle',
      phase: nextPhase,
      remainingMs: duration,
      durationMs: duration,
      cycle: nextCycle,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
    };
    setTimerState(next);
    Store.saveTimer(next);
    broadcastIfHost(next);
    queueOrPushDomains({
      timer: next,
      pomodoro: buildPomodoroSnapshot(curSettings, next),
      ...(nextSessions !== sessionsRef.current ? { history: { sessions: nextSessions } } : {}),
    });
  }, [activeTask, getPhaseDuration, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]);

  const handleSkipTimer = useCallback(() => {
    const cur = timerRef.current;
    const curSettings = settingsRef.current;
    const curLang = curSettings.language || 'en';
    if (curSettings.timer.hardcoreMode) {
      addToast('Hardcore Mode active — skipping is disabled! Finish the timer or reset.', 'err');
      return;
    }
    askConfirm(
      t('skipWarningTitle', curLang),
      cur.phase === 'focus' ? t('skipWarningFocusDesc', curLang) : t('skipWarningBreakDesc', curLang),
      t('skipAnyway', curLang),
      executeSkipTimer,
      false
    );
  }, [addToast, askConfirm, executeSkipTimer]);

  const handleSetPhase = useCallback(
    (phase: TimerPhase) => {
      const cur = timerRef.current;
      if (phase === cur.phase) return;
      const curSettings = settingsRef.current;
      const curLang = curSettings.language || 'en';
      const now = Date.now();
      const rem =
        cur.status === 'running' && cur.targetEndTime
          ? Math.max(0, cur.targetEndTime - now)
          : cur.remainingMs;
      const elapsed = Math.max(0, cur.durationMs - rem);

      const applyPhaseSwitch = () => {
        const latestSettings = settingsRef.current;
        const latestCur = timerRef.current;
        const duration = getPhaseDuration(phase, latestSettings);
        const next: TimerState = {
          ...latestCur,
          status: 'idle',
          phase,
          remainingMs: duration,
          durationMs: duration,
          targetEndTime: null,
          startedAt: null,
          sessionStartedAt: null,
        };
        setTimerState(next);
        Store.saveTimer(next);
        broadcastIfHost(next);
        queueOrPushDomains({ timer: next });
      };

      if (curSettings.timer.hardcoreMode) {
        if (cur.status !== 'idle' || elapsed >= 1000 || cur.phase !== 'focus') {
          addToast('Hardcore Mode active — skipping or switching phases is disabled!', 'err');
          return;
        }
      } else if (cur.status !== 'idle' || elapsed >= 1000) {
        askConfirm(
          t('skipWarningTitle', curLang),
          cur.phase === 'focus' ? t('skipWarningFocusDesc', curLang) : t('skipWarningBreakDesc', curLang),
          t('skipAnyway', curLang),
          applyPhaseSwitch,
          false
        );
        return;
      }

      applyPhaseSwitch();
    },
    [addToast, askConfirm, getPhaseDuration, broadcastIfHost, queueOrPushDomains]
  );

  const handleUpdateSettings = useCallback(
    (nextSettings: Settings, path = '') => {
      const wasHardcore = !!settingsRef.current.timer.hardcoreMode;
      const normalized = Store.normSettings(nextSettings);
      setSettings(normalized);
      Store.saveSettings(normalized);

      let nextTimerForSync = timerRef.current;
      if (!wasHardcore && normalized.timer.hardcoreMode) {
        const dur = getPhaseDuration('focus', normalized);
        const freshHardcoreTimer: TimerState = {
          status: 'idle',
          phase: 'focus',
          remainingMs: dur,
          durationMs: dur,
          cycle: 0,
          targetEndTime: null,
          startedAt: null,
          sessionStartedAt: null,
          interrupted: false,
        };
        setTimerState(freshHardcoreTimer);
        Store.saveTimer(freshHardcoreTimer);
        broadcastIfHost(freshHardcoreTimer);
        nextTimerForSync = freshHardcoreTimer;
        void loadHumiliationLines();
      }

      if (path !== 'mode') {
        sync.touch();
      }
      if (auth.currentUser) {
        if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
        settingsSaveTimerRef.current = setTimeout(() => {
          settingsSaveTimerRef.current = null;
          queueOrPushDomains({
            settings: settingsRef.current,
            pomodoro: buildPomodoroSnapshot(settingsRef.current, nextTimerForSync),
            ...(!wasHardcore && normalized.timer.hardcoreMode ? { timer: nextTimerForSync } : {}),
          });
        }, 250);
      }
    },
    [getPhaseDuration, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]
  );

  const executeQuitHardcore = useCallback(async () => {
    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }
    const cur = timerRef.current;
    const curSettings = settingsRef.current;
    const completedBeforeQuit = Math.min(HARDCORE_REQUIRED_SESSIONS, Math.max(0, cur.cycle || 0));

    const unlocked = Store.normSettings({
      ...curSettings,
      timer: { ...curSettings.timer, hardcoreMode: false },
    });
    setSettings(unlocked);
    Store.saveSettings(unlocked);
    setSettingsOpen(false);

    const dur = getPhaseDuration('focus', unlocked);
    const resetTimer: TimerState = {
      status: 'idle',
      phase: 'focus',
      remainingMs: dur,
      durationMs: dur,
      cycle: 0,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
      interrupted: false,
    };
    setTimerState(resetTimer);
    Store.saveTimer(resetTimer);
    broadcastIfHost(resetTimer);
    queueOrPushDomains({
      settings: unlocked,
      timer: resetTimer,
      pomodoro: buildPomodoroSnapshot(unlocked, resetTimer),
    });

    if (currentRoomCode && auth.currentUser && activeRoomRef.current?.groupHardcore) {
      const senderName = getCurrentUserName();
      sendRoomMessage(
        currentRoomCode,
        `💀 ${senderName} quit Group Hardcore Mode at ${completedBeforeQuit}/${HARDCORE_REQUIRED_SESSIONS}.`,
        'system'
      ).catch(() => {});
    }

    const lines = await loadHumiliationLines();
    const line = pickRandomHumiliationLine(lines);
    setHumiliationModal({
      open: true,
      line,
      completedSessions: completedBeforeQuit,
    });
  }, [getPhaseDuration, broadcastIfHost, queueOrPushDomains, buildPomodoroSnapshot]);

  const handleRequestQuitHardcore = useCallback(() => {
    const curLang = settingsRef.current.language || 'en';
    const completed = Math.min(
      HARDCORE_REQUIRED_SESSIONS,
      Math.max(0, timerRef.current.cycle || 0)
    );
    askConfirm(
      t('quitReallyTitle', curLang),
      `${t('quitReallyDesc', curLang)} (${completed}/${HARDCORE_REQUIRED_SESSIONS})`,
      t('quitConfirmYes', curLang),
      () => {
        void executeQuitHardcore();
      },
      true
    );
  }, [askConfirm, executeQuitHardcore]);

  // Flush any debounced settings write before tab close or backgrounding
  useEffect(() => {
    const flushSettings = () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
        settingsSaveTimerRef.current = null;
        queueOrPushDomains({
          settings: settingsRef.current,
          pomodoro: buildPomodoroSnapshot(settingsRef.current, timerRef.current),
        });
      }
    };
    const handleVisibility = () => {
      if (document.hidden) flushSettings();
    };
    window.addEventListener('pagehide', flushSettings);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushSettings);
      document.removeEventListener('visibilitychange', handleVisibility);
      flushSettings();
    };
  }, [queueOrPushDomains, buildPomodoroSnapshot]);

  // Zen Mode (Auto-hide controls)
  useEffect(() => {
    if (!settings.appearance.autoHide) {
      document.body.classList.remove('zen-hidden');
      return;
    }
    let zenTimer: any = null;
    const isEligible = () => {
      if (
        tasksOpen ||
        soundsOpen ||
        notesOpen ||
        musicOpen ||
        settingsOpen ||
        studyBotOpen ||
        calculatorOpen ||
        todoOpen ||
        roomsOpen ||
        confirmModal?.open ||
        humiliationModal.open
      ) {
        return false;
      }
      return settings.mode === 'ambient' || timerRef.current.status === 'running';
    };
    const wake = () => {
      document.body.classList.remove('zen-hidden');
      clearTimeout(zenTimer);
      zenTimer = setTimeout(() => {
        if (isEligible()) {
          document.body.classList.add('zen-hidden');
        }
      }, settings.appearance.autoHideDelay * 1000);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, wake, { passive: true }));
    wake();
    return () => {
      clearTimeout(zenTimer);
      document.body.classList.remove('zen-hidden');
      events.forEach(ev => window.removeEventListener(ev, wake));
    };
  }, [
    settings.appearance.autoHide,
    settings.appearance.autoHideDelay,
    settings.mode,
    timerState.status,
    tasksOpen,
    soundsOpen,
    notesOpen,
    musicOpen,
    settingsOpen,
    studyBotOpen,
    calculatorOpen,
    todoOpen,
    roomsOpen,
    confirmModal,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmModal?.open || humiliationModal.open) return;
        if (roomsOpen) {
          e.preventDefault();
          setRoomsOpen(false);
          return;
        }
        if (todoOpen) {
          e.preventDefault();
          setTodoOpen(false);
          return;
        }
        if (calculatorOpen) {
          e.preventDefault();
          setCalculatorOpen(false);
          return;
        }
        if (studyBotOpen) {
          e.preventDefault();
          setStudyBotOpen(false);
          return;
        }
        if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
          return;
        }
        if (tasksOpen || soundsOpen || notesOpen || musicOpen) {
          e.preventDefault();
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          return;
        }
        if (zenMode) {
          e.preventDefault();
          handleToggleZen();
          return;
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() || '';
      if (['input', 'textarea', 'select'].includes(tag) || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (settingsOpen || roomsOpen || confirmModal?.open || humiliationModal.open) return;
      const k = e.key.toLowerCase();
      const onBtn = tag === 'button' || tag === 'a';
      if (calculatorOpen && /^[0-9+\-*/%.^()=]$/.test(e.key)) {
        return;
      }
      if (k === ' ' && !onBtn) {
        e.preventDefault();
        handleToggleTimer();
      } else if (k === 'r') {
        handleResetTimer();
      } else if (k === 'n' || k === 's') {
        handleSkipTimer();
      } else if (k === 'z') {
        e.preventDefault();
        handleToggleZen();
      } else if (k === 'g') {
        e.preventDefault();
        setRoomsOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setStudyBotOpen(false);
        setCalculatorOpen(false);
        setTodoOpen(false);
      } else if (k === 't') {
        setTasksOpen(prev => !prev);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setStudyBotOpen(false);
        setCalculatorOpen(false);
        setTodoOpen(false);
      } else if (k === 'm') {
        setSoundsOpen(prev => !prev);
        setTasksOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setStudyBotOpen(false);
        setCalculatorOpen(false);
        setTodoOpen(false);
      } else if (k === '1') {
        handleUpdateSettings({ ...settingsRef.current, mode: 'home' as ModeKey }, 'mode');
      } else if (k === '2') {
        handleUpdateSettings({ ...settingsRef.current, mode: 'focus' as ModeKey }, 'mode');
      } else if (k === '3') {
        handleUpdateSettings({ ...settingsRef.current, mode: 'ambient' as ModeKey }, 'mode');
      } else if (k === ',') {
        setSettingsOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setStudyBotOpen(false);
        setCalculatorOpen(false);
        setTodoOpen(false);
      } else if (k === 'b') {
        setStudyBotOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setSettingsOpen(false);
        setCalculatorOpen(false);
        setTodoOpen(false);
      } else if (k === 'c') {
        setCalculatorOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setSettingsOpen(false);
        setStudyBotOpen(false);
        setTodoOpen(false);
      } else if (k === 'l') {
        setTodoOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setSettingsOpen(false);
        setStudyBotOpen(false);
        setCalculatorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    settingsOpen,
    roomsOpen,
    tasksOpen,
    soundsOpen,
    notesOpen,
    musicOpen,
    studyBotOpen,
    calculatorOpen,
    todoOpen,
    confirmModal,
    humiliationModal.open,
    settings,
    zenMode,
    handleToggleZen,
    handleUpdateSettings,
    handleResetTimer,
    handleSkipTimer,
  ]);

  const handleMusicVolumeChange = useCallback(
    (vol: number) => {
      const clamped = clampVolume(vol);
      if (clamped > 0 && musicMuted) {
        setMusicMuted(false);
        musicPlayerRef.current?.setMuted(false);
      }
      musicPlayerRef.current?.setVolume(clamped);
      const cur = settingsRef.current;
      handleUpdateSettings(
        {
          ...cur,
          music: {
            ...cur.music,
            volume: clamped,
          },
        },
        'music.volume'
      );
    },
    [musicMuted, handleUpdateSettings]
  );

  const handleToggleMusicMute = useCallback(() => {
    setMusicMuted(prev => {
      const next = !prev;
      musicPlayerRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleSeekMusic = useCallback((seconds: number) => {
    musicPlayerRef.current?.seekTo(seconds);
  }, []);

  const handleRenameTask = (id: string, newTitle: string) => {
    const next = tasks.map(item =>
      item.id === id ? { ...item, title: newTitle, updatedAt: Date.now() } : item
    );
    setTasks(next);
    Store.saveTaskItems(next);
    sync.touch();
    queueOrPushDomains({ tasks: next });
  };

  // If auth is still checking initial state, display clean loading splash
  if (authChecking && !isLocalPreviewBypass) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0a0a0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '18px',
          color: '#ffffff',
          zIndex: 99999,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.12)',
            borderTopColor: 'var(--accent, #6366f1)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
          Connecting to your Peakus cloud workspace...
        </div>
      </div>
    );
  }

  // If user is not authenticated, render the mandatory full-screen Auth Gateway
  if (!currentUser && !isLocalPreviewBypass) {
    return (
      <>
        <AuthGatewayModal onToast={addToast} lang={lang} />
        <ToastList
          toasts={toasts}
          onRemove={id => setToasts(prev => prev.filter(item => item.id !== id))}
        />
      </>
    );
  }

  return (
    <>
      {/* Background Canvas, Video, or YouTube Embed */}
      <Background
        settings={settings}
        onUpdateModeBg={(m: ModeKey, newBg: any) => {
          const cur = settingsRef.current;
          const next = {
            ...cur,
            modes: {
              ...cur.modes,
              [m]: { ...cur.modes[m], bg: newBg },
            },
          };
          handleUpdateSettings(next, `modes.${m}.bg`);
        }}
        onErrorToast={msg => addToast(msg, 'err')}
      />

      {/* Hidden YouTube Music Player (IFrame API with Seek & Volume Control) */}
      <YouTubeMusicPlayer
        ref={musicPlayerRef}
        youtubeId={settings.music?.youtubeId || ''}
        playing={!!settings.music?.playing}
        volume={settings.music?.volume ?? 70}
        muted={musicMuted}
        onTelemetry={setMusicTelemetry}
        onTitleResolved={resolvedTitle => {
          const cur = settingsRef.current;
          if (
            cur.music?.title === 'Custom YouTube Stream' &&
            resolvedTitle &&
            resolvedTitle !== cur.music.title
          ) {
            handleUpdateSettings(
              {
                ...cur,
                music: {
                  ...cur.music,
                  title: resolvedTitle,
                },
              },
              'music.title'
            );
          }
        }}
      />

      {/* Main Stage UI */}
      <Stage
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        activeTask={activeTask}
        onRenameTask={handleRenameTask}
        timerState={timerState}
        onToggleTimer={handleToggleTimer}
        onResetTimer={handleResetTimer}
        onResetSegments={handleRequestResetSegments}
        onSkipTimer={handleSkipTimer}
        onSetPhase={handleSetPhase}
        onRequestQuitHardcore={handleRequestQuitHardcore}
        onOpenTasks={() => {
          setTasksOpen(prev => !prev);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        onOpenSounds={() => {
          setSoundsOpen(prev => !prev);
          setTasksOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        onOpenNotes={() => {
          setNotesOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setMusicOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        onOpenMusic={() => {
          setMusicOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        onOpenSettings={() => {
          setRequestedSettingsSection(null);
          setSettingsOpen(true);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        onOpenThemes={() => {
          setRequestedSettingsSection('themes');
          setSettingsOpen(true);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        tasksOpen={tasksOpen}
        soundsOpen={soundsOpen}
        notesOpen={notesOpen}
        musicOpen={musicOpen}
        settingsOpen={settingsOpen}
        streakCount={streakCount}
        streakGoalMet={computedStats.todayGoalMet}
        todayFocusMs={computedStats.todayFocusMs}
        todayGoalMs={computedStats.todayGoalMs}
        onOpenStats={() => {
          setRequestedSettingsSection('stats');
          setSettingsOpen(true);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        zenMode={zenMode}
        onToggleZen={handleToggleZen}
        presets={presets}
        onSelectPreset={handleSelectPreset}
        flowMode={!!settings.timer.flowMode}
        onToggleFlowMode={handleToggleFlowMode}
        currentRoomCode={currentRoomCode}
        roomsOpen={roomsOpen}
        roomUnreadCount={roomUnreadCount}
        activeRoom={activeRoom}
        roomMembers={roomMembers}
        sprintCountdownSec={sprintCountdownSec}
        onOpenRooms={() => {
          setRoomsOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setSettingsOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        studyBotOpen={studyBotOpen}
        onOpenStudyBot={() => {
          setStudyBotOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setSettingsOpen(false);
          setCalculatorOpen(false);
          setTodoOpen(false);
        }}
        calculatorOpen={calculatorOpen}
        onOpenCalculator={() => {
          setCalculatorOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setSettingsOpen(false);
          setStudyBotOpen(false);
          setTodoOpen(false);
        }}
        todoOpen={todoOpen}
        onOpenTodo={() => {
          setTodoOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setSettingsOpen(false);
          setStudyBotOpen(false);
          setCalculatorOpen(false);
        }}
      />

      {/* Tasks Popover */}
      <TasksPopover
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
        tasks={tasks}
        onUpdateTasks={handleUpdateTasksFromQueue}
        language={lang}
        onToast={addToast}
        onConfirm={askConfirm}
      />

      {/* Sounds Popover */}
      <SoundsPopover
        open={soundsOpen}
        onClose={() => setSoundsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Notes Popover */}
      <NotesPopover
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        language={lang}
        notes={notes}
        onUpdateNotes={handleUpdateNotes}
        onConfirm={askConfirm}
      />

      {/* Calculator Popover (Accessed from Tools) */}
      <CalculatorPopover
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        language={lang}
        onAppendToNotes={handleAppendCalcToNotes}
        onToast={addToast}
      />

      {/* Aesthetic Todo List Popover (Beta, Accessed from Tools) */}
      <TodoPopover
        open={todoOpen}
        onClose={() => setTodoOpen(false)}
        todos={todos}
        onUpdateTodos={handleUpdateTodos}
        tasks={tasks}
        onSendToFocusQueue={handleSendTodoToFocusQueue}
        onRemoveFromFocusQueue={handleRemoveTodoFromFocusQueue}
        onFocusNow={handleFocusTodoNow}
        godMode={!!settings.quotes.godMode}
        todoPrefs={todoPrefs}
        onUpdateTodoPrefs={handleUpdateTodoPrefs}
        onTestReminder={handleTestTodoReminder}
        language={lang}
        onToast={addToast}
        onConfirm={askConfirm}
      />

      {/* Floating Do-Now Reminder Notification Card */}
      {activeReminderAlert && (
        <div
          className="todo-alert-banner"
          role="alert"
          data-testid="todoReminderAlert"
        >
          <div className="todo-alert-head">
            <span className="todo-alert-eyebrow">PEAKUS REMINDER</span>
            <button
              type="button"
              className="mini"
              aria-label="Dismiss reminder"
              onClick={() => setActiveReminderAlert(null)}
            >
              ×
            </button>
          </div>
          <div className="todo-alert-title">{activeReminderAlert.title}</div>
          <div className="todo-alert-body">{activeReminderAlert.body}</div>
          {activeReminderAlert.todoId && (
            <div className="todo-alert-actions">
              <button
                type="button"
                className="todo-banner-btn primary"
                onClick={() => {
                  const id = activeReminderAlert.todoId;
                  const now = Date.now();
                  handleUpdateTodos(
                    todosRef.current.map(item =>
                      item.id === id ? { ...item, done: true, doneAt: now, updatedAt: now } : item
                    )
                  );
                  setActiveReminderAlert(null);
                }}
              >
                Mark Done
              </button>
              <button
                type="button"
                className="todo-banner-btn"
                onClick={() => {
                  const id = activeReminderAlert.todoId;
                  const now = Date.now();
                  handleUpdateTodos(
                    todosRef.current.map(item =>
                      item.id === id
                        ? { ...item, remindAt: now + 5 * 60000, remindedAt: null, updatedAt: now }
                        : item
                    )
                  );
                  setActiveReminderAlert(null);
                  addToast('Snoozed reminder by 5 minutes.');
                }}
              >
                Snooze +5m
              </button>
            </div>
          )}
        </div>
      )}

      {/* YouTube Music Stream Popover */}
      <MusicPopover
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onToast={addToast}
        telemetry={musicTelemetry}
        muted={musicMuted}
        onToggleMute={handleToggleMusicMute}
        onVolumeChange={handleMusicVolumeChange}
        onSeek={handleSeekMusic}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setRequestedSettingsSection(null);
        }}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        tasks={tasks}
        onUpdateTasks={next => {
          setTasks(next);
          Store.saveTaskItems(next);
          queueOrPushDomains({ tasks: next });
        }}
        sessions={sessions}
        onUpdateSessions={next => {
          setSessions(next);
          Store.saveSessions(next);
          queueOrPushDomains({ history: { sessions: next } });
        }}
        onToast={addToast}
        onConfirm={askConfirm}
        presets={presets}
        onSavePreset={handleSavePreset}
        onSelectPreset={handleSelectPreset}
        timerState={timerState}
        requestedSection={requestedSettingsSection}
        activeTask={activeTask}
        currentRoomCode={currentRoomCode}
        onJoinedRoom={code => {
          setCurrentRoomCode(code);
          setLastRoomReadAt(Date.now());
        }}
        onLeftRoom={() => {
          setCurrentRoomCode(null);
          setActiveRoom(null);
          setRoomMembers([]);
          setRoomMessages([]);
        }}
        activeRoom={activeRoom}
        roomMembers={roomMembers}
        roomMessages={roomMessages}
        roomUnreadCount={roomUnreadCount}
        roomChatMuted={roomChatMuted}
        onToggleRoomChatMuted={handleToggleRoomChatMuted}
        roomBreakOnlyAlerts={roomBreakOnlyChat}
        onToggleRoomBreakOnlyAlerts={() => setRoomBreakOnlyChat(prev => !prev)}
        onMarkRoomChatRead={handleMarkRoomChatRead}
        onRoomTabChange={tab => setActiveRoomTab(tab)}
        onEnableHardcoreMode={() => {
          handleUpdateSettings(
            {
              ...settingsRef.current,
              timer: { ...settingsRef.current.timer, hardcoreMode: true },
            },
            'timer.hardcoreMode'
          );
          addToast('🔥 Hardcore Mode activated — lock in for 4 sessions!');
        }}
        ownRoomTaskText={ownRoomTaskText}
        ownRoomTaskDone={ownRoomTaskDone}
        onUpdateOwnRoomTask={(title, done) => {
          setOwnRoomTaskText(title);
          setOwnRoomTaskDone(done);
        }}
        onForceSync={handleForceSync}
        onRequestQuitHardcore={handleRequestQuitHardcore}
      />

      {/* Study Room Modal (Opened directly from dock Rooms button / Stage pill / G) */}
      <StudyRoomModal
        isOpen={roomsOpen}
        onClose={() => setRoomsOpen(false)}
        managedExternally
        room={activeRoom}
        members={roomMembers}
        messages={roomMessages}
        initialJoinCode={pendingInviteRoomCode}
        unreadCount={roomUnreadCount}
        chatMuted={roomChatMuted}
        onToggleChatMuted={handleToggleRoomChatMuted}
        breakOnlyAlerts={roomBreakOnlyChat}
        onToggleBreakOnlyAlerts={() => setRoomBreakOnlyChat(prev => !prev)}
        onActiveTabChange={tab => setActiveRoomTab(tab)}
        onMarkChatRead={handleMarkRoomChatRead}
        isHardcoreMode={!!settings.timer.hardcoreMode}
        onEnableHardcoreMode={() => {
          handleUpdateSettings(
            {
              ...settingsRef.current,
              timer: { ...settingsRef.current.timer, hardcoreMode: true },
            },
            'timer.hardcoreMode'
          );
          addToast('🔥 Hardcore Mode activated — lock in for 4 sessions!');
        }}
        ownTaskText={ownRoomTaskText}
        ownTaskDone={ownRoomTaskDone}
        onUpdateOwnTask={(title, done) => {
          setOwnRoomTaskText(title);
          setOwnRoomTaskDone(done);
        }}
        timerState={timerState}
        activeTask={activeTask}
        todayFocusMs={computedStats.todayFocusMs}
        onToast={addToast}
        currentRoomCode={currentRoomCode}
        onJoinedRoom={code => {
          setCurrentRoomCode(code);
          setLastRoomReadAt(Date.now());
          setPendingInviteRoomCode(null);
        }}
        onLeftRoom={() => {
          setCurrentRoomCode(null);
          setActiveRoom(null);
          setRoomMembers([]);
          setRoomMessages([]);
        }}
      />

      {/* Floating Room Reaction / Nudge Pop */}
      {floatingReactionPop && !roomsOpen && (
        <button
          type="button"
          className="room-reaction-pop"
          onClick={() => {
            setFloatingReactionPop(null);
            setActiveRoomTab('chat');
            handleMarkRoomChatRead();
            setRoomsOpen(true);
          }}
        >
          <span>{floatingReactionPop.senderName}:</span>
          <span>{floatingReactionPop.text}</span>
        </button>
      )}

      {/* Confirm Modal */}
      <ConfirmModal state={confirmModal} />

      {/* Hardcore Quit Humiliation Modal */}
      <HardcoreHumiliationModal
        open={humiliationModal.open}
        line={humiliationModal.line}
        completedSessions={humiliationModal.completedSessions}
        requiredSessions={HARDCORE_REQUIRED_SESSIONS}
        lang={lang}
        onClose={() => setHumiliationModal(prev => ({ ...prev, open: false }))}
      />

      {/* Reset Segment Warning Modal */}
      <ResetSegmentModal
        isOpen={showResetSegmentModal}
        onClose={() => setShowResetSegmentModal(false)}
        onResetCurrent={handleConfirmResetCurrentSegment}
        onResetAll={handleConfirmResetAllSegments}
        currentCycle={timerState.cycle}
        totalCycles={settings.timer.cycles || 4}
        hardcoreMode={!!settings.timer.hardcoreMode}
        onQuitHardcore={handleRequestQuitHardcore}
        lang={lang}
      />

      {/* Offline Background Detected Modal */}
      <OfflineBackgroundModal
        isOpen={showOfflineBgModal}
        onClose={() => setShowOfflineBgModal(false)}
        onOpenYouTubeBackgrounds={() => setSettingsOpen(true)}
        lang={lang}
      />

      {/* Flow Continuation Prompt Modal */}
      <FlowPromptModal
        open={showFlowPrompt}
        language={lang}
        onContinue={handleContinueFlow}
        onCancel={handleCancelFlow}
      />

      {/* Study Bot Popover (Gemini AI Tutor) */}
      <StudyBotPopover
        isOpen={studyBotOpen}
        onClose={() => setStudyBotOpen(false)}
        activeTask={activeTask}
        timerState={timerState}
        onAppendToNotes={handleUpdateNotes}
        onToast={addToast}
        language={lang}
      />

      {/* First-time opening Pro Prank Modal */}
      {showProPrank && (
        <ProPrankModal
          language={lang}
          onClose={() => setShowProPrank(false)}
        />
      )}

      {/* Toasts */}
      <ToastList
        toasts={toasts}
        onRemove={id => setToasts(prev => prev.filter(item => item.id !== id))}
      />
    </>
  );
};
