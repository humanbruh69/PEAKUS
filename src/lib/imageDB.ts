export interface ImageRecord {
  id: string;
  name: string;
  blob: Blob;
  type?: 'image' | 'video';
  size?: number;
  createdAt: number;
}

export const ImageDB = (() => {
  let dbp: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return rej(new Error('IndexedDB no disponible'));
      }
      const req = indexedDB.open('foco', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('images', { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error || new Error('No se pudo abrir IndexedDB'));
      req.onblocked = () => rej(new Error('IndexedDB bloqueado'));
    });
    dbp.catch(() => {
      dbp = null;
    });
    return dbp;
  }

  async function tx<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('images', mode);
      const st = t.objectStore('images');
      let result: any;
      Promise.resolve(fn(st)).then(r => {
        result = r;
      });
      t.oncomplete = () => res(result && result.result !== undefined ? result.result : result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Transacción cancelada'));
    });
  }

  return {
    put: (rec: ImageRecord) => tx('readwrite', st => st.put(rec)),
    get: (id: string) => tx<ImageRecord | undefined>('readonly', st => st.get(id)),
    del: (id: string) => tx('readwrite', st => st.delete(id)),
    delete: (id: string) => tx('readwrite', st => st.delete(id)),
    list: () => tx<ImageRecord[]>('readonly', st => st.getAll()),
    clear: () => tx('readwrite', st => st.clear()),
  };
})();

export type CustomImage = ImageRecord;
export const imageDB = ImageDB;
