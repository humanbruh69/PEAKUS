import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';
import type {
  LanguageCode,
  Task,
  TodoItem,
  TodoNotificationPrefs,
  TodoPriority,
  TodoQuoteMode,
  TodoStatus,
  TodoViewMode,
} from '../types';
import { t as translate } from '../lib/i18n';
import { uid } from '../lib/utils';
import { usePWAInstall } from '../lib/usePWAInstall';
import {
  collectTodoTags,
  computeQuickRemindAt,
  computeTodoProgress,
  cycleTodoStatus,
  DEFAULT_TODO_TAGS,
  filterTodos,
  formatReminderLabel,
  formatReminderPayload,
  GOD_MODE_QUOTE_TAG,
  fromDateTimeLocalValue,
  NOTION_TODO_EMOJIS,
  sanitizeTodoStatus,
  sortTodos,
  toDateTimeLocalValue,
  type QuickRemindPreset,
  type TodoFilter,
  type TodoSortBy,
} from '../lib/todoEngine';
import { isTodoFocusedNow, isTodoInFocusQueue } from '../lib/focusQueueSync';

interface TodoPopoverProps {
  open: boolean;
  onClose: () => void;
  todos: TodoItem[];
  onUpdateTodos: (next: TodoItem[]) => void;
  tasks?: Task[];
  onSendToFocusQueue?: (todo: TodoItem) => void;
  onRemoveFromFocusQueue?: (todo: TodoItem) => void;
  onFocusNow?: (todo: TodoItem) => void;
  godMode?: boolean;
  todoPrefs: TodoNotificationPrefs;
  onUpdateTodoPrefs: (next: TodoNotificationPrefs) => void;
  onTestReminder: (todoTitle: string) => void;
  language?: LanguageCode;
  onToast: (msg: string, type?: '' | 'err', action?: { label: string; fn: () => void }) => void;
  onConfirm: (title: string, text: string, okLabel: string, fn: () => void) => void;
}

const PRIORITY_CYCLE: TodoPriority[] = ['low', 'medium', 'high'];

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
};

const STATUS_LABEL: Record<TodoStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const SORT_LABELS: Record<TodoSortBy, string> = {
  smart: 'Smart',
  due: 'Due Date',
  priority: 'Priority',
  title: 'A–Z',
  created: 'Newest',
  manual: 'Manual',
};

const SORT_CYCLE: TodoSortBy[] = ['smart', 'due', 'priority', 'title', 'created'];

