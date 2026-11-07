import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import type { Task, LanguageCode } from '../types';
import { uid } from '../lib/utils';
import { Store } from '../lib/store';
import { sync } from '../lib/sync';
import { t as translate } from '../lib/i18n';

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
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subInput, setSubInput] = useState('');
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = language;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeTasks = tasks
    .filter(t => !t.deleted && !t.done)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const doneTasks = tasks
    .filter(t => !t.deleted && t.done)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const saveTasks = (nextTasks: Task[]) => {
    onUpdateTasks(nextTasks);
    Store.saveTaskItems(nextTasks);
    sync.touch();
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const newTask: Task = {
      id: uid('t'),
      title,
      done: false,
      active: activeTasks.length === 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: maxOrder + 1,
      subtasks: [],
    };
    saveTasks([...tasks, newTask]);
    setNewTitle('');
  };

  const toggleDone = (id: string) => {
    const next = tasks.map(t => {
      if (t.id === id) {
        const done = !t.done;
        return {
          ...t,
          done,
          active: done ? false : t.active,
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

  const deleteTask = (tItem: Task) => {
    const next = tasks.map(item =>
      item.id === tItem.id ? { ...item, deleted: true, updatedAt: Date.now() } : item
    );
    saveTasks(next);
    onToast(`${translate('taskDeletedToast', lang)}: ${tItem.title}`, '', {
      label: translate('undo', lang),
      fn: () => {
        const restored = Store.loadTaskItems().map(item =>
          item.id === tItem.id ? { ...item, deleted: false, updatedAt: Date.now() } : item
        );
        saveTasks(restored);
      },
    });
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
      t.id === id ? { ...t, title: editTitle.trim(), updatedAt: Date.now() } : t
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
        ? { ...t, estimate: Math.max(0, val) || null, updatedAt: Date.now() }
        : t
    );
    saveTasks(next);
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
    <div className="pop" role="dialog" aria-label={translate('tasksTitle', lang)}>
      <div className="pop-head">
        <span className="badge-ic" aria-hidden="true">
          <Icon name="tasks" />
        </span>
        <h2>{translate('tasksTitle', lang)}</h2>
        <button
          className="x-btn"
          aria-label={translate('tasksTitle', lang)}
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="pop-body">
        {activeTasks.length === 0 ? (
          <div className="pop-empty">
            <strong>{translate('noPendingTasks', lang)}</strong>
            {translate('noPendingTasksSub', lang)}
          </div>
        ) : (
          <ul className="task-list">
            {activeTasks.map(tItem => {
              const isEditing = editingId === tItem.id;
              const isExpanded = expandedId === tItem.id;
              const subDoneCount = (tItem.subtasks || []).filter(s => s.done).length;
              const subTotal = (tItem.subtasks || []).length;
              return (
                <li
                  key={tItem.id}
                  className={`task ${tItem.active ? 'active' : ''} ${tItem.done ? 'done' : ''}`}
                >
                  <div className="task-row">
                    <button
                      className="check"
                      aria-label={`${tItem.done ? 'Uncheck' : 'Complete'}: ${tItem.title}`}
                      onClick={() => toggleDone(tItem.id)}
                    >
                      <Icon name="check" />
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
                      >
                        {tItem.title}
                      </span>
                    )}

                    {subTotal > 0 && (
                      <span className="task-meta">
                        {subDoneCount}/{subTotal}
                      </span>
                    )}

                    {tItem.estimate != null && tItem.estimate > 0 && (
                      <span className="task-meta" title={translate('estimatedFocus', lang)}>
                        {tItem.estimate} {translate('focusMinutes', lang)}
                      </span>
                    )}

                    <div className="task-actions">
                      <button
                        className={`mini ${tItem.active ? 'on' : ''}`}
                        title={tItem.active ? translate('removeFromTimer', lang) : translate('useInTimer', lang)}
                        aria-pressed={tItem.active}
                        onClick={() => toggleActive(tItem.id)}
                      >
                        <Icon name="target" />
                      </button>
                      <button
                        className="mini"
                        title={translate('subtasks', lang)}
                        onClick={() => setExpandedId(isExpanded ? null : tItem.id)}
                      >
                        <Icon name="chev" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                      </button>
                      <button
                        className="mini"
                        title={translate('delete', lang)}
                        onClick={() => deleteTask(tItem)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="task-detail">
                      <div className="field-row">
                        <span>{translate('estimatedFocus', lang)}:</span>
                        <input
                          type="number"
                          min="0"
                          max="240"
                          value={tItem.estimate || 0}
                          style={{ width: '70px', minHeight: '30px', padding: '4px 8px' }}
                          onChange={e => setEstimate(tItem.id, Number(e.target.value))}
                        />
                        <span>{translate('focusMinutes', lang)}</span>
                      </div>

                      <ul className="sub-list">
                        {(tItem.subtasks || []).map(s => (
                          <li key={s.id} className={`sub ${s.done ? 'done' : ''}`}>
                            <button
                              className="check"
                              onClick={() => toggleSubtask(tItem.id, s.id)}
                            >
                              <Icon name="check" />
                            </button>
                            <span className="t">{s.title}</span>
                            <button
                              className="mini"
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
                          className="btn"
                          style={{ minHeight: '32px', padding: '0 10px' }}
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
                className="link-btn"
                onClick={() => setShowDone(!showDone)}
              >
                {showDone ? 'Hide' : `${translate('completedTasks', lang)} (${doneTasks.length})`}
              </button>
              {showDone && (
                <button className="link-btn" onClick={clearDone}>
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
                        className="check"
                        onClick={() => toggleDone(tItem.id)}
                      >
                        <Icon name="check" />
                      </button>
                      <span className="task-title">{tItem.title}</span>
                      <button
                        className="mini"
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

      <div className="pop-foot">
        <form className="add-task" onSubmit={handleAddTask}>
          <input
            ref={inputRef}
            type="text"
            placeholder={translate('newTaskPlaceholder', lang)}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn primary" disabled={!newTitle.trim()}>
            <Icon name="plus" />
          </button>
        </form>
      </div>
    </div>
  );
};
