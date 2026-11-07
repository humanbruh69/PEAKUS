import { U } from './utils';

export interface AmbientDefinition {
  name: string;
  desc: string;
  build: (ctx: AudioContext, out: GainNode) => { stop?: () => void }[];
}

export interface AlertDefinition {
  name: string;
  play: (ctx: AudioContext, out: GainNode, t: number) => void;
}

export const AudioX = (() => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const buffers: Record<string, AudioBuffer> = {};
  const channels: Record<string, { g: GainNode; nodes: { stop?: () => void }[] }> = {};
  const subs = new Set<() => void>();
  let getSettings: () => { sounds: { master: number; levels: Record<string, number> } } = () => ({
    sounds: { master: 70, levels: {} },
  });

  const emit = () => subs.forEach(fn => fn());

  function ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      master.gain.value = (getSettings().sounds.master ?? 70) / 100;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function noise(type: 'white' | 'pink' | 'brown' | 'crackle', seconds = 6): AudioBuffer {
    const key = type + seconds;
    if (buffers[key]) return buffers[key];
    const c = ensure()!;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') {
          d[i] = w * 0.5;
        } else if (type === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else if (type === 'brown') {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else if (type === 'crackle') {
          d[i] = 0;
          if (Math.random() < 0.00035) {
            const amp = 0.3 + Math.random() * 0.7;
            const n = 30 + Math.random() * 200;
            for (let k = 0; k < n && i + k < len; k++) {
              d[i + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / (n / 4));
            }
          }
        }
      }
      const f = Math.min(2000, len / 10);
      for (let i = 0; i < f; i++) {
        const k = i / f;
        d[i] *= k;
        d[len - 1 - i] *= k;
      }
    }
    buffers[key] = buf;
    return buf;
  }

  function src(type: 'white' | 'pink' | 'brown' | 'crackle', sec: number): AudioBufferSourceNode {
    const c = ensure()!;
    const s = c.createBufferSource();
    s.buffer = noise(type, sec);
    s.loop = true;
    s.loopStart = 0;
    return s;
  }

  function lfo(freq: number, depth: number, target: AudioParam) {
    const c = ensure()!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
    return o;
  }

  const AMBIENTS: Record<string, AmbientDefinition> = {
    lluvia: {
      name: 'Lluvia',
      desc: 'Lluvia constante',
      build(c, out) {
        const s = src('pink', 7);
        const hp = c.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 500;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 7000;
        const g = c.createGain();
        g.gain.value = 0.9;
        s.connect(hp);
        hp.connect(lp);
        lp.connect(g);
        g.connect(out);

        const d = src('crackle', 5);
        const dg = c.createGain();
        dg.gain.value = 0.35;
        const dhp = c.createBiquadFilter();
        dhp.type = 'highpass';
        dhp.frequency.value = 2500;
        d.connect(dhp);
        dhp.connect(dg);
        dg.connect(out);

        s.start();
        d.start();
        return [s, d];
      },
    },
    tormenta: {
      name: 'Tormenta',
      desc: 'Lluvia fuerte y truenos',
      build(c, out) {
        const s = src('pink', 7);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3500;
        const g = c.createGain();
        g.gain.value = 1;
        s.connect(lp);
        lp.connect(g);
        g.connect(out);

        const r = src('brown', 8);
        const rlp = c.createBiquadFilter();
        rlp.type = 'lowpass';
        rlp.frequency.value = 160;
        const rg = c.createGain();
        rg.gain.value = 0.0;
        r.connect(rlp);
        rlp.connect(rg);
        rg.connect(out);

        s.start();
        r.start();
        let alive = true;
        let timeoutId: any;
        const thunder = () => {
          if (!alive) return;
          const t = c.currentTime;
          rg.gain.cancelScheduledValues(t);
          rg.gain.setValueAtTime(0.0001, t);
          rg.gain.exponentialRampToValueAtTime(1.6, t + 0.35 + Math.random() * 0.6);
          rg.gain.exponentialRampToValueAtTime(0.0001, t + 4 + Math.random() * 3);
          timeoutId = setTimeout(thunder, 14000 + Math.random() * 26000);
        };
        timeoutId = setTimeout(thunder, 5000 + Math.random() * 6000);
        return [
          s,
          r,
          {
            stop() {
              alive = false;
              clearTimeout(timeoutId);
            },
          },
        ];
      },
    },
    olas: {
      name: 'Olas',
      desc: 'Mar que va y viene',
      build(c, out) {
        const s = src('brown', 9);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const g = c.createGain();
        g.gain.value = 0.55;
        s.connect(lp);
        lp.connect(g);
        g.connect(out);

        const s2 = src('pink', 7);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200;
        bp.Q.value = 0.5;
        const g2 = c.createGain();
        g2.gain.value = 0.2;
        s2.connect(bp);
        bp.connect(g2);
        g2.connect(out);

        const o1 = lfo(0.09, 0.45, g.gain);
        const o2 = lfo(0.09, 0.18, g2.gain);
        const o3 = lfo(0.09, 500, lp.frequency);
        s.start();
        s2.start();
        return [s, s2, o1, o2, o3];
      },
    },
    viento: {
      name: 'Viento',
      desc: 'Brisa suave',
      build(c, out) {
        const s = src('pink', 8);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 500;
        bp.Q.value = 1.4;
        const g = c.createGain();
        g.gain.value = 1.4;
        s.connect(bp);
        bp.connect(g);
        g.connect(out);

        const o1 = lfo(0.05, 260, bp.frequency);
        const o2 = lfo(0.13, 0.5, g.gain);
        s.start();
        return [s, o1, o2];
      },
    },
    fogata: {
      name: 'Fogata',
      desc: 'Leña crepitando',
      build(c, out) {
        const s = src('brown', 8);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        const g = c.createGain();
        g.gain.value = 0.5;
        s.connect(lp);
        lp.connect(g);
        g.connect(out);

        const crack1 = src('crackle', 6);
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2200;
        bp.Q.value = 0.7;
        const cg = c.createGain();
        cg.gain.value = 1.3;
        crack1.connect(bp);
        bp.connect(cg);
        cg.connect(out);

        const crack2 = src('crackle', 4.3);
        const cg2 = c.createGain();
        cg2.gain.value = 0.6;
        const lp2 = c.createBiquadFilter();
        lp2.type = 'lowpass';
        lp2.frequency.value = 900;
        crack2.connect(lp2);
        lp2.connect(cg2);
        cg2.connect(out);

        s.start();
        crack1.start();
        crack2.start();
        return [s, crack1, crack2];
      },
    },
    marron: {
      name: 'Ruido marrón',
      desc: 'Grave y envolvente',
      build(c, out) {
        const s = src('brown', 8);
        const g = c.createGain();
        g.gain.value = 0.9;
        s.connect(g);
        g.connect(out);
        s.start();
        return [s];
      },
    },
    rosa: {
      name: 'Ruido rosa',
      desc: 'Equilibrado',
      build(c, out) {
        const s = src('pink', 8);
        const g = c.createGain();
        g.gain.value = 0.8;
        s.connect(g);
        g.connect(out);
        s.start();
        return [s];
      },
    },
    blanco: {
      name: 'Ruido blanco',
      desc: 'Parejo y brillante',
      build(c, out) {
        const s = src('white', 6);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 9000;
        const g = c.createGain();
        g.gain.value = 0.35;
        s.connect(lp);
        lp.connect(g);
        g.connect(out);
        s.start();
        return [s];
      },
    },
  };

  function levelOf(id: string) {
    return (getSettings().sounds.levels[id] ?? 50) / 100;
  }

  function tone(
    c: AudioContext,
    freq: number,
    t: number,
    dur: number,
    { type = 'sine', vol = 0.3, attack = 0.005, out }: { type?: OscillatorType; vol?: number; attack?: number; out: GainNode }
  ) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const ALERTS: Record<string, AlertDefinition> = {
    sparkle: {
      name: 'Sparkle',
      play(c, out, t) {
        [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => {
          tone(c, f, t + i * 0.09, 0.9, { vol: 0.22, out });
          tone(c, f * 2, t + i * 0.09, 0.4, { vol: 0.05, out });
        });
      },
    },
    campana: {
      name: 'Campana',
      play(c, out, t) {
        [[523.25, 0.35], [1046.5 * 1.002, 0.16], [1568 * 0.998, 0.1], [2637, 0.05]].forEach(([f, v]) =>
          tone(c, f, t, 3.2, { vol: v, out })
        );
        [[659.25, 0.3], [1318.5, 0.12]].forEach(([f, v]) => tone(c, f, t + 0.9, 3, { vol: v, out }));
      },
    },
    digital: {
      name: 'Digital',
      play(c, out, t) {
        for (let k = 0; k < 3; k++) {
          tone(c, 1760, t + k * 0.28, 0.12, { type: 'square', vol: 0.09, out });
          tone(c, 1760, t + k * 0.28 + 0.14, 0.1, { type: 'square', vol: 0.09, out });
        }
      },
    },
    suave: {
      name: 'Suave',
      play(c, out, t) {
        tone(c, 659.25, t, 1.6, { vol: 0.25, attack: 0.05, out });
        tone(c, 880, t + 0.35, 1.8, { vol: 0.2, attack: 0.05, out });
        tone(c, 987.77, t + 0.7, 2.2, { vol: 0.16, attack: 0.05, out });
      },
    },
    madera: {
      name: 'Madera',
      play(c, out, t) {
        [0, 0.22, 0.44].forEach((d, i) => {
          tone(c, 880 - i * 110, t + d, 0.18, { type: 'triangle', vol: 0.4, out });
          tone(c, 1760 - i * 220, t + d, 0.06, { vol: 0.12, out });
        });
      },
    },
    none: {
      name: 'Sin sonido',
      play() {},
    },
  };

  return {
    AMBIENTS,
    ALERTS,
    setSettingsGetter(fn: () => { sounds: { master: number; levels: Record<string, number> } }) {
      getSettings = fn;
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    ensure,
    available: () => typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext),
    isPlaying: (id: string) => !!channels[id],
    anyPlaying: () => Object.keys(channels).length > 0,
    unlock() {
      ensure();
    },
    playAlert(id: string, volume: number) {
      const a = ALERTS[id] || ALERTS.sparkle;
      const c = ensure();
      if (!c || id === 'none') return false;
      const g = c.createGain();
      g.gain.value = U.clamp(volume, 0, 100) / 100;
      g.connect(c.destination);
      a.play(c, g, c.currentTime + 0.03);
      setTimeout(() => g.disconnect(), 6000);
      return true;
    },
    toggle(id: string) {
      channels[id] ? this.stop(id) : this.play(id);
    },
    play(id: string) {
      const def = AMBIENTS[id];
      if (!def || channels[id]) return;
      const c = ensure();
      if (!c || !master) return;
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.connect(master);
      const nodes = def.build(c, g);
      g.gain.setTargetAtTime(levelOf(id), c.currentTime, 0.4);
      channels[id] = { g, nodes };
      emit();
    },
    stop(id: string) {
      const ch = channels[id];
      if (!ch || !ctx) return;
      delete channels[id];
      const t = ctx.currentTime;
      ch.g.gain.cancelScheduledValues(t);
      ch.g.gain.setTargetAtTime(0.0001, t, 0.25);
      setTimeout(() => {
        ch.nodes.forEach(n => {
          try {
            n.stop?.();
          } catch {}
        });
        ch.g.disconnect();
      }, 1200);
      emit();
    },
    stopAll() {
      Object.keys(channels).forEach(id => this.stop(id));
    },
    playing: () => Object.keys(channels),
    getAmbients: () => AMBIENTS,
    getAlerts: () => ALERTS,
    setLevel(id: string, val?: number) {
      if (val !== undefined) {
        getSettings().sounds.levels[id] = val;
      }
      const ch = channels[id];
      if (ch && ctx) ch.g.gain.setTargetAtTime(Math.max(0.0001, val !== undefined ? val / 100 : levelOf(id)), ctx.currentTime, 0.1);
    },
    setMaster(volume?: number) {
      const v = volume ?? getSettings().sounds.master;
      if (master && ctx) master.gain.setTargetAtTime(v / 100, ctx.currentTime, 0.1);
    },
  };
})();

export const audioX = AudioX;
