import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  Settings,
  ModeKey,
  Task,
  Session,
  TimerState,
  TimerPhase,
  TimerStatus,
} from './types';
import { Store } from './lib/store';
import { audioX } from './lib/audio';
import { sync } from './lib/sync';
import { hexToRgb, fmtClock, fmtDur, uid, dayKey, startOfDay, addDays } from './lib/utils';
import { DEFAULTS } from './lib/constants';
import { t } from './lib/i18n';
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
import { pushAllToCloud, subscribeToCloud, initializeNewUserCloud, fetchUserCloudData, clearLocalDeviceWorkspace } from './lib/cloudSync';
import { AuthGatewayModal } from './components/AuthGatewayModal';
import { ResetSegmentModal } from './components/ResetSegmentModal';
import { OfflineBackgroundModal } from './components/OfflineBackgroundModal';
import { StudyRoomModal } from './components/StudyRoomModal';
import { broadcastRoomTimer, updateMemberPresence, subscribeToStudyRoom } from './lib/studyRooms';
import { getSavedLinks, setAllSavedLinks, SavedLinkItem } from './lib/savedLinks';
import { computeStats } from './lib/statsEngine';
import { StudyBotPopover } from './components/StudyBotPopover';
import { toLocalDateKey } from './lib/pomodoroEngine';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(() => Store.loadSettings());
  const [tasks, setTasks] = useState<Task[]>(() => Store.loadTaskItems());
  const [sessions, setSessions] = useState<Session[]>(() => Store.loadSessions());
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);

  // Mandatory Auth & Cloud State
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Reset Segment Modal & Offline Background Modal State
  const [showResetSegmentModal, setShowResetSegmentModal] = useState<boolean>(false);
  const [showOfflineBgModal, setShowOfflineBgModal] = useState<boolean>(false);

  // Flow Continuation State
  const [showFlowPrompt, setShowFlowPrompt] = useState(false);
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
  const [showProPrank, setShowProPrank] = useState(() => {
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
  const [roomOpen, setRoomOpen] = useState(false);
  const [studyBotOpen, setStudyBotOpen] = useState(false);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem('peakus.room_code') || null;
    } catch {
      return null;
    }
  });

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
    const [R, G, B] = hexToRgb(s.appearance.accent);
    r.setProperty('--accent', s.appearance.accent);
    r.setProperty('--accent-rgb', `${R}, ${G}, ${B}`);
    r.setProperty('--accent-soft', `rgba(${R}, ${G}, ${B}, 0.22)`);
    r.setProperty('--accent-glow', `rgba(${R}, ${G}, ${B}, 0.5)`);
    r.setProperty('--accent-border', `rgba(${R}, ${G}, ${B}, 0.45)`);
    r.setProperty('--accent-dark', `rgba(${R}, ${G}, ${B}, 0.12)`);
    const mix = (v: number) => Math.round(v + (255 - v) * 0.45);
    r.setProperty('--accent-text', `rgb(${mix(R)}, ${mix(G)}, ${mix(B)})`);
    r.setProperty('--clock-color', s.clock.color);
    r.setProperty('--clock-scale', String(s.clock.size / 100));
  }, [settings.appearance.accent, settings.clock.color, settings.clock.size]);

  // Audio master update
  useEffect(() => {
    audioX.setMaster(settings.sounds.master);
  }, [settings.sounds.master]);

  // Sync callbacks setup
  useEffect(() => {
    sync.setCallbacks({
      getSettings: () => settingsRef.current,
      onRemoteSettings: nextSettings => setSettings(nextSettings),
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
        clearLocalDeviceWorkspace();
        setCurrentUser(null);
        setSettings(DEFAULTS);
        setSessions([]);
        setTasks([]);
        setPresets(DEFAULT_PRESETS);
        sessionsRef.current = [];
        setStudyBotOpen(false);
        setAuthChecking(false);
        cloudLoadedUserRef.current = null;
        return;
      }

      // If switching from another user, wipe previous user's workspace so no cross-account contamination occurs
      if (cloudLoadedUserRef.current && cloudLoadedUserRef.current !== user.uid) {
        clearLocalDeviceWorkspace();
        setSettings(DEFAULTS);
        setSessions([]);
        setTasks([]);
        setPresets(DEFAULT_PRESETS);
        sessionsRef.current = [];
      }

      setCurrentUser(user);

      // Verify if user already has data in Firestore; if not, initialize cloud doc with clean defaults
      try {
        const existingData = await fetchUserCloudData(user.uid);
        if (!existingData) {
          await initializeNewUserCloud(user.uid);
        }
      } catch (err) {
        console.warn('Initial cloud check:', err);
      }

      // Subscribe to remote changes (Cloud is sole source of truth; zero local cache overwrite)
      unsubCloud = subscribeToCloud(
        user.uid,
        {
          onLoaded: () => {
            cloudLoadedUserRef.current = user.uid;
            setAuthChecking(false);
          },
          onSettings: (remoteSettings, hadOfflineBg) => {
            cloudLoadedUserRef.current = user.uid;
            const normalized = Store.normSettings(remoteSettings);
            setSettings(normalized);
            Store.saveSettings(normalized);
            if (hadOfflineBg) {
              setShowOfflineBgModal(true);
            }
          },
          onSavedLinks: remoteLinks => {
            cloudLoadedUserRef.current = user.uid;
            if (Array.isArray(remoteLinks)) {
              setAllSavedLinks(remoteLinks, false);
            }
          },
          onTasks: remoteTasks => {
            cloudLoadedUserRef.current = user.uid;
            const userTasks = Array.isArray(remoteTasks) ? remoteTasks : [];
            setTasks(userTasks);
            Store.saveTaskItems(userTasks);
          },
          onHistory: remoteSessions => {
            cloudLoadedUserRef.current = user.uid;
            const userSessions = Array.isArray(remoteSessions) ? remoteSessions : [];
            setSessions(userSessions);
            Store.saveSessions(userSessions);
          },
          onPausedTimer: remoteTimer => {
            cloudLoadedUserRef.current = user.uid;
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
            cloudLoadedUserRef.current = user.uid;
            if (remotePomodoro) {
              if (remotePomodoro.focusStats) {
                Store.saveFocusStats(remotePomodoro.focusStats);
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
            cloudLoadedUserRef.current = user.uid;
            if (typeof remoteNotes === 'string') {
              Store.saveNotes(remoteNotes);
            }
          },
          onPresets: remotePresets => {
            cloudLoadedUserRef.current = user.uid;
            if (Array.isArray(remotePresets) && remotePresets.length > 0) {
              setPresets(remotePresets);
            }
          },
          onDisplayName: remoteName => {
            cloudLoadedUserRef.current = user.uid;
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
      if (auth.currentUser) {
        pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current, {
          customSavedLinks: updatedLinks,
        });
      }
    };
    window.addEventListener('peakus:saved-links-updated', handleSavedLinksChanged);

    return () => {
      if (unsubCloud) unsubCloud();
      unsubAuth();
      window.removeEventListener('peakus:saved-links-updated', handleSavedLinksChanged);
    };
  }, []);

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
    return computeStats(sessions, tasks, settings.timer.streakGoal);
  }, [sessions, tasks, settings.timer.streakGoal]);
  const streakCount = computedStats.currentStreak;

  // Broadcast timer update to room if user is room host
  const broadcastIfHost = useCallback((nextTimer: TimerState) => {
    if (currentRoomCode && auth.currentUser) {
      broadcastRoomTimer(currentRoomCode, nextTimer).catch(() => {});
    }
  }, [currentRoomCode]);

  // Persist current room code to localStorage
  useEffect(() => {
    try {
      if (currentRoomCode) {
        localStorage.setItem('peakus.room_code', currentRoomCode);
      } else {
        localStorage.removeItem('peakus.room_code');
      }
    } catch {}
  }, [currentRoomCode]);

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
      updateMemberPresence(currentRoomCode, status, activeTask?.title, computedStats.todayFocusMs).catch(() => {});
    };
    sendPresence();
    const interval = setInterval(sendPresence, 20000);
    return () => clearInterval(interval);
  }, [currentRoomCode, timerState.status, timerState.phase, activeTask?.title, computedStats.todayFocusMs]);

  // Listen to remote room changes for synchronized timers
  useEffect(() => {
    if (!currentRoomCode || !auth.currentUser) return;
    const unsub = subscribeToStudyRoom(currentRoomCode, remoteRoom => {
      if (!remoteRoom) {
        setCurrentRoomCode(null);
        return;
      }
      // If room is synced and current user is not host, follow host timer!
      if (remoteRoom.timerMode === 'synced' && remoteRoom.hostId !== auth.currentUser?.uid && remoteRoom.timer) {
        const rt = remoteRoom.timer;
        setTimerState(prev => {
          if (
            prev.status === rt.status &&
            prev.phase === rt.phase &&
            Math.abs(prev.remainingMs - rt.remainingMs) < 2000
          ) {
            return prev;
          }
          return {
            ...prev,
            status: (rt.status as any) || 'idle',
            phase: (rt.phase as any) || 'focus',
            remainingMs: rt.remainingMs,
            durationMs: rt.durationMs,
            cycle: rt.cycle || 0,
            startedAt: rt.startedAt,
          };
        });
      }
    });
    return () => unsub();
  }, [currentRoomCode]);

  // Auto-recovery / Reconciliation:
  // If the user has completed cycle segments (e.g. cycle >= 1) but fewer recorded focus sessions
  // (e.g. wiped by previous cloud bug), automatically backfill the verified sessions so focus time & streak are restored.
  useEffect(() => {
    if (timerState.cycle > 0) {
      const completedFocusSessions = sessions.filter(s => s.kind === 'focus' && s.completed);
      if (completedFocusSessions.length < timerState.cycle) {
        const needed = timerState.cycle - completedFocusSessions.length;
        const now = Date.now();
        const recovered: Session[] = [];
        const focusDurationMs = (settings.timer.focus || 25) * 60 * 1000;
        const breakDurationMs = (settings.timer.short || 5) * 60 * 1000;
        for (let i = 0; i < needed; i++) {
          const offset = (needed - 1 - i) * (focusDurationMs + breakDurationMs);
          const start = now - offset - focusDurationMs;
          const end = start + focusDurationMs;
          recovered.push({
            id: uid('s_recovered'),
            kind: 'focus',
            phase: 'focus',
            start,
            end,
            ms: focusDurationMs,
            completed: true,
            taskId: activeTask ? activeTask.id : null,
            title: activeTask ? activeTask.title : settings.timer.label || 'Study & Focus',
          });
        }
        const updated = [...recovered, ...sessions];
        setSessions(updated);
        Store.saveSessions(updated);
        if (auth.currentUser) {
          pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current, {
            customHistory: { sessions: updated },
          });
        }
      }
    }
  }, [timerState.cycle, sessions.length]);

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

      // If flowMode is enabled and focus session ended, ask if user wants to continue their flow (+10 min)
      if (prevPhase === 'focus' && tSettings.flowMode) {
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
      const targetTally = Math.max(1, tSettings.cycles || 4);

      if (tSettings.mode === 'countdown') {
        nextPhase = 'focus';
        autoStart = tSettings.autoBreak;
      } else {
        if (prevPhase === 'focus') {
          nextCycle = timerRef.current.cycle + 1;
          nextPhase = nextCycle < targetTally ? 'short' : 'long';
          autoStart = tSettings.autoBreak;
        } else if (prevPhase === 'long') {
          nextPhase = 'focus';
          nextCycle = 0; // Reset cycleTally to 0 when long break finishes
          autoStart = tSettings.autoFocus;
        } else {
          // SHORT_BREAK finishes: transition back to FOCUS without changing cycleTally
          nextPhase = 'focus';
          nextCycle = timerRef.current.cycle; // Keep unchanged
          autoStart = tSettings.autoFocus;
        }
      }

      const nextDuration = getPhaseDuration(nextPhase, currentS);
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
      if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
        pushAllToCloud(auth.currentUser.uid, currentS, nextState, {
          customHistory: { sessions: nextSessions },
          customFocusStats: nextFocusStats,
        });
      }

      const nextName =
        nextPhase === 'focus'
          ? t('phaseFocus', currentLang)
          : nextPhase === 'short'
          ? t('phaseShort', currentLang)
          : t('phaseLong', currentLang);

      const toastMsg =
        prevPhase === 'focus'
          ? `Session complete! You focused for ${fmtDur(durationMs)}. ${
              autoStart ? `Starting ${nextName}.` : `Ready for ${nextName}?`
            }`
          : `Break finished. ${
              autoStart ? 'Starting next focus session.' : 'Ready to focus again?'
            }`;

      addToast(toastMsg);
      if (
        tSettings.notify &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        (document.hidden || !document.hasFocus())
      ) {
        try {
          new Notification(
            prevPhase === 'focus' ? 'Session Complete!' : 'Break Finished',
            { body: toastMsg, tag: 'peakus-timer' }
          );
        } catch {}
      }
    },
    [sessions, activeTask, getPhaseDuration, addToast]
  );

  // Expose test trigger in window
  useEffect(() => {
    (window as any).__expireTimerForTesting = () => {
      handleSegmentEnd('focus', 25 * 60 * 1000);
    };
    return () => {
      delete (window as any).__expireTimerForTesting;
    };
  }, [handleSegmentEnd]);

  // Flow Continuation Handlers
  const handleContinueFlow = useCallback(() => {
    setShowFlowPrompt(false);
    pendingBreakRef.current = null;
    const tenMinutesMs = 10 * 60 * 1000;
    const now = Date.now();
    const nextState: TimerState = {
      ...timerRef.current,
      phase: 'focus',
      status: 'running',
      remainingMs: tenMinutesMs,
      durationMs: tenMinutesMs,
      startedAt: now,
      sessionStartedAt: now,
      interrupted: false,
    };
    setTimerState(nextState);
    Store.saveTimer(nextState);
    addToast(t('flowAddedToast', settings.language || 'en'));
  }, [settings.language, addToast]);

  const handleCancelFlow = useCallback(() => {
    setShowFlowPrompt(false);
    const pending = pendingBreakRef.current;
    const now = Date.now();
    const currentS = settingsRef.current;
    const tSettings = currentS.timer;
    const currentLang = currentS.language || 'en';
    let nextPhase: TimerPhase = pending?.nextPhase || 'short';
    let nextDuration = pending?.durationMs || getPhaseDuration(nextPhase, currentS);
    let autoStart = pending?.autoStart ?? tSettings.autoBreak;
    let nextCycle = pending?.nextCycle ?? (timerRef.current.cycle + 1);

    const nextState: TimerState = {
      status: autoStart ? 'running' : 'idle',
      phase: nextPhase,
      remainingMs: nextDuration,
      durationMs: nextDuration,
      cycle: nextCycle,
      startedAt: autoStart ? now : null,
      sessionStartedAt: autoStart ? now : null,
      interrupted: false,
    };
    setTimerState(nextState);
    Store.saveTimer(nextState);
    pendingBreakRef.current = null;

    const nextName =
      nextPhase === 'focus'
        ? t('phaseFocus', currentLang)
        : nextPhase === 'short'
        ? t('phaseShort', currentLang)
        : t('phaseLong', currentLang);

    addToast(autoStart ? `Starting ${nextName}.` : `Ready for ${nextName}?`);
  }, [getPhaseDuration, addToast]);

  const handleToggleFlowMode = useCallback(() => {
    const nextVal = !settings.timer.flowMode;
    const nextSettings = {
      ...settings,
      timer: {
        ...settings.timer,
        flowMode: nextVal,
      },
    };
    setSettings(nextSettings);
    Store.saveSettings(nextSettings);
    sync.touch();
    addToast(nextVal ? 'Flow Mode enabled (will ask +10m after focus)' : 'Flow Mode disabled');
  }, [settings, addToast]);

  // Preset Handlers
  const handleSelectPreset = useCallback(
    (preset: PomodoroPreset) => {
      const nextSettings = applyPresetToSettings(settingsRef.current, preset);
      setSettings(nextSettings);
      Store.saveSettings(nextSettings);
      const phase = timerRef.current.phase;
      const duration = getPhaseDuration(phase, nextSettings);
      if (timerRef.current.status === 'idle') {
        const nextTimer: TimerState = {
          ...timerRef.current,
          durationMs: duration,
          remainingMs: duration,
        };
        setTimerState(nextTimer);
        Store.saveTimer(nextTimer);
      }
      addToast(t('presetAppliedToast', nextSettings.language || 'en'));
    },
    [getPhaseDuration, addToast]
  );

  const handleSavePreset = useCallback((preset: PomodoroPreset) => {
    const updated = saveCustomPreset(preset);
    setPresets(updated);
    if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
      pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current, {
        customPresets: updated,
      });
    }
  }, []);

  const handleUpdateNotes = useCallback((notesText: string) => {
    if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
      pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current, {
        customNotes: notesText,
      });
    }
  }, []);

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
      if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
        pushAllToCloud(auth.currentUser.uid, settingsRef.current, next);
      }
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

  const handleResetTimer = () => {
    const cur = timerRef.current;
    const executeReset = () => {
      const duration = getPhaseDuration(cur.phase, settings);
      const next: TimerState = {
        ...cur,
        status: 'idle',
        remainingMs: duration,
        durationMs: duration,
        targetEndTime: null,
        startedAt: null,
        sessionStartedAt: null,
      };
      setTimerState(next);
      Store.saveTimer(next);
      broadcastIfHost(next);
      if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
        pushAllToCloud(auth.currentUser.uid, settingsRef.current, next);
      }
    };

    if (cur.status !== 'idle' || cur.remainingMs < cur.durationMs) {
      askConfirm(
        'Restart Current Segment?',
        'Are you sure you want to restart this segment? Elapsed focus progress in this session will be reset.',
        'Restart Timer',
        executeReset,
        true
      );
    } else {
      executeReset();
    }
  };

  const handleRequestResetSegments = useCallback(() => {
    setShowResetSegmentModal(true);
  }, []);

  const handleConfirmResetCurrentSegment = useCallback(() => {
    const cur = timerRef.current;
    const dur = getPhaseDuration(cur.phase, settingsRef.current);
    const next: TimerState = {
      ...cur,
      status: 'idle',
      remainingMs: dur,
      durationMs: dur,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
    };
    setTimerState(next);
    Store.saveTimer(next);
    addToast('Current segment restarted.');
    if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
      pushAllToCloud(auth.currentUser.uid, settingsRef.current, next);
    }
  }, [getPhaseDuration, addToast]);

  const handleConfirmResetAllSegments = useCallback(() => {
    const cur = timerRef.current;
    const dur = getPhaseDuration('focus', settingsRef.current);
    const target = settingsRef.current.timer.cycles || 4;
    const next: TimerState = {
      ...cur,
      status: 'idle',
      phase: 'focus',
      remainingMs: dur,
      durationMs: dur,
      cycle: 0, // Reset cycleTally back to 0
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
    };
    setTimerState(next);
    Store.saveTimer(next);
    addToast(`All cycle segments reset (0/${target}).`);
    if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
      pushAllToCloud(auth.currentUser.uid, settingsRef.current, next);
    }
  }, [getPhaseDuration, addToast]);

  const handleSkipTimer = () => {
    const cur = timerRef.current;
    const tSettings = settings.timer;
    let nextSessions = sessionsRef.current;
    // If session was running and >= 1 minute, record as interrupted
    if (cur.status === 'running' && cur.sessionStartedAt) {
      const elapsed = cur.durationMs - cur.remainingMs;
      if (elapsed >= 60000) {
        const interruptedSession: Session = {
          id: uid('s'),
          kind: cur.phase === 'focus' ? 'focus' : 'break',
          phase: cur.phase,
          start: cur.sessionStartedAt,
          end: Date.now(),
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
    }
    let nextPhase: TimerPhase = 'focus';
    let nextCycle = cur.cycle;
    const targetTally = Math.max(1, tSettings.cycles || 4);

    if (tSettings.mode === 'pomodoro') {
      if (cur.phase === 'focus') {
        nextCycle = cur.cycle + 1;
        nextPhase = nextCycle < targetTally ? 'short' : 'long';
      } else if (cur.phase === 'long') {
        // When a LONG_BREAK finishes (or is skipped), reset cycleTally back to 0 and transition to FOCUS
        nextPhase = 'focus';
        nextCycle = 0;
      } else {
        // When a SHORT_BREAK finishes (or is skipped), transition back to FOCUS without changing cycleTally
        nextPhase = 'focus';
        nextCycle = cur.cycle;
      }
    }
    const duration = getPhaseDuration(nextPhase, settings);
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
    if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
      pushAllToCloud(auth.currentUser.uid, settingsRef.current, next, {
        customHistory: { sessions: nextSessions },
      });
    }
  };

  const handleSetPhase = (phase: TimerPhase) => {
    const duration = getPhaseDuration(phase, settings);
    const next: TimerState = {
      ...timerRef.current,
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
  };

  // Zen Mode (Auto-hide controls)
  useEffect(() => {
    if (!settings.appearance.autoHide) {
      document.body.classList.remove('zen-hidden');
      return;
    }
    let zenTimer: any = null;
    const isEligible = () => {
      if (tasksOpen || soundsOpen || notesOpen || musicOpen || settingsOpen || roomOpen || studyBotOpen || confirmModal?.open) {
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
    roomOpen,
    studyBotOpen,
    confirmModal,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmModal?.open) return;
        if (roomOpen) {
          e.preventDefault();
          setRoomOpen(false);
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
      if (settingsOpen || confirmModal?.open) return;
      const k = e.key.toLowerCase();
      const onBtn = tag === 'button' || tag === 'a';
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
      } else if (k === 't') {
        setTasksOpen(prev => !prev);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
      } else if (k === 'm') {
        setSoundsOpen(prev => !prev);
        setTasksOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
      } else if (k === '1') {
        const next = { ...settings, mode: 'home' as ModeKey };
        setSettings(next);
        Store.saveSettings(next);
      } else if (k === '2') {
        const next = { ...settings, mode: 'focus' as ModeKey };
        setSettings(next);
        Store.saveSettings(next);
      } else if (k === '3') {
        const next = { ...settings, mode: 'ambient' as ModeKey };
        setSettings(next);
        Store.saveSettings(next);
      } else if (k === ',') {
        setSettingsOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setStudyBotOpen(false);
      } else if (k === 'b') {
        setStudyBotOpen(prev => !prev);
        setTasksOpen(false);
        setSoundsOpen(false);
        setNotesOpen(false);
        setMusicOpen(false);
        setSettingsOpen(false);
        setRoomOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    settingsOpen,
    tasksOpen,
    soundsOpen,
    notesOpen,
    musicOpen,
    studyBotOpen,
    confirmModal,
    settings,
    zenMode,
    handleToggleZen,
  ]);

  const handleUpdateSettings = (nextSettings: Settings, path = '') => {
    const normalized = Store.normSettings(nextSettings);
    setSettings(normalized);
    Store.saveSettings(normalized);
    if (path !== 'mode') {
      sync.touch();
    }
    if (auth.currentUser) {
      if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = setTimeout(() => {
        if (auth.currentUser) {
          pushAllToCloud(auth.currentUser.uid, normalized, timerRef.current);
        }
      }, 250);
    }
  };

  const handleRenameTask = (id: string, newTitle: string) => {
    const next = tasks.map(item =>
      item.id === id ? { ...item, title: newTitle, updatedAt: Date.now() } : item
    );
    setTasks(next);
    Store.saveTaskItems(next);
    sync.touch();
    if (auth.currentUser) {
      pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current);
    }
  };

  // If auth is still checking initial state, display clean loading splash
  if (authChecking) {
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
  if (!currentUser) {
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
          const next = {
            ...settings,
            modes: {
              ...settings.modes,
              [m]: { ...settings.modes[m], bg: newBg },
            },
          };
          handleUpdateSettings(next, `modes.${m}.bg`);
        }}
        onErrorToast={msg => addToast(msg, 'err')}
      />

      {/* Hidden YouTube Music Audio Player */}
      {settings.music?.playing && settings.music?.youtubeId && (
        <div
          className="sr-only"
          aria-hidden="true"
          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        >
          <iframe
            key={settings.music.youtubeId}
            src={`https://www.youtube-nocookie.com/embed/${settings.music.youtubeId}?autoplay=1&controls=0&playsinline=1`}
            allow="autoplay"
            title="Peakus Background Music Stream"
            tabIndex={-1}
          />
        </div>
      )}

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
        onOpenTasks={() => {
          setTasksOpen(prev => !prev);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
        }}
        onOpenSounds={() => {
          setSoundsOpen(prev => !prev);
          setTasksOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
        }}
        onOpenNotes={() => {
          setNotesOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setMusicOpen(false);
        }}
        onOpenMusic={() => {
          setMusicOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
        }}
        onOpenSettings={() => {
          setSettingsOpen(true);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
        }}
        tasksOpen={tasksOpen}
        soundsOpen={soundsOpen}
        notesOpen={notesOpen}
        musicOpen={musicOpen}
        settingsOpen={settingsOpen}
        streakCount={streakCount}
        zenMode={zenMode}
        onToggleZen={handleToggleZen}
        presets={presets}
        onSelectPreset={handleSelectPreset}
        flowMode={!!settings.timer.flowMode}
        onToggleFlowMode={handleToggleFlowMode}
        roomOpen={roomOpen}
        onOpenRoom={() => {
          setRoomOpen(true);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setSettingsOpen(false);
          setStudyBotOpen(false);
        }}
        currentRoomCode={currentRoomCode}
        studyBotOpen={studyBotOpen}
        onOpenStudyBot={() => {
          setStudyBotOpen(prev => !prev);
          setTasksOpen(false);
          setSoundsOpen(false);
          setNotesOpen(false);
          setMusicOpen(false);
          setSettingsOpen(false);
          setRoomOpen(false);
        }}
      />

      {/* Tasks Popover */}
      <TasksPopover
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
        tasks={tasks}
        onUpdateTasks={next => {
          setTasks(next);
          Store.saveTaskItems(next);
          if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
            pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current, {
              customTasks: next,
            });
          }
        }}
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
        onUpdateNotes={handleUpdateNotes}
      />

      {/* YouTube Music Stream Popover */}
      <MusicPopover
        open={musicOpen}
        onClose={() => setMusicOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onToast={addToast}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        tasks={tasks}
        onUpdateTasks={next => {
          setTasks(next);
          Store.saveTaskItems(next);
          if (auth.currentUser && cloudLoadedUserRef.current === auth.currentUser.uid) {
            pushAllToCloud(auth.currentUser.uid, settingsRef.current, timerRef.current, {
              customTasks: next,
            });
          }
        }}
        sessions={sessions}
        onUpdateSessions={next => {
          setSessions(next);
          Store.saveSessions(next);
        }}
        onToast={addToast}
        onConfirm={askConfirm}
        presets={presets}
        onSavePreset={handleSavePreset}
        onSelectPreset={handleSelectPreset}
        timerState={timerState}
      />

      {/* Confirm Modal */}
      <ConfirmModal state={confirmModal} />

      {/* Reset Segment Warning Modal */}
      <ResetSegmentModal
        isOpen={showResetSegmentModal}
        onClose={() => setShowResetSegmentModal(false)}
        onResetCurrent={handleConfirmResetCurrentSegment}
        onResetAll={handleConfirmResetAllSegments}
        currentCycle={timerState.cycle}
        totalCycles={settings.timer.cycles || 4}
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

      {/* Collaborative Study Room Modal */}
      <StudyRoomModal
        isOpen={roomOpen}
        onClose={() => setRoomOpen(false)}
        timerState={timerState}
        activeTask={activeTask}
        todayFocusMs={computedStats.todayFocusMs}
        onToast={addToast}
        currentRoomCode={currentRoomCode}
        onJoinedRoom={code => {
          setCurrentRoomCode(code);
        }}
        onLeftRoom={() => {
          setCurrentRoomCode(null);
          setRoomOpen(false);
        }}
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
