import { U } from './utils';
import { MESHES, SOLIDS, CATEGORIES } from './constants';
import { Anim, AnimationInstance } from './animations';

export { SOLIDS, CATEGORIES };

export const W0 = 1920;
export const H0 = 1080;

export interface SceneDefinition {
  id: string;
  name: string;
  cats: string[];
  base: string;
  draw: (ctx: CanvasRenderingContext2D, rng: () => number) => void;
  anim?: () => AnimationInstance;
}

export const P = {
  rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  lg(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  },
  rg(c: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  },
  rgba(hex: string, a: number) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },
  glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a = 1, op: GlobalCompositeOperation = 'lighter') {
    c.save();
    c.globalCompositeOperation = op;
    c.fillStyle = P.rg(c, x, y, 0, r, [
      [0, P.rgba(hex, a)],
      [0.35, P.rgba(hex, a * 0.45)],
      [1, P.rgba(hex, 0)],
    ]);
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  },
  rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    c.beginPath();
    if (typeof (c as any).roundRect === 'function') {
      (c as any).roundRect(x, y, w, h, r);
    } else {
      c.rect(x, y, w, h);
    }
  },
  blur(c: CanvasRenderingContext2D, px: number) {
    if ('filter' in c) (c as any).filter = px ? `blur(${Math.max(0, px * ((c as any)._s || 1))}px)` : 'none';
  },
  noBlur(c: CanvasRenderingContext2D) {
    if ('filter' in c) (c as any).filter = 'none';
  },
  pick: (r: () => number, arr: string[]) => arr[Math.floor(r() * arr.length) % arr.length],
  ridge(
    c: CanvasRenderingContext2D,
    r: () => number,
    opts: {
      y: number;
      amp: number;
      rough?: number;
      color: string;
      x0?: number;
      x1?: number;
      depth?: number;
      bottom?: number;
      peaks?: [number, number][];
    }
  ) {
    const { y, amp, rough = 0.55, color, x0 = -40, x1 = W0 + 40, depth = 8, bottom = H0 + 10, peaks } = opts;
    let pts: [number, number][] = peaks ? peaks.map(p => [p[0], p[1]]) : [
      [x0, y + (r() - 0.5) * amp],
      [x1, y + (r() - 0.5) * amp],
    ];
    let a = amp;
    for (let d = 0; d < depth; d++) {
      const np: [number, number][] = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [xa, ya] = pts[i - 1],
          [xb, yb] = pts[i];
        np.push([(xa + xb) / 2, (ya + yb) / 2 + (r() - 0.5) * a]);
        np.push([xb, yb]);
      }
      pts = np;
      a *= rough;
    }
    c.beginPath();
    c.moveTo(x0, bottom);
    pts.forEach(p => c.lineTo(p[0], p[1]));
    c.lineTo(x1, bottom);
    c.closePath();
    c.fillStyle = color;
    c.fill();
    return pts;
  },
  blobs(
    c: CanvasRenderingContext2D,
    r: () => number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    n: number,
    colors: string[],
    rmin: number,
    rmax: number,
    alpha = 1
  ) {
    c.save();
    c.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2,
        d = Math.sqrt(r());
      const x = cx + Math.cos(ang) * rx * d,
        y = cy + Math.sin(ang) * ry * d;
      c.fillStyle = P.pick(r, colors);
      c.beginPath();
      c.arc(x, y, rmin + r() * (rmax - rmin), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  },
  foliage(
    c: CanvasRenderingContext2D,
    r: () => number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    n: number,
    pal: string[][],
    size = 1
  ) {
    const pass = (count: number, cols: string[], rmin: number, rmax: number, dy: number, bias: number) => {
      for (let i = 0; i < count; i++) {
        const ang = r() * Math.PI * 2,
          d = Math.sqrt(r());
        const x = cx + Math.cos(ang) * rx * d - bias * rx * 0.25,
          y = cy + Math.sin(ang) * ry * d + dy - bias * ry * 0.3;
        const rad = (rmin + r() * (rmax - rmin)) * size;
        c.fillStyle = P.pick(r, cols);
        c.beginPath();
        c.ellipse(x, y, rad, rad * (0.55 + r() * 0.3), r() * Math.PI, 0, Math.PI * 2);
        c.fill();
      }
    };
    pass(n, pal[0], 22, 48, 14, 0);
    pass(Math.round(n * 1.2), pal[1], 12, 30, 0, 0.3);
    pass(Math.round(n * 0.9), pal[2], 5, 14, -6, 0.9);
  },
  soft(
    c: CanvasRenderingContext2D,
    px: number,
    fn: (x: CanvasRenderingContext2D) => void,
    op: GlobalCompositeOperation = 'source-over',
    scale = 0.25
  ) {
    const s = (c as any)._s || 1;
    const w = Math.max(1, Math.ceil(c.canvas.width * scale)),
      h = Math.max(1, Math.ceil(c.canvas.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const x = cv.getContext('2d')!;
    (x as any)._s = s * scale;
    x.setTransform((x as any)._s, 0, 0, (x as any)._s, 0, 0);
    fn(x);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = op;
    if ('filter' in c && px) (c as any).filter = `blur(${Math.max(0.5, px * s * 0.5)}px)`;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(cv, 0, 0, c.canvas.width, c.canvas.height);
    c.restore();
  },
  pine(c: CanvasRenderingContext2D, x: number, base: number, h: number, w: number, color: string) {
    const tiers = 7;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, base - h);
    for (let i = 1; i <= tiers; i++) {
      const y = base - h + ((h * 0.92) * i) / tiers,
        wi = (w / 2) * (0.25 + (0.75 * i) / tiers);
      c.lineTo(x + wi, y);
      if (i < tiers) c.lineTo(x + wi * 0.45, y - (h / tiers) * 0.08);
    }
    c.lineTo(x + w * 0.05, base - h * 0.08);
    c.lineTo(x + w * 0.05, base);
    c.lineTo(x - w * 0.05, base);
    c.lineTo(x - w * 0.05, base - h * 0.08);
    for (let i = tiers; i >= 1; i--) {
      const y = base - h + ((h * 0.92) * i) / tiers,
        wi = (w / 2) * (0.25 + (0.75 * i) / tiers);
      if (i < tiers) c.lineTo(x - wi * 0.45, y - (h / tiers) * 0.08);
      c.lineTo(x - wi, y);
    }
    c.closePath();
    c.fill();
  },
  stars(c: CanvasRenderingContext2D, r: () => number, n: number, yMax: number, maxR = 1.6, alpha = 1) {
    for (let i = 0; i < n; i++) {
      const x = r() * W0,
        y = Math.pow(r(), 1.4) * yMax,
        s = r() * maxR + 0.3;
      c.fillStyle = `rgba(255,255,255,${(0.25 + r() * 0.75) * alpha})`;
      c.beginPath();
      c.arc(x, y, s, 0, Math.PI * 2);
      c.fill();
    }
  },
  _grain: null as HTMLCanvasElement | null,
  grain(c: CanvasRenderingContext2D, amount = 0.06) {
    if (!P._grain && typeof document !== 'undefined') {
      const g = document.createElement('canvas');
      g.width = g.height = 200;
      const gc = g.getContext('2d')!;
      const id = gc.createImageData(200, 200);
      const rr = P.rng(7);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = rr() * 255;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      gc.putImageData(id, 0, 0);
      P._grain = g;
    }
    if (P._grain) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = amount;
      c.globalCompositeOperation = 'overlay';
      const pat = c.createPattern(P._grain, 'repeat');
      if (pat) {
        c.fillStyle = pat;
        c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      }
      c.restore();
    }
  },
  vignette(c: CanvasRenderingContext2D, strength = 0.45, col = '0,0,0') {
    c.fillStyle = P.rg(c, W0 / 2, H0 / 2, H0 * 0.35, W0 * 0.72, [
      [0, `rgba(${col},0)`],
      [1, `rgba(${col},${strength})`],
    ]);
    c.fillRect(0, 0, W0, H0);
  },
  mesh(c: CanvasRenderingContext2D, base: string, blobs: [number, number, number, string, number?][]) {
    c.fillStyle = base;
    c.fillRect(0, 0, W0, H0);
    for (const [x, y, rad, col, a = 1] of blobs) {
      c.fillStyle = P.rg(c, x, y, 0, rad, [
        [0, P.rgba(col, a)],
        [0.55, P.rgba(col, a * 0.5)],
        [1, P.rgba(col, 0)],
      ]);
      c.fillRect(0, 0, W0, H0);
    }
  },
  grass(
    c: CanvasRenderingContext2D,
    r: () => number,
    n: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    colors: string[],
    hmin: number,
    hmax: number,
    lw = 2
  ) {
    c.save();
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0),
        y = y0 + Math.pow(r(), 0.8) * (y1 - y0);
      const h = (hmin + r() * (hmax - hmin)) * (0.5 + (y - y0) / (y1 - y0 + 1));
      c.strokeStyle = P.pick(r, colors);
      c.lineWidth = lw * (0.6 + r());
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + (r() - 0.5) * h * 0.5, y - h * 0.6, x + (r() - 0.5) * h * 0.8, y - h);
      c.stroke();
    }
    c.restore();
  },
  flower(c: CanvasRenderingContext2D, x: number, y: number, s: number, petal: string, center: string, n = 8) {
    c.fillStyle = petal;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.55, s * 0.6, s * 0.28, a, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = center;
    c.beginPath();
    c.arc(x, y, s * 0.38, 0, Math.PI * 2);
    c.fill();
  },
  windows(
    c: CanvasRenderingContext2D,
    r: () => number,
    x: number,
    y: number,
    w: number,
    h: number,
    cols: number,
    rows: number,
    onRate: number,
    warm = ['#ffd27a', '#ffc46b', '#ffe3a3'],
    cool = ['#9ec5ff', '#c7d8ff'],
    a = 0.9
  ) {
    const cw = w / cols,
      ch = h / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() > onRate) continue;
        c.globalAlpha = a * (0.5 + r() * 0.5);
        c.fillStyle = r() < 0.8 ? P.pick(r, warm) : P.pick(r, cool);
        c.fillRect(x + i * cw + cw * 0.22, y + j * ch + ch * 0.22, cw * 0.56, ch * 0.5);
      }
    }
    c.globalAlpha = 1;
  },
};

