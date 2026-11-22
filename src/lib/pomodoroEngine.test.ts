import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PomodoroSettings,
  createInitialPomodoroState,
  startTimer,
  pauseTimer,
  tickTimer,
  completePhase,
  skipPhase,
  resetCycle,
  resetCurrentSegment,
  resetSegmentSavingFocus,
  resetWholeSessionSavingFocus,
  extendFlowFocus,
  takeBreakFromFlow,
  toLocalDateKey,
  getPhaseDurationMs,
  toTimerPhase,
  fromTimerPhase,
  formatWholeSessionResetToast,
  canSkipPhase,
  canPauseTimer,
  shouldLogResetFocus,
  enforceHardcoreSettings,
  HARDCORE_REQUIRED_SESSIONS,
} from './pomodoroEngine';

const TEST_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  targetTally: 4,
  selectedTallyIcon: 'growing_tree',
  autoStartBreaks: false,
  autoStartFocus: false,
  hardcoreMode: false,
};

test('initial PomodoroState starts with phase FOCUS and cycleTally 0', () => {
  const state = createInitialPomodoroState(TEST_SETTINGS);
  assert.equal(state.phase, 'FOCUS');
  assert.equal(state.status, 'idle');
  assert.equal(state.cycleTally, 0);
  assert.equal(state.durationMs, 25 * 60 * 1000);
  assert.equal(state.remainingMs, 25 * 60 * 1000);
  assert.equal(state.targetEndTime, null);
});

test('drift-free engine calculates remaining time using timestamp deltas without drift', () => {
  const baseTime = 1700000000000;
  const initial = createInitialPomodoroState(TEST_SETTINGS);
  const started = startTimer(initial, baseTime);

  assert.equal(started.status, 'running');
  assert.equal(started.targetEndTime, baseTime + 25 * 60 * 1000);

  // Normal tick after 1 second
  const tick1 = tickTimer(started, baseTime + 1000);
  assert.equal(tick1.finished, false);
  assert.equal(tick1.nextState.remainingMs, 25 * 60 * 1000 - 1000);

  // Background tab delay simulation: tab freezes or sleeps for 10 minutes (600,000ms)
  // When browser wakes up, it recomputes targetEndTime - now directly without drift
  const tickAfterSleep = tickTimer(started, baseTime + 600000);
  assert.equal(tickAfterSleep.finished, false);
  assert.equal(tickAfterSleep.nextState.remainingMs, 25 * 60 * 1000 - 600000);

  // When time elapses past duration, finished is true and remainingMs is 0
  const tickEnd = tickTimer(started, baseTime + 25 * 60 * 1000);
  assert.equal(tickEnd.finished, true);
  assert.equal(tickEnd.nextState.remainingMs, 0);
  assert.equal(tickEnd.nextState.status, 'idle');
});

test('pauseTimer snapshots remainingMs accurately and clears targetEndTime', () => {
  const baseTime = 1700000000000;
  const initial = createInitialPomodoroState(TEST_SETTINGS);
  const started = startTimer(initial, baseTime);

  // Pause after 5 minutes (300,000ms)
  const paused = pauseTimer(started, baseTime + 300000);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.targetEndTime, null);
  assert.equal(paused.remainingMs, 20 * 60 * 1000);

  // Resuming 2 minutes later recalculates targetEndTime based on paused remainingMs
  const resumed = startTimer(paused, baseTime + 420000);
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.targetEndTime, baseTime + 420000 + 20 * 60 * 1000);
});

