import type {
  LanguageCode,
  TodoItem,
  TodoNotificationPrefs,
  TodoPriority,
  TodoQuoteMode,
  TodoStatus,
  TodoSubtask,
  TodoViewMode,
} from '../types';
import { MULTILINGUAL_QUOTES } from './i18n';
import { TOXIC_MOTIVATION_QUOTES } from './toxicQuotes';

export type TodoFilter = 'all' | 'active' | 'todo' | 'in_progress' | 'scheduled' | 'done';
export type TodoSortBy = 'smart' | 'due' | 'priority' | 'title' | 'created' | 'manual';
export type QuickRemindPreset = '5m' | '15m' | '30m' | '1h' | 'tonight' | 'tomorrow';

export const NOTION_TODO_EMOJIS = ['📝', '📚', '💻', '✍️', '🎯', '⚡', '🧠', '🔥', '🧪', '📌', '📖', '✨'];
export const DEFAULT_TODO_TAGS = ['Study', 'Exam', 'Coding', 'Reading', 'Lab', 'Personal'];

export const DEFAULT_TODO_PREFS: TodoNotificationPrefs = {
  quotesEnabled: true,
  quoteMode: 'default',
  customQuotes: [],
  defaultView: 'list',
};

const PRIORITY_RANK: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sanitizeTodoPriority(val: unknown): TodoPriority {
  if (val === 'high' || val === 'medium' || val === 'low') return val;
  return 'medium';
}

export function sanitizeTodoQuoteMode(val: unknown): TodoQuoteMode {
  if (val === 'default' || val === 'toxic' || val === 'custom') return val;
  return 'default';
}

export function sanitizeTodoViewMode(val: unknown): TodoViewMode {
  if (val === 'list' || val === 'table' || val === 'board') return val;
  return 'list';
}

export function sanitizeTodoStatus(val: unknown, doneFallback = false): TodoStatus {
  if (val === 'todo' || val === 'in_progress' || val === 'done') return val;
  return doneFallback ? 'done' : 'todo';
}

export function sanitizeTodoTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of raw) {
    if (typeof tag !== 'string') continue;
    const clean = tag.trim().slice(0, 24);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 8) break;
  }
  return out;
}

export function sanitizeTodoSubtasks(raw: unknown): TodoSubtask[] {
  if (!Array.isArray(raw)) return [];
  const out: TodoSubtask[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const sub = entry as Record<string, unknown>;
    const title = typeof sub.title === 'string' ? sub.title.trim().slice(0, 160) : '';
    const id = typeof sub.id === 'string' && sub.id.trim() ? sub.id.trim().slice(0, 80) : '';
    if (!title || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title, done: !!sub.done });
    if (out.length >= 30) break;
  }
  return out;
}

export function cycleTodoStatus(current: TodoStatus | undefined, done = false): TodoStatus {
  const normalized = sanitizeTodoStatus(current, done);
  if (normalized === 'todo') return 'in_progress';
  if (normalized === 'in_progress') return 'done';
  return 'todo';
}

export function sanitizeTodoItems(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TodoItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : '';
    if (!title) continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const createdAt = Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : Date.now();
    const updatedAt = Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : createdAt;
    const remindAtRaw = item.remindAt === null || item.remindAt === undefined ? null : Number(item.remindAt);
    const remindAt = remindAtRaw !== null && Number.isFinite(remindAtRaw) && remindAtRaw > 0 ? remindAtRaw : null;
    const remindedAtRaw = item.remindedAt === null || item.remindedAt === undefined ? null : Number(item.remindedAt);
    const remindedAt =
      remindedAtRaw !== null && Number.isFinite(remindedAtRaw) && remindedAtRaw > 0 ? remindedAtRaw : null;
    const doneAtRaw = item.doneAt === null || item.doneAt === undefined ? null : Number(item.doneAt);
    const doneAt = doneAtRaw !== null && Number.isFinite(doneAtRaw) && doneAtRaw > 0 ? doneAtRaw : null;
    const status = sanitizeTodoStatus(item.status, !!item.done);
    const done = status === 'done' || !!item.done;
    const icon = typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim().slice(0, 8) : '📝';
    const order = Number.isFinite(Number(item.order)) ? Number(item.order) : i;

    out.push({
      id,
      title,
      icon,
      status: done ? 'done' : status,
      note: typeof item.note === 'string' ? item.note.trim().slice(0, 1200) : '',
      done,
      priority: sanitizeTodoPriority(item.priority),
      tags: sanitizeTodoTags(item.tags),
      subtasks: sanitizeTodoSubtasks(item.subtasks),
      order,
      remindAt,
      remindedAt,
      createdAt,
      updatedAt,
      doneAt,
      linkedTaskId:
        typeof item.linkedTaskId === 'string' && item.linkedTaskId.trim()
          ? item.linkedTaskId.trim().slice(0, 80)
          : null,
    });
  }
  return out;
}

