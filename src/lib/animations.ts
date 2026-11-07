import { P, W0, H0, drawFlames } from './scenes';

export interface AnimationInstance {
  scene?: boolean;
  full?: boolean;
  resize: (w: number, h: number) => void;
  frame: (c: CanvasRenderingContext2D, dt: number, t: number, vw: number, vh: number) => void;
}

export interface RainOptions {
  density?: number;
  color?: string;
  alpha?: number;
  angle?: number;
  splash?: boolean;
}

interface RainDrop {
  x: number;
  y: number;
  l: number;
  v: number;
  a: number;
  w: number;
}

interface RainSplash {
  x: number;
  y: number;
  t: number;
}

interface Firefly {
  x: number;
  y: number;
  p: number;
  s: number;
  r: number;
}

interface Droplet {
  x: number;
  y: number;
  r: number;
  v: number;
  pause: number;
  trail: [number, number][];
}

interface TwinkleStar {
  x: number;
  y: number;
  p: number;
  s: number;
  r: number;
}

interface ShootStar {
  x: number;
  y: number;
  t: number;
}

interface Ember {
  x: number;
  y: number;
  v: number;
  l: number;
}

export const Anim = {
  rain(opts: RainOptions = {}): AnimationInstance {
    const o = Object.assign(
      { density: 1, color: '200,210,255', alpha: 0.28, angle: 0.12, splash: true },
      opts
    );
    let drops: RainDrop[] = [];
    let splashes: RainSplash[] = [];
    let vw = 0;
    let vh = 0;

    const make = (): RainDrop => ({
      x: Math.random() * (vw + 200) - 100,
      y: Math.random() * -vh,
      l: 14 + Math.random() * 30,
      v: 900 + Math.random() * 700,
      a: o.alpha * (0.4 + Math.random() * 0.8),
      w: Math.random() < 0.2 ? 1.6 : 1,
    });

    return {
      resize(w: number, h: number) {
        vw = w;
        vh = h;
        const n = Math.round(((w * h) / 7000) * o.density);
        drops = Array.from({ length: n }, () => {
          const d = make();
          d.y = Math.random() * vh;
          return d;
        });
      },
      frame(c: CanvasRenderingContext2D, dt: number) {
        c.lineCap = 'round';
        for (const d of drops) {
          d.y += d.v * dt;
          d.x += d.v * dt * o.angle;
          if (d.y > vh) {
            if (o.splash && Math.random() < 0.35) {
              splashes.push({ x: d.x, y: vh * (0.78 + Math.random() * 0.22), t: 0 });
            }
            Object.assign(d, make(), { y: -d.l });
          }
          c.strokeStyle = `rgba(${o.color},${d.a})`;
          c.lineWidth = d.w;
          c.beginPath();
          c.moveTo(d.x, d.y);
          c.lineTo(d.x - d.l * o.angle, d.y - d.l);
          c.stroke();
        }
        c.lineWidth = 1;
        splashes = splashes.filter(s => (s.t += dt) < 0.3);
        for (const s of splashes) {
          const k = s.t / 0.3;
          c.strokeStyle = `rgba(${o.color},${0.35 * (1 - k)})`;
          c.beginPath();
          c.ellipse(s.x, s.y, 2 + k * 9, 1 + k * 2.5, 0, 0, Math.PI * 2);
          c.stroke();
        }
      },
    };
  },

  fireflies(n = 45, col = '255,240,150'): AnimationInstance {
    let fs: Firefly[] = [];
    let vw = 0;
    let vh = 0;

    return {
      resize(w: number, h: number) {
        vw = w;
        vh = h;
        fs = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: h * (0.25 + Math.random() * 0.7),
          p: Math.random() * 7,
          s: 0.3 + Math.random() * 0.8,
          r: 1.5 + Math.random() * 2.5,
        }));
      },
      frame(c: CanvasRenderingContext2D, dt: number, t: number) {
        c.globalCompositeOperation = 'lighter';
        for (const f of fs) {
          f.x += Math.sin(t * 0.4 * f.s + f.p) * 14 * dt;
          f.y += Math.cos(t * 0.3 * f.s + f.p * 2) * 10 * dt;
          const a = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.3 * f.s + f.p));
          const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 6);
          g.addColorStop(0, `rgba(${col},${a})`);
          g.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = g;
          c.fillRect(f.x - f.r * 6, f.y - f.r * 6, f.r * 12, f.r * 12);
        }
        c.globalCompositeOperation = 'source-over';
      },
    };
  },

  droplets(): AnimationInstance {
    let ds: Droplet[] = [];
    let vw = 0;
    let vh = 0;

    const make = (): Droplet => ({
      x: Math.random() * vw,
      y: -20 - Math.random() * vh * 0.5,
      r: 3 + Math.random() * 6,
      v: 0,
      pause: Math.random() * 3,
      trail: [],
    });

    return {
      resize(w: number, h: number) {
        vw = w;
        vh = h;
        ds = Array.from({ length: Math.round(w / 55) }, () => {
          const d = make();
          d.y = Math.random() * h;
          return d;
        });
      },
      frame(c: CanvasRenderingContext2D, dt: number) {
        for (const d of ds) {
          if (d.pause > 0) {
            d.pause -= dt;
          } else {
            d.v = Math.min(260, d.v + 300 * dt);
            d.y += d.v * dt;
            d.x += Math.sin(d.y / 40) * 0.3;
            if (Math.random() < 0.01) {
              d.pause = 0.3 + Math.random();
              d.v = 0;
            }
          }
          d.trail.push([d.x, d.y]);
          if (d.trail.length > 40) d.trail.shift();
          if (d.y > vh + 20) Object.assign(d, make());

          c.strokeStyle = 'rgba(210,225,255,.13)';
          c.lineWidth = d.r * 0.5;
          c.lineCap = 'round';
          c.beginPath();
          d.trail.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
          c.stroke();

          c.fillStyle = 'rgba(0,0,0,.25)';
          c.beginPath();
          c.ellipse(d.x, d.y + d.r * 0.2, d.r, d.r * 1.15, 0, 0, 7);
          c.fill();

          c.fillStyle = 'rgba(190,210,255,.28)';
          c.beginPath();
          c.ellipse(d.x, d.y, d.r * 0.9, d.r, 0, 0, 7);
          c.fill();

          c.fillStyle = 'rgba(255,255,255,.7)';
          c.beginPath();
          c.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, d.r * 0.25, 0, 7);
          c.fill();
        }
      },
    };
  },

  twinkle(n = 90, yFrac = 0.55, shooting = true): AnimationInstance {
    let st: TwinkleStar[] = [];
    let vw = 0;
    let vh = 0;
    let shoot: ShootStar | null = null;
    let nextShoot = 4;

    return {
      resize(w: number, h: number) {
        vw = w;
        vh = h;
        st = Array.from({ length: n }, () => ({
          x: Math.random() * w,
          y: Math.pow(Math.random(), 1.3) * h * yFrac,
          p: Math.random() * 7,
          s: 0.6 + Math.random() * 1.6,
          r: 0.8 + Math.random() * 1.4,
        }));
      },
      frame(c: CanvasRenderingContext2D, dt: number, t: number) {
        for (const s of st) {
          const a = Math.max(0, Math.sin(t * s.s + s.p)) * 0.9;
          c.fillStyle = `rgba(255,255,255,${a})`;
          c.beginPath();
          c.arc(s.x, s.y, s.r, 0, 7);
          c.fill();
        }
        if (!shooting) return;
        nextShoot -= dt;
        if (!shoot && nextShoot < 0) {
          shoot = {
            x: Math.random() * vw * 0.7 + vw * 0.1,
            y: Math.random() * vh * 0.25,
            t: 0,
          };
          nextShoot = 6 + Math.random() * 10;
        }
        if (shoot) {
          shoot.t += dt;
          const k = shoot.t / 0.9;
          if (k > 1) {
            shoot = null;
            return;
          }
          const x = shoot.x + k * 380;
          const y = shoot.y + k * 160;
          const g = c.createLinearGradient(x, y, x - 120, y - 50);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.strokeStyle = g;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x - 120, y - 50);
          c.stroke();
        }
      },
    };
  },

  flames(): AnimationInstance {
    let emb: Ember[] = [];

    return {
      scene: true,
      resize() {
        emb = [];
      },
      frame(c: CanvasRenderingContext2D, dt: number, t: number) {
        drawFlames(c, t, 1);
        if (Math.random() < 0.3) {
          emb.push({
            x: 960 + (Math.random() - 0.5) * 140,
            y: 780,
            v: 60 + Math.random() * 80,
            l: 0,
          });
        }
        emb = emb.filter(e => (e.l += dt) < 2.2);
        c.globalCompositeOperation = 'lighter';
        for (const e of emb) {
          e.y -= e.v * dt;
          e.x += Math.sin(e.l * 4 + e.v) * 0.6;
          c.fillStyle = `rgba(255,170,70,${0.8 * (1 - e.l / 2.2)})`;
          c.fillRect(e.x, e.y, 3, 3);
        }
        c.globalCompositeOperation = 'source-over';
        const fl = 0.08 + 0.05 * Math.sin(t * 9) + 0.03 * Math.sin(t * 23);
        c.fillStyle = P.rg(c, 960, 760, 50, 900, [
          [0, `rgba(255,140,50,${fl})`],
          [1, 'rgba(255,120,40,0)'],
        ]);
        c.fillRect(0, 0, W0, H0);
      },
    };
  },

  steam(): AnimationInstance {
    return {
      scene: true,
      resize() {},
      frame(c: CanvasRenderingContext2D, _dt: number, t: number) {
        c.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const ph = t * 0.7 + k * 2.1;
          c.strokeStyle = `rgba(255,245,235,${0.1 + 0.05 * Math.sin(ph)})`;
          c.lineWidth = 7;
          c.beginPath();
          for (let i = 0; i <= 20; i++) {
            const u = i / 20;
            const x = 1195 + k * 14 + Math.sin(u * 5 + ph * 2) * 14 * u;
            const y = 630 - u * 150;
            if (i) c.lineTo(x, y);
            else c.moveTo(x, y);
          }
          c.stroke();
        }
      },
    };
  },

  mesh(base: string, blobs: any[]): AnimationInstance {
    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 180;
    const x2 = cv.getContext('2d')!;

    return {
      full: true,
      resize() {},
      frame(c: CanvasRenderingContext2D, _dt: number, t: number, vw: number, vh: number) {
        x2.setTransform(320 / W0, 0, 0, 180 / H0, 0, 0);
        P.mesh(
          x2,
          base,
          blobs.map(([x, y, rad, col, a], i) => [
            x + Math.sin(t * 0.13 + i * 1.7) * 260,
            y + Math.cos(t * 0.11 + i * 2.3) * 180,
            rad * (1 + 0.12 * Math.sin(t * 0.2 + i)),
            col,
            a,
          ])
        );
        c.imageSmoothingQuality = 'high';
        c.drawImage(cv, 0, 0, vw, vh);
      },
    };
  },
};