test('when FOCUS finishes: increments cycleTally, logs daily stats, transitions to SHORT_BREAK', () => {
  const now = new Date('2026-11-11T10:00:00Z').getTime();
  const dateKey = toLocalDateKey(now);
  const state = createInitialPomodoroState(TEST_SETTINGS); // cycleTally = 0

  const result = completePhase(state, TEST_SETTINGS, {}, now);

  assert.equal(result.completedFocus, true);
  assert.equal(result.loggedDurationMs, 25 * 60 * 1000);
  assert.equal(result.nextState.cycleTally, 1);
  assert.equal(result.nextState.phase, 'SHORT_BREAK');
  assert.equal(result.nextState.durationMs, 5 * 60 * 1000);
  assert.equal(result.nextState.remainingMs, 5 * 60 * 1000);

  // Check stats logged to YYYY-MM-DD
  const dayStats = result.nextStats[dateKey];
  assert.ok(dayStats);
  assert.equal(dayStats.sessionCount, 1);
  assert.equal(dayStats.focusMs, 25 * 60 * 1000);
  assert.equal(dayStats.focusMinutes, 25);
});

test('when FOCUS is skipped in normal mode: transitions to break WITHOUT incrementing cycleTally', () => {
  const now = new Date('2026-11-11T10:00:00Z').getTime();
  const state = createInitialPomodoroState(TEST_SETTINGS, 1);
  const skipped = skipPhase(state, TEST_SETTINGS, now);

  assert.equal(skipped.phase, 'SHORT_BREAK');
  assert.equal(skipped.cycleTally, 1);
  assert.equal(skipped.status, 'idle');
});

test('when SHORT_BREAK finishes or is skipped: transitions to FOCUS without changing cycleTally', () => {
  const now = new Date('2026-11-11T10:30:00Z').getTime();
  const state = {
    ...createInitialPomodoroState(TEST_SETTINGS),
    phase: 'SHORT_BREAK' as const,
    cycleTally: 2,
    durationMs: 5 * 60 * 1000,
    remainingMs: 5 * 60 * 1000,
  };

  // 1. When finished
  const finishedResult = completePhase(state, TEST_SETTINGS, {}, now);
  assert.equal(finishedResult.nextState.phase, 'FOCUS');
  assert.equal(finishedResult.nextState.cycleTally, 2); // Unchanged!
  assert.equal(finishedResult.nextState.durationMs, 25 * 60 * 1000);

  // 2. When skipped
  const skippedState = skipPhase(state, TEST_SETTINGS, now);
  assert.equal(skippedState.phase, 'FOCUS');
  assert.equal(skippedState.cycleTally, 2); // Unchanged!
  assert.equal(skippedState.durationMs, 25 * 60 * 1000);
});

test('when cycleTally reaches targetTally (e.g. 4): transitions to LONG_BREAK', () => {
  const now = new Date('2026-11-11T11:00:00Z').getTime();
  const state = {
    ...createInitialPomodoroState(TEST_SETTINGS),
    phase: 'FOCUS' as const,
    cycleTally: 3, // Completing this will make it 4 (targetTally)
    durationMs: 25 * 60 * 1000,
    remainingMs: 0,
  };

  const result = completePhase(state, TEST_SETTINGS, {}, now);

  assert.equal(result.nextState.cycleTally, 4);
  assert.equal(result.nextState.phase, 'LONG_BREAK');
  assert.equal(result.nextState.durationMs, 15 * 60 * 1000);
  assert.equal(result.nextState.remainingMs, 15 * 60 * 1000);
});

test('when LONG_BREAK finishes or is skipped: resets cycleTally to 0 and transitions to FOCUS', () => {
  const now = new Date('2026-11-11T12:00:00Z').getTime();
  const state = {
    ...createInitialPomodoroState(TEST_SETTINGS),
    phase: 'LONG_BREAK' as const,
    cycleTally: 4,
    durationMs: 15 * 60 * 1000,
    remainingMs: 15 * 60 * 1000,
  };

  // 1. When finished
  const finishedResult = completePhase(state, TEST_SETTINGS, {}, now);
  assert.equal(finishedResult.nextState.phase, 'FOCUS');
  assert.equal(finishedResult.nextState.cycleTally, 0); // Reset to 0!
  assert.equal(finishedResult.nextState.durationMs, 25 * 60 * 1000);

  // 2. When skipped
  const skippedState = skipPhase(state, TEST_SETTINGS, now);
  assert.equal(skippedState.phase, 'FOCUS');
  assert.equal(skippedState.cycleTally, 0); // Reset to 0!
  assert.equal(skippedState.durationMs, 25 * 60 * 1000);
});

