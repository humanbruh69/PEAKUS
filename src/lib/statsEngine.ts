import { Session, Task } from '../types';

export interface DayFocusStat {
  dateStr: string; // YYYY-MM-DD in local time
  focusMs: number;
  breakMs: number;
  sessionCount: number;
}

export interface TaskFocusStat {
  id: string;
  title: string;
  ms: number;
  count: number;
}

export interface HeatmapCell {
  dateStr: string;
  timeMs: number;
  focusMs: number;
  level: 0 | 1 | 2 | 3 | 4; // 0: 0m, 1: 1-29m, 2: 30-89m, 3: 90-179m, 4: >=180m
  isFuture: boolean;
  label: string;
}

export interface ComputedStats {
  totalFocusMs: number;
  totalBreakMs: number;
  completedFocusSessionsCount: number;
  interruptedFocusSessionsCount: number;
  completedTasksCount: number;
  dailyAverageFocusMs: number;
  currentStreak: number;
  bestStreak: number;
  todayFocusMs: number;
  todayGoalMs: number;
  todayProgressRatio: number;
  dailyFocusMap: Map<string, number>;
  taskDistribution: TaskFocusStat[];
  generateHeatmap: (weeks: number) => HeatmapCell[];
}

/**
 * Format local date as YYYY-MM-DD
 */
