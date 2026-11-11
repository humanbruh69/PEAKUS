/**
 * Flocus-inspired Drift-Free Pomodoro Timer & Session Tally Engine
 * Clean separation between state machine logic, drift-free timestamp engine, and UI.
 */

export type PomodoroPhase = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
export type PomodoroStatus = 'idle' | 'running' | 'paused';

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  targetTally: number;
  selectedTallyIcon: string;
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
}

export interface DayFocusStatRecord {
  date: string; // YYYY-MM-DD in local time
  focusMinutes: number;
  focusMs: number;
  sessionCount: number;
  breakMinutes: number;
  breakMs: number;
}

export type FocusStatsMap = Record<string, DayFocusStatRecord>;

export interface PomodoroState {
  phase: PomodoroPhase;
  status: PomodoroStatus;
  cycleTally: number;
  durationMs: number;
  remainingMs: number;
  targetEndTime: number | null;
  startedAt: number | null;
  sessionStartedAt: number | null;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  targetTally: 4,
  selectedTallyIcon: 'growing_tree',
  autoStartBreaks: true,
  autoStartFocus: false,
};

/**
 * Format timestamp or Date into local YYYY-MM-DD string
 */
export function toLocalDateKey(d: Date | number = Date.now()): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Bidirectional phase mapping with legacy UI keys ('focus' | 'short' | 'long')
 */
export function toTimerPhase(phase: PomodoroPhase): 'focus' | 'short' | 'long' {
  switch (phase) {
    case 'FOCUS':
      return 'focus';
    case 'SHORT_BREAK':
      return 'short';
    case 'LONG_BREAK':
      return 'long';
  }
}

export function fromTimerPhase(phase: string): PomodoroPhase {
  const lower = String(phase || '').toLowerCase();
  if (lower === 'short' || lower === 'short_break') return 'SHORT_BREAK';
  if (lower === 'long' || lower === 'long_break') return 'LONG_BREAK';
  return 'FOCUS';
}

/**
 * Calculate duration in milliseconds for a phase
 */
export function getPhaseDurationMs(phase: PomodoroPhase, settings: PomodoroSettings): number {
  switch (phase) {
    case 'FOCUS':
      return Math.max(1, settings.focusMinutes) * 60 * 1000;
    case 'SHORT_BREAK':
      return Math.max(1, settings.shortBreakMinutes) * 60 * 1000;
    case 'LONG_BREAK':
      return Math.max(1, settings.longBreakMinutes) * 60 * 1000;
  }
}

/**
 * Initialize clean state
 */
export function createInitialPomodoroState(
  settings: PomodoroSettings = DEFAULT_POMODORO_SETTINGS,
  initialTally = 0,
  initialPhase: PomodoroPhase = 'FOCUS'
): PomodoroState {
  const durationMs = getPhaseDurationMs(initialPhase, settings);
  return {
    phase: initialPhase,
    status: 'idle',
    cycleTally: Math.max(0, initialTally),
    durationMs,
    remainingMs: durationMs,
    targetEndTime: null,
    startedAt: null,
    sessionStartedAt: null,
  };
}

/**
 * Calculate remaining time drift-free from wall-clock targetEndTime
 */
export function calculateRemainingMs(
  targetEndTime: number | null,
  fallbackRemaining: number,
  now = Date.now()
): number {
  if (targetEndTime === null) {
    return Math.max(0, fallbackRemaining);
  }
  return Math.max(0, targetEndTime - now);
}

/**
 * Start or resume countdown
 */
export function startTimer(state: PomodoroState, now = Date.now()): PomodoroState {
  if (state.status === 'running') return state;
  const rem = state.remainingMs <= 0 ? state.durationMs : state.remainingMs;
  return {
    ...state,
    status: 'running',
    remainingMs: rem,
    targetEndTime: now + rem,
    startedAt: state.startedAt ?? now,
    sessionStartedAt: state.sessionStartedAt ?? now,
  };
}

/**
 * Pause countdown and snapshot remainingMs
 */