test('manual "Reset Cycle" action resets cycleTally to 0 and sets phase to FOCUS', () => {
  const resetState = resetCycle(TEST_SETTINGS);
  assert.equal(resetState.phase, 'FOCUS');
  assert.equal(resetState.status, 'idle');
  assert.equal(resetState.cycleTally, 0);
  assert.equal(resetState.durationMs, 25 * 60 * 1000);
  assert.equal(resetState.remainingMs, 25 * 60 * 1000);
  assert.equal(resetState.targetEndTime, null);
});

test('full 4-cycle Pomodoro state machine progression follows Flocus rules', () => {
  let stats = {};
  let state = createInitialPomodoroState(TEST_SETTINGS);
  const now = new Date('2026-11-11T09:00:00Z').getTime();

  // Cycle 1: FOCUS -> SHORT_BREAK (tally: 1)
  let res = completePhase(state, TEST_SETTINGS, stats, now);
  assert.equal(res.nextState.cycleTally, 1);
  assert.equal(res.nextState.phase, 'SHORT_BREAK');
  stats = res.nextStats;

  // Short break 1 completes -> FOCUS (tally stays 1)
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 1000);
  assert.equal(res.nextState.cycleTally, 1);
  assert.equal(res.nextState.phase, 'FOCUS');
  stats = res.nextStats;

  // Cycle 2: FOCUS -> SHORT_BREAK (tally: 2)
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 2000);
  assert.equal(res.nextState.cycleTally, 2);
  assert.equal(res.nextState.phase, 'SHORT_BREAK');
  stats = res.nextStats;

  // Short break 2 completes -> FOCUS (tally stays 2)
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 3000);
  assert.equal(res.nextState.cycleTally, 2);
  assert.equal(res.nextState.phase, 'FOCUS');
  stats = res.nextStats;

  // Cycle 3: FOCUS -> SHORT_BREAK (tally: 3)
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 4000);
  assert.equal(res.nextState.cycleTally, 3);
  assert.equal(res.nextState.phase, 'SHORT_BREAK');
  stats = res.nextStats;

  // Short break 3 completes -> FOCUS (tally stays 3)
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 5000);
  assert.equal(res.nextState.cycleTally, 3);
  assert.equal(res.nextState.phase, 'FOCUS');
  stats = res.nextStats;

  // Cycle 4: FOCUS -> LONG_BREAK (tally: 4)
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 6000);
  assert.equal(res.nextState.cycleTally, 4);
  assert.equal(res.nextState.phase, 'LONG_BREAK');
  stats = res.nextStats;

  // Long break completes -> reset to 0, FOCUS
  res = completePhase(res.nextState, TEST_SETTINGS, stats, now + 7000);
  assert.equal(res.nextState.cycleTally, 0);
  assert.equal(res.nextState.phase, 'FOCUS');

  // Verify daily focus stats aggregated 4 focus sessions = 100 minutes
  const dateKey = toLocalDateKey(now);
  const dayStats = (res.nextStats as any)[dateKey];
  assert.equal(dayStats.sessionCount, 4);
  assert.equal(dayStats.focusMinutes, 100);
});

test('phase mapping helpers convert between PomodoroPhase and legacy timer phases', () => {
  assert.equal(toTimerPhase('FOCUS'), 'focus');
  assert.equal(toTimerPhase('SHORT_BREAK'), 'short');
  assert.equal(toTimerPhase('LONG_BREAK'), 'long');

  assert.equal(fromTimerPhase('focus'), 'FOCUS');
  assert.equal(fromTimerPhase('short'), 'SHORT_BREAK');
  assert.equal(fromTimerPhase('long'), 'LONG_BREAK');
});

