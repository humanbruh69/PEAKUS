import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectTodoTags,
  computeQuickRemindAt,
  computeTodoProgress,
  cycleTodoStatus,
  filterTodos,
  findDueTodoReminders,
  formatReminderLabel,
  formatReminderPayload,
  pickReminderQuote,
  sanitizeTodoItems,
  sanitizeTodoPrefs,
  sortTodos,
} from './todoEngine';
import type { TodoItem, TodoNotificationPrefs } from '../types';

const BASE_NOW = 1_700_000_000_000;

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'td_1',
    title: 'Review organic chemistry notes',
    icon: '📝',
    status: 'todo',
    note: '',
    done: false,
    priority: 'medium',
    tags: [],
    subtasks: [],
    remindAt: null,
    remindedAt: null,
    createdAt: BASE_NOW,
    updatedAt: BASE_NOW,
    doneAt: null,
    ...overrides,
  };
}

test('sanitizeTodoItems drops invalid items and preserves valid reminder timestamps & Notion fields', () => {
  const sanitized = sanitizeTodoItems([
    { id: '', title: 'Missing id' },
    { id: 'td_a', title: '   ' },
    {
      id: 'td_b',
      title: '  Read Ch. 4  ',
      icon: '📚',
      status: 'in_progress',
      tags: ['Exam', '  Physics ', 'exam'],
      subtasks: [
        { id: 's1', title: 'Summary', done: true },
        { id: 's1', title: 'Dup', done: false },
      ],
      priority: 'high',
      remindAt: BASE_NOW + 60_000,
      done: false,
      createdAt: BASE_NOW,
      updatedAt: BASE_NOW,
    },
    {
      id: 'td_b', // duplicate id should be ignored
      title: 'Duplicate',
    },
  ]);

  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].id, 'td_b');
  assert.equal(sanitized[0].title, 'Read Ch. 4');
  assert.equal(sanitized[0].icon, '📚');
  assert.equal(sanitized[0].status, 'in_progress');
  assert.deepEqual(sanitized[0].tags, ['Exam', 'Physics']);
  assert.equal(sanitized[0].subtasks?.length, 1);
  assert.equal(sanitized[0].priority, 'high');
  assert.equal(sanitized[0].remindAt, BASE_NOW + 60_000);
});

test('sortTodos places scheduled active items soonest first, then priority, then done last, and supports Notion sort modes', () => {
  const items: TodoItem[] = [
    makeTodo({ id: 'done', done: true, status: 'done', doneAt: BASE_NOW + 100 }),
    makeTodo({ id: 'low_unsched', title: 'Alpha', priority: 'low', remindAt: null }),
    makeTodo({ id: 'high_unsched', title: 'Zeta', priority: 'high', remindAt: null }),
    makeTodo({ id: 'later_sched', title: 'Beta', priority: 'high', remindAt: BASE_NOW + 120_000 }),
    makeTodo({ id: 'soon_sched', title: 'Gamma', priority: 'low', remindAt: BASE_NOW + 30_000 }),
  ];

  const sorted = sortTodos(items).map(x => x.id);
  assert.deepEqual(sorted, ['soon_sched', 'later_sched', 'high_unsched', 'low_unsched', 'done']);

  const byTitle = sortTodos(items, 'title').map(x => x.id);
  assert.equal(byTitle[0], 'low_unsched');
});

test('filterTodos and computeTodoProgress accurately count active, inProgress, scheduled, overdue, tags, and done', () => {
  const items: TodoItem[] = [
    makeTodo({ id: '1', title: 'Math sheet', status: 'in_progress', tags: ['Exam'], done: false, remindAt: BASE_NOW - 60_000 }),
    makeTodo({ id: '2', title: 'Physics lab', status: 'todo', tags: ['Lab'], done: false, remindAt: BASE_NOW + 300_000 }),
    makeTodo({ id: '3', title: 'Essay outline', status: 'done', done: true, doneAt: BASE_NOW }),
    makeTodo({ id: '4', title: 'Clean desk', status: 'todo', priority: 'high', done: false, remindAt: null }),
  ];

  assert.equal(filterTodos(items, 'all').length, 4);
  assert.equal(filterTodos(items, 'active').length, 3);
  assert.equal(filterTodos(items, 'in_progress').length, 1);
  assert.equal(filterTodos(items, 'todo').length, 2);
  assert.equal(filterTodos(items, 'scheduled').length, 2);
  assert.equal(filterTodos(items, 'done').length, 1);
  assert.equal(filterTodos(items, 'all', 'physics').length, 1);
  assert.equal(filterTodos(items, 'all', '', { priority: 'high' }).length, 1);
  assert.equal(filterTodos(items, 'all', '', { tag: 'Exam' }).length, 1);
  assert.deepEqual(collectTodoTags(items), ['Exam', 'Lab']);

  const progress = computeTodoProgress(items, BASE_NOW);
  assert.deepEqual(progress, {
    total: 4,
    active: 3,
    inProgress: 1,
    completed: 1,
    scheduled: 2,
    overdue: 1,
    percent: 25,
  });
});

