import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import type { Task, LanguageCode } from '../types';
import { uid } from '../lib/utils';
import { Store } from '../lib/store';
import { sync } from '../lib/sync';
import { t as translate } from '../lib/i18n';

const TASK_EMOJIS = ['📋', '📚', '✍️', '💻', '🎯', '⚡', '🧪', '📝'];
const ESTIMATE_PRESETS = [15, 25, 30, 45, 60];

interface TasksPopoverProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  language?: LanguageCode;
  onToast: (msg: string, type?: '' | 'err', action?: { label: string; fn: () => void }) => void;
  onConfirm: (title: string, text: string, okLabel: string, fn: () => void) => void;
}

export const TasksPopover: React.FC<TasksPopoverProps> = ({
  open,
  onClose,
  tasks,
  onUpdateTasks,
  language = 'en',
  onToast,
  onConfirm,
}) => {
  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEstimate, setNewEstimate] = useState<number>(30);
  const [newIcon, setNewIcon] = useState<string>('📋');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subInput, setSubInput] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = language;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (composerOpen) {
          setComposerOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, composerOpen]);

  useEffect(() => {
    if (composerOpen) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [composerOpen]);

  if (!open) return null;

  const activeTasks = tasks
    .filter(t => !t.deleted && !t.done)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const doneTasks = tasks
    .filter(t => !t.deleted && t.done)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const allVisibleCount = activeTasks.length + doneTasks.length;

  const saveTasks = (nextTasks: Task[]) => {
    onUpdateTasks(nextTasks);
    Store.saveTaskItems(nextTasks);
    sync.touch();
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'New task';
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const newTask: Task = {
      id: uid('t'),
      title: title.slice(0, 200),
      icon: newIcon || '📋',
      done: false,
      active: activeTasks.length === 0,
      estimate: newEstimate > 0 ? newEstimate : 30,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: maxOrder + 1,
      subtasks: [],
    };
    saveTasks([...tasks, newTask]);
    setNewTitle('');
    setComposerOpen(false);
  };

  const toggleDone = (id: string) => {
    const next = tasks.map(t => {
      if (t.id === id) {
        const done = !t.done;
        return {
          ...t,
          done,
          active: done ? false : t.active,
          doneAt: done ? Date.now() : null,
          updatedAt: Date.now(),
        };
      }
      return t;
    });
    saveTasks(next);
  };

  const toggleActive = (id: string) => {
    const next = tasks.map(t => ({
      ...t,
      active: t.id === id ? !t.active : false,
      updatedAt: Date.now(),
    }));
    saveTasks(next);
  };

  const cycleTaskIcon = (id: string) => {
    const next = tasks.map(t => {
      if (t.id !== id) return t;
      const cur = t.icon || '📋';
      const idx = TASK_EMOJIS.indexOf(cur);
      const nextIcon = TASK_EMOJIS[(idx + 1) % TASK_EMOJIS.length];
      return { ...t, icon: nextIcon, updatedAt: Date.now() };
    });
    saveTasks(next);
  };

  const deleteTask = (tItem: Task) => {
    const prevTasksSnapshot = tasks;
    const next = tasks.map(item =>
      item.id === tItem.id ? { ...item, deleted: true, active: false, updatedAt: Date.now() } : item
    );
    saveTasks(next);
    onToast(
      tItem.linkedTodoId
        ? `Removed "${tItem.title}" from Focus Queue (kept in To-dos)`
        : `${translate('taskDeletedToast', lang)}: ${tItem.title}`,
      '',
      {
        label: translate('undo', lang),
        fn: () => {
          saveTasks(prevTasksSnapshot);
        },
      }
    );
  };

  const startEdit = (tItem: Task) => {
    setEditingId(tItem.id);
    setEditTitle(tItem.title);
  };

  const commitEdit = (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    const next = tasks.map(t =>
      t.id === id ? { ...t, title: editTitle.trim().slice(0, 200), updatedAt: Date.now() } : t
    );
    saveTasks(next);
    setEditingId(null);
  };

  const toggleSubtask = (taskId: string, subId: string) => {
    const next = tasks.map(t => {
      if (t.id === taskId) {
        const subs = (t.subtasks || []).map(s =>
          s.id === subId ? { ...s, done: !s.done } : s
        );
        return { ...t, subtasks: subs, updatedAt: Date.now() };
      }
      return t;
    });
    saveTasks(next);
  };

  const addSubtask = (taskId: string) => {
    const text = subInput.trim();
    if (!text) return;
    const next = tasks.map(t => {
      if (t.id === taskId) {
        const subs = [...(t.subtasks || []), { id: uid('sub'), title: text, done: false }];
        return { ...t, subtasks: subs, updatedAt: Date.now() };
      }
      return t;
    });
    saveTasks(next);
    setSubInput('');
  };

  const deleteSubtask = (taskId: string, subId: string) => {
    const next = tasks.map(t => {
      if (t.id === taskId) {
        const subs = (t.subtasks || []).filter(s => s.id !== subId);
        return { ...t, subtasks: subs, updatedAt: Date.now() };
      }
      return t;
    });
    saveTasks(next);
  };

  const setEstimate = (taskId: string, val: number) => {
    const next = tasks.map(t =>
      t.id === taskId
        ? { ...t, estimate: Math.max(0, Math.min(240, val)) || 30, updatedAt: Date.now() }
        : t
    );
    saveTasks(next);
  };

  const reorderActiveTasks = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIdx = activeTasks.findIndex(t => t.id === fromId);
    const toIdx = activeTasks.findIndex(t => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...activeTasks];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const orderMap = new Map<string, number>();
    reordered.forEach((t, idx) => orderMap.set(t.id, idx + 1));
    const now = Date.now();
    const next = tasks.map(t =>
      orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id), updatedAt: now } : t
    );
    saveTasks(next);
  };

  const clearAllTasks = () => {
    if (allVisibleCount === 0) return;
    onConfirm(
      'Clear all tasks?',
      'All pending and completed focus tasks will be cleared.',
      'Clear all',
      () => {
        const now = Date.now();
        const next = tasks.map(t => ({ ...t, deleted: true, active: false, updatedAt: now }));
        saveTasks(next);
      }
    );
  };

  const clearDone = () => {
    onConfirm(
      translate('confirmClearTasksTitle', lang),
      translate('confirmClearTasksDesc', lang),
      translate('clearCompleted', lang),
      () => {
        const next = tasks.map(t =>
          t.done ? { ...t, deleted: true, updatedAt: Date.now() } : t
        );
        saveTasks(next);
      }
    );
  };

  return (
    <div className="pop tasks-pop" id="tasksPopover" role="dialog" aria-label={translate('tasksTitle', lang)}>
      <div className="pop-head tasks-head">
        <div className="tasks-head-left">
          <div>
            <h2>{translate('tasksTitle', lang)}</h2>
            <span className="tasks-sub-label">Today&apos;s Focus Queue</span>
          </div>
          <span className="tasks-left-count" data-testid="tasksLeftCount">
            {activeTasks.length} left
          </span>
        </div>

        <div className="tasks-head-right">
          {allVisibleCount > 0 && (
            <button
              type="button"
              className="tasks-clear-all"
              data-testid="tasksClearAllBtn"
              onClick={clearAllTasks}
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            className="x-btn"
            aria-label={`Close ${translate('tasksTitle', lang)}`}
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
      </div>

      <div className="pop-body tasks-body">
        {activeTasks.length === 0 ? (
          <div className="pop-empty">
            <strong>{translate('noPendingTasks', lang)}</strong>
            {translate('noPendingTasksSub', lang)}
          </div>
        ) : (
          <ul className="task-list" data-testid="tasksList">
            {activeTasks.map(tItem => {
              const isEditing = editingId === tItem.id;
              const isExpanded = expandedId === tItem.id;
              const mins = tItem.estimate != null && tItem.estimate > 0 ? tItem.estimate : 30;
              const subDoneCount = (tItem.subtasks || []).filter(s => s.done).length;
              const subTotal = (tItem.subtasks || []).length;
              const isDragTarget = dragOverId === tItem.id && draggedId !== tItem.id;

              return (
                <li
                  key={tItem.id}
                  draggable
                  onDragStart={e => {
                    setDraggedId(tItem.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', tItem.id);
                  }}
                  onDragOver={e => {
                    e.preventDefault();
                    if (dragOverId !== tItem.id) setDragOverId(tItem.id);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
                    reorderActiveTasks(sourceId, tItem.id);
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={`task ${tItem.active ? 'active' : ''} ${tItem.done ? 'done' : ''} ${
                    draggedId === tItem.id ? 'dragging' : ''
                  } ${isDragTarget ? 'drag-over' : ''}`}
                >
                  <div className="task-row">
                    <button
                      type="button"
                      className="check"
                      aria-label={`${tItem.done ? 'Uncheck' : 'Complete'}: ${tItem.title}`}
                      onClick={() => toggleDone(tItem.id)}
                    >
                      <Icon name="check" />
                    </button>

                    <button
                      type="button"
                      className="task-emoji-btn"
                      title="Change task icon"
                      aria-label={`Change icon for ${tItem.title}`}
                      onClick={() => cycleTaskIcon(tItem.id)}
                    >
                      {tItem.icon || '📋'}
                    </button>

                    {isEditing ? (
                      <input
                        className="task-edit"
                        value={editTitle}
                        autoFocus
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => commitEdit(tItem.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(tItem.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    ) : (
                      <span
                        className="task-title"
                        onDoubleClick={() => startEdit(tItem)}
                        title="Double-click to rename"
                      >
                        {tItem.title}
                      </span>
                    )}

                    {tItem.linkedTodoId && (
                      <span
                        className="task-synced-badge"
                        data-testid="taskSyncedBadge"
                        title="Synced bi-directionally with Todo [BETA]"
                      >
                        Todo
                      </span>
                    )}

                    {subTotal > 0 && (
                      <span className="task-sub-count">
                        {subDoneCount}/{subTotal}
                      </span>
                    )}

                    <button
                      type="button"
                      className={`task-mins-btn ${isExpanded ? 'on' : ''}`}
                      title={`${mins} mins · Click to edit duration, timer focus & subtasks`}
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : tItem.id)}
                    >
                      <Icon name="clock" />
                      <span>{mins} mins</span>
                    </button>

                    <div className="task-actions">
                      <span
                        className="handle"
                        title="Drag to reorder"
                        aria-hidden="true"
                      >
                        <Icon name="grip" />
                      </span>
                      <button
                        type="button"
                        className="mini"
                        aria-label={`Delete ${tItem.title}`}
                        title={translate('delete', lang)}
                        onClick={() => deleteTask(tItem)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="task-detail">
                      <div className="task-detail-bar">
                        <div className="task-est-presets">
                          {ESTIMATE_PRESETS.map(p => (
                            <button
                              key={p}
                              type="button"
                              className={mins === p ? 'on' : ''}
                              onClick={() => setEstimate(tItem.id, p)}
                            >
                              {p}m
                            </button>
                          ))}
                          <input
                            type="number"
                            min="1"
                            max="240"
                            aria-label="Custom focus minutes"
                            value={mins}
                            onChange={e => setEstimate(tItem.id, Number(e.target.value))}
                          />
                        </div>

                        <button
                          type="button"
                          className={`task-focus-pin ${tItem.active ? 'on' : ''}`}
                          onClick={() => toggleActive(tItem.id)}
                        >
                          <Icon name="target" />
                          <span>
                            {tItem.active
                              ? 'Linked to timer'
                              : translate('useInTimer', lang)}
                          </span>
                        </button>
                      </div>

                      <ul className="sub-list">
                        {(tItem.subtasks || []).map(s => (
                          <li key={s.id} className={`sub ${s.done ? 'done' : ''}`}>
                            <button
                              type="button"
                              className="check"
                              aria-label={`${s.done ? 'Uncheck' : 'Complete'} subtask ${s.title}`}
                              onClick={() => toggleSubtask(tItem.id, s.id)}
                            >
                              <Icon name="check" />
                            </button>
                            <span className="t">{s.title}</span>
                            <button
                              type="button"
                              className="mini"
                              aria-label={`Remove subtask ${s.title}`}
                              onClick={() => deleteSubtask(tItem.id, s.id)}
                            >
                              <Icon name="x" />
                            </button>
                          </li>
                        ))}
                      </ul>

                      <div className="inline-add">
                        <input
                          type="text"
                          placeholder={translate('addSubtaskPlaceholder', lang)}
                          value={subInput}
                          style={{ minHeight: '32px', padding: '4px 8px', flex: 1 }}
                          onChange={e => setSubInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSubtask(tItem.id);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn"
                          style={{ minHeight: '32px', padding: '0 10px' }}
                          aria-label="Add subtask"
                          onClick={() => addSubtask(tItem.id)}
                        >
                          <Icon name="plus" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {doneTasks.length > 0 && (
          <div>
            <div className="done-head">
              <button
                type="button"
                className="link-btn"
                onClick={() => setShowDone(!showDone)}
              >
                {showDone ? 'Hide completed' : `${translate('completedTasks', lang)} (${doneTasks.length})`}
              </button>
              {showDone && (
                <button type="button" className="link-btn" onClick={clearDone}>
                  {translate('clearCompleted', lang)}
                </button>
              )}
            </div>
            {showDone && (
              <ul className="task-list">
                {doneTasks.map(tItem => (
                  <li key={tItem.id} className="task done">
                    <div className="task-row">
                      <button
                        type="button"
                        className="check"
                        aria-label={`Uncheck ${tItem.title}`}
                        onClick={() => toggleDone(tItem.id)}
                      >
                        <Icon name="check" />
                      </button>
                      <span className="task-emoji-static" aria-hidden="true">
                        {tItem.icon || '📋'}
                      </span>
                      <span className="task-title">{tItem.title}</span>
                      <button
                        type="button"
                        className="mini"
                        aria-label={`Delete ${tItem.title}`}
                        title={translate('delete', lang)}
                        onClick={() => deleteTask(tItem)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="pop-foot tasks-foot-pill">
        {composerOpen ? (
          <form className="tasks-inline-composer" onSubmit={handleAddTask}>
            <div className="tasks-composer-row">
              <button
                type="button"
                className="task-emoji-btn"
                title="Cycle icon"
                onClick={() => {
                  const idx = TASK_EMOJIS.indexOf(newIcon);
                  setNewIcon(TASK_EMOJIS[(idx + 1) % TASK_EMOJIS.length]);
                }}
              >
                {newIcon}
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder={translate('newTaskPlaceholder', lang)}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={200}
              />
              <select
                aria-label="Task duration in minutes"
                className="tasks-min-select"
                value={newEstimate}
                onChange={e => setNewEstimate(Number(e.target.value))}
              >
                <option value={15}>15 mins</option>
                <option value={25}>25 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
              </select>
            </div>
            <div className="tasks-composer-actions">
              <button
                type="button"
                className="tasks-cancel-btn"
                onClick={() => {
                  setComposerOpen(false);
                  setNewTitle('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="tasks-add-pill-btn">
                Save Task
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="tasks-add-pill-btn"
            data-testid="addTaskPillBtn"
            onClick={() => setComposerOpen(true)}
          >
            Add Task
          </button>
        )}
      </div>
    </div>
  );
};
