import { U } from './utils';
import { DEFAULTS } from './constants';
import { Settings, TasksState, HistoryState, TimerState, NotesDoc, BackgroundConfig, Task, Session } from '../types';

export const Store = (() => {
  const K = {
    settings: 'foco.settings.v1',
    tasks: 'foco.tasks.v1',
    history: 'foco.history.v1',
    timer: 'foco.timer.v1',
    notes: 'foco.notes.v1',
  };

  const mem = new Map<string, string>();
  let lsOk = true;
  try {
    const t = '__foco_t';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
  } catch {
    lsOk = false;
  }

  function read<T>(key: string, fallback: T): T {
    try {
      const raw = lsOk ? localStorage.getItem(key) : mem.get(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key: string, value: any): boolean {
    const raw = JSON.stringify(value);
    if (!lsOk) {
      mem.set(key, raw);
      return true;
    }
    try {
      localStorage.setItem(key, raw);
      return true;
    } catch (e) {
      console.warn('Storage failed', e);
      return false;
    }
  }

  function normBg(bg: any): BackgroundConfig | null {
    if (!U.isObj(bg)) return null;
    if (bg.kind === 'scene' && typeof bg.id === 'string') return { kind: 'scene', id: bg.id };
    if (bg.kind === 'color' && U.isHex(bg.color)) return { kind: 'color', color: bg.color };
    if (bg.kind === 'upload' && typeof bg.id === 'string') return { kind: 'upload', id: bg.id };
    if (bg.kind === 'youtube' && typeof bg.youtubeId === 'string') {
      return { kind: 'youtube', youtubeId: bg.youtubeId, youtubeTitle: bg.youtubeTitle || '' };
    }
    if (bg.kind === 'videoUpload' && typeof bg.videoUploadId === 'string') {
      return { kind: 'videoUpload', videoUploadId: bg.videoUploadId, videoName: bg.videoName || '' };
    }
    if (bg.kind === 'videoUrl' && typeof bg.videoUrl === 'string') {
      return { kind: 'videoUrl', videoUrl: bg.videoUrl, videoName: bg.videoName || '' };
    }
    return null;
  }

  function intIn(v: any, a: number, b: number, d: number | null): number {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? U.clamp(n, a, b) : (d ?? a);
  }

  function normSettings(raw: any): Settings {
    const s: Settings = U.deepMerge(DEFAULTS, U.isObj(raw) ? raw : {});
    if (!['en', 'ta', 'es'].includes(s.language)) s.language = 'en';
    s.sounds.levels = Object.assign({}, DEFAULTS.sounds.levels, U.isObj(raw?.sounds?.levels) ? raw.sounds.levels : {});
    for (const k of Object.keys(s.sounds.levels)) {
      s.sounds.levels[k] = U.clamp(Number(s.sounds.levels[k]) || 0, 0, 100);
    }
    if (!['home', 'focus', 'ambient'].includes(s.mode)) s.mode = 'focus';
    for (const m of ['home', 'focus', 'ambient'] as const) {
      const mm = s.modes[m];
      const bg = raw?.modes?.[m]?.bg;
      mm.bg = normBg(bg) || U.clone(DEFAULTS.modes[m].bg);
      mm.dim = U.clamp(+mm.dim || 0, 0, 90);
      mm.blur = U.clamp(+mm.blur || 0, 0, 30);
      mm.posX = U.clamp(+mm.posX, 0, 100);
      mm.posY = U.clamp(+mm.posY, 0, 100);
      if (Number.isNaN(mm.posX)) mm.posX = 50;
      if (Number.isNaN(mm.posY)) mm.posY = 50;
    }
    const t = s.timer;
    t.focus = intIn(t.focus, 1, 240, 50);
    t.short = intIn(t.short, 1, 120, 10);
    t.long = intIn(t.long, 1, 180, 20);
    t.cycles = intIn(t.cycles, 1, 12, 4);
    t.countdown = intIn(t.countdown, 1, 600, 50);
    t.volume = intIn(t.volume, 0, 100, 65);
    t.streakGoal = intIn(t.streakGoal, 1, 600, 25);
    if (!['pomodoro', 'countdown'].includes(t.mode)) t.mode = 'pomodoro';
    if (!['emoji', 'dots', 'numbers', 'none'].includes(t.tallies)) t.tallies = 'emoji';
    if (typeof t.tallyTheme !== 'string') t.tallyTheme = DEFAULTS.timer.tallyTheme || 'growing_tree';
    if (!Array.isArray(t.customTallyEmojis)) {
      t.customTallyEmojis = DEFAULTS.timer.customTallyEmojis || ['🌰', '🌱', '🌿', '🌳'];
    }
    if (typeof t.label !== 'string') t.label = DEFAULTS.timer.label;
    t.label = t.label.slice(0, 120);

    const c = s.clock;
    if (!['12', '24'].includes(c.format)) c.format = '12';
    if (!['bold', 'thin', 'minimal', 'serif', 'hand', 'minimal-light', 'serif-condensed'].includes(c.style)) c.style = 'bold';
    c.size = intIn(c.size, 50, 170, 100);
    if (!U.isHex(c.color)) c.color = '#ffffff';

    if (!U.isHex(s.appearance.accent)) s.appearance.accent = DEFAULTS.appearance.accent;
    if (!['auto', 'on', 'off'].includes(s.appearance.animation)) s.appearance.animation = 'auto';
    s.appearance.autoHideDelay = intIn(s.appearance.autoHideDelay, 2, 60, 5);

    if (!['daily', 'hourly', 'visit'].includes(s.quotes.rotation)) s.quotes.rotation = 'daily';
    s.quotes.custom = String(s.quotes.custom || '').slice(0, 200);
    s.name = String(s.name || '').slice(0, 40);
    s.sounds.master = intIn(s.sounds.master, 0, 100, 70);

    if (!s.music || !U.isObj(s.music)) s.music = U.clone(DEFAULTS.music);
    s.music.volume = intIn(s.music.volume, 0, 100, 70);
    if (typeof s.music.youtubeId !== 'string') s.music.youtubeId = DEFAULTS.music.youtubeId;
    if (typeof s.music.title !== 'string') s.music.title = DEFAULTS.music.title;
    s.music.enabled = s.music.enabled ?? true;
    s.music.playing = !!s.music.playing;

    return s;
  }

  function normTasks(raw: any): TasksState {
    const out: TasksState = { items: [], activeId: null, orderAt: 0, activeAt: 0, deleted: {} };
    if (!U.isObj(raw) || !Array.isArray(raw.items)) return out;
    out.orderAt = Number(raw.orderAt) || 0;
    out.activeAt = Number(raw.activeAt) || 0;
    if (U.isObj(raw.deleted)) {
      for (const [k, v] of Object.entries(raw.deleted)) {
        if (Number.isFinite(+v)) out.deleted[k] = +v;
      }
    }
    for (const t of raw.items) {
      if (!U.isObj(t) || typeof t.title !== 'string' || !t.title.trim()) continue;
      out.items.push({
        id: typeof t.id === 'string' ? t.id : U.uid('t'),
        title: t.title.slice(0, 200),
        done: !!t.done,
        createdAt: Number(t.createdAt) || Date.now(),
        doneAt: t.doneAt ? Number(t.doneAt) : null,
        updatedAt: Number(t.updatedAt) || Number(t.createdAt) || 0,
        estimate: t.estimate ? intIn(t.estimate, 1, 1440, null) : null,
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks
              .filter(x => U.isObj(x) && typeof x.title === 'string' && x.title.trim())
              .map(x => ({ id: typeof x.id === 'string' ? x.id : U.uid('s'), title: x.title.slice(0, 200), done: !!x.done }))
          : [],
      });
    }
    out.activeId = out.items.some(t => t.id === raw.activeId) ? raw.activeId : null;
    return out;
  }

  function normHistory(raw: any): HistoryState {
    const out: HistoryState = { sessions: [], taskDone: [], deleted: {}, doneDeleted: {}, clearedAt: 0 };
    if (!U.isObj(raw)) return out;
    out.clearedAt = Number(raw.clearedAt) || 0;
    for (const f of ['deleted', 'doneDeleted'] as const) {
      if (U.isObj(raw[f])) {
        for (const [k, v] of Object.entries(raw[f])) {
          if (Number.isFinite(+v)) out[f][k] = +v;
        }
      }
    }
    const seen = new Set<string>();
    if (Array.isArray(raw.sessions)) {
      for (const s of raw.sessions) {
        if (!U.isObj(s) || typeof s.id !== 'string' || seen.has(s.id)) continue;
        if (!['focus', 'break'].includes(s.kind)) continue;
        const start = Number(s.start), end = Number(s.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
        let runs: [number, number][] = Array.isArray(s.runs)
          ? s.runs
              .filter(r => Array.isArray(r) && r.length === 2 && Number.isFinite(+r[0]) && Number.isFinite(+r[1]) && +r[1] >= +r[0])
              .map(r => [+r[0], +r[1]])
          : [];
        if (!runs.length) runs = [[start, end]];
        const ms = runs.reduce((a, r) => a + (r[1] - r[0]), 0);
        seen.add(s.id);
        out.sessions.push({
          id: s.id,
          kind: s.kind,
          start,
          end,
          runs,
          ms,
          plannedMs: Number(s.plannedMs) || ms,
          completed: !!s.completed,
          taskId: typeof s.taskId === 'string' ? s.taskId : null,
          title: typeof s.title === 'string' ? s.title.slice(0, 200) : '',
          phase: typeof s.phase === 'string' ? s.phase : s.kind,
        });
      }
    }
    out.sessions.sort((a, b) => a.start - b.start);
    if (Array.isArray(raw.taskDone)) {
      for (const d of raw.taskDone) {
        if (U.isObj(d) && typeof d.taskId === 'string' && Number.isFinite(+d.at)) {
          out.taskDone.push({ taskId: d.taskId, title: String(d.title || '').slice(0, 200), at: +d.at });
        }
      }
    }
    return out;
  }

  return {
    K,
    persistent: () => lsOk,
    loadSettings: () => normSettings(read(K.settings, {})),
    saveSettings: (s: Settings) => write(K.settings, s),
    loadTasks: () => normTasks(read(K.tasks, {})),
    saveTasks: (t: TasksState) => write(K.tasks, t),
    loadTaskItems: (): Task[] => {
      const state = normTasks(read(K.tasks, {}));
      return state.items.map(t => ({
        ...t,
        active: t.id === state.activeId,
        deleted: !!state.deleted[t.id],
      }));
    },
    saveTaskItems: (items: Task[], activeId?: string | null) => {
      const prev = normTasks(read(K.tasks, {}));
      const act = activeId !== undefined ? activeId : items.find(t => t.active && !t.deleted)?.id || null;
      const deleted = { ...prev.deleted };
      items.forEach(t => {
        if (t.deleted) deleted[t.id] = Date.now();
      });
      write(K.tasks, {
        v: 1,
        items: items.filter(t => !t.deleted),
        activeId: act,
        orderAt: Date.now(),
        activeAt: Date.now(),
        deleted,
      });
    },
    loadHistory: () => normHistory(read(K.history, {})),
    saveHistory: (h: HistoryState) => write(K.history, h),
    loadSessions: (): Session[] => normHistory(read(K.history, {})).sessions,
    saveSessions: (sessions: Session[]) => {
      const prev = normHistory(read(K.history, {}));
      write(K.history, {
        ...prev,
        sessions,
      });
    },
    loadTimer: () => read<TimerState | null>(K.timer, null),
    saveTimer: (t: TimerState) => write(K.timer, t),
    loadNotesDoc: (): NotesDoc => {
      const n: any = read<any>(K.notes, '');
      return typeof n === 'string'
        ? { text: n, at: 0 }
        : U.isObj(n) && typeof n.text === 'string'
        ? { text: n.text.slice(0, 20000), at: Number(n.at) || 0 }
        : { text: '', at: 0 };
    },
    loadNotes: () => Store.loadNotesDoc().text,
    saveNotes: (n: string, at = Date.now()) => write(K.notes, { text: String(n).slice(0, 20000), at }),
    normSettings,
    normTasks,
    normHistory,
    defaults: () => U.clone(DEFAULTS),
  };
})();