export function toLocalDateKey(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start of day (midnight) in local time
 */
export function getLocalStartOfDay(d: Date | number): Date {
  const date = typeof d === 'number' ? new Date(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Add days to a date in local time
 */
export function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Robust, high-performance Stats Engine with zero caching bugs.
 */
export function computeStats(
  sessions: Session[],
  tasks: Task[],
  streakGoalMinutes: number = 25,
  referenceDate: Date = new Date()
): ComputedStats {
  const goalMs = Math.max(1, streakGoalMinutes) * 60000;
  const todayMidnight = getLocalStartOfDay(referenceDate);
  const todayKey = toLocalDateKey(todayMidnight);

  let totalFocusMs = 0;
  let totalBreakMs = 0;
  let completedFocusSessionsCount = 0;
  let interruptedFocusSessionsCount = 0;

  const dailyFocusMap = new Map<string, number>();
  const dailyBreakMap = new Map<string, number>();
  const taskMap = new Map<string, { title: string; ms: number; count: number }>();

  // Process all sessions in one single O(N) pass
  for (const s of sessions) {
    if (!s || typeof s.start !== 'number' || typeof s.end !== 'number' || s.end < s.start) {
      continue;
    }

    const duration = Math.max(0, s.ms || (s.end - s.start));
    const isFocus = s.kind === 'focus';
    const dayKey = toLocalDateKey(s.start);

    if (isFocus) {
      totalFocusMs += duration;
      dailyFocusMap.set(dayKey, (dailyFocusMap.get(dayKey) || 0) + duration);

      if (s.completed) {
        completedFocusSessionsCount++;
      } else {
        interruptedFocusSessionsCount++;
      }

      // Aggregate task breakdown
      const taskId = s.taskId || 'general';
      const taskTitle = s.title?.trim() || 'General Focus';
      const existing = taskMap.get(taskId) || { title: taskTitle, ms: 0, count: 0 };
      existing.ms += duration;
      existing.count += 1;
      taskMap.set(taskId, existing);
    } else {
      totalBreakMs += duration;
      dailyBreakMap.set(dayKey, (dailyBreakMap.get(dayKey) || 0) + duration);
    }
  }

  // Calculate Streak
  // Logic: A day counts if focusMs >= goalMs.
  // Current streak:
  // - If today met goal -> streak counts today + consecutive days prior.
  // - If today hasn't met goal yet -> day is still in progress! Check yesterday. If yesterday met goal, streak starts from yesterday. If neither met goal, streak is 0.
  let currentStreak = 0;
  const todayFocusMs = dailyFocusMap.get(todayKey) || 0;
  let cursor = new Date(todayMidnight.getTime());

  if (todayFocusMs >= goalMs) {
    currentStreak++;
    cursor = addLocalDays(cursor, -1);
    while ((dailyFocusMap.get(toLocalDateKey(cursor)) || 0) >= goalMs) {
      currentStreak++;
      cursor = addLocalDays(cursor, -1);
    }
  } else {
    // Check yesterday to maintain active streak during current day
    const yesterday = addLocalDays(cursor, -1);
    let check = yesterday;
    while ((dailyFocusMap.get(toLocalDateKey(check)) || 0) >= goalMs) {
      currentStreak++;
      check = addLocalDays(check, -1);
    }
  }

  // Best Streak Calculation
  // Find longest unbroken sequence of days >= goalMs across all recorded days
  const allDays = Array.from(dailyFocusMap.keys())
    .filter(k => (dailyFocusMap.get(k) || 0) >= goalMs)
    .sort();

  let bestStreak = 0;
  let tempStreak = 0;
  let prevDayMs: number | null = null;

  for (const dayStr of allDays) {
    const [y, m, d] = dayStr.split('-').map(Number);
    const dayDate = new Date(y, m - 1, d);
    const dayTime = dayDate.getTime();

    if (prevDayMs !== null) {
      const prevDate = new Date(prevDayMs);
      const expectedNext = addLocalDays(prevDate, 1).getTime();
      if (Math.abs(dayTime - expectedNext) < 3600000 * 4) { // within daylight savings variance
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }

    prevDayMs = dayTime;
    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
  }

  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
  }

  // Tasks completed count
  const completedTasksCount = tasks.filter(t => t && t.done && !t.deleted).length;

  // Daily Average
  // Calculate average per active focus day
  const activeDaysCount = dailyFocusMap.size;
  const dailyAverageFocusMs = activeDaysCount > 0 ? Math.round(totalFocusMs / activeDaysCount) : 0;

  // Task distribution list
  const taskDistribution: TaskFocusStat[] = Array.from(taskMap.entries())
    .map(([id, val]) => ({ id, title: val.title, ms: val.ms, count: val.count }))
    .sort((a, b) => b.ms - a.ms);

  const todayProgressRatio = Math.min(1, todayFocusMs / goalMs);

  // Generate heatmap matrix (O(weeks * 7))
  const generateHeatmap = (weeks: number): HeatmapCell[] => {
    const safeWeeks = Math.max(4, Math.min(54, weeks));
    const nowLocal = getLocalStartOfDay(referenceDate);
    // Align with Monday as start of week (0 = Monday, 6 = Sunday)
    const dow = (nowLocal.getDay() + 6) % 7;
    const startOfWeekGrid = addLocalDays(nowLocal, -dow - (safeWeeks - 1) * 7);

    const cells: HeatmapCell[] = [];
    const totalDays = safeWeeks * 7;

    for (let i = 0; i < totalDays; i++) {
      const cellDate = addLocalDays(startOfWeekGrid, i);
      const dateKey = toLocalDateKey(cellDate);
      const isFuture = cellDate.getTime() > nowLocal.getTime();
      const val = isFuture ? 0 : dailyFocusMap.get(dateKey) || 0;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (val > 0) {
        if (val < 30 * 60000) level = 1;
        else if (val < 90 * 60000) level = 2;
        else if (val < 180 * 60000) level = 3;
        else level = 4;
      }

      const formattedDate = cellDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      const minutes = Math.round(val / 60000);
      const label = `${formattedDate}: ${minutes > 0 ? `${minutes} min focus` : 'no focus'}`;

      cells.push({
        dateStr: dateKey,
        timeMs: cellDate.getTime(),
        focusMs: val,
        level,
        isFuture,
        label,
      });
    }

    return cells;
  };

  return {
    totalFocusMs,
    totalBreakMs,
    completedFocusSessionsCount,
    interruptedFocusSessionsCount,
    completedTasksCount,
    dailyAverageFocusMs,
    currentStreak,
    bestStreak,
    todayFocusMs,
    todayGoalMs: goalMs,
    todayProgressRatio,
    dailyFocusMap,
    taskDistribution,
    generateHeatmap,
  };
}
