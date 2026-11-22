import type { Subtask, Task, TodoItem, TodoStatus, TodoSubtask } from '../types';
import { sanitizeTodoStatus } from './todoEngine';
import { uid } from './utils';

function cloneTodoSubtasksToTask(subs?: TodoSubtask[]): Subtask[] {
  return (subs || []).map(s => ({
    id: s.id,
    title: s.title,
    done: !!s.done,
  }));
}

function cloneTaskSubtasksToTodo(subs?: Subtask[]): TodoSubtask[] {
  return (subs || []).map(s => ({
    id: s.id,
    title: s.title,
    done: !!s.done,
  }));
}

function subtasksEqual(
  a: Array<{ id: string; title: string; done: boolean }> | undefined,
  b: Array<{ id: string; title: string; done: boolean }> | undefined
): boolean {
  const listA = a || [];
  const listB = b || [];
  if (listA.length !== listB.length) return false;
  for (let i = 0; i < listA.length; i++) {
    if (
      listA[i].id !== listB[i].id ||
      listA[i].title !== listB[i].title ||
      !!listA[i].done !== !!listB[i].done
    ) {
      return false;
    }
  }
  return true;
}

export function findLinkedTaskForTodo(todo: Pick<TodoItem, 'id' | 'linkedTaskId'>, tasks: Task[]): Task | undefined {
  return tasks.find(
    t => !t.deleted && (t.linkedTodoId === todo.id || (!!todo.linkedTaskId && t.id === todo.linkedTaskId))
  );
}

export function isTodoInFocusQueue(todo: Pick<TodoItem, 'id' | 'linkedTaskId'>, tasks: Task[]): boolean {
  return !!findLinkedTaskForTodo(todo, tasks);
}

export function isTodoFocusedNow(todo: Pick<TodoItem, 'id' | 'linkedTaskId'>, tasks: Task[]): boolean {
  const linked = findLinkedTaskForTodo(todo, tasks);
  return !!(linked && linked.active && !linked.done && !linked.deleted);
}

export interface EnqueueTodoResult {
  nextTodos: TodoItem[];
  nextTasks: Task[];
  queuedTask: Task;
  wasAlreadyQueued: boolean;
}

export function enqueueTodoInFocusQueue(
  todo: TodoItem,
  tasks: Task[],
  todos: TodoItem[],
  options?: {
    focusNow?: boolean;
    now?: number;
    makeTaskId?: () => string;
  }
): EnqueueTodoResult {
  const now = options?.now ?? Date.now();
  const focusNow = !!options?.focusNow;
  const existingIndex = tasks.findIndex(
    t => t.linkedTodoId === todo.id || (!!todo.linkedTaskId && t.id === todo.linkedTaskId)
  );
  const existingTask = existingIndex >= 0 ? tasks[existingIndex] : undefined;
  const wasAlreadyQueued = !!(existingTask && !existingTask.deleted);

  const hasOtherActive = tasks.some(t => !t.deleted && !t.done && t.active && t.id !== existingTask?.id);
  const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);

  let queuedTask: Task;
  let nextTasks: Task[];

  if (existingTask) {
    const shouldBeActive = focusNow ? true : existingTask.deleted ? !hasOtherActive : !!existingTask.active;
    queuedTask = {
      ...existingTask,
      title: todo.title.slice(0, 200),
      icon: todo.icon || existingTask.icon || '📋',
      done: !!todo.done,
      doneAt: todo.done ? (todo.doneAt || existingTask.doneAt || now) : null,
      subtasks: cloneTodoSubtasksToTask(todo.subtasks),
      linkedTodoId: todo.id,
      deleted: false,
      active: todo.done && !focusNow ? false : shouldBeActive,
      order: existingTask.deleted ? maxOrder + 1 : existingTask.order,
      updatedAt: now,
    };

    nextTasks = tasks.map(t => {
      if (t.id === queuedTask.id) return queuedTask;
      if (focusNow && t.active) return { ...t, active: false, updatedAt: now };
      return t;
    });
  } else {
    const newId = options?.makeTaskId ? options.makeTaskId() : uid('t');
    const shouldBeActive = focusNow ? true : !hasOtherActive && !todo.done;
    queuedTask = {
      id: newId,
      title: todo.title.slice(0, 200),
      icon: todo.icon || '📋',
      done: !!todo.done,
      doneAt: todo.done ? (todo.doneAt || now) : null,
      estimate: 30,
      createdAt: now,
      updatedAt: now,
      order: maxOrder + 1,
      subtasks: cloneTodoSubtasksToTask(todo.subtasks),
      active: shouldBeActive,
      deleted: false,
      linkedTodoId: todo.id,
    };

    nextTasks = [
      ...tasks.map(t => (focusNow && t.active ? { ...t, active: false, updatedAt: now } : t)),
      queuedTask,
    ];
  }

  const nextTodos = todos.map(item => {
    if (item.id !== todo.id) return item;
    const curStatus = sanitizeTodoStatus(item.status, item.done);
    const nextStatus: TodoStatus =
      focusNow && !item.done && curStatus === 'todo' ? 'in_progress' : curStatus;
    return {
      ...item,
      status: nextStatus,
      linkedTaskId: queuedTask.id,
      updatedAt: now,
    };
  });

  return { nextTodos, nextTasks, queuedTask, wasAlreadyQueued };
}

