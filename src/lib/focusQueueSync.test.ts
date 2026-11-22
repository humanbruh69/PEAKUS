import test from 'node:test';
import assert from 'node:assert/strict';
import type { Task, TodoItem } from '../types';
import {
  enqueueTodoInFocusQueue,
  isTodoFocusedNow,
  isTodoInFocusQueue,
  removeTodoFromFocusQueue,
  syncTaskChangesToTodos,
  syncTodoChangesToTasks,
} from './focusQueueSync';

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'td_1',
    title: 'Solve LeetCode DP',
    icon: '🧠',
    status: 'todo',
    note: 'Revise memoization first',
    done: false,
    priority: 'high',
    tags: ['Coding'],
    subtasks: [{ id: 'sub_1', title: 'Read editorial', done: false }],
    order: 1,
    remindAt: null,
    remindedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    doneAt: null,
    linkedTaskId: null,
    ...overrides,
  };
}

test('enqueueTodoInFocusQueue sends Todo to Tasks queue and links both records', () => {
  const todo = makeTodo();
  const res = enqueueTodoInFocusQueue(todo, [], [todo], {
    focusNow: false,
    now: 2000,
    makeTaskId: () => 't_100',
  });

  assert.equal(res.wasAlreadyQueued, false);
  assert.equal(res.nextTasks.length, 1);
  assert.equal(res.queuedTask.id, 't_100');
  assert.equal(res.queuedTask.linkedTodoId, 'td_1');
  assert.equal(res.queuedTask.active, true);
  assert.equal(res.queuedTask.subtasks.length, 1);
  assert.equal(res.nextTodos[0].linkedTaskId, 't_100');
  assert.equal(isTodoInFocusQueue(res.nextTodos[0], res.nextTasks), true);
});

test('enqueueTodoInFocusQueue with focusNow pins task to timer and advances status to in_progress', () => {
  const existingTask: Task = {
    id: 't_existing',
    title: 'Other task',
    done: false,
    active: true,
    createdAt: 500,
    updatedAt: 500,
    subtasks: [],
  };
  const todo = makeTodo();

  const res = enqueueTodoInFocusQueue(todo, [existingTask], [todo], {
    focusNow: true,
    now: 3000,
    makeTaskId: () => 't_focus',
  });

  assert.equal(res.nextTasks.find(t => t.id === 't_existing')?.active, false);
  assert.equal(res.queuedTask.active, true);
  assert.equal(res.nextTodos[0].status, 'in_progress');
  assert.equal(isTodoFocusedNow(res.nextTodos[0], res.nextTasks), true);
});

test('bi-directional sync reflects Todo edits into queued Task and Task completion back into Todo', () => {
  const todo = makeTodo();
  const initial = enqueueTodoInFocusQueue(todo, [], [todo], {
    focusNow: true,
    now: 2000,
    makeTaskId: () => 't_100',
  });

  // 1) User edits Todo title and subtask -> syncs to Tasks queue
  const editedTodos = initial.nextTodos.map(t =>
    t.id === 'td_1'
      ? {
          ...t,
          title: 'Master Dynamic Programming',
          subtasks: [{ id: 'sub_1', title: 'Read editorial', done: true }],
        }
      : t
  );
  const syncedTasks = syncTodoChangesToTasks(editedTodos, initial.nextTasks, 3000);
  assert.equal(syncedTasks[0].title, 'Master Dynamic Programming');
  assert.equal(syncedTasks[0].subtasks[0].done, true);

  // 2) User completes Task inside TasksPopover -> syncs done + status='done' back to Todo
  const completedTasks = syncedTasks.map(t =>
    t.id === 't_100' ? { ...t, done: true, active: false, doneAt: 4000, updatedAt: 4000 } : t
  );
  const syncedTodos = syncTaskChangesToTodos(completedTasks, editedTodos, 4000);
  assert.equal(syncedTodos[0].done, true);
  assert.equal(syncedTodos[0].status, 'done');
  assert.equal(syncedTodos[0].doneAt, 4000);
});

test('removing or deleting a synced Task in Focus Queue unpins the Todo without deleting it from Backlog', () => {
  const todo = makeTodo();
  const initial = enqueueTodoInFocusQueue(todo, [], [todo], {
    focusNow: true,
    now: 2000,
    makeTaskId: () => 't_100',
  });

  // Unqueue via removeTodoFromFocusQueue
  const removed = removeTodoFromFocusQueue('td_1', initial.nextTasks, initial.nextTodos, 3000);
  assert.equal(removed.nextTasks[0].deleted, true);
  assert.equal(removed.nextTodos.length, 1);
  assert.equal(removed.nextTodos[0].linkedTaskId, null);

  // Deleting inside TasksPopover -> syncTaskChangesToTodos unpins master Todo safely
  const deletedTasks = initial.nextTasks.map(t => ({ ...t, deleted: true, active: false }));
  const unpinnedTodos = syncTaskChangesToTodos(deletedTasks, initial.nextTodos, 5000);
  assert.equal(unpinnedTodos.length, 1);
  assert.equal(unpinnedTodos[0].linkedTaskId, null);
});

test('deleting a queued Todo from Master Backlog removes its queued Task from Focus Queue', () => {
  const todo = makeTodo();
  const initial = enqueueTodoInFocusQueue(todo, [], [todo], {
    focusNow: true,
    now: 2000,
    makeTaskId: () => 't_100',
  });

  const nextTasks = syncTodoChangesToTasks([], initial.nextTasks, 6000);
  assert.equal(nextTasks[0].deleted, true);
  assert.equal(nextTasks[0].active, false);
});
