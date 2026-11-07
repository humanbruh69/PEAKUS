/* ============ Combinación de datos entre dispositivos ============
   Determinista y convergente: combinar A con B da lo mismo sin importar el orden.
*/
import { U } from './utils';
import { Task, TasksState, HistoryState, Session, TaskDoneRecord } from '../types';

const isObj = U.isObj;
const num = (v: any) => (Number.isFinite(+v) ? +v : 0);
const TOMBSTONE_TTL = 400 * 86400000;

function mergeMap(a?: Record<string, number>, b?: Record<string, number>, now?: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (isObj(src)) {
      for (const [k, v] of Object.entries(src)) {
        const t = num(v);
        if (now && now - t > TOMBSTONE_TTL) continue;
        if (!(k in out) || t > out[k]) out[k] = t;
      }
    }
  }
  return out;
}

export function mergeTasks(A?: Partial<TasksState>, B?: Partial<TasksState>, now?: number): TasksState {
  A = isObj(A) ? A : {};
  B = isObj(B) ? B : {};
  const deleted = mergeMap(A.deleted, B.deleted, now);
  const byId = new Map<string, Task>();
  for (const it of [...(A.items || []), ...(B.items || [])]) {
    if (!isObj(it) || typeof it.id !== 'string') continue;
    const cur = byId.get(it.id);
    if (!cur || num(it.updatedAt) > num(cur.updatedAt)) byId.set(it.id, it);
  }
  for (const [id, it] of byId) {
    if (deleted[id] !== undefined && deleted[id] >= num(it.updatedAt)) byId.delete(id);
  }
  const aNewer = num(A.orderAt) >= num(B.orderAt);
  const first = aNewer ? A.items || [] : B.items || [];
  const second = aNewer ? B.items || [] : A.items || [];
  const order: Task[] = [];
  const seen = new Set<string>();
  for (const it of [...first, ...second]) {
    if (it && byId.has(it.id) && !seen.has(it.id)) {
      seen.add(it.id);
      order.push(byId.get(it.id)!);
    }
  }
  const actA = num(A.activeAt) >= num(B.activeAt);
  let activeId = actA ? A.activeId : B.activeId;
  if (!activeId || !byId.has(activeId) || byId.get(activeId)?.done) activeId = null;

  return {
    items: order,
    activeId: activeId ?? null,
    orderAt: Math.max(num(A.orderAt), num(B.orderAt)),
    activeAt: Math.max(num(A.activeAt), num(B.activeAt)),
    deleted,
  };
}

export function mergeHistory(A?: Partial<HistoryState>, B?: Partial<HistoryState>, now?: number): HistoryState {
  A = isObj(A) ? A : {};
  B = isObj(B) ? B : {};
  const clearedAt = Math.max(num(A.clearedAt), num(B.clearedAt));
  const deleted = mergeMap(A.deleted, B.deleted, now);
  const doneDeleted = mergeMap(A.doneDeleted, B.doneDeleted, now);
  const sessions = new Map<string, Session>();
  for (const s of [...(A.sessions || []), ...(B.sessions || [])]) {
    if (!isObj(s) || typeof s.id !== 'string' || sessions.has(s.id)) continue;
    if (deleted[s.id] !== undefined || num(s.end) <= clearedAt) continue;
    sessions.set(s.id, s);
  }
  const done = new Map<string, TaskDoneRecord>();
  for (const d of [...(A.taskDone || []), ...(B.taskDone || [])]) {
    if (!isObj(d)) continue;
    const k = d.taskId + '@' + num(d.at);
    if (done.has(k) || doneDeleted[k] !== undefined || num(d.at) <= clearedAt) continue;
    done.set(k, d);
  }
  return {
    sessions: [...sessions.values()].sort((x, y) => num(x.start) - num(y.start)),
    taskDone: [...done.values()].sort((x, y) => num(x.at) - num(y.at)),
    deleted,
    doneDeleted,
    clearedAt,
  };
}

function pickNewer(a: any, b: any, key: string) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  return num(a[key]) >= num(b[key]) ? a : b;
}

export function mergeDocs(a: any, b: any, now = Date.now()): any {
  if (!isObj(a)) return isObj(b) ? mergeDocs(b, {}, now) : null;
  if (!isObj(b)) b = {};
  return {
    v: 1,
    settings: pickNewer(a.settings, b.settings, '_at') || null,
    notes: pickNewer(a.notes, b.notes, 'at') || { text: '', at: 0 },
    tasks: mergeTasks(a.tasks, b.tasks, now),
    history: mergeHistory(a.history, b.history, now),
  };
}

export function validDoc(d: any) {
  return isObj(d) && (d.settings == null || isObj(d.settings)) && (d.tasks == null || isObj(d.tasks)) && (d.history == null || isObj(d.history));
}

export const FocoMerge = { mergeDocs, mergeTasks, mergeHistory, validDoc };
export default FocoMerge;