export function removeTodoFromFocusQueue(
  todoId: string,
  tasks: Task[],
  todos: TodoItem[],
  now = Date.now()
): { nextTodos: TodoItem[]; nextTasks: Task[] } {
  const nextTasks = tasks.map(t =>
    t.linkedTodoId === todoId ? { ...t, deleted: true, active: false, updatedAt: now } : t
  );
  const nextTodos = todos.map(item =>
    item.id === todoId ? { ...item, linkedTaskId: null, updatedAt: now } : item
  );
  return { nextTodos, nextTasks };
}

export function syncTodoChangesToTasks(
  nextTodos: TodoItem[],
  prevTasks: Task[],
  now = Date.now()
): Task[] {
  const todoById = new Map<string, TodoItem>();
  for (const todo of nextTodos) {
    todoById.set(todo.id, todo);
  }

  let changed = false;
  const nextTasks = prevTasks.map(task => {
    if (task.deleted || !task.linkedTodoId) return task;
    const todo = todoById.get(task.linkedTodoId);
    if (!todo) {
      changed = true;
      return { ...task, deleted: true, active: false, updatedAt: now };
    }
    if (todo.linkedTaskId === null) {
      return task;
    }

    const targetDone = !!todo.done;
    const targetTitle = todo.title.slice(0, 200);
    const targetIcon = todo.icon || '📋';
    const targetActive = targetDone ? false : task.active;
    const subsMatch = subtasksEqual(task.subtasks, todo.subtasks);

    if (
      task.title === targetTitle &&
      (task.icon || '📋') === targetIcon &&
      !!task.done === targetDone &&
      !!task.active === !!targetActive &&
      subsMatch
    ) {
      return task;
    }

    changed = true;
    return {
      ...task,
      title: targetTitle,
      icon: targetIcon,
      done: targetDone,
      doneAt: targetDone ? (todo.doneAt || task.doneAt || now) : null,
      active: targetActive,
      subtasks: cloneTodoSubtasksToTask(todo.subtasks),
      updatedAt: now,
    };
  });

  return changed ? nextTasks : prevTasks;
}

export function syncTaskChangesToTodos(
  nextTasks: Task[],
  prevTodos: TodoItem[],
  now = Date.now()
): TodoItem[] {
  const taskByTodoId = new Map<string, Task>();
  const taskById = new Map<string, Task>();
  for (const t of nextTasks) {
    taskById.set(t.id, t);
    if (t.linkedTodoId) {
      const existing = taskByTodoId.get(t.linkedTodoId);
      if (!existing || (existing.deleted && !t.deleted)) {
        taskByTodoId.set(t.linkedTodoId, t);
      }
    }
  }

  let changed = false;
  const nextTodos = prevTodos.map(todo => {
    const task = taskByTodoId.get(todo.id) || (todo.linkedTaskId ? taskById.get(todo.linkedTaskId) : undefined);
    if (!task) return todo;

    if (task.deleted) {
      if (!todo.linkedTaskId) return todo;
      changed = true;
      return {
        ...todo,
        linkedTaskId: null,
        updatedAt: now,
      };
    }

    const curStatus = sanitizeTodoStatus(todo.status, todo.done);
    const targetDone = !!task.done;
    const targetStatus: TodoStatus = targetDone
      ? 'done'
      : curStatus === 'done'
      ? 'todo'
      : curStatus;
    const targetTitle = task.title.slice(0, 200);
    const targetIcon = task.icon || todo.icon || '📝';
    const subsMatch = subtasksEqual(todo.subtasks, task.subtasks);

    if (
      todo.linkedTaskId === task.id &&
      todo.title === targetTitle &&
      (todo.icon || '📝') === targetIcon &&
      !!todo.done === targetDone &&
      curStatus === targetStatus &&
      subsMatch
    ) {
      return todo;
    }

    changed = true;
    return {
      ...todo,
      linkedTaskId: task.id,
      title: targetTitle,
      icon: targetIcon,
      done: targetDone,
      status: targetStatus,
      doneAt: targetDone ? (task.doneAt || todo.doneAt || now) : null,
      subtasks: cloneTaskSubtasksToTodo(task.subtasks),
      updatedAt: now,
    };
  });

  return changed ? nextTodos : prevTodos;
}