test('resetSegmentSavingFocus saves elapsed focus time to daily stats and preserves cycleTally in normal mode', () => {
  const baseTime = new Date('2026-11-12T10:00:00Z').getTime();
  const dateKey = toLocalDateKey(baseTime);
  const initial = {
    ...createInitialPomodoroState(TEST_SETTINGS, 2),
  };
  const started = startTimer(initial, baseTime);

  // User focuses for 5 minutes (300,000ms), then resets this part
  const resetAt = baseTime + 5 * 60 * 1000;
  const res = resetSegmentSavingFocus(started, TEST_SETTINGS, {}, resetAt);

  assert.equal(res.savedFocusMs, 5 * 60 * 1000);
  assert.equal(res.nextStats[dateKey].focusMinutes, 5);
  assert.equal(res.nextState.cycleTally, 2);
  assert.equal(res.nextState.phase, 'FOCUS');
  assert.equal(res.nextState.status, 'idle');
  assert.equal(res.nextState.remainingMs, 25 * 60 * 1000);
  assert.equal(res.nextState.targetEndTime, null);
});

test('resetWholeSessionSavingFocus saves elapsed focus time and resets cycleTally to 0 in normal mode', () => {
  const baseTime = new Date('2026-11-12T10:00:00Z').getTime();
  const dateKey = toLocalDateKey(baseTime);
  const initial = {
    ...createInitialPomodoroState(TEST_SETTINGS, 3),
  };
  const started = startTimer(initial, baseTime);

  // User focuses for 8 minutes, then clicks "Reset whole session"
  const resetAt = baseTime + 8 * 60 * 1000;
  const res = resetWholeSessionSavingFocus(started, TEST_SETTINGS, {}, resetAt);

  assert.equal(res.savedFocusMs, 8 * 60 * 1000);
  assert.equal(res.nextStats[dateKey].focusMinutes, 8);
  assert.equal(res.nextState.cycleTally, 0);
  assert.equal(res.nextState.phase, 'FOCUS');
  assert.equal(res.nextState.status, 'idle');
  assert.equal(res.nextState.remainingMs, 25 * 60 * 1000);
});

test('Hardcore Mode blocks skipping and pausing and discards elapsed focus time on reset without logging stats', () => {
  const hardcore: PomodoroSettings = { ...TEST_SETTINGS, hardcoreMode: true };
  assert.equal(canSkipPhase(hardcore), false);
  assert.equal(canPauseTimer(hardcore), false);
  assert.equal(shouldLogResetFocus(hardcore), false);

  const baseTime = new Date('2026-11-12T10:00:00Z').getTime();
  const initial = createInitialPomodoroState(hardcore, 1);
  const started = startTimer(initial, baseTime);

  // Pausing in hardcore mode leaves timer running and targetEndTime intact
  const afterPauseAttempt = pauseTimer(started, baseTime + 5000, hardcore);
  assert.equal(afterPauseAttempt.status, 'running');
  assert.equal(afterPauseAttempt.targetEndTime, started.targetEndTime);
  assert.equal(afterPauseAttempt.remainingMs, started.remainingMs);

  // Skipping in hardcore mode leaves state untouched
  const afterSkipAttempt = skipPhase(started, hardcore, baseTime + 10000);
  assert.equal(afterSkipAttempt.phase, 'FOCUS');
  assert.equal(afterSkipAttempt.status, 'running');
  assert.equal(afterSkipAttempt.cycleTally, 1);

  // Resetting after 5 minutes in hardcore mode discards stats
  const resetAt = baseTime + 5 * 60 * 1000;
  const segReset = resetSegmentSavingFocus(started, hardcore, {}, resetAt);
  assert.equal(segReset.savedFocusMs, 0);
  assert.deepEqual(segReset.nextStats, {});
  assert.equal(segReset.nextState.status, 'idle');
  assert.equal(segReset.nextState.cycleTally, 1);

  const wholeReset = resetWholeSessionSavingFocus(started, hardcore, {}, resetAt);
  assert.equal(wholeReset.savedFocusMs, 0);
  assert.deepEqual(wholeReset.nextStats, {});
  assert.equal(wholeReset.nextState.cycleTally, 0);
});

