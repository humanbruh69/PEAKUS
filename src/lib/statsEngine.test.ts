import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, toLocalDateKey, addLocalDays, getLocalStartOfDay } from './statsEngine';
import { Session, Task } from '../types';

test('computeStats correctly handles empty sessions and tasks', () => {
  const stats = computeStats([], [], 25);
  assert.equal(stats.totalFocusMs, 0);
  assert.equal(stats.totalBreakMs, 0);
  assert.equal(stats.completedFocusSessionsCount, 0);
  assert.equal(stats.interruptedFocusSessionsCount, 0);
  assert.equal(stats.completedTasksCount, 0);
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.bestStreak, 0);
  assert.equal(stats.dailyAverageFocusMs, 0);
});

test('computeStats aggregates focus and break time accurately', () => {
  const now = Date.now();
  const sessions: Session[] = [
    {
      id: 's1',
      kind: 'focus',
      start: now - 30 * 60000,
      end: now,
      ms: 30 * 60000,
      completed: true,
      title: 'Deep Coding',
      phase: 'focus',
    },
    {
      id: 's2',
      kind: 'break',
      start: now - 35 * 60000,
      end: now - 30 * 60000,
      ms: 5 * 60000,
      completed: true,
      title: 'Rest',
      phase: 'short',
    },
    {
      id: 's3',
      kind: 'focus',
      start: now - 50 * 60000,
      end: now - 40 * 60000,
      ms: 10 * 60000,
      completed: false, // interrupted
      title: 'Reading',
      phase: 'focus',
    },
  ];

  const tasks: Task[] = [
    { id: 't1', title: 'Task 1', done: true, createdAt: now, updatedAt: now, subtasks: [] },
    { id: 't2', title: 'Task 2', done: false, createdAt: now, updatedAt: now, subtasks: [] },
    { id: 't3', title: 'Task 3', done: true, deleted: true, createdAt: now, updatedAt: now, subtasks: [] }, // deleted, shouldn't count
  ];

  const stats = computeStats(sessions, tasks, 25);
  assert.equal(stats.totalFocusMs, 40 * 60000);
  assert.equal(stats.totalBreakMs, 5 * 60000);
  assert.equal(stats.completedFocusSessionsCount, 1);
  assert.equal(stats.interruptedFocusSessionsCount, 1);
  assert.equal(stats.completedTasksCount, 1);
});

test('computeStats accurately calculates continuous and preserved streaks', () => {
  const refDate = new Date('2026-11-04T12:00:00'); // Wednesday
  const todayMidnight = getLocalStartOfDay(refDate);

  const dayMinus3 = addLocalDays(todayMidnight, -3).getTime() + 1000 * 3600; // 3 days ago
  const dayMinus2 = addLocalDays(todayMidnight, -2).getTime() + 1000 * 3600; // 2 days ago
  const dayMinus1 = addLocalDays(todayMidnight, -1).getTime() + 1000 * 3600; // yesterday

  // Sessions for day -3, day -2, day -1, each with 30 min (goal is 25 min)
  const sessions: Session[] = [
    { id: 's1', kind: 'focus', start: dayMinus3, end: dayMinus3 + 30 * 60000, ms: 30 * 60000, completed: true },
    { id: 's2', kind: 'focus', start: dayMinus2, end: dayMinus2 + 30 * 60000, ms: 30 * 60000, completed: true },
    { id: 's3', kind: 'focus', start: dayMinus1, end: dayMinus1 + 30 * 60000, ms: 30 * 60000, completed: true },
  ];

  // If today hasn't met goal yet, streak from yesterday should still be preserved as 3!
  const statsNoToday = computeStats(sessions, [], 25, refDate);
  assert.equal(statsNoToday.currentStreak, 3);
  assert.equal(statsNoToday.bestStreak, 3);

  // Now user completes a 30m session today
  const todaySession: Session = {
    id: 's4',
    kind: 'focus',
    start: todayMidnight.getTime() + 1000 * 3600,
    end: todayMidnight.getTime() + 1000 * 3600 + 30 * 60000,
    ms: 30 * 60000,
    completed: true,
  };
  const statsWithToday = computeStats([...sessions, todaySession], [], 25, refDate);
  assert.equal(statsWithToday.currentStreak, 4);
  assert.equal(statsWithToday.bestStreak, 4);
});

test('computeStats resets current streak if yesterday and today had no focus', () => {
  const refDate = new Date('2026-11-04T12:00:00');
  const todayMidnight = getLocalStartOfDay(refDate);
  const dayMinus5 = addLocalDays(todayMidnight, -5).getTime() + 1000 * 3600;

  const sessions: Session[] = [
    { id: 's1', kind: 'focus', start: dayMinus5, end: dayMinus5 + 60 * 60000, ms: 60 * 60000, completed: true },
  ];

  const stats = computeStats(sessions, [], 25, refDate);
  assert.equal(stats.currentStreak, 0); // gap exists, streak is 0
  assert.equal(stats.bestStreak, 1);    // all-time best streak was 1
});

test('generateHeatmap returns proper grid dimensions and level thresholds', () => {
  const stats = computeStats([], [], 25);
  const cells = stats.generateHeatmap(26);
  assert.equal(cells.length, 26 * 7);
  assert.ok(cells[0].dateStr);
  assert.equal(typeof cells[0].level, 'number');
});
