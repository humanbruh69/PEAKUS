import { Store } from './store';
import { clone } from './utils';
import type { Settings, SyncMeta, ServerStatus, SyncDoc } from '../types';

export interface SyncCallbacks {
  getSettings: () => Settings;
  onRemoteSettings: (s: Settings) => void;
  onRemoteTasks: (tasks: any[]) => void;
  onRemoteHistory: (history: any[]) => void;
  onRemoteNotes: (notes: { text: string; at: number }) => void;
}

const META_KEY = 'foco.sync.v1';

export class SyncManager {
  private meta: SyncMeta = { key: '', connected: false, lastSync: 0, lastError: '' };
  private server: ServerStatus = 'unknown';
  private timer: any = null;
  private periodic: any = null;
  private inflight: Promise<any> | null = null;
  private applying = false;
  private subs = new Set<() => void>();
  private cbs: SyncCallbacks | null = null;

  constructor() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (m && typeof m === 'object') {
        this.meta = Object.assign(this.meta, m);
      }
    } catch {}
  }

  setCallbacks(cbs: SyncCallbacks) {
    this.cbs = cbs;
  }

  private emit() {
    this.subs.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  private saveMeta() {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(this.meta));
    } catch {}
  }

  possible(): boolean {
    return typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
  }

  getMeta(): SyncMeta {
    return this.meta;
  }

  getServerStatus(): ServerStatus {
    return this.server;
  }

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private localDoc(): SyncDoc {
    if (!this.cbs) {
      const settings = Store.loadSettings();
      delete (settings as any).mode;
      return {
        v: 1,
        settings,
        tasks: Store.loadTasks(),
        history: Store.loadHistory(),
        notes: Store.loadNotesDoc(),
      };
    }
    const settings = clone(this.cbs.getSettings());
    delete (settings as any).mode;
    return {
      v: 1,
      settings,
      tasks: Store.loadTasks(),
      history: Store.loadHistory(),
      notes: Store.loadNotesDoc(),
    };
  }

  private async call(method: 'GET' | 'POST', body?: any) {
    const r = await fetch('/api/sync', {
      method,
      cache: 'no-store',
      headers: {
        'x-sync-key': this.meta.key,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let j: any = {};
    try {
      j = await r.json();
    } catch {}
    return { status: r.status, body: j };
  }

  private apply(doc: SyncDoc) {
    if (!doc || !this.cbs) return;
    this.applying = true;
    try {
      const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
      const loc = this.localDoc();

      if (doc.settings && !same(doc.settings, loc.settings)) {
        const mode = this.cbs.getSettings().mode;
        const norm = Store.normSettings(Object.assign({}, doc.settings, { mode }));
        Store.saveSettings(norm);
        this.cbs.onRemoteSettings(norm);
      }
      if (doc.tasks && !same(Store.normTasks(doc.tasks), loc.tasks)) {
        this.cbs.onRemoteTasks(doc.tasks);
      }
      if (doc.history && !same(Store.normHistory(doc.history), loc.history)) {
        this.cbs.onRemoteHistory(doc.history);
      }
      if (doc.notes && (!loc.notes || doc.notes.text !== loc.notes.text || doc.notes.at !== loc.notes.at)) {
        Store.saveNotes(doc.notes.text, doc.notes.at);
        this.cbs.onRemoteNotes(doc.notes);
      }
    } finally {
      this.applying = false;
    }
  }

  touch() {
    if (this.applying || !this.meta.connected) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 2500);
  }

  async run(): Promise<any> {
    if (!this.possible() || !this.meta.connected || !this.meta.key) return;
    if (!navigator.onLine) {
      this.meta.lastError = 'Sin conexión. Tus cambios quedan guardados acá y se suben cuando vuelva internet.';
      this.saveMeta();
      this.emit();
      return;
    }
    if (this.inflight) return this.inflight;

    const task = async () => {
      try {
        const doc = this.localDoc();
        const r = await this.call('POST', { doc });
        if (r.status === 200) {
          this.apply(r.body.doc);
          this.meta.lastSync = Date.now();
          this.meta.lastError = '';
          this.server = 'ok';
        } else if (r.status === 401) {
          this.meta.lastError = 'La clave ya no coincide con la del servidor. Volvé a conectar este dispositivo.';
          this.meta.connected = false;
          this.server = 'ok';
        } else if (r.status === 503) {
          this.meta.lastError = 'El servidor no tiene configurada la base de datos o la clave.';
          this.server = 'not_configured';
        } else {
          this.meta.lastError = `No se pudo sincronizar (${r.body.error || r.status}). Se reintenta solo.`;
        }
      } catch {
        this.meta.lastError = 'Sin conexión con el servidor. Tus cambios quedan guardados acá y se suben después.';
      }
      this.saveMeta();
      this.emit();
    };

    const lock =
      (navigator as any).locks && (navigator as any).locks.request
        ? (navigator as any).locks.request('foco-sync', { ifAvailable: true }, (l: any) =>
            l ? task() : null
          )
        : task();

    this.inflight = Promise.resolve(lock).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async probe(): Promise<ServerStatus> {
    if (!this.possible()) {
      this.server = 'unavailable';
      this.emit();
      return this.server;
    }
    try {
      const r = await fetch('/api/sync', {
        method: 'GET',
        cache: 'no-store',
        headers: { 'x-sync-key': '' },
      });
      this.server =
        r.status === 503
          ? 'not_configured'
          : r.status === 401 || r.status === 200
          ? 'ok'
          : r.status === 404
          ? 'unavailable'
          : 'error';
    } catch {
      this.server = 'unavailable';
    }
    this.emit();
    return this.server;
  }

  async connect(key: string): Promise<{ ok: boolean; msg?: string; hadCloud?: boolean }> {
    this.meta.key = String(key || '').trim();
    if (this.meta.key.length < 12) {
      return { ok: false, msg: 'La clave tiene que tener al menos 12 caracteres.' };
    }
    let r: any;
    try {
      r = await this.call('GET');
    } catch {
      return { ok: false, msg: 'No hay conexión con el servidor.' };
    }
    if (r.status === 401) {
      return { ok: false, msg: 'Esa clave no coincide con SYNC_KEY en Vercel.' };
    }
    if (r.status === 503) {
      return { ok: false, msg: 'El servidor todavía no tiene configurada la base de datos o SYNC_KEY.' };
    }
    if (r.status !== 200) {
      return { ok: false, msg: 'El servidor respondió con un error (' + r.status + ').' };
    }

    const cloud = r.body.doc;
    const doc = this.localDoc();
    if (cloud && cloud.settings) {
      if (doc.settings) (doc.settings as any)._at = 0;
      if (doc.notes) doc.notes.at = 0;
    }

    try {
      r = await this.call('POST', { doc });
    } catch {
      return { ok: false, msg: 'Se cortó la conexión. Probá de nuevo.' };
    }
    if (r.status !== 200) {
      return { ok: false, msg: 'No se pudo subir tus datos (' + r.status + ').' };
    }

    this.apply(r.body.doc);
    this.meta.connected = true;
    this.meta.lastSync = Date.now();
    this.meta.lastError = '';
    this.server = 'ok';
    this.saveMeta();
    this.emit();
    this.start();
    return { ok: true, hadCloud: !!(cloud && cloud.settings) };
  }

  disconnect() {
    this.meta = { key: '', connected: false, lastSync: 0, lastError: '' };
    this.saveMeta();
    this.emit();
  }

  start() {
    if (this.periodic || !this.possible()) return;
    this.periodic = setInterval(() => {
      if (!document.hidden) this.run();
    }, 90000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.run();
    });
    window.addEventListener('online', () => this.run());
    window.addEventListener('pagehide', () => {
      if (this.meta.connected && this.timer) {
        clearTimeout(this.timer);
        this.run();
      }
    });
    this.run();
  }

  genKey(): string {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from(a, b => A[b % A.length])
      .join('')
      .replace(/(.{6})(?=.)/g, '$1-');
  }
}

export const sync = new SyncManager();
