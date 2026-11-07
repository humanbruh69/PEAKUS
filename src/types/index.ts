export type AppMode = 'home' | 'focus' | 'ambient';
export type ModeKey = AppMode;
export type TimerPhase = 'focus' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused';
export type ClockFormat = '12' | '24';
export type ClockStyle =
  | 'bold'
  | 'thin'
  | 'minimal'
  | 'serif'
  | 'hand'
  | 'minimal-light'
  | 'serif-condensed';
export type TimerStyle = 'default' | 'flip' | 'bar' | 'gauge' | 'dots' | 'pie';
export type TalliesStyle = 'emoji' | 'dots' | 'numbers' | 'none';
export type QuoteRotation = 'daily' | 'hourly' | 'visit';
export type AnimationMode = 'auto' | 'on' | 'off';
export type LanguageCode = 'en' | 'ta' | 'es';

export interface BackgroundConfig {
  kind: 'scene' | 'color' | 'upload' | 'youtube' | 'videoUpload' | 'videoUrl';
  id?: string;
  color?: string;
  youtubeId?: string;
  youtubeTitle?: string;
  videoUploadId?: string;
  videoName?: string;
  videoUrl?: string;
}

export interface ModeConfig {
  bg: BackgroundConfig;
  dim: number;
  blur: number;
  posX: number;
  posY: number;
}

export interface ClockSettings {
  format: ClockFormat;
  seconds: boolean;
  flip: boolean;
  date: boolean;
  greetings: boolean;
  dynamicGreetings: boolean;
  style: ClockStyle;
  size: number;
  color: string;
}

export interface TimerSettings {
  mode: 'pomodoro' | 'countdown';
  focus: number;
  short: number;
  long: number;
  cycles: number;
  countdown: number;
  etaMode: boolean;
  style: TimerStyle;
  progressBar: boolean;
  notify: boolean;
  autoBreak: boolean;
  autoFocus: boolean;
  showStreak: boolean;
  tallies: TalliesStyle;
  tallyTheme?: string;
  customTallyEmojis?: string[];
  sound: string;
  volume: number;
  label: string;
  streakGoal: number;
  flowMode?: boolean;
}

export interface QuotesSettings {
  show: boolean;
  rotation: QuoteRotation;
  custom: string;
  useCustom: boolean;
}

export interface AppearanceSettings {
  accent: string;
  showLogo: boolean;
  animation: AnimationMode;
  autoHide: boolean;
  autoHideDelay: number;
}

export interface SoundsSettings {
  master: number;
  levels: Record<string, number>;
  active?: string[];
}

export interface MusicSettings {
  enabled: boolean;
  playing: boolean;
  volume: number;
  youtubeId: string;
  title: string;
  streamUrl?: string;
}

export interface Settings {
  version: number;
  _at: number;
  name: string;
  language: LanguageCode;
  mode: AppMode;
  modes: {
    home: ModeConfig;
    focus: ModeConfig;
    ambient: ModeConfig;
  };
  clock: ClockSettings;
  timer: TimerSettings;
  quotes: QuotesSettings;
  appearance: AppearanceSettings;
  sounds: SoundsSettings;
  music: MusicSettings;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
  doneAt?: number | null;
  estimate?: number | null;
  subtasks: Subtask[];
  order?: number;
  active?: boolean;
  deleted?: boolean;
}

export interface TasksState {
  items: Task[];
  activeId: string | null;
  orderAt: number;
  activeAt: number;
  deleted: Record<string, number>;
}

export interface Session {
  id: string;
  kind: 'focus' | 'break' | TimerPhase;
  phase?: string;
  start: number;
  end: number;
  runs?: [number, number][];
  ms: number;
  plannedMs?: number;
  completed: boolean;
  taskId?: string | null;
  title?: string;
}

export interface TaskDoneRecord {
  taskId: string;
  title: string;
  at: number;
}

export interface HistoryState {
  sessions: Session[];
  taskDone: TaskDoneRecord[];
  deleted: Record<string, number>;
  doneDeleted: Record<string, number>;
  clearedAt: number;
}

export interface TimerState {
  v?: number;
  phase: TimerPhase;
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  elapsedMs?: number;
  runStart?: number | null;
  runs?: [number, number][];
  segStart?: number | null;
  cycle: number;
  segId?: string | null;
  taskId?: string | null;
  title?: string;
  updatedAt?: number;
  startedAt?: number | null;
  sessionStartedAt?: number | null;
  interrupted?: boolean;
}

export interface NotesDoc {
  text: string;
  at: number;
}

export interface Toast {
  id: string;
  msg: string;
  type?: 'err' | '';
  action?: {
    label: string;
    fn: () => void;
  };
}

export interface StreakInfo {
  current: number;
  best: number;
  todayCounts: boolean;
}

export interface ComputedStats {
  range: { a: number; b: number; prev?: { a: number; b: number }; prevLabel?: string };
  focus: number;
  prevFocus: number | null;
  change: number | null;
  completed: number;
  interrupted: number;
  breakMs: number;
  tasksDone: number;
  avgPerDay: number;
  streak: StreakInfo;
  days: Map<string, number>;
  dist: { name: string; ms: number; task: boolean }[];
  list: Session[];
}

export interface SyncMeta {
  key: string;
  connected: boolean;
  lastSync: number;
  lastError: string;
}

export type ServerStatus = 'unknown' | 'ok' | 'not_configured' | 'unavailable' | 'error';

export interface SyncDoc {
  v: number;
  settings?: Settings;
  tasks?: TasksState | any;
  history?: HistoryState | any;
  notes?: NotesDoc;
}