test('Flow mode extendFlowFocus sets drift-free 10m targetEndTime and takeBreakFromFlow starts break immediately', () => {
  const now = 1700000000000;
  const state = createInitialPomodoroState(TEST_SETTINGS, 1);

  // Extend +10 min
  const extended = extendFlowFocus(state, now, 10);
  assert.equal(extended.phase, 'FOCUS');
  assert.equal(extended.status, 'running');
  assert.equal(extended.durationMs, 10 * 60 * 1000);
  assert.equal(extended.remainingMs, 10 * 60 * 1000);
  assert.equal(extended.targetEndTime, now + 10 * 60 * 1000);
  assert.equal(extended.cycleTally, 1); // unchanged during extension

  // Take a break after flow prompt -> increments tally once and starts break running
  const breakState = takeBreakFromFlow(extended, TEST_SETTINGS, now + 5000);
  assert.equal(breakState.phase, 'SHORT_BREAK');
  assert.equal(breakState.status, 'running');
  assert.equal(breakState.cycleTally, 2);
  assert.equal(breakState.durationMs, 5 * 60 * 1000);
  assert.equal(breakState.targetEndTime, now + 5000 + 5 * 60 * 1000);
});

test('formatWholeSessionResetToast reports completed cycles before reset (e.g. 3/4 -> 0/4)', () => {
  const fmt = (ms: number) => `${Math.round(ms / 60000)}m`;
  assert.equal(
    formatWholeSessionResetToast(3, 4, 0, fmt),
    'Whole session reset (3/4 → 0/4).'
  );
  assert.equal(
    formatWholeSessionResetToast(3, 4, 5 * 60 * 1000, fmt),
    'Whole session reset (3/4 → 0/4 · 5m focus saved).'
  );
  assert.equal(
    formatWholeSessionResetToast(0, 4, 0, fmt),
    'Whole session reset (0/4).'
  );
});

test('Hardcore Mode enforces mandatory auto-start breaks/focus and completes only after 4 focus sessions', () => {
  const rawHardcore: PomodoroSettings = {
    ...TEST_SETTINGS,
    targetTally: 2,
    autoStartBreaks: false,
    autoStartFocus: false,
    hardcoreMode: true,
  };
  const enforced = enforceHardcoreSettings(rawHardcore);
  assert.equal(enforced.targetTally, HARDCORE_REQUIRED_SESSIONS);
  assert.equal(enforced.autoStartBreaks, true);
  assert.equal(enforced.autoStartFocus, true);

  let state = createInitialPomodoroState(rawHardcore);
  let stats = {};
  let now = new Date('2026-11-12T10:00:00Z').getTime();

  for (let i = 1; i <= 3; i++) {
    const focusDone = completePhase(state, rawHardcore, stats, now);
    state = focusDone.nextState;
    stats = focusDone.nextStats;
    assert.equal(focusDone.hardcoreCompleted, false);
    assert.equal(state.phase, 'SHORT_BREAK');
    assert.equal(state.status, 'running'); // auto-started break mandatory
    assert.equal(state.cycleTally, i);

    now += state.durationMs;
    const breakDone = completePhase(state, rawHardcore, stats, now);
    state = breakDone.nextState;
    stats = breakDone.nextStats;
    assert.equal(breakDone.hardcoreCompleted, false);
    assert.equal(state.phase, 'FOCUS');
    assert.equal(state.status, 'running'); // auto-started focus mandatory
  }

  // 4th completed focus finishes Hardcore Mode
  now += state.durationMs;
  const finalDone = completePhase(state, rawHardcore, stats, now);
  assert.equal(finalDone.hardcoreCompleted, true);
  assert.equal(finalDone.nextState.cycleTally, 4);
  assert.equal(finalDone.nextState.phase, 'LONG_BREAK');
  assert.equal(finalDone.nextState.status, 'running');
});