export function pauseTimer(state: PomodoroState, now = Date.now()): PomodoroState {
  if (state.status !== 'running') return state;
  const rem = calculateRemainingMs(state.targetEndTime, state.remainingMs, now);
  return {
    ...state,
    status: 'paused',
    remainingMs: rem,
    targetEndTime: null,
  };
}

/**
 * Process a tick or visibility sync event
 */
export function tickTimer(
  state: PomodoroState,
  now = Date.now()
): { nextState: PomodoroState; finished: boolean } {
  if (state.status !== 'running' || state.targetEndTime === null) {
    return { nextState: state, finished: false };
  }

  const remainingMs = Math.max(0, state.targetEndTime - now);
  if (remainingMs <= 0) {
    return {
      nextState: {
        ...state,
        remainingMs: 0,
        status: 'idle',
        targetEndTime: null,
      },
      finished: true,
    };
  }

  return {
    nextState: {
      ...state,
      remainingMs,
    },
    finished: false,
  };
}

/**
 * Core State Machine Transition on Phase Completion:
 * - When FOCUS finishes:
 *   - Increment cycleTally by 1.
 *   - Log focus duration and session count to daily stats (keyed by YYYY-MM-DD).
 *   - If cycleTally < targetTally -> transition to SHORT_BREAK.
 *   - If cycleTally >= targetTally -> transition to LONG_BREAK.
 * - When SHORT_BREAK finishes -> transition back to FOCUS without changing cycleTally.
 * - When LONG_BREAK finishes -> reset cycleTally back to 0 and transition to FOCUS.
 */
export function completePhase(
  state: PomodoroState,
  settings: PomodoroSettings,
  currentStats: FocusStatsMap = {},
  now = Date.now()
): {
  nextState: PomodoroState;
  nextStats: FocusStatsMap;
  completedFocus: boolean;
  loggedDurationMs: number;
  dateKey: string;
} {
  const dateKey = toLocalDateKey(now);
  const existingDayStat: DayFocusStatRecord = currentStats[dateKey] || {
    date: dateKey,
    focusMinutes: 0,
    focusMs: 0,
    sessionCount: 0,
    breakMinutes: 0,
    breakMs: 0,
  };

  if (state.phase === 'FOCUS') {
    const newTally = state.cycleTally + 1;
    const focusDurationMs = state.durationMs;

    // Log completed focus duration and increment session count
    const updatedDayStat: DayFocusStatRecord = {
      ...existingDayStat,
      focusMs: existingDayStat.focusMs + focusDurationMs,
      focusMinutes: Math.round((existingDayStat.focusMs + focusDurationMs) / 60000),
      sessionCount: existingDayStat.sessionCount + 1,
    };

    const nextStats: FocusStatsMap = {
      ...currentStats,
      [dateKey]: updatedDayStat,
    };

    const target = Math.max(1, settings.targetTally || 4);
    const nextPhase: PomodoroPhase = newTally < target ? 'SHORT_BREAK' : 'LONG_BREAK';
    const nextDur = getPhaseDurationMs(nextPhase, settings);
    const autoStart = !!settings.autoStartBreaks;

    const nextState: PomodoroState = {
      phase: nextPhase,
      status: autoStart ? 'running' : 'idle',
      cycleTally: newTally,
      durationMs: nextDur,
      remainingMs: nextDur,
      targetEndTime: autoStart ? now + nextDur : null,
      startedAt: autoStart ? now : null,
      sessionStartedAt: autoStart ? now : null,
    };

    return {
      nextState,
      nextStats,
      completedFocus: true,
      loggedDurationMs: focusDurationMs,
      dateKey,
    };
  }

  // Break finished (SHORT_BREAK or LONG_BREAK)
  const breakDurationMs = state.durationMs;
  const updatedDayStat: DayFocusStatRecord = {
    ...existingDayStat,
    breakMs: existingDayStat.breakMs + breakDurationMs,
    breakMinutes: Math.round((existingDayStat.breakMs + breakDurationMs) / 60000),
  };
  const nextStats: FocusStatsMap = {
    ...currentStats,
    [dateKey]: updatedDayStat,
  };

  // If LONG_BREAK finished, reset cycleTally to 0; if SHORT_BREAK finished, keep cycleTally unchanged
  const nextTally = state.phase === 'LONG_BREAK' ? 0 : state.cycleTally;
  const nextPhase: PomodoroPhase = 'FOCUS';
  const nextDur = getPhaseDurationMs(nextPhase, settings);
  const autoStart = !!settings.autoStartFocus;

  const nextState: PomodoroState = {
    phase: nextPhase,
    status: autoStart ? 'running' : 'idle',
    cycleTally: nextTally,
    durationMs: nextDur,
    remainingMs: nextDur,
    targetEndTime: autoStart ? now + nextDur : null,
    startedAt: autoStart ? now : null,
    sessionStartedAt: autoStart ? now : null,
  };

  return {
    nextState,
    nextStats,
    completedFocus: false,
    loggedDurationMs: breakDurationMs,
    dateKey,
  };
}