/* ---------------- Escenas ---------------- */
export function drawCafe(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#17132f'],
    [0.55, '#2a2254'],
    [1, '#161127'],
  ]);
  c.fillRect(0, 0, W0, H0);

  c.save();
  c.globalAlpha = 1;
  for (let y = 0; y < 820; y += 34) {
    const off = (y / 34) % 2 ? 45 : 0;
    for (let x = -90 + off; x < W0; x += 90) {
      c.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.03})`;
      c.fillRect(x + 2, y + 2, 86, 30);
    }
  }
  c.restore();

  [[330, 150], [590, 150], [1060, 150], [1330, 150]].forEach(([x, w]) => {
    c.fillStyle = '#120e24';
    c.fillRect(x - 10, -10, w + 20, 125);
    c.fillStyle = P.lg(c, 0, 0, 0, 110, [
      [0, '#ffd7a0'],
      [1, '#f0a36f'],
    ]);
    c.fillRect(x, -10, w, 110);
    c.fillStyle = 'rgba(120,60,90,.35)';
    c.fillRect(x, -10, w * 0.28, 110);
    c.fillRect(x + w * 0.72, -10, w * 0.28, 110);
    c.fillStyle = '#120e24';
    c.fillRect(x + w / 2 - 4, -10, 8, 110);
    c.fillRect(x, 40, w, 7);
    P.glow(c, x + w / 2, 50, 190, '#ffb070', 0.18);
  });

  c.fillStyle = '#141029';
  c.fillRect(1640, 180, 300, 900);
  c.fillStyle = P.lg(c, 0, 330, 0, 800, [
    [0, '#6b2f5e'],
    [1, '#2d1840'],
  ]);
  c.fillRect(1690, 330, 230, 470);
  P.blobs(c, P.rng(31), 1800, 520, 90, 170, 60, ['#e06aa0', '#ff9cc0', '#b44d86', '#f5c16c'], 6, 16, 0.55);
  c.fillStyle = '#141029';
  c.fillRect(1690, 520, 230, 10);
  c.fillRect(1795, 330, 10, 470);

  P.rr(c, 1665, 205, 250, 62, 8);
  c.fillStyle = '#1b2f7a';
  c.fill();
  c.save();
  c.shadowColor = '#5b8cff';
  c.shadowBlur = 30 * ((c as any)._s || 1);
  c.fillStyle = '#9dbaff';
  c.font = `600 38px 'Inter Variable', sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('ramen', 1790, 237);
  c.restore();
  P.glow(c, 1790, 236, 260, '#4a78ff', 0.22);

  c.fillStyle = '#0d0a1c';
  c.beginPath();
  c.moveTo(40, H0);
  c.bezierCurveTo(70, 700, 120, 420, 60, 120);
  c.lineTo(110, 110);
  c.bezierCurveTo(170, 400, 150, 720, 170, H0);
  c.fill();
  c.lineWidth = 16;
  c.strokeStyle = '#0d0a1c';
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(90, 260);
  c.quadraticCurveTo(170, 180, 260, 150);
  c.stroke();
  c.beginPath();
  c.moveTo(80, 180);
  c.quadraticCurveTo(20, 110, -20, 90);
  c.stroke();
  P.blobs(c, P.rng(4), 150, 60, 230, 110, 170, ['#2d1d44', '#3a2256', '#472a63', '#261a3a'], 14, 40);
  P.blobs(c, P.rng(5), 1830, 90, 170, 120, 160, ['#f29cc6', '#e27fb0', '#ffc2dc', '#c95f98', '#7a3a6a'], 5, 15, 0.9);
  P.blobs(c, P.rng(6), 1880, 250, 110, 80, 70, ['#f29cc6', '#ffc2dc', '#c95f98'], 4, 12, 0.85);

  c.fillStyle = P.lg(c, 0, 190, 0, 300, [
    [0, '#52409f'],
    [1, '#3a2c7c'],
  ]);
  c.beginPath();
  c.moveTo(270, 200);
  c.lineTo(1650, 200);
  c.lineTo(1700, 300);
  c.lineTo(220, 300);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.05)';
  for (let x = 250; x < 1690; x += 120) {
    c.beginPath();
    c.moveTo(x + 20, 200);
    c.lineTo(x + 80, 200);
    c.lineTo(x + 80 - (x - 960) * 0.04, 300);
    c.lineTo(x + 20 - (x - 960) * 0.04, 300);
    c.fill();
  }
  c.fillStyle = '#31256a';
  for (let x = 220; x < 1700; x += 50) {
    c.beginPath();
    c.arc(x + 25, 300, 25, 0, Math.PI);
    c.fill();
  }

  c.fillStyle = '#18122e';
  c.fillRect(300, 318, 1320, 490);

  const panes: [number, number, number, number][] = [
    [328, 342, 180, 430],
    [540, 342, 720, 430],
    [1292, 342, 300, 430],
  ];
  c.save();
  c.beginPath();
  panes.forEach(p => c.rect(...p));
  c.clip();
  c.fillStyle = P.lg(c, 0, 342, 0, 772, [
    [0, '#e6bfb2'],
    [0.45, '#d9a8a2'],
    [1, '#b48a9f'],
  ]);
  c.fillRect(300, 330, 1320, 460);

  const jr = P.rng(11);
  [[430, 560, 1240], [490, 560, 1240]].forEach(([y, x0, x1]) => {
    c.fillStyle = '#9a6752';
    c.fillRect(x0 + 180, y, x1 - x0 - 180, 9);
    for (let x = x0 + 190; x < x1 - 20; ) {
      const w = 14 + jr() * 22,
        h = 18 + jr() * 30;
      c.fillStyle = P.pick(jr, ['#fff3e6', '#e9a3a0', '#b3d4c8', '#f3cf8e', '#c6b0e8', '#ffffff', '#8fb6d9']);
      P.rr(c, x, y - h, w, h, 4);
      c.fill();
      x += w + 6 + jr() * 14;
    }
  });

  c.fillStyle = '#f5e7ef';
  c.fillRect(352, 372, 132, 118);
  c.strokeStyle = '#a58db5';
  c.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(366, 400 + i * 14);
    c.lineTo(366 + 40 + jr() * 60, 400 + i * 14);
    c.stroke();
  }
  c.fillStyle = '#e9d5e0';
  c.fillRect(870, 352, 110, 80);
  c.fillStyle = '#b595c4';
  c.fillRect(885, 368, 60, 6);
  c.fillRect(885, 384, 80, 5);
  c.fillRect(885, 398, 50, 5);

  c.fillStyle = P.lg(c, 600, 0, 720, 0, [
    [0, '#d7dbe4'],
    [1, '#8c93a6'],
  ]);
  P.rr(c, 598, 468, 120, 96, 10);
  c.fill();
  c.fillStyle = '#5c6275';
  c.fillRect(620, 540, 76, 10);
  c.fillStyle = '#2d2a3a';
  c.fillRect(640, 500, 36, 26);

  [[700, 395], [960, 380], [1190, 395]].forEach(([x, y]) => {
    c.strokeStyle = '#4a3a55';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, 342);
    c.lineTo(x, y);
    c.stroke();
    c.fillStyle = '#fbeee4';
    c.beginPath();
    c.arc(x, y + 14, 24, Math.PI, 0);
    c.fill();
    P.glow(c, x, y + 20, 230, '#ffd9b0', 0.3);
  });

  c.fillStyle = '#5c3b55';
  c.fillRect(560, 576, 700, 20);
  c.fillStyle = P.lg(c, 0, 596, 0, 700, [
    [0, '#3f2b52'],
    [1, '#2c1f3d'],
  ]);
  c.fillRect(570, 596, 680, 110);
  c.strokeStyle = 'rgba(255,255,255,.06)';
  c.lineWidth = 3;
  for (let x = 640; x < 1250; x += 90) {
    c.beginPath();
    c.moveTo(x, 606);
    c.lineTo(x, 696);
    c.stroke();
  }

  c.fillStyle = 'rgba(255,255,255,.55)';
  c.beginPath();
  c.arc(860, 556, 26, Math.PI, 0);
  c.fill();
  c.fillStyle = '#e2a07e';
  c.fillRect(840, 552, 40, 12);
  ([[1000, '#f1e2d0'], [1030, '#d8c1e6'], [1100, '#fff']] as [number, string][]).forEach(([x, col]) => {
    c.fillStyle = col;
    P.rr(c, x, 548, 20, 28, 4);
    c.fill();
  });

  c.fillStyle = P.lg(c, 0, 700, 0, 772, [
    [0, '#b27d60'],
    [1, '#8f5e4b'],
  ]);
  c.fillRect(540, 700, 720, 80);
  c.strokeStyle = 'rgba(60,30,30,.35)';
  c.lineWidth = 2;
  for (let i = -8; i <= 8; i++) {
    c.beginPath();
    c.moveTo(900 + i * 40, 700);
    c.lineTo(900 + i * 110, 780);
    c.stroke();
  }

  [660, 780, 900, 1020, 1140].forEach(x => {
    c.strokeStyle = '#4a2f36';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(x - 22, 622);
    c.lineTo(x - 28, 752);
    c.moveTo(x + 22, 622);
    c.lineTo(x + 28, 752);
    c.moveTo(x, 624);
    c.lineTo(x, 748);
    c.stroke();
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(x, 700, 26, 6, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#7f64a8';
    c.beginPath();
    c.ellipse(x, 622, 36, 11, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#b89ade';
    c.beginPath();
    c.ellipse(x, 617, 34, 9, 0, 0, Math.PI * 2);
    c.fill();
  });

  c.fillStyle = 'rgba(230,240,255,.55)';
  P.rr(c, 1420, 380, 140, 330, 8);
  c.fill();
  const gr = P.rng(21);
  for (let y = 400; y < 700; y += 55) {
    c.fillStyle = '#9fb0c6';
    c.fillRect(1428, y + 40, 124, 4);
    for (let x = 1432; x < 1545; x += 16) {
      c.fillStyle = P.pick(gr, ['#ff8fa8', '#8fd3c4', '#ffd07a', '#b7a4f2', '#fff']);
      c.fillRect(x, y + 14 + gr() * 8, 11, 26);
    }
  }
  c.fillStyle = '#8f6a78';
  c.fillRect(1300, 470, 110, 6);
  P.blobs(c, gr, 1350, 440, 50, 20, 20, ['#d98fb0', '#f2b8cc', '#e7cf9a'], 6, 12);

  P.foliage(c, P.rng(8), 420, 640, 64, 54, 18, [['#3f6a4c', '#48735a'], ['#5e8f6a', '#6c9a70'], ['#8fbf8a', '#a3cf98']], 0.6);
  c.fillStyle = '#b5705a';
  c.fillRect(390, 680, 62, 70);

  c.fillStyle = 'rgba(100, 60, 180, .24)';
  c.fillRect(300, 330, 1320, 460);

  c.globalCompositeOperation = 'lighter';
  c.fillStyle = P.lg(c, 0, 342, 400, 772, [
    [0, 'rgba(255,255,255,.07)'],
    [0.5, 'rgba(255,255,255,0)'],
    [1, 'rgba(255,255,255,.03)'],
  ]);
  c.fillRect(300, 330, 1320, 460);
  c.restore();

  c.fillStyle = '#1a1430';
  c.fillRect(508, 330, 32, 460);
  c.fillRect(1260, 330, 32, 460);
  c.fillRect(300, 772, 1320, 36);
  c.fillStyle = '#261d45';
  c.fillRect(290, 800, 1340, 16);

  P.glow(c, 960, 190, 300, '#b77cff', 0.35);
  P.rr(c, 832, 140, 256, 96, 10);
  c.fillStyle = '#5a3da8';
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = '#c6a2ff';
  c.stroke();
  c.save();
  c.shadowColor = '#f0c7ff';
  c.shadowBlur = 24 * ((c as any)._s || 1);
  c.fillStyle = '#f7e2ff';
  c.font = `76px 'DM Serif Display', Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('café', 960, 184);
  c.restore();
  c.strokeStyle = '#2b2150';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(900, 140);
  c.lineTo(900, 118);
  c.moveTo(1020, 140);
  c.lineTo(1020, 118);
  c.stroke();

  [[240, 700], [1648, 720]].forEach(([x, y]) => {
    P.foliage(c, P.rng(x), x, y, 50, 64, 24, [['#142219', '#1a2a20'], ['#223a2b', '#2a4533'], ['#3a5e45', '#4a6e52']], 0.8);
    c.fillStyle = '#231a36';
    c.fillRect(x - 36, y + 50, 72, 70);
  });

  c.fillStyle = P.lg(c, 0, 816, 0, H0, [
    [0, '#231d3d'],
    [1, '#0f0c1c'],
  ]);
  c.fillRect(0, 816, W0, H0 - 816);
  c.fillStyle = '#2d2650';
  c.fillRect(0, 890, W0, 6);
  c.strokeStyle = 'rgba(0,0,0,.25)';
  c.lineWidth = 2;
  for (let x = -100; x < W0 + 100; x += 170) {
    c.beginPath();
    c.moveTo(x, 896);
    c.lineTo(x - 120, H0);
    c.stroke();
  }

  P.soft(
    c,
    18,
    x => {
      x.fillStyle = 'rgba(255,190,170,.16)';
      x.fillRect(560, 830, 700, 170);
      x.fillStyle = 'rgba(255,215,190,.12)';
      [700, 960, 1190].forEach(v => x.fillRect(v - 25, 840, 50, 200));
      x.fillStyle = 'rgba(190,150,255,.14)';
      x.fillRect(840, 820, 240, 90);
      x.fillStyle = 'rgba(90,130,255,.12)';
      x.fillRect(1680, 830, 240, 140);
    },
    'lighter'
  );

  P.glow(c, 960, 620, 820, '#ff9fc2', 0.08);
  c.fillStyle = 'rgba(40,20,90,.18)';
  c.fillRect(0, 0, W0, H0);
  P.vignette(c, 0.55, '10,6,25');
}

export function drawBosque(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#0b2216'],
    [0.45, '#1f4b2c'],
    [1, '#0c2517'],
  ]);
  c.fillRect(0, 0, W0, H0);
  P.glow(c, 1060, 380, 700, '#c7e39a', 0.42, 'source-over');

  P.soft(c, 10, x =>
    P.foliage(x, r, 1050, 330, 600, 250, 90, [['#5d8a53', '#6f9a5f'], ['#86b070', '#9cc184'], ['#b9d993', '#cfe6a4']], 1.4)
  );
  P.glow(c, 1060, 380, 420, '#e8f5b8', 0.35, 'source-over');
  P.soft(
    c,
    28,
    x => {
      for (let i = 0; i < 6; i++) {
        const v = 820 + i * 95;
        x.fillStyle = 'rgba(235,255,200,.08)';
        x.beginPath();
        x.moveTo(v, -20);
        x.lineTo(v + 70, -20);
        x.lineTo(v + 260 + i * 30, 900);
        x.lineTo(v + 140 + i * 30, 900);
        x.fill();
      }
    },
    'lighter'
  );

  const trunk = (pts: [number, number][], w: number, col: string) => {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(...pts[0]);
    c.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]);
    c.stroke();
  };
  trunk([[260, H0], [300, 700], [180, 350], [330, -40]], 120, '#1a2b17');
  trunk([[380, H0], [420, 760], [520, 420], [470, -40]], 70, '#223822');
  trunk([[1640, H0], [1600, 700], [1740, 380], [1620, -40]], 130, '#162615');
  trunk([[1480, H0], [1500, 760], [1420, 450], [1500, -40]], 60, '#223a22');
  c.save();
  c.globalAlpha = 0.35;
  trunk([[300, H0], [330, 700], [220, 350], [360, -40]], 30, '#4d6b33');
  trunk([[1600, H0], [1570, 700], [1700, 380], [1590, -40]], 26, '#4d6b33');
  c.restore();

  c.fillStyle = P.rg(c, 690, 470, 20, 230, [
    [0, 'rgba(3,12,6,.85)'],
    [1, 'rgba(3,12,6,0)'],
  ]);
  c.fillRect(420, 220, 540, 500);

  const canopy = [
    ['#112b18', '#16361f', '#1a3d22'],
    ['#1f4a28', '#27603a', '#2d6a36'],
    ['#4b8a47', '#6aa355', '#8cbf5e'],
  ];
  P.foliage(c, r, 300, 60, 440, 210, 150, canopy);
  P.foliage(c, r, 1650, 70, 440, 230, 150, canopy);
  P.foliage(c, r, 1000, -30, 540, 110, 90, canopy);
  P.blobs(c, r, 300, 90, 360, 160, 70, ['#a9d06d', '#c6de7f'], 2, 5, 0.8);
  P.blobs(c, r, 1650, 110, 360, 160, 70, ['#a9d06d', '#c6de7f'], 2, 5, 0.8);

  c.fillStyle = P.lg(c, 0, 520, 0, H0, [
    [0, '#3f7a3a'],
    [1, '#1d4424'],
  ]);
  c.beginPath();
  c.moveTo(0, 620);
  c.bezierCurveTo(500, 520, 1400, 520, W0, 610);
  c.lineTo(W0, H0);
  c.lineTo(0, H0);
  c.fill();

  c.save();
  c.fillStyle = P.lg(c, 0, 520, 0, H0, [
    [0, 'rgba(214,196,150,.75)'],
    [1, 'rgba(160,140,100,.5)'],
  ]);
  c.beginPath();
  c.moveTo(1180, 540);
  c.bezierCurveTo(1220, 560, 1160, 620, 1230, 660);
  c.bezierCurveTo(1320, 720, 1260, 820, 1150, 900);
  c.bezierCurveTo(1060, 980, 1040, 1040, 1060, H0 + 10);
  c.lineTo(1280, H0 + 10);
  c.bezierCurveTo(1250, 1020, 1300, 950, 1360, 880);
  c.bezierCurveTo(1440, 790, 1340, 700, 1260, 650);
  c.bezierCurveTo(1220, 620, 1250, 570, 1200, 540);
  c.fill();
  c.restore();

  P.grass(c, r, 900, 0, W0, 560, H0, ['#5f9a47', '#4a8a3c', '#77ad55', '#2f6a30', '#8dbf62'], 14, 40, 2.2);

  const bush = [
    ['#0b2412', '#0e2e16'],
    ['#15401f', '#1a4a24', '#1f5229'],
    ['#2f6a33', '#3f7f3c', '#4e8f45'],
  ];
  P.foliage(c, r, 140, 920, 300, 220, 110, bush, 1.2);
  P.foliage(c, r, 1800, 900, 300, 230, 110, bush, 1.2);

  const fern = (x: number, y: number, len: number, ang: number, col: string) => {
    c.strokeStyle = col;
    c.lineWidth = 3;
    c.lineCap = 'round';
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push([x + Math.cos(ang) * len * t, y + Math.sin(ang) * len * t + t * t * len * 0.35]);
    }
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
    c.stroke();
    c.lineWidth = 2;
    pts.forEach(([px, py], i) => {
      if (!i) return;
      const l = (1 - i / 20) * len * 0.16 + 6;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(ang - 1.2) * l, py + Math.sin(ang - 1.2) * l);
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(ang + 1.2) * l, py + Math.sin(ang + 1.2) * l);
      c.stroke();
    });
  };
  const fr = P.rng(3);
  for (let i = 0; i < 9; i++) fern(360 + fr() * 120, 640 + fr() * 80, 150 + fr() * 120, -2.2 + fr() * 1.3, P.pick(fr, ['#4e8a3c', '#6aa84a', '#3c7431']));
  for (let i = 0; i < 7; i++) fern(1500 + fr() * 120, 640 + fr() * 80, 150 + fr() * 100, -1.4 + fr() * 1.2, P.pick(fr, ['#4e8a3c', '#6aa84a', '#3c7431']));

  const fl = P.rng(12);
  for (let i = 0; i < 26; i++) {
    const x = 230 + fl() * 700,
      y = 700 + fl() * 330;
    P.flower(c, x, y, 10 + (y - 650) / 30 + fl() * 6, '#f4f1e6', '#e8c33c');
  }
  for (let i = 0; i < 14; i++) {
    const x = 1300 + fl() * 500,
      y = 760 + fl() * 280;
    P.flower(c, x, y, 8 + fl() * 10, '#f4f1e6', '#e8c33c');
  }
  P.blobs(c, fl, 190, 520, 90, 80, 90, ['#e0679a', '#f59ac0', '#c94b85'], 3, 7);
  P.blobs(c, fl, 1500, 700, 180, 90, 120, ['#e0679a', '#f59ac0', '#c94b85', '#ffb3d1'], 3, 7);
  P.blobs(c, fl, 1780, 640, 110, 90, 80, ['#e0679a', '#f59ac0'], 4, 8);
  P.blobs(c, fl, 960, 760, 600, 260, 200, ['#f2d45c', '#ffe98a', '#dbe4ff', '#9ec5ff'], 2, 4, 0.8);

  for (let i = 0; i < 30; i++) P.glow(c, 500 + fl() * 1000, 250 + fl() * 500, 10 + fl() * 10, '#fff3a0', 0.5);
  P.vignette(c, 0.5, '2,10,4');
}

export function drawVentana(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#070d1d'],
    [0.5, '#101b35'],
    [1, '#0a1022'],
  ]);
  c.fillRect(0, 0, W0, H0);
  const cols = ['#ffb45e', '#ff8a59', '#ffd98a', '#7fb2ff', '#c58bff', '#ff8fb1', '#9fe0ff'];
  P.soft(c, 22, x => {
    for (let i = 0; i < 70; i++) {
      const px = r() * W0,
        py = 360 + (r() - 0.5) * 520,
        rad = 20 + r() * 110;
      x.fillStyle = P.rgba(P.pick(r, cols), 0.12 + r() * 0.35);
      x.beginPath();
      x.arc(px, py, rad, 0, Math.PI * 2);
      x.fill();
    }
  });
  P.soft(
    c,
    5,
    x => {
      for (let i = 0; i < 90; i++) {
        const px = r() * W0,
          py = 420 + (r() - 0.5) * 400,
          rad = 6 + r() * 26;
        x.fillStyle = P.rgba(P.pick(r, cols), 0.25 + r() * 0.45);
        x.beginPath();
        x.arc(px, py, rad, 0, Math.PI * 2);
        x.fill();
      }
    },
    'lighter',
    0.5
  );
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, 'rgba(5,10,25,.55)'],
    [0.35, 'rgba(5,10,25,0)'],
    [0.75, 'rgba(5,10,25,0)'],
    [1, 'rgba(5,10,25,.6)'],
  ]);
  c.fillRect(0, 0, W0, H0);

  for (let i = 0; i < 420; i++) {
    const x = r() * W0,
      y = r() * H0,
      s = 1.5 + Math.pow(r(), 3) * 9;
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.beginPath();
    c.ellipse(x, y + s * 0.15, s, s * 1.1, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(200,220,255,.18)';
    c.beginPath();
    c.ellipse(x, y, s * 0.85, s * 0.95, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.arc(x - s * 0.3, y - s * 0.35, s * 0.22, 0, Math.PI * 2);
    c.fill();
  }

  c.fillStyle = '#060913';
  c.fillRect(0, 0, 40, H0);
  c.fillRect(W0 - 40, 0, 40, H0);
  c.fillRect(0, H0 - 60, W0, 60);
  c.fillRect(W0 / 2 - 14, 0, 28, H0 - 60);
  c.fillStyle = 'rgba(255,255,255,.04)';
  c.fillRect(40, H0 - 64, W0 - 80, 4);
  P.vignette(c, 0.5);
}

export function drawEscritorio(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#1d1411'],
    [1, '#34221b'],
  ]);
  c.fillRect(0, 0, W0, H0);

  const wx = 560,
    wy = 90,
    ww = 800,
    wh = 540;
  c.save();
  c.beginPath();
  c.rect(wx, wy, ww, wh);
  c.clip();
  c.fillStyle = P.lg(c, 0, wy, 0, wy + wh, [
    [0, '#141a38'],
    [0.7, '#3a2f63'],
    [1, '#6b4a7a'],
  ]);
  c.fillRect(wx, wy, ww, wh);
  P.stars(c, r, 80, 360, 1.3, 0.8);
  const br = P.rng(17);
  for (let x = wx - 20; x < wx + ww; x += 40 + br() * 60) {
    const h = 120 + br() * 260,
      w = 50 + br() * 70;
    c.fillStyle = '#1d1838';
    c.fillRect(x, wy + wh - h, w, h);
    P.windows(c, br, x, wy + wh - h, w, h, Math.round(w / 14), Math.round(h / 18), 0.35);
  }
  P.soft(
    c,
    10,
    x => {
      for (let i = 0; i < 20; i++) {
        x.fillStyle = P.rgba(P.pick(br, ['#ffcf7a', '#ff9e7a', '#9fc0ff']), 0.35);
        x.beginPath();
        x.arc(wx + br() * ww, wy + wh - br() * 140, 8 + br() * 18, 0, 7);
        x.fill();
      }
    },
    'lighter'
  );
  c.strokeStyle = 'rgba(200,215,255,.12)';
  c.lineWidth = 1.2;
  for (let i = 0; i < 90; i++) {
    const x = wx + br() * ww,
      y = wy + br() * wh;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 5, y + 30);
    c.stroke();
  }
  c.restore();

  c.fillStyle = '#140d0a';
  c.fillRect(wx - 26, wy - 26, ww + 52, 26);
  c.fillRect(wx - 26, wy + wh, ww + 52, 34);
  c.fillRect(wx - 26, wy, 26, wh);
  c.fillRect(wx + ww, wy, 26, wh);
  c.fillRect(wx + ww / 2 - 9, wy, 18, wh);
  c.fillRect(wx, wy + wh * 0.45, ww, 14);

  [[wx - 140, 1], [wx + ww + 30, -1]].forEach(([x]) => {
    c.fillStyle = P.lg(c, x, 0, x + 110, 0, [
      [0, '#3b2020'],
      [0.5, '#5a2d2a'],
      [1, '#2e1918'],
    ]);
    c.fillRect(x, 40, 110, 680);
  });

  P.glow(c, 470, 520, 700, '#ffb86b', 0.28);

  c.fillStyle = P.lg(c, 0, 700, 0, H0, [
    [0, '#7a5238'],
    [0.08, '#5e3e2a'],
    [1, '#2e1d13'],
  ]);
  c.fillRect(0, 700, W0, H0 - 700);
  c.fillStyle = 'rgba(255,220,170,.08)';
  c.fillRect(0, 700, W0, 6);

  c.fillStyle = '#2a211c';
  c.beginPath();
  c.ellipse(390, 712, 80, 16, 0, 0, 7);
  c.fill();
  c.strokeStyle = '#2a211c';
  c.lineWidth = 10;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(390, 705);
  c.lineTo(450, 520);
  c.lineTo(560, 450);
  c.stroke();
  c.fillStyle = '#3a2d25';
  c.beginPath();
  c.moveTo(530, 420);
  c.lineTo(640, 470);
  c.lineTo(600, 520);
  c.lineTo(500, 470);
  c.closePath();
  c.fill();
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = P.lg(c, 0, 500, 0, 760, [
    [0, 'rgba(255,214,150,.35)'],
    [1, 'rgba(255,214,150,0)'],
  ]);
  c.beginPath();
  c.moveTo(555, 495);
  c.lineTo(620, 505);
  c.lineTo(980, 800);
  c.lineTo(420, 800);
  c.closePath();
  c.fill();
  c.restore();
  P.glow(c, 590, 500, 120, '#ffe2b0', 0.8);
  P.glow(c, 700, 760, 420, '#ffc67a', 0.22);

  c.fillStyle = '#e9dfcc';
  c.beginPath();
  c.moveTo(760, 760);
  c.lineTo(1090, 748);
  c.lineTo(1130, 842);
  c.lineTo(770, 858);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(80,90,140,.35)';
  c.lineWidth = 2;
  for (let i = 1; i < 7; i++) {
    c.beginPath();
    c.moveTo(770 + i * 1.5, 760 + i * 13);
    c.lineTo(1095 + i * 5, 748 + i * 13);
    c.stroke();
  }
  c.strokeStyle = '#b9ab92';
  c.beginPath();
  c.moveTo(945, 754);
  c.lineTo(952, 850);
  c.stroke();
  c.strokeStyle = '#e0b04b';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(1010, 870);
  c.lineTo(1170, 812);
  c.stroke();

  c.fillStyle = '#d9cfc2';
  P.rr(c, 1175, 640, 70, 80, 10);
  c.fill();
  c.strokeStyle = '#d9cfc2';
  c.lineWidth = 9;
  c.beginPath();
  c.arc(1250, 675, 18, -1.3, 1.3);
  c.stroke();
  c.fillStyle = '#3b2415';
  c.beginPath();
  c.ellipse(1210, 644, 32, 7, 0, 0, 7);
  c.fill();

  const books: [string, number][] = [
    ['#8e3b46', 36],
    ['#2f5d62', 30],
    ['#c9a15b', 34],
    ['#3f3d6b', 28],
    ['#7a4a2e', 32],
  ];
  let yPos = 720;
  books.forEach(([col, h], i) => {
    const x = 1350 + (i % 2) * 14;
    yPos -= h;
    c.fillStyle = col;
    P.rr(c, x, yPos, 250, h - 2, 3);
    c.fill();
    c.fillStyle = '#efe6d6';
    c.fillRect(x + 234, yPos + 4, 12, h - 10);
    c.fillStyle = 'rgba(255,230,160,.5)';
    c.fillRect(x + 20, yPos + h / 2 - 3, 60, 3);
  });

  c.fillStyle = '#9c5c3e';
  c.beginPath();
  c.moveTo(1690, 620);
  c.lineTo(1790, 620);
  c.lineTo(1775, 715);
  c.lineTo(1705, 715);
  c.fill();
  const pr = P.rng(9);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (pr() - 0.5) * 2.4,
      l = 80 + pr() * 90;
    c.save();
    c.translate(1740, 625);
    c.rotate(a + Math.PI / 2);
    c.fillStyle = P.pick(pr, ['#2f5a36', '#3d7443', '#264a2c']);
    c.beginPath();
    c.ellipse(0, -l / 2, 16, l / 2, 0, 0, 7);
    c.fill();
    c.restore();
  }
  P.vignette(c, 0.6, '8,4,2');
}

export function drawFlames(c: CanvasRenderingContext2D, t: number, alphaMul = 1) {
  const cx = 960,
    base = 828;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const tongues: [number, number, number][] = [
    [-80, 120, 0],
    [-40, 170, 1.3],
    [0, 210, 2.1],
    [45, 160, 3.4],
    [85, 110, 4.2],
    [-15, 140, 5.1],
    [25, 130, 6],
  ];
  for (const [dx, h0, ph] of tongues) {
    const h = h0 * (0.82 + 0.18 * Math.sin(t * 7 + ph) + 0.08 * Math.sin(t * 13 + ph * 2));
    const sway = Math.sin(t * 3 + ph) * 12;
    const x = cx + dx,
      w = 34 + h0 * 0.12;
    const g = c.createLinearGradient(0, base, 0, base - h);
    g.addColorStop(0, `rgba(255,190,70,${0.95 * alphaMul})`);
    g.addColorStop(0.4, `rgba(255,120,30,${0.8 * alphaMul})`);
    g.addColorStop(1, 'rgba(200,40,10,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - w, base);
    c.bezierCurveTo(x - w, base - h * 0.4, x + sway - w * 0.3, base - h * 0.7, x + sway, base - h);
    c.bezierCurveTo(x + sway + w * 0.3, base - h * 0.7, x + w, base - h * 0.4, x + w, base);
    c.closePath();
    c.fill();
  }
  c.fillStyle = P.rg(c, cx, base - 30, 5, 110, [
    [0, `rgba(255,240,180,${0.6 * alphaMul})`],
    [1, 'rgba(255,200,100,0)'],
  ]);
  c.fillRect(cx - 120, base - 150, 240, 170);
  c.restore();
}

export function drawChimenea(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = '#2a1a10';
  c.fillRect(0, 0, W0, H0);
  for (let x = 0; x < W0; x += 96) {
    c.fillStyle = P.lg(c, x, 0, x + 96, 0, [
      [0, '#3d2616'],
      [0.5, '#4b2f1c'],
      [1, '#382214'],
    ]);
    c.fillRect(x, 0, 92, 880);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(x + 92, 0, 4, 880);
    for (let k = 0; k < 3; k++) {
      c.fillStyle = 'rgba(0,0,0,.2)';
      c.beginPath();
      c.ellipse(x + 30 + r() * 40, r() * 860, 6, 3, 0, 0, 7);
      c.fill();
    }
  }
  P.glow(c, 960, 700, 1100, '#ff8a3a', 0.28);

  c.fillStyle = '#3a312d';
  c.fillRect(680, 250, 560, 620);
  const sr = P.rng(5);
  for (let y = 256; y < 866; y += 44) {
    for (let x = 686 + (y % 88 ? 0 : 30); x < 1234; x += 60 + sr() * 30) {
      const w = 50 + sr() * 36;
      const v = Math.floor(85 + sr() * 50);
      c.fillStyle = `rgb(${v},${v - 10},${v - 18})`;
      P.rr(c, x, y, Math.min(w, 1234 - x), 38, 10);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.06)';
      c.fillRect(x + 4, y + 3, Math.min(w, 1234 - x) - 8, 5);
    }
  }

  c.fillStyle = '#23150c';
  c.fillRect(640, 470, 640, 44);
  c.fillStyle = 'rgba(255,190,120,.12)';
  c.fillRect(640, 470, 640, 5);
  c.fillStyle = '#efe3cf';
  c.fillRect(720, 410, 18, 60);
  c.fillRect(760, 430, 18, 40);
  P.glow(c, 729, 402, 30, '#ffd27a', 0.9);
  P.glow(c, 769, 422, 26, '#ffd27a', 0.9);
  c.fillStyle = '#6b4a2c';
  c.fillRect(1080, 390, 90, 80);
  c.fillStyle = '#a7c4b0';
  c.fillRect(1090, 400, 70, 60);

  c.fillStyle = '#120a07';
  c.beginPath();
  c.moveTo(800, 850);
  c.lineTo(800, 620);
  c.quadraticCurveTo(960, 520, 1120, 620);
  c.lineTo(1120, 850);
  c.fill();
  c.fillStyle = P.rg(c, 960, 820, 10, 220, [
    [0, 'rgba(255,140,40,.55)'],
    [1, 'rgba(255,90,20,0)'],
  ]);
  c.fillRect(800, 560, 320, 290);

  c.fillStyle = '#4a2a18';
  c.save();
  c.translate(960, 830);
  c.rotate(-0.12);
  P.rr(c, -120, -16, 240, 32, 16);
  c.fill();
  c.rotate(0.3);
  P.rr(c, -110, -34, 220, 28, 14);
  c.fill();
  c.restore();

  drawFlames(c, 0, 0.75);

  c.fillStyle = P.lg(c, 0, 870, 0, H0, [
    [0, '#4a2c19'],
    [1, '#26160c'],
  ]);
  c.fillRect(0, 870, W0, H0 - 870);
  c.strokeStyle = 'rgba(0,0,0,.3)';
  c.lineWidth = 2;
  for (let i = -10; i < 12; i++) {
    c.beginPath();
    c.moveTo(960 + i * 70, 870);
    c.lineTo(960 + i * 200, H0);
    c.stroke();
  }
  c.fillStyle = '#6e2a26';
  c.beginPath();
  c.ellipse(960, 990, 520, 80, 0, 0, 7);
  c.fill();
  c.strokeStyle = '#a6573b';
  c.lineWidth = 6;
  c.beginPath();
  c.ellipse(960, 990, 460, 62, 0, 0, 7);
  c.stroke();
  c.strokeStyle = '#d99a5b';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(960, 990, 380, 48, 0, 0, 7);
  c.stroke();

  c.fillStyle = '#1c100b';
  P.rr(c, 170, 620, 330, 340, 60);
  c.fill();
  P.rr(c, 120, 760, 110, 220, 40);
  c.fill();
  P.rr(c, 450, 760, 110, 220, 40);
  c.fill();
  c.fillStyle = 'rgba(255,140,60,.12)';
  P.rr(c, 470, 770, 80, 200, 30);
  c.fill();
  P.vignette(c, 0.62, '10,4,0');
}

export function drawBiblioteca(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = '#1e140f';
  c.fillRect(0, 0, W0, H0);
  P.glow(c, 960, 380, 1100, '#ffb070', 0.14);
  const cols = ['#7a2e2e', '#2e4f4a', '#a8823d', '#3a3560', '#5e3a22', '#8a5a3b', '#243a5c', '#6b6b3a', '#9c4a3a', '#d8c7a2', '#4a2a3a'];
  for (let sx = -40; sx < W0; sx += 330) {
    c.fillStyle = '#2d1d14';
    c.fillRect(sx, 0, 330, H0);
    for (let y = 60; y < 900; y += 165) {
      c.fillStyle = '#140c08';
      c.fillRect(sx + 18, y, 294, 150);
      let x = sx + 22;
      while (x < sx + 300) {
        const w = 16 + r() * 22,
          h = 95 + r() * 45;
        const lean = r() < 0.06;
        c.fillStyle = P.pick(r, cols);
        if (lean && x + 60 < sx + 300) {
          c.save();
          c.translate(x, y + 150);
          c.rotate(-0.22);
          c.fillRect(0, -h, w, h);
          c.restore();
          x += w + 26;
          continue;
        }
        c.fillRect(x, y + 150 - h, w, h);
        c.fillStyle = 'rgba(255,215,140,.28)';
        c.fillRect(x + 2, y + 150 - h + 12, w - 4, 3);
        c.fillRect(x + 2, y + 150 - 22, w - 4, 2);
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.fillRect(x + w - 3, y + 150 - h, 3, h);
        x += w + 1 + (r() < 0.12 ? 10 : 0);
      }
      c.fillStyle = '#3e2819';
      c.fillRect(sx + 10, y + 150, 310, 15);
      c.fillStyle = 'rgba(255,200,140,.08)';
      c.fillRect(sx + 10, y + 150, 310, 3);
    }
    c.fillStyle = '#3a2517';
    c.fillRect(sx, 0, 18, H0);
    c.fillRect(sx + 312, 0, 18, H0);
  }

  [[620, 150], [1300, 150]].forEach(([x, y]) => {
    c.fillStyle = '#c9a15b';
    c.fillRect(x - 6, y, 12, 30);
    P.glow(c, x, y - 4, 360, '#ffc978', 0.45);
  });

  c.strokeStyle = '#4e331f';
  c.lineWidth = 16;
  c.beginPath();
  c.moveTo(1480, -20);
  c.lineTo(1560, 1000);
  c.moveTo(1600, -20);
  c.lineTo(1690, 1000);
  c.stroke();
  c.lineWidth = 11;
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    c.beginPath();
    c.moveTo(1480 + 80 * t, -20 + 1020 * t);
    c.lineTo(1600 + 90 * t, -20 + 1020 * t);
    c.stroke();
  }

  c.fillStyle = P.lg(c, 0, 900, 0, H0, [
    [0, '#5c3a22'],
    [1, '#2a180c'],
  ]);
  c.fillRect(0, 900, W0, 180);
  c.fillStyle = '#1b3b2a';
  c.beginPath();
  c.moveTo(380, 820);
  c.lineTo(560, 820);
  c.lineTo(540, 860);
  c.lineTo(400, 860);
  c.fill();
  c.fillStyle = '#b08a3a';
  c.fillRect(466, 860, 8, 44);
  c.fillRect(430, 898, 80, 8);
  P.glow(c, 470, 880, 360, '#ffd28a', 0.4);
  P.glow(c, 470, 860, 80, '#fff0c8', 0.6);
  P.vignette(c, 0.62, '6,3,1');
}

export function drawCiudad(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, 820, [
    [0, '#090d2a'],
    [0.45, '#261b58'],
    [0.8, '#74407e'],
    [1, '#d77f8c'],
  ]);
  c.fillRect(0, 0, W0, H0);
  P.stars(c, r, 260, 520, 1.5);
  P.glow(c, 1480, 230, 260, '#ffe9c8', 0.25);
  c.fillStyle = '#fff4df';
  c.beginPath();
  c.arc(1480, 230, 46, 0, 7);
  c.fill();
  c.fillStyle = 'rgba(210,190,170,.35)';
  c.beginPath();
  c.arc(1466, 220, 9, 0, 7);
  c.arc(1494, 246, 6, 0, 7);
  c.fill();
  P.glow(c, 960, 800, 900, '#ff9aa8', 0.22);

  const layer = (
    base: number,
    hmin: number,
    hmax: number,
    wmin: number,
    wmax: number,
    col: string,
    winRate: number,
    winA: number
  ) => {
    for (let x = -60; x < W0 + 60; ) {
      const w = wmin + r() * (wmax - wmin),
        h = hmin + r() * (hmax - hmin);
      c.fillStyle = col;
      c.fillRect(x, base - h, w, h + 400);
      if (r() < 0.3) {
        c.fillRect(x + w * 0.3, base - h - 30, w * 0.4, 30);
        if (r() < 0.5) {
          c.fillRect(x + w / 2 - 2, base - h - 80, 4, 50);
        }
      }
      if (winRate) {
        P.windows(
          c,
          r,
          x,
          base - h + 10,
          w,
          h - 10,
          Math.max(2, Math.round(w / 16)),
          Math.max(3, Math.round(h / 20)),
          winRate,
          undefined,
          undefined,
          winA
        );
      }
      x += w + r() * 10;
    }
  };
  layer(820, 160, 380, 60, 140, '#2c2458', 0.12, 0.5);
  layer(840, 200, 520, 70, 150, '#1b1640', 0.3, 0.85);
  layer(880, 120, 300, 90, 180, '#100d28', 0.22, 0.95);

  c.fillStyle = P.lg(c, 0, 880, 0, H0, [
    [0, '#1a1438'],
    [1, '#07061a'],
  ]);
  c.fillRect(0, 880, W0, 200);
  P.soft(
    c,
    6,
    x => {
      for (let i = 0; i < 160; i++) {
        const px = r() * W0;
        x.fillStyle = P.rgba(P.pick(r, ['#ffd27a', '#ff9aa8', '#9ec5ff']), 0.12 + r() * 0.18);
        x.fillRect(px, 890 + r() * 20, 3 + r() * 6, 40 + r() * 140);
      }
    },
    'lighter',
    0.5
  );
  c.strokeStyle = 'rgba(255,255,255,.07)';
  c.lineWidth = 2;
  for (let i = 0; i < 70; i++) {
    const x = r() * W0,
      y = 900 + r() * 170;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 30 + r() * 80, y);
    c.stroke();
  }
  P.vignette(c, 0.5, '4,2,14');
}

export function drawCalle(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#0a1422'],
    [0.5, '#15263a'],
    [1, '#070b12'],
  ]);
  c.fillRect(0, 0, W0, H0);
  const vx = 960,
    vy = 520;
  P.glow(c, vx, vy, 520, '#8fb8d8', 0.35, 'source-over');
  const bldg = (side: number) => {
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6,
        t1 = (i + 0.85) / 6;
      const xa = side < 0 ? 0 + (vx - 160) * Math.pow(t0, 1.6) : W0 - (W0 - vx - 160) * Math.pow(t0, 1.6);
      const xb = side < 0 ? 0 + (vx - 160) * Math.pow(t1, 1.6) : W0 - (W0 - vx - 160) * Math.pow(t1, 1.6);
      const topA = 0 + 380 * Math.pow(t0, 1.2) - 60 - r() * 60,
        topB = 0 + 380 * Math.pow(t1, 1.2) - 60 - r() * 60;
      const botA = H0 - (H0 - vy - 40) * Math.pow(t0, 0.9) - 120 * (1 - t0),
        botB = H0 - (H0 - vy - 40) * Math.pow(t1, 0.9) - 120 * (1 - t1);
      c.fillStyle = ['#18283a', '#132232', '#1d2f42'][i % 3];
      c.beginPath();
      c.moveTo(xa, topA);
      c.lineTo(xb, topB);
      c.lineTo(xb, botB);
      c.lineTo(xa, botA);
      c.fill();
      for (let k = 0; k < 14; k++) {
        if (r() > 0.45) continue;
        const u = 0.15 + r() * 0.7,
          v = 0.1 + r() * 0.65;
        const x = xa + (xb - xa) * u,
          yt = topA + (topB - topA) * u,
          yb = botA + (botB - botA) * u,
          y = yt + (yb - yt) * v;
        const s = 26 * (1 - t0 * 0.75);
        c.fillStyle = P.rgba(P.pick(r, ['#ffcf7a', '#ffb45e', '#9fd0ff']), 0.55 + r() * 0.4);
        c.fillRect(x, y, s * 0.7, s);
        P.glow(c, x + s * 0.35, y + s * 0.5, s * 2.5, '#ffc070', 0.08);
      }
    }
  };
  bldg(-1);
  bldg(1);

  c.fillStyle = P.lg(c, 0, vy, 0, H0, [
    [0, '#1a2a3a'],
    [1, '#080d14'],
  ]);
  c.beginPath();
  c.moveTo(vx - 90, vy + 40);
  c.lineTo(vx + 90, vy + 40);
  c.lineTo(W0 + 200, H0);
  c.lineTo(-200, H0);
  c.fill();
  c.strokeStyle = 'rgba(255,230,160,.35)';
  c.lineWidth = 6;
  c.setLineDash([40, 50]);
  c.beginPath();
  c.moveTo(vx, vy + 44);
  c.lineTo(vx, H0);
  c.stroke();
  c.setLineDash([]);

  const refl: [number, number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 5,
      s = 1 - t * 0.8;
    [-1, 1].forEach(side => {
      const x = vx + side * (760 * s + 60),
        y = vy + 40 + (H0 - vy) * s * 0.95;
      const h = 460 * s;
      c.strokeStyle = '#0a1018';
      c.lineWidth = 8 * s + 1;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - h);
      c.lineTo(x - side * 50 * s, y - h);
      c.stroke();
      P.glow(c, x - side * 50 * s, y - h + 8 * s, 190 * s + 20, '#ffd48a', 0.55);
      refl.push([x - side * 50 * s - 10 * s, y + 10, 20 * s + 4, (H0 - y) * 0.9 + 60 * s]);
    });
  }
  P.soft(
    c,
    12,
    x => {
      x.fillStyle = 'rgba(255,200,120,.22)';
      refl.forEach(q => x.fillRect(...q));
      for (let i = 0; i < 30; i++) {
        const px = vx + (r() - 0.5) * 1500,
          py = vy + 80 + r() * 480;
        x.fillStyle = P.rgba(P.pick(r, ['#ff6a5a', '#ffd27a', '#7fd0ff']), 0.1 + r() * 0.12);
        x.fillRect(px, py, 6 + r() * 10, 60 + r() * 160);
      }
    },
    'lighter'
  );
  c.fillStyle = P.lg(c, 0, vy - 200, 0, vy + 200, [
    [0, 'rgba(150,190,220,0)'],
    [0.5, 'rgba(150,190,220,.16)'],
    [1, 'rgba(150,190,220,0)'],
  ]);
  c.fillRect(0, vy - 200, W0, 400);
  P.vignette(c, 0.55);
}

export function drawNubes(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#8b97d8'],
    [0.5, '#c9b0e0'],
    [1, '#f5c3c8'],
  ]);
  c.fillRect(0, 0, W0, H0);
  P.glow(c, 1300, 300, 600, '#ffe3d6', 0.4, 'source-over');
  const cloud = (x2: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, top: string, bot: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * w,
        y = cy + (r() - 0.5) * h * 0.5 - Math.cos(((x - cx) / w) * Math.PI) * h * 0.25,
        rad = 40 + r() * h * 0.5;
      x2.fillStyle = P.lg(x2, 0, y - rad, 0, y + rad, [
        [0, top],
        [1, bot],
      ]);
      x2.beginPath();
      x2.arc(x, y, rad, 0, 7);
      x2.fill();
    }
  };
  P.soft(
    c,
    3,
    x => {
      cloud(x, 400, 300, 700, 160, 'rgba(255,245,250,.85)', 'rgba(222,190,225,.8)', 50);
      cloud(x, 1500, 230, 600, 140, 'rgba(255,245,250,.8)', 'rgba(222,190,225,.75)', 40);
      cloud(x, 1100, 560, 1300, 200, 'rgba(255,240,245,.9)', 'rgba(236,180,205,.85)', 90);
      cloud(x, 300, 760, 1100, 240, 'rgba(255,238,242,.95)', 'rgba(240,176,196,.9)', 90);
      cloud(x, 1600, 800, 1100, 260, 'rgba(255,238,242,.95)', 'rgba(240,176,196,.9)', 100);
      cloud(x, 960, 1020, 2400, 260, 'rgba(255,236,240,1)', 'rgba(244,180,196,1)', 160);
    },
    'source-over',
    0.5
  );
  P.vignette(c, 0.18, '80,40,90');
}

export function drawPico(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, 720, [
    [0, '#262a66'],
    [0.45, '#7456a4'],
    [0.8, '#e595b4'],
    [1, '#f6c29b'],
  ]);
  c.fillRect(0, 0, W0, H0);
  P.stars(c, r, 120, 280, 1.3, 0.8);
  P.glow(c, 1000, 660, 600, '#ffc38a', 0.4, 'source-over');
  P.ridge(c, r, { y: 560, amp: 140, color: '#9b82c2', rough: 0.52 });

  const pts = P.ridge(c, r, {
    peaks: [
      [-40, 700],
      [600, 520],
      [1010, 250],
      [1400, 540],
      [W0 + 40, 650],
    ],
    y: 0,
    amp: 90,
    rough: 0.5,
    color: '#6e5da3',
    depth: 6,
  });
  c.save();
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  pts.forEach(p => c.lineTo(...p));
  c.lineTo(W0 + 40, H0);
  c.lineTo(-40, H0);
  c.clip();
  c.fillStyle = P.lg(c, 0, 250, 0, 520, [
    [0, 'rgba(245,238,255,.95)'],
    [0.6, 'rgba(220,208,245,.7)'],
    [1, 'rgba(220,208,245,0)'],
  ]);
  c.fillRect(600, 240, 800, 300);
  c.fillStyle = 'rgba(60,40,110,.35)';
  c.beginPath();
  c.moveTo(1010, 250);
  c.lineTo(1420, 560);
  c.lineTo(1010, 700);
  c.closePath();
  c.fill();
  c.restore();

  c.fillStyle = P.lg(c, 0, 520, 0, 700, [
    [0, 'rgba(255,220,235,0)'],
    [1, 'rgba(255,220,235,.25)'],
  ]);
  c.fillRect(0, 520, W0, 200);
  P.ridge(c, r, { y: 740, amp: 150, color: '#4a3f82' });
  c.fillStyle = 'rgba(255,215,230,.12)';
  c.fillRect(0, 740, W0, 80);
  P.ridge(c, r, { y: 850, amp: 120, color: '#2e2860' });
  const near = P.ridge(c, r, { y: 960, amp: 90, color: '#1a1738' });
  for (let i = 0; i < 70; i++) {
    const x = r() * W0;
    const p = near.reduce((b, q) => (Math.abs(q[0] - x) < Math.abs(b[0] - x) ? q : b));
    P.pine(c, x, p[1] + 20, 60 + r() * 90, 26 + r() * 20, '#15122e');
  }
  P.vignette(c, 0.35, '20,10,40');
}

export function drawLago(c: CanvasRenderingContext2D, r: () => number) {
  const hz = 620;
  const top = document.createElement('canvas');
  top.width = c.canvas.width;
  top.height = c.canvas.height;
  const t = top.getContext('2d')!;
  (t as any)._s = (c as any)._s;
  t.setTransform(c.getTransform());
  t.fillStyle = P.lg(t, 0, 0, 0, hz, [
    [0, '#5f5f9c'],
    [0.5, '#d98579'],
    [1, '#f7bb7e'],
  ]);
  t.fillRect(0, 0, W0, hz + 2);
  P.glow(t, 1300, 560, 520, '#ffd9a0', 0.55, 'source-over');
  t.fillStyle = '#fff1d6';
  t.beginPath();
  t.arc(1300, 575, 42, 0, 7);
  t.fill();
  P.ridge(t, r, { y: 470, amp: 200, color: '#8a6f9a', bottom: hz + 2 });
  P.ridge(t, r, { y: 560, amp: 110, color: '#56507e', bottom: hz + 2 });
  for (let i = 0; i < 90; i++) {
    const x = r() * W0;
    if (x > 600 && x < 1400 && r() < 0.8) continue;
    P.pine(t, x, hz + 4, 40 + r() * 70, 20 + r() * 14, '#221f3b');
  }
  const s = (c as any)._s || 1;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(top, 0, 0);
  c.restore();

  c.save();
  c.beginPath();
  c.rect(0, hz, W0, H0 - hz);
  c.clip();
  c.setTransform(1, 0, 0, -1, 0, 2 * hz * s);
  c.globalAlpha = 0.75;
  c.drawImage(top, 0, 0);
  c.restore();

  c.fillStyle = P.lg(c, 0, hz, 0, H0, [
    [0, 'rgba(40,30,70,.25)'],
    [1, 'rgba(20,15,40,.8)'],
  ]);
  c.fillRect(0, hz, W0, H0 - hz);
  c.strokeStyle = 'rgba(255,230,200,.18)';
  c.lineWidth = 2;
  for (let i = 0; i < 120; i++) {
    const y = hz + 10 + Math.pow(r(), 1.5) * (H0 - hz),
      x = r() * W0,
      l = 20 + (y - hz) * 0.4 * r();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + l, y);
    c.stroke();
  }
  P.soft(
    c,
    8,
    x => {
      x.fillStyle = 'rgba(255,215,150,.35)';
      x.fillRect(1270, hz + 5, 60, 300);
    },
    'lighter'
  );
  P.vignette(c, 0.35, '20,10,30');
}

export function drawCampina(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, 640, [
    [0, '#bcdbe8'],
    [0.6, '#f3e3bb'],
    [1, '#fde6b2'],
  ]);
  c.fillRect(0, 0, W0, H0);
  P.glow(c, 1380, 420, 560, '#fff3cf', 0.6, 'source-over');
  const hill = (y: number, amp: number, col: string, ph: number) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, H0);
    for (let x = 0; x <= W0; x += 20) {
      c.lineTo(x, y + Math.sin(x / 520 + ph) * amp + Math.sin(x / 190 + ph * 2) * amp * 0.25);
    }
    c.lineTo(W0, H0);
    c.fill();
  };
  hill(560, 30, '#b4c9a0', 1);
  hill(600, 36, '#9fbd88', 2.2);
  for (let i = 0; i < 18; i++) {
    const x = r() * W0,
      y = 600 + r() * 30;
    P.foliage(c, r, x, y - 20, 40, 24, 6, [['#56784a'], ['#6f955e', '#6a8f58'], ['#9dbd84']], 0.45);
  }
  hill(680, 40, '#8bb070', 3.1);
  c.fillStyle = 'rgba(255,245,220,.25)';
  c.fillRect(0, 560, W0, 160);
  hill(780, 50, '#77a35c', 0.4);

  c.strokeStyle = '#5a4630';
  c.lineWidth = 6;
  const fy = (x: number) => 800 + Math.sin(x / 420) * 30 + (x - 960) * 0.02;
  c.beginPath();
  for (let x = 200; x < 1500; x += 10) x === 200 ? c.moveTo(x, fy(x) - 40) : c.lineTo(x, fy(x) - 40);
  c.stroke();
  c.beginPath();
  for (let x = 200; x < 1500; x += 10) x === 200 ? c.moveTo(x, fy(x) - 18) : c.lineTo(x, fy(x) - 18);
  c.stroke();
  c.lineWidth = 8;
  for (let x = 200; x < 1500; x += 110) {
    c.beginPath();
    c.moveTo(x, fy(x) + 6);
    c.lineTo(x, fy(x) - 56);
    c.stroke();
  }
  hill(900, 40, '#5f8f47', 2);
  P.grass(c, r, 1200, 0, W0, 860, H0, ['#6a9a4d', '#548a3e', '#83b25f', '#3f7331'], 20, 60, 2.4);
  P.foliage(c, r, 1650, 480, 150, 110, 40, [['#355a31', '#3e6637'], ['#4e7a43', '#5f8d4f'], ['#86ad6a', '#9cc07c']]);
  c.fillStyle = '#4a3a28';
  c.fillRect(1640, 540, 22, 120);
  P.vignette(c, 0.2, '60,50,20');
}

export function drawPinar(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#dfe7e6'],
    [0.6, '#b3c5c6'],
    [1, '#90a8aa'],
  ]);
  c.fillRect(0, 0, W0, H0);
  const layers: [string, number, number][] = [
    ['#a7bcbd', 420, 0.5],
    ['#8aa4a6', 520, 0.6],
    ['#6b8a8d', 630, 0.72],
    ['#4b6a6d', 760, 0.85],
    ['#2c4749', 900, 1],
    ['#172c2e', 1050, 1.25],
  ];
  layers.forEach(([col, base, s]) => {
    for (let x = -40; x < W0 + 40; x += (30 + r() * 50) * s) {
      P.pine(c, x, base + r() * 40 * s, (180 + r() * 220) * s, (60 + r() * 40) * s, col);
    }
    c.fillStyle = P.lg(c, 0, base - 160 * s, 0, base + 40, [
      [0, 'rgba(230,238,238,0)'],
      [1, 'rgba(230,238,238,.35)'],
    ]);
    c.fillRect(0, base - 160 * s, W0, 200 * s + 40);
  });
  P.vignette(c, 0.3, '10,30,30');
}

export function drawEstrellas(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, 0, H0, [
    [0, '#03051a'],
    [0.6, '#0d1644'],
    [1, '#243463'],
  ]);
  c.fillRect(0, 0, W0, H0);

  P.soft(c, 40, x => {
    x.translate(W0 / 2, H0 / 2);
    x.rotate(-0.5);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = P.rgba(P.pick(r, ['#8b6bd8', '#5b7fe0', '#d38bd0', '#ffffff']), 0.06 + r() * 0.08);
      x.beginPath();
      x.ellipse((r() - 0.5) * 2200, (r() - 0.5) * 160, 120 + r() * 200, 40 + r() * 80, 0, 0, 7);
      x.fill();
    }
  });

  c.save();
  c.translate(W0 / 2, H0 / 2);
  c.rotate(-0.5);
  for (let i = 0; i < 2200; i++) {
    const x = (r() - 0.5) * 2400,
      y = (r() + r() + r() - 1.5) * 120;
    c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
    c.fillRect(x, y, r() < 0.1 ? 2 : 1.2, r() < 0.1 ? 2 : 1.2);
  }
  c.restore();

  P.stars(c, r, 700, H0 * 0.85, 1.7);
  P.glow(c, 960, 1000, 800, '#4b62a8', 0.3, 'source-over');
  P.ridge(c, r, { y: 900, amp: 120, color: '#070a1a' });
  P.ridge(c, r, { y: 990, amp: 80, color: '#04050f' });

  c.fillStyle = '#04050f';
  c.beginPath();
  c.moveTo(1400, 930);
  c.lineTo(1450, 880);
  c.lineTo(1500, 930);
  c.lineTo(1500, 980);
  c.lineTo(1400, 980);
  c.fill();
  c.fillStyle = '#ffcf7a';
  c.fillRect(1440, 935, 18, 16);
  P.glow(c, 1449, 943, 60, '#ffb45e', 0.6);
  P.vignette(c, 0.45);
}

export function rippleDraw(c: CanvasRenderingContext2D, pal: string[], freq = 1) {
  const w = 480,
    h = 270;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const x2 = cv.getContext('2d')!;
  const id = x2.createImageData(w, h);
  const d = id.data;
  const cols = pal.map(U.hexToRgb);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w,
        v = y / h;
      let s = Math.sin((u * 3.2 + Math.sin(v * 4.1 + u * 2.3) * 0.55) * 3.2 * freq + Math.sin(u * 5 - v * 3) * 0.6);
      s = (s + 1) / 2;
      s = Math.pow(s, 1.4);
      const f = s * (cols.length - 1),
        i0 = Math.floor(f),
        i1 = Math.min(cols.length - 1, i0 + 1),
        k = f - i0;
      const o = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) d[o + ch] = cols[i0][ch] + (cols[i1][ch] - cols[i0][ch]) * k;
      d[o + 3] = 255;
    }
  }
  x2.putImageData(id, 0, 0);
  c.imageSmoothingQuality = 'high';
  c.drawImage(cv, 0, 0, W0, H0);
}

export function drawDunas(c: CanvasRenderingContext2D) {
  const cols = ['#f6d6b0', '#eeb88c', '#dd9474', '#b86a62', '#7e4a5c', '#43304f'];
  c.fillStyle = '#fbe6c8';
  c.fillRect(0, 0, W0, H0);
  cols.forEach((col, i) => {
    const y0 = 200 + i * 150;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, H0);
    for (let x = 0; x <= W0; x += 16) {
      c.lineTo(x, y0 + Math.sin(x / (380 + i * 40) + i * 1.7) * (70 - i * 6) + Math.sin(x / 150 + i) * 12);
    }
    c.lineTo(W0, H0);
    c.fill();
  });
  P.glow(c, 1400, 180, 300, '#fff4e0', 0.6, 'source-over');
}

export function drawOrbes(c: CanvasRenderingContext2D, r: () => number) {
  c.fillStyle = P.lg(c, 0, 0, W0, H0, [
    [0, '#120a2a'],
    [1, '#2a0f3a'],
  ]);
  c.fillRect(0, 0, W0, H0);
  const cols = ['#7c3aed', '#ec4899', '#22d3ee', '#f59e0b', '#a78bfa'];
  for (let i = 0; i < 14; i++) {
    const x = r() * W0,
      y = r() * H0,
      rad = 80 + r() * 300,
      col = P.pick(r, cols);
    c.fillStyle = P.rg(c, x - rad * 0.3, y - rad * 0.3, 0, rad, [
      [0, P.rgba(col, 0.85)],
      [0.7, P.rgba(col, 0.35)],
      [1, P.rgba(col, 0)],
    ]);
    c.globalCompositeOperation = 'screen';
    c.beginPath();
    c.arc(x, y, rad, 0, 7);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

export const SCENES: SceneDefinition[] = [
  { id: 'cafe', name: 'Café lluvioso', cats: ['urban', 'rain'], base: '#2a2254', draw: drawCafe, anim: () => Anim.rain() },
  { id: 'bosque', name: 'Bosque encantado', cats: ['nature'], base: '#1f4b2c', draw: drawBosque, anim: () => Anim.fireflies() },
  { id: 'ventana', name: 'Lluvia en la ventana', cats: ['rain'], base: '#101b35', draw: drawVentana, anim: () => Anim.droplets() },
  { id: 'calle', name: 'Noche lluviosa', cats: ['urban', 'rain'], base: '#15263a', draw: drawCalle, anim: () => Anim.rain({ density: 1.2, color: '190,215,235', alpha: 0.3, angle: 0.05 }) },
  { id: 'ciudad', name: 'Ciudad de noche', cats: ['urban'], base: '#261b58', draw: drawCiudad, anim: () => Anim.twinkle(70, 0.45, true) },
  { id: 'escritorio', name: 'Escritorio nocturno', cats: ['interior'], base: '#34221b', draw: drawEscritorio, anim: () => Anim.steam() },
  { id: 'chimenea', name: 'Cabaña con chimenea', cats: ['interior'], base: '#3d2616', draw: drawChimenea, anim: () => Anim.flames() },
  { id: 'biblioteca', name: 'Biblioteca', cats: ['interior'], base: '#2d1d14', draw: drawBiblioteca },
  { id: 'nubes', name: 'Nubes lofi', cats: ['scenic'], base: '#c9b0e0', draw: drawNubes },
  { id: 'pico', name: 'Pico al atardecer', cats: ['scenic'], base: '#7456a4', draw: drawPico },
  { id: 'lago', name: 'Lago al amanecer', cats: ['scenic'], base: '#d98579', draw: drawLago },
  { id: 'estrellas', name: 'Noche estrellada', cats: ['scenic'], base: '#0d1644', draw: drawEstrellas, anim: () => Anim.twinkle(120, 0.7, true) },
  { id: 'campina', name: 'Campiña', cats: ['nature'], base: '#9fbd88', draw: drawCampina },
  { id: 'pinar', name: 'Pinar con niebla', cats: ['nature'], base: '#8aa4a6', draw: drawPinar },
  ...Object.entries({ termal: 'Termal', algodon: 'Algodón', otono: 'Otoño', aurora: 'Aurora', medianoche: 'Medianoche', lavanda: 'Lavanda' }).map(([id, name]) => ({
    id: 'g-' + id,
    name,
    cats: ['gradient'],
    base: MESHES[id][0],
    draw: (c: CanvasRenderingContext2D) => P.mesh(c, MESHES[id][0], MESHES[id][1]),
    anim: ['termal', 'aurora', 'medianoche'].includes(id) ? () => Anim.mesh(MESHES[id][0], MESHES[id][1]) : undefined,
  })),
  { id: 'a-ondas', name: 'Ondas', cats: ['abstract'], base: '#4aa8ff', draw: c => rippleDraw(c, ['#0b5bd3', '#2f8cff', '#8fd0ff', '#ffffff']) },
  { id: 'a-ondas-rosa', name: 'Ondas rosas', cats: ['abstract'], base: '#f28fb0', draw: c => rippleDraw(c, ['#c2185b', '#f06292', '#ffc1d6', '#fff5f8'], 0.8) },
  { id: 'a-dunas', name: 'Dunas', cats: ['abstract'], base: '#dd9474', draw: drawDunas },
  { id: 'a-orbes', name: 'Orbes', cats: ['abstract'], base: '#2a0f3a', draw: drawOrbes },
];

export const sceneById = (id: string) => SCENES.find(s => s.id === id);

export function renderScene(scene: SceneDefinition, width: number): HTMLCanvasElement {
  const w = Math.round(width),
    h = Math.round((width * 9) / 16);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d')!;
  (c as any)._s = w / W0;
  c.setTransform((c as any)._s, 0, 0, (c as any)._s, 0, 0);
  scene.draw(c, P.rng(U.hashStr(scene.id)));
  P.noBlur(c);
  c.setTransform((c as any)._s, 0, 0, (c as any)._s, 0, 0);
  if (!scene.id.startsWith('g-')) P.grain(c, w < 600 ? 0.04 : 0.055);
  return cv;
}
