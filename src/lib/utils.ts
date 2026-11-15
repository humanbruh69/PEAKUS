export const U = {
  uid(prefix = '') {
    const r = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint32Array(2))
      : [Math.random() * 2 ** 32, Math.random() * 2 ** 32];
    return prefix + Date.now().toString(36) + '-' + Array.from(r, n => (n >>> 0).toString(36)).join('');
  },
  clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)),
  isObj: (v: any): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v),
  deepMerge(base: any, over: any): any {
    if (!U.isObj(base)) return over === undefined ? base : over;
    const out: any = {};
    for (const k of Object.keys(base)) {
      const b = base[k], o = over ? over[k] : undefined;
      if (U.isObj(b)) out[k] = U.deepMerge(b, U.isObj(o) ? o : {});
      else if (o === undefined || (typeof b !== typeof o && b !== null)) out[k] = b;
      else out[k] = o;
    }
    if (over) for (const k of Object.keys(over)) if (!(k in base) && base.__open) out[k] = over[k];
    return out;
  },
  clone: <T>(v: T): T => JSON.parse(JSON.stringify(v)),
  esc(s: any): string {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  },
  pad: (n: number | string) => String(n).padStart(2, '0'),
  dayKey(ts: number | Date) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  },
  startOfDay(ts: number | Date) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },
  addDays(ts: number | Date, n: number) {
    const d = new Date(ts);
    d.setDate(d.getDate() + n);
    return d.getTime();
  },
  fmtDur(ms: number, opts: { short?: boolean } = {}) {
    const totalMin = Math.round(ms / 60000);
    if (ms > 0 && totalMin === 0) return opts.short ? '<1m' : 'menos de 1 min';
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (h === 0) return m + 'm';
    return m ? `${h}h ${m}m` : `${h}h`;
  },
  fmtClock(ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}:${U.pad(m)}:${U.pad(sec)}` : `${U.pad(m)}:${U.pad(sec)}`;
  },
  debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
    let t: any;
    return (...a: Parameters<T>) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  },
  hexToRgb(hex: string): [number, number, number] {
    const norm = U.normalizeHex(hex);
    if (!norm) return [94, 106, 210];
    const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(norm);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [94, 106, 210];
  },
  normalizeHex(v: any): string | null {
    if (typeof v !== 'string') return null;
    const raw = v.trim().replace(/^#/, '');
    if (/^[\da-f]{6}$/i.test(raw)) {
      return `#${raw.toLowerCase()}`;
    }
    if (/^[\da-f]{3}$/i.test(raw)) {
      const expanded = raw
        .split('')
        .map(ch => ch + ch)
        .join('');
      return `#${expanded.toLowerCase()}`;
    }
    return null;
  },
  isHex: (v: any): boolean => U.normalizeHex(v) !== null,
  getContrastTextColor(hex: string): '#ffffff' | '#0d0e16' {
    const [r, g, b] = U.hexToRgb(hex);
    const toLinear = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return luminance > 0.45 ? '#0d0e16' : '#ffffff';
  },
  hashStr(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
};

export const {
  uid,
  clamp,
  isObj,
  deepMerge,
  clone,
  esc,
  pad,
  dayKey,
  startOfDay,
  addDays,
  fmtDur,
  fmtClock,
  debounce,
  hexToRgb,
  normalizeHex,
  isHex,
  getContrastTextColor,
  hashStr,
} = U;