export function sanitizeTodoPrefs(raw: unknown): TodoNotificationPrefs {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_TODO_PREFS, customQuotes: [] };
  }
  const obj = raw as Record<string, unknown>;
  const customQuotes = Array.isArray(obj.customQuotes)
    ? obj.customQuotes
        .filter((q): q is string => typeof q === 'string')
        .map(q => q.trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 30)
    : [];
  return {
    quotesEnabled: obj.quotesEnabled === undefined ? true : !!obj.quotesEnabled,
    quoteMode: sanitizeTodoQuoteMode(obj.quoteMode),
    customQuotes,
    defaultView: sanitizeTodoViewMode(obj.defaultView),
  };
}

export interface TodoAdvancedFilters {
  priority?: TodoPriority | 'all';
  tag?: string | null;
}

export function filterTodos(
  items: TodoItem[],
  filter: TodoFilter,
  query = '',
  advanced?: TodoAdvancedFilters
): TodoItem[] {
  const q = query.trim().toLowerCase();
  const prioFilter = advanced?.priority || 'all';
  const tagFilter = advanced?.tag?.trim().toLowerCase() || '';

  return items.filter(item => {
    const status = sanitizeTodoStatus(item.status, item.done);
    if (filter === 'active' && item.done) return false;
    if (filter === 'todo' && status !== 'todo') return false;
    if (filter === 'in_progress' && status !== 'in_progress') return false;
    if (filter === 'done' && !item.done) return false;
    if (filter === 'scheduled' && (item.done || item.remindAt === null)) return false;

    if (prioFilter !== 'all' && item.priority !== prioFilter) return false;
    if (tagFilter) {
      const hasTag = (item.tags || []).some(t => t.toLowerCase() === tagFilter);
      if (!hasTag) return false;
    }

    if (q) {
      const subText = (item.subtasks || []).map(s => s.title).join(' ');
      const tagText = (item.tags || []).join(' ');
      const hay = `${item.title} ${item.note || ''} ${tagText} ${subText}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortTodos(items: TodoItem[], sortBy: TodoSortBy = 'smart'): TodoItem[] {
  return [...items].sort((a, b) => {
    if (sortBy === 'manual') {
      const oa = a.order ?? Number.MAX_SAFE_INTEGER;
      const ob = b.order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return b.createdAt - a.createdAt;
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'created') {
      return b.createdAt - a.createdAt;
    }
    if (sortBy === 'priority') {
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pDiff !== 0) return pDiff;
      return (a.remindAt ?? Number.MAX_SAFE_INTEGER) - (b.remindAt ?? Number.MAX_SAFE_INTEGER);
    }
    if (sortBy === 'due') {
      const da = a.remindAt ?? Number.MAX_SAFE_INTEGER;
      const db = b.remindAt ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }

    // Default 'smart': undone before done, scheduled soonest first, then priority, then newest
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) {
      return (b.doneAt || b.updatedAt) - (a.doneAt || a.updatedAt);
    }
    const aHasReminder = a.remindAt !== null;
    const bHasReminder = b.remindAt !== null;
    if (aHasReminder !== bHasReminder) return aHasReminder ? -1 : 1;
    if (aHasReminder && bHasReminder && a.remindAt !== b.remindAt) {
      return (a.remindAt as number) - (b.remindAt as number);
    }
    const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.createdAt - a.createdAt;
  });
}

export function collectTodoTags(items: TodoItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    for (const tag of item.tags || []) {
      const clean = tag.trim();
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export interface TodoProgressSummary {
  total: number;
  active: number;
  inProgress: number;
  completed: number;
  scheduled: number;
  overdue: number;
  percent: number;
}

export function computeTodoProgress(items: TodoItem[], now = Date.now()): TodoProgressSummary {
  const total = items.length;
  let completed = 0;
  let inProgress = 0;
  let scheduled = 0;
  let overdue = 0;
  for (const item of items) {
    const status = sanitizeTodoStatus(item.status, item.done);
    if (item.done || status === 'done') {
      completed++;
    } else {
      if (status === 'in_progress') {
        inProgress++;
      }
      if (item.remindAt !== null) {
        scheduled++;
        if (item.remindAt <= now) {
          overdue++;
        }
      }
    }
  }
  const active = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, active, inProgress, completed, scheduled, overdue, percent };
}

export function pickReminderQuote(
  prefs: TodoNotificationPrefs,
  lang: LanguageCode | string = 'en',
  seed = 0
): string {
  if (!prefs.quotesEnabled) return '';
  const idxSeed = Math.abs(Math.floor(seed));

  if (prefs.quoteMode === 'custom') {
    const cleanCustom = (prefs.customQuotes || []).map(q => q.trim()).filter(Boolean);
    if (cleanCustom.length > 0) {
      return cleanCustom[idxSeed % cleanCustom.length];
    }
  }

  if (prefs.quoteMode === 'toxic') {
    const toxicList = TOXIC_MOTIVATION_QUOTES.map(q => (lang === 'ta' ? q.tamil : q.english));
    if (toxicList.length > 0) {
      return toxicList[idxSeed % toxicList.length];
    }
  }

  const defaultList = MULTILINGUAL_QUOTES[lang as LanguageCode] || MULTILINGUAL_QUOTES.en;
  if (defaultList.length === 0) return '';
  return defaultList[idxSeed % defaultList.length];
}

export const GOD_MODE_QUOTE_TAG = 'katkaari d nitin';

export function formatReminderPayload(
  todo: Pick<TodoItem, 'title' | 'note'>,
  prefs: TodoNotificationPrefs,
  lang: LanguageCode | string = 'en',
  seed = 0,
  godMode = false
): { title: string; body: string; quote: string } {
  const cleanTitle = todo.title.trim() || 'Focus Task';
  const quote = pickReminderQuote(prefs, lang, seed);
  const quoteBlock = quote && godMode ? `${quote}\n${GOD_MODE_QUOTE_TAG}` : quote;
  const title = `Do now: ${cleanTitle}`;
  let body = '';
  if (quoteBlock && todo.note?.trim()) {
    body = `${quoteBlock} — ${todo.note.trim()}`;
  } else if (quoteBlock) {
    body = quoteBlock;
  } else if (todo.note?.trim()) {
    body = todo.note.trim();
  } else {
    body = 'Scheduled reminder from Peakus Todo.';
  }
  return { title, body, quote };
}

export function findDueTodoReminders(items: TodoItem[], now = Date.now()): TodoItem[] {
  return items.filter(item => {
    if (item.done) return false;
    if (item.remindAt === null) return false;
    if (item.remindAt > now) return false;
    if (item.remindedAt && item.remindedAt >= item.remindAt) return false;
    return true;
  });
}

export function computeQuickRemindAt(preset: QuickRemindPreset, now = Date.now()): number {
  const d = new Date(now);
  if (preset === '5m') return now + 5 * 60 * 1000;
  if (preset === '15m') return now + 15 * 60 * 1000;
  if (preset === '30m') return now + 30 * 60 * 1000;
  if (preset === '1h') return now + 60 * 60 * 1000;
  if (preset === 'tonight') {
    const target = new Date(d);
    target.setHours(20, 0, 0, 0);
    if (target.getTime() <= now + 5 * 60 * 1000) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }
  // tomorrow 9:00 AM
  const target = new Date(d);
  target.setDate(target.getDate() + 1);
  target.setHours(9, 0, 0, 0);
  return target.getTime();
}

export function formatReminderLabel(
  remindAt: number | null,
  now = Date.now()
): { timeText: string; relativeText: string; isOverdue: boolean; isSoon: boolean } {
  if (remindAt === null) {
    return { timeText: '', relativeText: '', isOverdue: false, isSoon: false };
  }
  const diffMs = remindAt - now;
  const isOverdue = diffMs <= 0;
  const absMins = Math.max(1, Math.round(Math.abs(diffMs) / 60000));
  const isSoon = !isOverdue && diffMs <= 30 * 60 * 1000;

  let relativeText = '';
  if (isOverdue) {
    if (absMins < 60) relativeText = `${absMins}m ago`;
    else {
      const hrs = Math.round(absMins / 60);
      relativeText = `${hrs}h ago`;
    }
  } else if (absMins < 60) {
    relativeText = `in ${absMins}m`;
  } else if (absMins < 24 * 60) {
    const hrs = Math.floor(absMins / 60);
    const remM = absMins % 60;
    relativeText = remM > 0 ? `in ${hrs}h ${remM}m` : `in ${hrs}h`;
  } else {
    const days = Math.round(absMins / (24 * 60));
    relativeText = `in ${days}d`;
  }

  const targetDate = new Date(remindAt);
  const nowDate = new Date(now);
  const hh = String(targetDate.getHours()).padStart(2, '0');
  const mm = String(targetDate.getMinutes()).padStart(2, '0');
  const sameDay =
    targetDate.getFullYear() === nowDate.getFullYear() &&
    targetDate.getMonth() === nowDate.getMonth() &&
    targetDate.getDate() === nowDate.getDate();

  const tomorrowDate = new Date(nowDate);
  tomorrowDate.setDate(nowDate.getDate() + 1);
  const isTomorrow =
    targetDate.getFullYear() === tomorrowDate.getFullYear() &&
    targetDate.getMonth() === tomorrowDate.getMonth() &&
    targetDate.getDate() === tomorrowDate.getDate();

  let dayPrefix = '';
  if (sameDay) dayPrefix = 'Today';
  else if (isTomorrow) dayPrefix = 'Tomorrow';
  else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    dayPrefix = `${months[targetDate.getMonth()]} ${targetDate.getDate()}`;
  }

  return {
    timeText: `${dayPrefix} ${hh}:${mm}`,
    relativeText,
    isOverdue,
    isSoon,
  };
}

export function toDateTimeLocalValue(ts: number | null): string {
  if (!ts || !Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${da}T${hh}:${mi}`;
}

export function fromDateTimeLocalValue(value: string): number | null {
  if (!value || !value.trim()) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