export const TodoPopover: React.FC<TodoPopoverProps> = ({
  open,
  onClose,
  todos,
  onUpdateTodos,
  tasks = [],
  onSendToFocusQueue,
  onRemoveFromFocusQueue,
  onFocusNow,
  godMode = false,
  todoPrefs,
  onUpdateTodoPrefs,
  onTestReminder,
  language = 'en',
  onToast,
  onConfirm,
}) => {
  const [viewMode, setViewMode] = useState<TodoViewMode>(todoPrefs.defaultView || 'list');
  const [filter, setFilter] = useState<TodoFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<TodoPriority | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<TodoSortBy>('smart');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState('📝');
  const [newNote, setNewNote] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [composerRemindAt, setComposerRemindAt] = useState<number | null>(null);
  const [activeComposerPreset, setActiveComposerPreset] = useState<QuickRemindPreset | null>(null);
  const [showCustomTimeInput, setShowCustomTimeInput] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [scheduleEditorId, setScheduleEditorId] = useState<string | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [customTagDraft, setCustomTagDraft] = useState('');
  const [tableQuickTitle, setTableQuickTitle] = useState('');
  const [boardDraftCol, setBoardDraftCol] = useState<TodoStatus | null>(null);
  const [boardDraftTitle, setBoardDraftTitle] = useState('');
  const [dragTodoId, setDragTodoId] = useState<string | null>(null);

  const [studioOpen, setStudioOpen] = useState(false);
  const [customQuoteInput, setCustomQuoteInput] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [nowTick, setNowTick] = useState(() => Date.now());

  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    if (todoPrefs.defaultView) {
      setViewMode(todoPrefs.defaultView);
    }
  }, [todoPrefs.defaultView]);

  useEffect(() => {
    if (!open) return;
    setNowTick(Date.now());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    const tick = setInterval(() => setNowTick(Date.now()), 30000);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTodoId) {
          setSelectedTodoId(null);
          return;
        }
        if (scheduleEditorId) {
          setScheduleEditorId(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearInterval(tick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, scheduleEditorId, selectedTodoId]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }
  }, [searchOpen]);

  const progress = useMemo(() => computeTodoProgress(todos, nowTick), [todos, nowTick]);
  const allTags = useMemo(() => collectTodoTags(todos), [todos]);
  const sortedTodos = useMemo(() => sortTodos(todos, sortBy), [todos, sortBy]);
  const visibleTodos = useMemo(
    () =>
      filterTodos(sortedTodos, filter, searchQuery, {
        priority: priorityFilter,
        tag: tagFilter,
      }),
    [sortedTodos, filter, searchQuery, priorityFilter, tagFilter]
  );

  const selectedTodo = useMemo(
    () => (selectedTodoId ? todos.find(t => t.id === selectedTodoId) || null : null),
    [todos, selectedTodoId]
  );

  const previewSampleTodo = useMemo(() => {
    const firstActive = sortedTodos.find(item => !item.done);
    return {
      title: firstActive?.title || 'Finish Organic Chem Chapter 4',
      note: firstActive?.note || '',
    };
  }, [sortedTodos]);

  const previewPayload = useMemo(
    () => formatReminderPayload(previewSampleTodo, todoPrefs, language, nowTick % 37, godMode),
    [previewSampleTodo, todoPrefs, language, nowTick, godMode]
  );

  if (!open) return null;

  const handleRequestNotifPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onToast('Browser notifications are not supported on this device.', 'err');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        onToast('Reminder notifications enabled.');
      } else if (perm === 'denied') {
        onToast('Notifications blocked in browser settings.', 'err');
      }
    } catch {
      onToast('Could not request notification permission.', 'err');
    }
  };

  const handleInstallClick = async () => {
    const accepted = await install();
    if (accepted) {
      onToast('Peakus installed! Background reminders are ready.');
    }
  };

  const handleSwitchView = (mode: TodoViewMode) => {
    setViewMode(mode);
    setSelectedTodoId(null);
    onUpdateTodoPrefs({ ...todoPrefs, defaultView: mode });
  };

  const createTodoRecord = (
    titleRaw: string,
    overrides?: Partial<TodoItem>
  ) => {
    const title = titleRaw.trim();
    if (!title) return;
    const now = Date.now();
    const status = overrides?.status || 'todo';
    const done = status === 'done';
    const created: TodoItem = {
      id: uid('td'),
      title: title.slice(0, 200),
      icon: overrides?.icon || newIcon || '📝',
      status,
      note: overrides?.note ?? newNote.trim().slice(0, 1200),
      done,
      priority: overrides?.priority || newPriority,
      tags: overrides?.tags || [],
      subtasks: overrides?.subtasks || [],
      order: todos.length + 1,
      remindAt: overrides?.remindAt !== undefined ? overrides.remindAt : composerRemindAt,
      remindedAt: null,
      createdAt: now,
      updatedAt: now,
      doneAt: done ? now : null,
    };
    onUpdateTodos([created, ...todos]);
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createTodoRecord(newTitle);
    setNewTitle('');
    setNewNote('');
    setComposerRemindAt(null);
    setActiveComposerPreset(null);
    setShowCustomTimeInput(false);
    setShowNoteComposer(false);
    inputRef.current?.focus();
  };

  const updateTodoById = (id: string, updater: (item: TodoItem) => TodoItem) => {
    onUpdateTodos(todos.map(item => (item.id === id ? updater(item) : item)));
  };

  const setTodoStatus = (id: string, nextStatus: TodoStatus) => {
    const now = Date.now();
    const nextDone = nextStatus === 'done';
    updateTodoById(id, item => ({
      ...item,
      status: nextStatus,
      done: nextDone,
      doneAt: nextDone ? now : null,
      updatedAt: now,
    }));
  };

  const handleCycleStatus = (item: TodoItem) => {
    const cur = sanitizeTodoStatus(item.status, item.done);
    const next = cycleTodoStatus(cur, item.done);
    setTodoStatus(item.id, next);
  };

  const cycleItemPriority = (id: string) => {
    const now = Date.now();
    updateTodoById(id, item => {
      const idx = PRIORITY_CYCLE.indexOf(item.priority);
      const nextP = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
      return { ...item, priority: nextP, updatedAt: now };
    });
  };

  const setItemReminder = (id: string, remindAt: number | null) => {
    const now = Date.now();
    updateTodoById(id, item => ({
      ...item,
      remindAt,
      remindedAt: null,
      updatedAt: now,
    }));
    setScheduleEditorId(null);
  };

  const commitEditTitle = (id: string) => {
    const trimmed = editTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    updateTodoById(id, item => ({
      ...item,
      title: trimmed.slice(0, 200),
      updatedAt: Date.now(),
    }));
  };

  const deleteTodo = (target: TodoItem) => {
    const snapshot = todos;
    onUpdateTodos(todos.filter(item => item.id !== target.id));
    if (selectedTodoId === target.id) setSelectedTodoId(null);
    onToast(`Removed "${target.title}"`, '', {
      label: translate('undo', language),
      fn: () => onUpdateTodos(snapshot),
    });
  };

  const duplicateTodo = (source: TodoItem) => {
    const now = Date.now();
    const copy: TodoItem = {
      ...source,
      id: uid('td'),
      title: `${source.title} (copy)`.slice(0, 200),
      subtasks: (source.subtasks || []).map(s => ({ ...s, id: uid('sub') })),
      remindedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    onUpdateTodos([copy, ...todos]);
    setSelectedTodoId(copy.id);
    onToast('Duplicated page');
  };

  const toggleTodoTag = (id: string, rawTag: string) => {
    const clean = rawTag.trim().slice(0, 24);
    if (!clean) return;
    updateTodoById(id, item => {
      const current = item.tags || [];
      const exists = current.some(t => t.toLowerCase() === clean.toLowerCase());
      const nextTags = exists
        ? current.filter(t => t.toLowerCase() !== clean.toLowerCase())
        : [...current, clean].slice(0, 8);
      return { ...item, tags: nextTags, updatedAt: Date.now() };
    });
  };

  const addTodoSubtask = (id: string, titleRaw: string) => {
    const clean = titleRaw.trim().slice(0, 160);
    if (!clean) return;
    updateTodoById(id, item => ({
      ...item,
      subtasks: [...(item.subtasks || []), { id: uid('sub'), title: clean, done: false }].slice(0, 30),
      updatedAt: Date.now(),
    }));
    setSubtaskDraft('');
  };

  const toggleTodoSubtask = (todoId: string, subId: string) => {
    updateTodoById(todoId, item => ({
      ...item,
      subtasks: (item.subtasks || []).map(s => (s.id === subId ? { ...s, done: !s.done } : s)),
      updatedAt: Date.now(),
    }));
  };

  const deleteTodoSubtask = (todoId: string, subId: string) => {
    updateTodoById(todoId, item => ({
      ...item,
      subtasks: (item.subtasks || []).filter(s => s.id !== subId),
      updatedAt: Date.now(),
    }));
  };

  const clearCompleted = () => {
    if (progress.completed === 0) return;
    onConfirm(
      'Clear completed todos?',
      'Completed todo pages will be permanently removed from this workspace.',
      translate('clearCompleted', language),
      () => {
        onUpdateTodos(todos.filter(item => !item.done));
      }
    );
  };

  const setQuoteMode = (mode: TodoQuoteMode | 'off') => {
    if (mode === 'off') {
      onUpdateTodoPrefs({ ...todoPrefs, quotesEnabled: false });
      return;
    }
    onUpdateTodoPrefs({
      ...todoPrefs,
      quotesEnabled: true,
      quoteMode: mode,
    });
    if (mode === 'custom') {
      setStudioOpen(true);
    }
  };

  const handleAddCustomQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customQuoteInput.trim().slice(0, 200);
    if (!q) return;
    const nextList = Array.from(new Set([q, ...(todoPrefs.customQuotes || [])])).slice(0, 30);
    onUpdateTodoPrefs({
      ...todoPrefs,
      quotesEnabled: true,
      quoteMode: 'custom',
      customQuotes: nextList,
    });
    setCustomQuoteInput('');
  };

  const handleDeleteCustomQuote = (quoteText: string) => {
    onUpdateTodoPrefs({
      ...todoPrefs,
      customQuotes: (todoPrefs.customQuotes || []).filter(q => q !== quoteText),
    });
  };

  const activeQuoteSelection: TodoQuoteMode | 'off' = !todoPrefs.quotesEnabled
    ? 'off'
    : todoPrefs.quoteMode;

  const activeFilterCount =
    (filter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (tagFilter ? 1 : 0);

  const ringRadius = 11;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCirc - (progress.percent / 100) * ringCirc;

  const renderStatusCheck = (item: TodoItem, onClick: (e: React.MouseEvent) => void) => {
    const status = sanitizeTodoStatus(item.status, item.done);
    return (
      <button
        type="button"
        className={`notion-check status-${status}`}
        aria-label={`Cycle status (${STATUS_LABEL[status]}) for ${item.title}`}
        title={`Status: ${STATUS_LABEL[status]} · Click to advance`}
        onClick={onClick}
      >
        {status === 'done' && <Icon name="check" />}
        {status === 'in_progress' && <Icon name="minus" />}
      </button>
    );
  };

  return (
    <div
      className="pop todo-pop notion-todo-pop"
      id="todoPopover"
      role="dialog"
      aria-label="To-dos"
    >
      {/* Notion Page Header */}
      <div className="pop-head todo-head">
        <span className="badge-ic" aria-hidden="true">
          <Icon name="todoBell" />
        </span>

        <div className="todo-head-titlewrap">
          <div className="todo-title-row">
            <h2>To-dos</h2>
            <span className="todo-beta-badge" data-testid="todoBetaBadge">
              {translate('betaLabel', language)}
            </span>
          </div>
          <span className="todo-head-sub">
            {progress.total === 0
              ? 'Master Planner & Backlog · Timed do-now alerts'
              : `Backlog · ${progress.active} open · ${progress.inProgress} in progress · ${progress.scheduled} ${
                  progress.scheduled === 1 ? 'alert' : 'alerts'
                }`}
          </span>
        </div>

        {/* Tabular completion ring */}
        <div className="todo-ring-wrap" title={`${progress.completed}/${progress.total} completed`}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <circle
              cx="14"
              cy="14"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="2.5"
            />
            <circle
              cx="14"
              cy="14"
              r={ringRadius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringDashOffset}
              transform="rotate(-90 14 14)"
              style={{ transition: 'stroke-dashoffset 0.25s ease' }}
            />
          </svg>
          <span className="todo-ring-num">
            {progress.completed}/{progress.total}
          </span>
        </div>

        <button
          type="button"
          className={`mini todo-studio-toggle ${studioOpen ? 'on' : ''}`}
          aria-label="Notification quote settings"
          aria-expanded={studioOpen}
          title="Reminder quotes & preview"
          onClick={() => setStudioOpen(prev => !prev)}
        >
          <Icon name="bell" />
        </button>

        <button
          type="button"
          className="x-btn"
          aria-label="Close Todo List"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>

      {/* Hairline Progress Bar */}
      <div className="todo-progress-track" aria-hidden="true">
        <div className="todo-progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="todo-main-scroll">
        {/* PWA Install & Notification Guidance Strip */}
        {(!isInstalled || notifPermission !== 'granted') && (
          <div className="todo-app-banner" data-testid="todoInstallBanner">
            <div className="todo-app-copy">
              <strong>
                {!isInstalled
                  ? 'Install Peakus as an app for reminder alerts'
                  : 'Enable notifications to receive do-now alerts'}
              </strong>
              <span>
                {!isInstalled
                  ? 'Reminders work reliably as system alerts once Peakus is installed as an app.'
                  : notifPermission === 'denied'
                  ? 'Alerts are blocked in your browser site settings.'
                  : 'Allow desktop/mobile notifications so scheduled todos notify you on time.'}
              </span>
            </div>
            <div className="todo-app-actions">
              {!isInstalled && isInstallable && (
                <button
                  type="button"
                  className="todo-banner-btn primary"
                  onClick={handleInstallClick}
                >
                  Install App
                </button>
              )}
              {!isInstalled && !isInstallable && (
                <button
                  type="button"
                  className="todo-banner-btn"
                  onClick={() => setShowInstallGuide(prev => !prev)}
                >
                  {showInstallGuide ? 'Hide Guide' : 'How to Install'}
                </button>
              )}
              {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                <button
                  type="button"
                  className="todo-banner-btn primary"
                  onClick={handleRequestNotifPermission}
                >
                  Enable Alerts
                </button>
              )}
            </div>
          </div>
        )}

        {showInstallGuide && !isInstalled && (
          <div className="todo-install-guide">
            {isIOS ? (
              <p>
                On iPhone/iPad Safari: tap <strong>Share</strong>, then tap{' '}
                <strong>Add to Home Screen</strong>. Open Peakus from your Home Screen and allow notifications.
              </p>
            ) : (
              <p>
                In Chrome / Edge: open the browser menu or address bar and select{' '}
                <strong>Install Peakus</strong> (or <strong>Add to Home Screen</strong> on mobile) to receive background reminders.
              </p>
            )}
          </div>
        )}

        {/* Quick Notification Quote Mode Strip */}
        <div className="todo-quote-bar">
          <span className="todo-quote-label">Alert Quote</span>
          <div className="todo-quote-seg" role="group" aria-label="Reminder notification quote style">
            {(['default', 'toxic', 'custom', 'off'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                className={activeQuoteSelection === mode ? 'on' : ''}
                data-testid={`todoQuoteMode-${mode}`}
                onClick={() => setQuoteMode(mode)}
              >
                {mode === 'default'
                  ? 'Default'
                  : mode === 'toxic'
                  ? 'Toxic'
                  : mode === 'custom'
                  ? 'Custom'
                  : 'Off'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="todo-test-btn"
            data-testid="todoTestAlertBtn"
            onClick={() => onTestReminder(previewSampleTodo.title)}
            title="Preview reminder notification now"
          >
            Test Alert
          </button>
        </div>

        {/* Expandable Quote Customization & Live Notification Preview */}
        {(studioOpen || activeQuoteSelection === 'custom') && (
          <div className="todo-studio" data-testid="todoQuoteStudio">
            <div className="todo-notif-preview">
              <div className="todo-notif-meta">
                <span>PEAKUS REMINDER PREVIEW</span>
                <span>
                  {activeQuoteSelection === 'toxic'
                    ? 'Toxic Quotes'
                    : activeQuoteSelection === 'custom'
                    ? 'Custom Quotes'
                    : activeQuoteSelection === 'default'
                    ? 'Default Quotes'
                    : 'Plain Alert'}
                </span>
              </div>
              <div className="todo-notif-title">{previewPayload.title}</div>
              <div className="todo-notif-body">{previewPayload.body}</div>
            </div>

            {activeQuoteSelection === 'custom' && (
              <div className="todo-custom-quotes">
                <form className="todo-custom-form" onSubmit={handleAddCustomQuote}>
                  <input
                    type="text"
                    placeholder="Write your own reminder quote..."
                    value={customQuoteInput}
                    onChange={e => setCustomQuoteInput(e.target.value)}
                    maxLength={200}
                  />
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={!customQuoteInput.trim()}
                  >
                    Add Quote
                  </button>
                </form>

                {(todoPrefs.customQuotes || []).length === 0 ? (
                  <div className="todo-custom-empty">
                    No custom quotes yet. Add one above — Peakus rotates them on every reminder.
                  </div>
                ) : (
                  <ul className="todo-custom-list">
                    {todoPrefs.customQuotes.map((q, idx) => (
                      <li key={`${idx}_${q}`}>
                        <div>
                          <span>“{q}”</span>
                          {godMode && <div className="quote-god-sub">{GOD_MODE_QUOTE_TAG}</div>}
                        </div>
                        <button
                          type="button"
                          className="mini"
                          aria-label={`Remove custom quote: ${q}`}
                          onClick={() => handleDeleteCustomQuote(q)}
                        >
                          <Icon name="x" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notion Page Inspector View OR Database Views */}
        {selectedTodo ? (
          <div className="notion-inspector" data-testid="notionPageInspector">
            <div className="notion-inspector-nav">
              <button
                type="button"
                className="notion-back-btn"
                onClick={() => setSelectedTodoId(null)}
              >
                <Icon name="arrowLeft" />
                <span>To-dos</span>
              </button>

              <div className="notion-inspector-actions">
                {onSendToFocusQueue && (
                  <button
                    type="button"
                    className={`notion-tool-btn ${isTodoInFocusQueue(selectedTodo, tasks) ? 'on' : ''}`}
                    onClick={() =>
                      isTodoInFocusQueue(selectedTodo, tasks) && onRemoveFromFocusQueue
                        ? onRemoveFromFocusQueue(selectedTodo)
                        : onSendToFocusQueue(selectedTodo)
                    }
                  >
                    {isTodoInFocusQueue(selectedTodo, tasks) ? 'In Focus Queue ✓' : '+ Focus Queue'}
                  </button>
                )}
                {onFocusNow && (
                  <button
                    type="button"
                    className={`todo-focus-now-btn ${isTodoFocusedNow(selectedTodo, tasks) ? 'on' : ''}`}
                    onClick={() => onFocusNow(selectedTodo)}
                  >
                    {isTodoFocusedNow(selectedTodo, tasks) ? 'Focusing' : 'Focus Now'}
                  </button>
                )}
                <button
                  type="button"
                  className="notion-tool-btn"
                  onClick={() => duplicateTodo(selectedTodo)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="notion-tool-btn danger"
                  onClick={() => deleteTodo(selectedTodo)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="notion-page-hero">
              <div className="notion-emoji-strip" role="group" aria-label="Choose page emoji">
                {NOTION_TODO_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className={(selectedTodo.icon || '📝') === emoji ? 'on' : ''}
                    onClick={() =>
                      updateTodoById(selectedTodo.id, item => ({
                        ...item,
                        icon: emoji,
                        updatedAt: Date.now(),
                      }))
                    }
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="notion-page-title-input"
                aria-label="Page title"
                value={selectedTodo.title}
                maxLength={200}
                onChange={e =>
                  updateTodoById(selectedTodo.id, item => ({
                    ...item,
                    title: e.target.value,
                    updatedAt: Date.now(),
                  }))
                }
              />
            </div>

            <div className="notion-props-grid">
              <div className="notion-prop-row">
                <span className="notion-prop-key">Status</span>
                <div className="notion-prop-val">
                  {(['todo', 'in_progress', 'done'] as const).map(st => {
                    const active = sanitizeTodoStatus(selectedTodo.status, selectedTodo.done) === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        className={`notion-status-btn status-${st} ${active ? 'on' : ''}`}
                        onClick={() => setTodoStatus(selectedTodo.id, st)}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="notion-prop-row">
                <span className="notion-prop-key">Priority</span>
                <div className="notion-prop-val">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`notion-prop-opt p-${p} ${selectedTodo.priority === p ? 'on' : ''}`}
                      onClick={() =>
                        updateTodoById(selectedTodo.id, item => ({
                          ...item,
                          priority: p,
                          updatedAt: Date.now(),
                        }))
                      }
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="notion-prop-row">
                <span className="notion-prop-key">Due & Alert</span>
                <div className="notion-prop-val col">
                  <div className="todo-quick-chips">
                    {(
                      [
                        ['5m', '+5m'],
                        ['15m', '+15m'],
                        ['1h', '+1h'],
                        ['tonight', '8 PM'],
                        ['tomorrow', '9 AM'],
                      ] as const
                    ).map(([preset, label]) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setItemReminder(
                            selectedTodo.id,
                            computeQuickRemindAt(preset as QuickRemindPreset)
                          )
                        }
                      >
                        {label}
                      </button>
                    ))}
                    {selectedTodo.remindAt !== null && (
                      <button
                        type="button"
                        className="clear"
                        onClick={() => setItemReminder(selectedTodo.id, null)}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    aria-label="Page due and alert date"
                    className="notion-date-input"
                    value={toDateTimeLocalValue(selectedTodo.remindAt)}
                    onChange={e => {
                      const ts = fromDateTimeLocalValue(e.target.value);
                      setItemReminder(selectedTodo.id, ts);
                    }}
                  />
                </div>
              </div>

              <div className="notion-prop-row">
                <span className="notion-prop-key">Tags</span>
                <div className="notion-prop-val col">
                  <div className="todo-quick-chips">
                    {Array.from(new Set([...DEFAULT_TODO_TAGS, ...(selectedTodo.tags || [])])).map(
                      tag => {
                        const selected = (selectedTodo.tags || []).some(
                          t => t.toLowerCase() === tag.toLowerCase()
                        );
                        return (
                          <button
                            key={tag}
                            type="button"
                            className={selected ? 'on' : ''}
                            onClick={() => toggleTodoTag(selectedTodo.id, tag)}
                          >
                            {tag}
                          </button>
                        );
                      }
                    )}
                  </div>
                  <form
                    className="notion-tag-add-form"
                    onSubmit={e => {
                      e.preventDefault();
                      if (!customTagDraft.trim()) return;
                      toggleTodoTag(selectedTodo.id, customTagDraft);
                      setCustomTagDraft('');
                    }}
                  >
                    <input
                      type="text"
                      placeholder="+ Custom tag..."
                      value={customTagDraft}
                      maxLength={24}
                      onChange={e => setCustomTagDraft(e.target.value)}
                    />
                    <button type="submit" disabled={!customTagDraft.trim()}>
                      Add
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="notion-blocks-section">
              <label className="notion-block-label" htmlFor="notionPageNotes">
                Notes
              </label>
              <textarea
                id="notionPageNotes"
                className="notion-notes-area"
                placeholder="Write study context, formulas, or reading notes..."
                value={selectedTodo.note || ''}
                maxLength={1200}
                onChange={e =>
                  updateTodoById(selectedTodo.id, item => ({
                    ...item,
                    note: e.target.value,
                    updatedAt: Date.now(),
                  }))
                }
              />

              <div className="notion-subtasks-wrap">
                <span className="notion-block-label">
                  Sub-tasks ({(selectedTodo.subtasks || []).filter(s => s.done).length}/
                  {(selectedTodo.subtasks || []).length})
                </span>
                {(selectedTodo.subtasks || []).length > 0 && (
                  <ul className="notion-sub-list">
                    {(selectedTodo.subtasks || []).map(sub => (
                      <li key={sub.id} className={sub.done ? 'done' : ''}>
                        <button
                          type="button"
                          className={`notion-check small ${sub.done ? 'status-done' : 'status-todo'}`}
                          aria-label={`${sub.done ? 'Uncheck' : 'Check'} subtask ${sub.title}`}
                          onClick={() => toggleTodoSubtask(selectedTodo.id, sub.id)}
                        >
                          {sub.done && <Icon name="check" />}
                        </button>
                        <span>{sub.title}</span>
                        <button
                          type="button"
                          className="mini"
                          aria-label={`Remove subtask ${sub.title}`}
                          onClick={() => deleteTodoSubtask(selectedTodo.id, sub.id)}
                        >
                          <Icon name="x" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="notion-sub-add-form"
                  onSubmit={e => {
                    e.preventDefault();
                    addTodoSubtask(selectedTodo.id, subtaskDraft);
                  }}
                >
                  <input
                    type="text"
                    placeholder="+ Add a to-do item..."
                    value={subtaskDraft}
                    maxLength={160}
                    onChange={e => setSubtaskDraft(e.target.value)}
                  />
                  <button type="submit" disabled={!subtaskDraft.trim()}>
                    Add
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Notion Database View Tabs + Filter / Sort / Search Toolbar */}
            <div className="notion-toolbar" data-testid="notionToolbar">
              <div className="notion-view-tabs" role="tablist" aria-label="Database view">
                {(
                  [
                    ['list', 'List', 'listView'],
                    ['table', 'Table', 'tableView'],
                    ['board', 'Board', 'boardView'],
                  ] as const
                ).map(([mode, label, iconName]) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === mode}
                    data-testid={`todoView-${mode}`}
                    className={`notion-view-tab ${viewMode === mode ? 'on' : ''}`}
                    onClick={() => handleSwitchView(mode)}
                  >
                    <Icon name={iconName} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="notion-tool-actions">
                <button
                  type="button"
                  className={`notion-tool-btn ${filterDrawerOpen || activeFilterCount > 0 ? 'on' : ''}`}
                  data-testid="todoFilterToggle"
                  onClick={() => setFilterDrawerOpen(prev => !prev)}
                >
                  <Icon name="filter" />
                  <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                </button>
                <button
                  type="button"
                  className={`notion-tool-btn ${sortBy !== 'smart' ? 'on' : ''}`}
                  data-testid="todoSortBtn"
                  title="Cycle sort order"
                  onClick={() => {
                    const idx = SORT_CYCLE.indexOf(sortBy);
                    setSortBy(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
                  }}
                >
                  <Icon name="sort" />
                  <span>Sort: {SORT_LABELS[sortBy]}</span>
                </button>
                <button
                  type="button"
                  className={`notion-tool-btn icon-only ${searchOpen || searchQuery ? 'on' : ''}`}
                  aria-label="Search to-dos"
                  data-testid="todoSearchToggle"
                  onClick={() => setSearchOpen(prev => !prev)}
                >
                  <Icon name="search" />
                </button>
              </div>
            </div>

            {/* Expandable Notion Search Row */}
            {(searchOpen || searchQuery) && (
              <div className="notion-search-row">
                <Icon name="search" />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search to-do titles, notes, tags, or subtasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="mini"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                  >
                    <Icon name="x" />
                  </button>
                )}
              </div>
            )}

            {/* Expandable Notion Filter Drawer */}
            {filterDrawerOpen && (
              <div className="notion-filter-drawer" data-testid="todoFilterDrawer">
                <div className="notion-filter-group">
                  <span className="notion-filter-label">Status</span>
                  <div className="todo-quick-chips">
                    {(
                      [
                        ['all', `All (${progress.total})`],
                        ['todo', 'To Do'],
                        ['in_progress', `In Progress (${progress.inProgress})`],
                        ['scheduled', `Alerts (${progress.scheduled})`],
                        ['done', `Done (${progress.completed})`],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={filter === key ? 'on' : ''}
                        onClick={() => setFilter(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="notion-filter-group">
                  <span className="notion-filter-label">Priority</span>
                  <div className="todo-quick-chips">
                    {(['all', 'high', 'medium', 'low'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        className={priorityFilter === p ? 'on' : ''}
                        onClick={() => setPriorityFilter(p)}
                      >
                        {p === 'all' ? 'Any' : PRIORITY_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>

                {allTags.length > 0 && (
                  <div className="notion-filter-group">
                    <span className="notion-filter-label">Tag</span>
                    <div className="todo-quick-chips">
                      <button
                        type="button"
                        className={!tagFilter ? 'on' : ''}
                        onClick={() => setTagFilter(null)}
                      >
                        All tags
                      </button>
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          className={tagFilter === tag ? 'on' : ''}
                          onClick={() => setTagFilter(prev => (prev === tag ? null : tag))}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {progress.completed > 0 && (
                  <div className="notion-filter-foot">
                    <button type="button" className="link-btn" onClick={clearCompleted}>
                      {translate('clearCompleted', language)}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Main View Content */}
            <div className="pop-body todo-body">
              {viewMode === 'board' ? (
                /* VIEW 3: NOTION KANBAN BOARD */
                <div className="notion-board" data-testid="todoBoardView">
                  {(
                    [
                      ['todo', 'To Do'],
                      ['in_progress', 'In Progress'],
                      ['done', 'Done'],
                    ] as const
                  ).map(([colStatus, colLabel]) => {
                    const colItems = visibleTodos.filter(
                      item => sanitizeTodoStatus(item.status, item.done) === colStatus
                    );
                    return (
                      <div
                        key={colStatus}
                        className={`notion-board-col col-${colStatus}`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const id = dragTodoId || e.dataTransfer.getData('text/plain');
                          if (id) setTodoStatus(id, colStatus);
                          setDragTodoId(null);
                        }}
                      >
                        <div className="notion-board-col-head">
                          <span className={`notion-col-title status-${colStatus}`}>
                            {colLabel}
                          </span>
                          <span className="notion-col-count">{colItems.length}</span>
                        </div>

                        <div className="notion-board-cards">
                          {colItems.map(item => {
                            const rem = formatReminderLabel(item.remindAt, nowTick);
                            const subs = item.subtasks || [];
                            const subsDone = subs.filter(s => s.done).length;
                            return (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={e => {
                                  setDragTodoId(item.id);
                                  e.dataTransfer.setData('text/plain', item.id);
                                }}
                                onDragEnd={() => setDragTodoId(null)}
                                className={`notion-board-card ${item.done ? 'done' : ''}`}
                              >
                                <div className="notion-card-top">
                                  <span className="notion-emoji-inline">{item.icon || '📝'}</span>
                                  <button
                                    type="button"
                                    className="notion-card-title-btn"
                                    onClick={() => setSelectedTodoId(item.id)}
                                  >
                                    {item.title}
                                  </button>
                                </div>
                                <div className="notion-card-meta">
                                  <span className={`todo-priority-text p-${item.priority}`}>
                                    {PRIORITY_LABEL[item.priority]}
                                  </span>
                                  {subs.length > 0 && (
                                    <>
                                      <span className="todo-meta-sep">·</span>
                                      <span>
                                        {subsDone}/{subs.length}
                                      </span>
                                    </>
                                  )}
                                  {item.remindAt !== null && (
                                    <>
                                      <span className="todo-meta-sep">·</span>
                                      <span className={rem.isOverdue ? 'is-overdue' : ''}>
                                        {rem.timeText}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {(item.tags || []).length > 0 && (
                                  <div className="notion-card-tags">
                                    {(item.tags || []).join(' · ')}
                                  </div>
                                )}
                                <div className="notion-card-foot">
                                  {onSendToFocusQueue && (
                                    <button
                                      type="button"
                                      className={isTodoInFocusQueue(item, tasks) ? 'on' : ''}
                                      onClick={() =>
                                        isTodoInFocusQueue(item, tasks) && onRemoveFromFocusQueue
                                          ? onRemoveFromFocusQueue(item)
                                          : onSendToFocusQueue(item)
                                      }
                                    >
                                      {isTodoInFocusQueue(item, tasks) ? 'Queued ✓' : '+ Queue'}
                                    </button>
                                  )}
                                  {onFocusNow && (
                                    <button
                                      type="button"
                                      className={`focus-cta ${isTodoFocusedNow(item, tasks) ? 'on' : ''}`}
                                      onClick={() => onFocusNow(item)}
                                    >
                                      {isTodoFocusedNow(item, tasks) ? 'Focusing' : 'Focus'}
                                    </button>
                                  )}
                                  {colStatus !== 'todo' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTodoStatus(
                                          item.id,
                                          colStatus === 'done' ? 'in_progress' : 'todo'
                                        )
                                      }
                                    >
                                      ← Back
                                    </button>
                                  )}
                                  {colStatus !== 'done' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTodoStatus(
                                          item.id,
                                          colStatus === 'todo' ? 'in_progress' : 'done'
                                        )
                                      }
                                    >
                                      {colStatus === 'todo' ? 'Start →' : 'Done ✓'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {boardDraftCol === colStatus ? (
                            <form
                              className="notion-board-add-form"
                              onSubmit={e => {
                                e.preventDefault();
                                if (!boardDraftTitle.trim()) return;
                                createTodoRecord(boardDraftTitle, { status: colStatus });
                                setBoardDraftTitle('');
                                setBoardDraftCol(null);
                              }}
                            >
                              <input
                                type="text"
                                autoFocus
                                placeholder="Page title..."
                                value={boardDraftTitle}
                                onChange={e => setBoardDraftTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') {
                                    setBoardDraftCol(null);
                                    setBoardDraftTitle('');
                                  }
                                }}
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="notion-board-new-btn"
                              onClick={() => {
                                setBoardDraftCol(colStatus);
                                setBoardDraftTitle('');
                              }}
                            >
                              + New
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : viewMode === 'table' ? (
                /* VIEW 2: NOTION DATABASE TABLE (Matching Image 2!) */
                <div className="notion-table-wrap" data-testid="todoTableView">
                  <table className="notion-table">
                    <thead>
                      <tr>
                        <th className="col-check" aria-label="Status checkbox">
                          ◌
                        </th>
                        <th>Aa Task name</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Due</th>
                        <th>Tags</th>
                        <th>Timer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTodos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="notion-table-empty">
                            No to-dos match this filter. Add a new row below.
                          </td>
                        </tr>
                      ) : (
                        visibleTodos.map(item => {
                          const status = sanitizeTodoStatus(item.status, item.done);
                          const rem = formatReminderLabel(item.remindAt, nowTick);
                          const subs = item.subtasks || [];
                          const subsDone = subs.filter(s => s.done).length;
                          return (
                            <tr key={item.id} className={item.done ? 'done' : ''}>
                              <td className="col-check">
                                {renderStatusCheck(item, () => handleCycleStatus(item))}
                              </td>
                              <td className="col-title">
                                <div className="notion-table-title-cell">
                                  <button
                                    type="button"
                                    className="notion-emoji-btn"
                                    title="Cycle icon"
                                    onClick={() => {
                                      const cur = item.icon || '📝';
                                      const idx = NOTION_TODO_EMOJIS.indexOf(cur);
                                      updateTodoById(item.id, row => ({
                                        ...row,
                                        icon: NOTION_TODO_EMOJIS[(idx + 1) % NOTION_TODO_EMOJIS.length],
                                        updatedAt: Date.now(),
                                      }));
                                    }}
                                  >
                                    {item.icon || '📝'}
                                  </button>
                                  <button
                                    type="button"
                                    className="notion-table-open-title"
                                    onClick={() => setSelectedTodoId(item.id)}
                                  >
                                    {item.title}
                                  </button>
                                  {subs.length > 0 && (
                                    <span className="notion-sub-ratio">
                                      {subsDone}/{subs.length}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <select
                                  aria-label={`Status for ${item.title}`}
                                  className={`notion-status-select status-${status}`}
                                  value={status}
                                  onChange={e =>
                                    setTodoStatus(item.id, e.target.value as TodoStatus)
                                  }
                                >
                                  <option value="todo">To Do</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="done">Done</option>
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className={`todo-priority-text p-${item.priority}`}
                                  onClick={() => cycleItemPriority(item.id)}
                                >
                                  <span className="todo-p-dot" aria-hidden="true" />
                                  {PRIORITY_LABEL[item.priority]}
                                </button>
                              </td>
                              <td className="col-due">
                                <button
                                  type="button"
                                  className={`notion-due-cell-btn ${
                                    !item.done && rem.isOverdue ? 'is-overdue' : ''
                                  }`}
                                  onClick={() => setSelectedTodoId(item.id)}
                                >
                                  {item.remindAt !== null ? rem.timeText : 'Add date'}
                                </button>
                              </td>
                              <td className="col-tags">
                                {(item.tags || []).length > 0
                                  ? (item.tags || []).join(' · ')
                                  : '—'}
                              </td>
                              <td className="col-focus">
                                <div className="notion-table-focus-actions">
                                  {onSendToFocusQueue && (
                                    <button
                                      type="button"
                                      className={`todo-queue-btn compact ${isTodoInFocusQueue(item, tasks) ? 'on' : ''}`}
                                      onClick={() =>
                                        isTodoInFocusQueue(item, tasks) && onRemoveFromFocusQueue
                                          ? onRemoveFromFocusQueue(item)
                                          : onSendToFocusQueue(item)
                                      }
                                    >
                                      {isTodoInFocusQueue(item, tasks) ? 'In Queue' : '+ Queue'}
                                    </button>
                                  )}
                                  {onFocusNow && (
                                    <button
                                      type="button"
                                      className={`todo-focus-now-btn compact ${isTodoFocusedNow(item, tasks) ? 'on' : ''}`}
                                      onClick={() => onFocusNow(item)}
                                    >
                                      {isTodoFocusedNow(item, tasks) ? 'Focusing' : 'Focus Now'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                      <tr className="notion-table-new-row">
                        <td className="col-check">+</td>
                        <td colSpan={6}>
                          <form
                            className="notion-table-add-form"
                            onSubmit={e => {
                              e.preventDefault();
                              if (!tableQuickTitle.trim()) return;
                              createTodoRecord(tableQuickTitle);
                              setTableQuickTitle('');
                            }}
                          >
                            <input
                              type="text"
                              placeholder="New to-do page (press Enter)..."
                              value={tableQuickTitle}
                              maxLength={200}
                              onChange={e => setTableQuickTitle(e.target.value)}
                            />
                          </form>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : visibleTodos.length === 0 ? (
                <div className="pop-empty todo-empty">
                  <strong>
                    {searchQuery || activeFilterCount > 0
                      ? 'No matching to-dos'
                      : 'Your Notion to-do space is clear'}
                  </strong>
                  <span>
                    {searchQuery || activeFilterCount > 0
                      ? 'Try clearing your search or filters.'
                      : 'Add a page below, switch between List / Table / Board, or set a timed do-now alert.'}
                  </span>
                </div>
              ) : (
                /* VIEW 1: NOTION LIST */
                <ul className="todo-list" data-testid="todoList">
                  {visibleTodos.map(item => {
                    const status = sanitizeTodoStatus(item.status, item.done);
                    const isEditing = editingId === item.id;
                    const isScheduling = scheduleEditorId === item.id;
                    const remInfo = formatReminderLabel(item.remindAt, nowTick);
                    const subs = item.subtasks || [];
                    const subsDone = subs.filter(s => s.done).length;
                    const alreadyNotified =
                      item.remindedAt !== null &&
                      item.remindedAt !== undefined &&
                      item.remindAt !== null &&
                      item.remindedAt >= item.remindAt;

                    return (
                      <li
                        key={item.id}
                        className={`todo-item ${item.done ? 'done' : ''} ${
                          !item.done && remInfo.isOverdue ? 'overdue' : ''
                        }`}
                      >
                        <div className="todo-item-row">
                          {renderStatusCheck(item, () => handleCycleStatus(item))}

                          <button
                            type="button"
                            className="notion-emoji-btn"
                            title="Cycle icon"
                            aria-label={`Change icon for ${item.title}`}
                            onClick={() => {
                              const cur = item.icon || '📝';
                              const idx = NOTION_TODO_EMOJIS.indexOf(cur);
                              updateTodoById(item.id, row => ({
                                ...row,
                                icon: NOTION_TODO_EMOJIS[(idx + 1) % NOTION_TODO_EMOJIS.length],
                                updatedAt: Date.now(),
                              }));
                            }}
                          >
                            {item.icon || '📝'}
                          </button>

                          <div className="todo-item-main">
                            {isEditing ? (
                              <input
                                className="task-edit"
                                value={editTitle}
                                autoFocus
                                onChange={e => setEditTitle(e.target.value)}
                                onBlur={() => commitEditTitle(item.id)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEditTitle(item.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                            ) : (
                              <div className="notion-title-line">
                                <button
                                  type="button"
                                  className="todo-item-title-btn"
                                  onClick={() => setSelectedTodoId(item.id)}
                                  onDoubleClick={e => {
                                    e.stopPropagation();
                                    setEditingId(item.id);
                                    setEditTitle(item.title);
                                  }}
                                >
                                  {item.title}
                                </button>
                                <button
                                  type="button"
                                  className="notion-open-pill"
                                  onClick={() => setSelectedTodoId(item.id)}
                                >
                                  Open
                                </button>
                              </div>
                            )}

                            {item.note && <div className="todo-item-note">{item.note}</div>}

                            <div className="todo-item-meta">
                              <span className={`notion-status-text status-${status}`}>
                                {STATUS_LABEL[status]}
                              </span>
                              <button
                                type="button"
                                className={`todo-priority-text p-${item.priority}`}
                                onClick={() => cycleItemPriority(item.id)}
                                title="Click to cycle priority"
                              >
                                <span className="todo-p-dot" aria-hidden="true" />
                                {PRIORITY_LABEL[item.priority]}
                              </button>

                              {subs.length > 0 && (
                                <span className="todo-rem-text">
                                  {subsDone}/{subs.length} subtasks
                                </span>
                              )}

                              {(item.tags || []).length > 0 && (
                                <span className="todo-rem-text">
                                  {(item.tags || []).join(' / ')}
                                </span>
                              )}

                              {item.remindAt !== null && (
                                <span
                                  className={`todo-rem-text ${
                                    !item.done && remInfo.isOverdue
                                      ? 'is-overdue'
                                      : remInfo.isSoon
                                      ? 'is-soon'
                                      : ''
                                  }`}
                                >
                                  {remInfo.timeText} ({remInfo.relativeText})
                                  {alreadyNotified && !item.done ? ' · Notified' : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="todo-item-actions">
                            {onSendToFocusQueue && (
                              <button
                                type="button"
                                data-testid="todoQueueBtn"
                                className={`todo-queue-btn ${isTodoInFocusQueue(item, tasks) ? 'on' : ''}`}
                                aria-label={
                                  isTodoInFocusQueue(item, tasks)
                                    ? `Remove ${item.title} from Focus Queue`
                                    : `Send ${item.title} to Focus Queue`
                                }
                                title={
                                  isTodoInFocusQueue(item, tasks)
                                    ? 'Synced in Focus Queue (Tasks) · Click to unpin'
                                    : 'Send to Today’s Focus Queue (Tasks)'
                                }
                                onClick={() =>
                                  isTodoInFocusQueue(item, tasks) && onRemoveFromFocusQueue
                                    ? onRemoveFromFocusQueue(item)
                                    : onSendToFocusQueue(item)
                                }
                              >
                                {isTodoInFocusQueue(item, tasks) ? 'In Queue' : '+ Queue'}
                              </button>
                            )}
                            {onFocusNow && (
                              <button
                                type="button"
                                data-testid="todoFocusNowBtn"
                                className={`todo-focus-now-btn ${isTodoFocusedNow(item, tasks) ? 'on' : ''}`}
                                aria-label={`Focus now on ${item.title}`}
                                title="Pin straight to main timer & log focus stats"
                                onClick={() => onFocusNow(item)}
                              >
                                <Icon name="target" />
                                <span>{isTodoFocusedNow(item, tasks) ? 'Focusing' : 'Focus Now'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className={`mini ${item.remindAt !== null ? 'on' : ''}`}
                              aria-label={`Set reminder for ${item.title}`}
                              title="Set or update reminder"
                              onClick={() =>
                                setScheduleEditorId(prev => (prev === item.id ? null : item.id))
                              }
                            >
                              <Icon name="bell" />
                            </button>
                            <button
                              type="button"
                              className="mini"
                              aria-label={`Delete ${item.title}`}
                              title={translate('delete', language)}
                              onClick={() => deleteTodo(item)}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </div>

                        {isScheduling && (
                          <div className="todo-inline-scheduler">
                            <div className="todo-quick-chips">
                              {(
                                [
                                  ['5m', '+5m'],
                                  ['15m', '+15m'],
                                  ['1h', '+1h'],
                                  ['tonight', '8 PM'],
                                  ['tomorrow', '9 AM'],
                                ] as const
                              ).map(([preset, label]) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() =>
                                    setItemReminder(
                                      item.id,
                                      computeQuickRemindAt(preset as QuickRemindPreset)
                                    )
                                  }
                                >
                                  {label}
                                </button>
                              ))}
                              {item.remindAt !== null && (
                                <button
                                  type="button"
                                  className="clear"
                                  onClick={() => setItemReminder(item.id, null)}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <input
                              type="datetime-local"
                              aria-label={`Custom reminder date and time for ${item.title}`}
                              value={toDateTimeLocalValue(item.remindAt)}
                              onChange={e => {
                                const ts = fromDateTimeLocalValue(e.target.value);
                                if (ts) setItemReminder(item.id, ts);
                              }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Composer (pinned cleanly in database views) */}
      {!selectedTodo && (
        <div className="pop-foot todo-foot">
          <form className="todo-composer" onSubmit={handleAddTodo}>
            <div className="todo-composer-top">
              <button
                type="button"
                className="notion-emoji-btn composer"
                title="Cycle page icon"
                aria-label="Cycle new todo emoji icon"
                onClick={() => {
                  const idx = NOTION_TODO_EMOJIS.indexOf(newIcon);
                  setNewIcon(NOTION_TODO_EMOJIS[(idx + 1) % NOTION_TODO_EMOJIS.length]);
                }}
              >
                {newIcon}
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="What do you need to do?"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={200}
              />
              <button
                type="submit"
                className="btn primary"
                aria-label="Add todo"
                disabled={!newTitle.trim()}
              >
                <Icon name="plus" />
              </button>
            </div>

            {showNoteComposer && (
              <input
                type="text"
                className="todo-note-input"
                placeholder="Optional short context or chapter..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                maxLength={1200}
              />
            )}

            <div className="todo-composer-bar">
              <button
                type="button"
                className={`todo-prio-btn p-${newPriority}`}
                onClick={() => {
                  const idx = PRIORITY_CYCLE.indexOf(newPriority);
                  setNewPriority(PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]);
                }}
                title="Cycle priority"
              >
                <span className="todo-p-dot" aria-hidden="true" />
                {PRIORITY_LABEL[newPriority]}
              </button>

              <div className="todo-quick-chips">
                {(
                  [
                    ['15m', '+15m'],
                    ['30m', '+30m'],
                    ['1h', '+1h'],
                    ['tonight', '8 PM'],
                  ] as const
                ).map(([preset, label]) => {
                  const active = activeComposerPreset === preset && !showCustomTimeInput;
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={active ? 'on' : ''}
                      onClick={() => {
                        setShowCustomTimeInput(false);
                        setActiveComposerPreset(preset);
                        setComposerRemindAt(computeQuickRemindAt(preset as QuickRemindPreset));
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={showCustomTimeInput ? 'on' : ''}
                  onClick={() => {
                    setActiveComposerPreset(null);
                    setShowCustomTimeInput(prev => !prev);
                  }}
                >
                  Pick Time
                </button>
                <button
                  type="button"
                  className={showNoteComposer ? 'on' : ''}
                  onClick={() => setShowNoteComposer(prev => !prev)}
                >
                  + Note
                </button>
              </div>
            </div>

            {(composerRemindAt !== null || showCustomTimeInput) && (
              <div className="todo-composer-remind-row">
                <span className="todo-rem-badge">
                  <Icon name="bell" />
                  {composerRemindAt
                    ? `Alert: ${formatReminderLabel(composerRemindAt, nowTick).timeText}`
                    : 'Choose alert date & time'}
                </span>
                <input
                  type="datetime-local"
                  aria-label="Custom reminder time"
                  value={toDateTimeLocalValue(composerRemindAt)}
                  onChange={e => {
                    setActiveComposerPreset(null);
                    setComposerRemindAt(fromDateTimeLocalValue(e.target.value));
                  }}
                />
                {composerRemindAt !== null && (
                  <button
                    type="button"
                    className="mini"
                    aria-label="Clear reminder time"
                    onClick={() => {
                      setComposerRemindAt(null);
                      setActiveComposerPreset(null);
                      setShowCustomTimeInput(false);
                    }}
                  >
                    <Icon name="x" />
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