test('cycleTodoStatus advances todo -> in_progress -> done -> todo cleanly', () => {
  assert.equal(cycleTodoStatus('todo', false), 'in_progress');
  assert.equal(cycleTodoStatus('in_progress', false), 'done');
  assert.equal(cycleTodoStatus('done', true), 'todo');
});

test('findDueTodoReminders returns only undone, due, and unnotified items', () => {
  const items: TodoItem[] = [
    makeTodo({ id: 'due_fresh', remindAt: BASE_NOW - 1000, remindedAt: null }),
    makeTodo({ id: 'due_already', remindAt: BASE_NOW - 5000, remindedAt: BASE_NOW - 4000 }),
    makeTodo({ id: 'due_rescheduled', remindAt: BASE_NOW - 1000, remindedAt: BASE_NOW - 10_000 }),
    makeTodo({ id: 'future', remindAt: BASE_NOW + 60_000, remindedAt: null }),
    makeTodo({ id: 'done_due', done: true, remindAt: BASE_NOW - 1000, remindedAt: null }),
  ];

  const due = findDueTodoReminders(items, BASE_NOW).map(i => i.id);
  assert.deepEqual(due, ['due_fresh', 'due_rescheduled']);
});

test('pickReminderQuote & formatReminderPayload respect default, toxic, custom, and disabled modes', () => {
  const todo = { title: 'Solve 10 calculus integrals', note: 'Chapter 5' };

  const defaultPrefs: TodoNotificationPrefs = { quotesEnabled: true, quoteMode: 'default', customQuotes: [] };
  const defRes = formatReminderPayload(todo, defaultPrefs, 'en', 2);
  assert.equal(defRes.title, 'Do now: Solve 10 calculus integrals');
  assert.ok(defRes.quote.length > 0);
  assert.ok(defRes.body.includes(defRes.quote));

  const toxicPrefs: TodoNotificationPrefs = { quotesEnabled: true, quoteMode: 'toxic', customQuotes: [] };
  const toxQuote = pickReminderQuote(toxicPrefs, 'en', 0);
  assert.equal(toxQuote, 'You are supposed to suffer.');

  const customPrefs: TodoNotificationPrefs = {
    quotesEnabled: true,
    quoteMode: 'custom',
    customQuotes: ['No phone until page 40', 'Lock in now'],
  };
  assert.equal(pickReminderQuote(customPrefs, 'en', 1), 'Lock in now');

  const offPrefs: TodoNotificationPrefs = { quotesEnabled: false, quoteMode: 'toxic', customQuotes: [] };
  const offRes = formatReminderPayload(todo, offPrefs, 'en', 0, true);
  assert.equal(offRes.quote, '');
  assert.equal(offRes.body, 'Chapter 5');

  const godRes = formatReminderPayload(todo, toxicPrefs, 'en', 0, true);
  assert.ok(godRes.body.includes('You are supposed to suffer.\nkatkaari d nitin'));
});

test('computeQuickRemindAt and formatReminderLabel produce expected offsets & prefs view sanitization', () => {
  const in15 = computeQuickRemindAt('15m', BASE_NOW);
  assert.equal(in15 - BASE_NOW, 15 * 60 * 1000);

  const labelSoon = formatReminderLabel(in15, BASE_NOW);
  assert.equal(labelSoon.isOverdue, false);
  assert.equal(labelSoon.isSoon, true);
  assert.equal(labelSoon.relativeText, 'in 15m');

  const labelOverdue = formatReminderLabel(BASE_NOW - 5 * 60 * 1000, BASE_NOW);
  assert.equal(labelOverdue.isOverdue, true);
  assert.equal(labelOverdue.relativeText, '5m ago');

  const cleanPrefs = sanitizeTodoPrefs({
    quotesEnabled: true,
    quoteMode: 'invalid',
    defaultView: 'board',
    customQuotes: ['  Stay sharp  ', ''],
  });
  assert.equal(cleanPrefs.quoteMode, 'default');
  assert.equal(cleanPrefs.defaultView, 'board');
  assert.deepEqual(cleanPrefs.customQuotes, ['Stay sharp']);
});