/**
 * Skip Phase Rules:
 * - When SHORT_BREAK is skipped -> transition back to FOCUS without changing cycleTally.
 * - When LONG_BREAK is skipped -> reset cycleTally back to 0 and transition to FOCUS.
 * - When FOCUS is skipped -> advance to next break (SHORT_BREAK if cycle < targetTally, else LONG_BREAK).
 */
export function skipPhase(
  state: PomodoroState,
  settings: PomodoroSettings,
  now = Date.now()
): PomodoroState {
  if (state.phase === 'LONG_BREAK') {
    const nextDur = getPhaseDurationMs('FOCUS', settings);
    return {
      phase: 'FOCUS',
      status: 'idle',
      cycleTally: 0, // Reset to 0
      durationMs: nextDur,
      remainingMs: nextDur,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
    };
  }

  if (state.phase === 'SHORT_BREAK') {
    const nextDur = getPhaseDurationMs('FOCUS', settings);
    return {
      phase: 'FOCUS',
      status: 'idle',
      cycleTally: state.cycleTally, // Unchanged
      durationMs: nextDur,
      remainingMs: nextDur,
      targetEndTime: null,
      startedAt: null,
      sessionStartedAt: null,
    };
  }

  // FOCUS skipped -> transition to break
  const target = Math.max(1, settings.targetTally || 4);
  const nextPhase: PomodoroPhase = state.cycleTally + 1 < target ? 'SHORT_BREAK' : 'LONG_BREAK';
  const nextDur = getPhaseDurationMs(nextPhase, settings);

  return {
    phase: nextPhase,
    status: 'idle',
    cycleTally: state.cycleTally,
    durationMs: nextDur,
    remainingMs: nextDur,
    targetEndTime: null,
    startedAt: null,
    sessionStartedAt: null,
  };
}

/**
 * Manual "Reset Cycle":
 * Resets cycleTally to 0 and sets phase to FOCUS
 */
export function resetCycle(
  settings: PomodoroSettings,
  _now = Date.now()
): PomodoroState {
  const dur = getPhaseDurationMs('FOCUS', settings);
  return {
    phase: 'FOCUS',
    status: 'idle',
    cycleTally: 0,
    durationMs: dur,
    remainingMs: dur,
    targetEndTime: null,
    startedAt: null,
    sessionStartedAt: null,
  };
}

/**
 * Reset current segment without changing cycleTally
 */
export function resetCurrentSegment(
  state: PomodoroState,
  settings: PomodoroSettings
): PomodoroState {
  const dur = getPhaseDurationMs(state.phase, settings);
  return {
    ...state,
    status: 'idle',
    durationMs: dur,
    remainingMs: dur,
    targetEndTime: null,
    startedAt: null,
    sessionStartedAt: null,
  };
}

/**
 * Switch directly to a specified phase
 */
export function switchPhase(
  targetPhase: PomodoroPhase,
  state: PomodoroState,
  settings: PomodoroSettings
): PomodoroState {
  const dur = getPhaseDurationMs(targetPhase, settings);
  return {
    ...state,
    phase: targetPhase,
    status: 'idle',
    durationMs: dur,
    remainingMs: dur,
    targetEndTime: null,
    startedAt: null,
    sessionStartedAt: null,
  };
}
