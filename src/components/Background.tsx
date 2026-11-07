import React, { useEffect, useRef, useState } from 'react';
import type { Settings, ModeKey } from '../types';
import { SCENES, W0, H0, renderScene } from '../lib/scenes';
import { type AnimationInstance } from '../lib/animations';
import { imageDB } from '../lib/imageDB';
import { DEFAULTS } from '../lib/constants';
import { clone } from '../lib/utils';
import { buildBackgroundEmbedUrl } from '../lib/youtube';

interface BackgroundProps {
  settings: Settings;
  onUpdateModeBg?: (mode: ModeKey, bg: any) => void;
  onErrorToast?: (msg: string) => void;
}

const sceneCache = new Map<string, string>();
const uploadsCache = new Map<string, string>();
const videoCache = new Map<string, string>();

async function getUploadURL(id: string): Promise<string> {
  if (uploadsCache.has(id)) return uploadsCache.get(id)!;
  const file = await imageDB.get(id);
  if (!file) throw new Error('Image not found in storage');
  const url = URL.createObjectURL(file.blob);
  uploadsCache.set(id, url);
  return url;
}

async function getVideoURL(id: string): Promise<string> {
  if (videoCache.has(id)) return videoCache.get(id)!;
  const file = await imageDB.get(id);
  if (!file) throw new Error('Video not found in storage');
  const url = URL.createObjectURL(file.blob);
  videoCache.set(id, url);
  return url;
}

function getSceneURL(scene: any, width: number): string {
  const k = scene.id + '@' + width;
  if (sceneCache.has(k)) return sceneCache.get(k)!;
  const cv = renderScene(scene, width);
  const url = cv.toDataURL('image/jpeg', 0.88);
  sceneCache.set(k, url);
  return url;
}

export const Background: React.FC<BackgroundProps> = ({ settings, onUpdateModeBg, onErrorToast }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layer0Ref = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);

  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [baseBg, setBaseBg] = useState<string>('#0d0b1a');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

  const mode = settings.mode;
  const cfg = settings.modes[mode] || DEFAULTS.modes[mode];
  const bg = cfg.bg;

  const animEnabled = settings.appearance.animation;
  const activeLayerRef = useRef(0);
  activeLayerRef.current = activeLayer;

  const isVideoOrEmbed =
    bg.kind === 'youtube' || bg.kind === 'videoUpload' || bg.kind === 'videoUrl';

  // Render width for scene
  const getRenderWidth = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(window.innerWidth, (window.innerHeight * 16) / 9) * dpr;
    return w < 1200 ? 1280 : w < 1800 ? 1920 : 2560;
  };

  // Ensure HTML5 video always autoplays muted
  useEffect(() => {
    if (videoElRef.current) {
      videoElRef.current.muted = true;
      videoElRef.current.defaultMuted = true;
      videoElRef.current.play().catch(e => {
        console.warn('Video background autoplay waiting for interaction:', e);
      });
    }
  }, [uploadedVideoUrl, bg.videoUrl, bg.kind]);

  // Set background images, videos, and embeds
  useEffect(() => {
    let canceled = false;
    const width = getRenderWidth();

    const applyBg = async () => {
      try {
        if (bg.kind === 'color') {
          setUploadedVideoUrl(null);
          const col = bg.color || '#1a1530';
          setBaseBg(col);
          const nextLayer = activeLayerRef.current === 0 ? 1 : 0;
          const lCurr = activeLayerRef.current === 0 ? layer0Ref.current : layer1Ref.current;
          const lNext = nextLayer === 0 ? layer0Ref.current : layer1Ref.current;
          if (lNext) {
            lNext.style.backgroundImage = 'none';
            lNext.style.backgroundColor = col;
            lNext.style.display = 'block';
          }
          if (lCurr) lCurr.classList.remove('on');
          if (lNext) lNext.classList.add('on');
          setActiveLayer(nextLayer);
        } else if (bg.kind === 'youtube' && bg.youtubeId) {
          setUploadedVideoUrl(null);
          setBaseBg('#000000');
          // Hide static layers completely so they never obscure the YouTube iframe
          if (layer0Ref.current) {
            layer0Ref.current.classList.remove('on');
            layer0Ref.current.style.display = 'none';
            layer0Ref.current.style.backgroundColor = 'transparent';
          }
          if (layer1Ref.current) {
            layer1Ref.current.classList.remove('on');
            layer1Ref.current.style.display = 'none';
            layer1Ref.current.style.backgroundColor = 'transparent';
          }
        } else if (bg.kind === 'videoUpload' && bg.videoUploadId) {
          setBaseBg('#000000');
          const vUrl = await getVideoURL(bg.videoUploadId);
          if (canceled) return;
          setUploadedVideoUrl(vUrl);
          // Hide static layers so they never obscure the video
          if (layer0Ref.current) {
            layer0Ref.current.classList.remove('on');
            layer0Ref.current.style.display = 'none';
            layer0Ref.current.style.backgroundColor = 'transparent';
          }
          if (layer1Ref.current) {
            layer1Ref.current.classList.remove('on');
            layer1Ref.current.style.display = 'none';
            layer1Ref.current.style.backgroundColor = 'transparent';
          }
        } else if (bg.kind === 'videoUrl' && bg.videoUrl) {
          setUploadedVideoUrl(null);
          setBaseBg('#000000');
          // Hide static layers so they never obscure the video
          if (layer0Ref.current) {
            layer0Ref.current.classList.remove('on');
            layer0Ref.current.style.display = 'none';
            layer0Ref.current.style.backgroundColor = 'transparent';
          }
          if (layer1Ref.current) {
            layer1Ref.current.classList.remove('on');
            layer1Ref.current.style.display = 'none';
            layer1Ref.current.style.backgroundColor = 'transparent';
          }
        } else if (bg.kind === 'upload' && bg.id) {
          setUploadedVideoUrl(null);
          setBaseBg('#111');
          const url = await getUploadURL(bg.id);
          if (canceled) return;
          const img = new Image();
          img.src = url;
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
          });
          if (canceled) return;
          const nextLayer = activeLayerRef.current === 0 ? 1 : 0;
          const lCurr = activeLayerRef.current === 0 ? layer0Ref.current : layer1Ref.current;
          const lNext = nextLayer === 0 ? layer0Ref.current : layer1Ref.current;
          if (lNext) {
            lNext.style.display = 'block';
            lNext.style.backgroundColor = 'transparent';
            lNext.style.backgroundImage = `url("${url}")`;
          }
          if (lCurr) lCurr.classList.remove('on');
          if (lNext) lNext.classList.add('on');
          setActiveLayer(nextLayer);
        } else {
          setUploadedVideoUrl(null);
          const scene = SCENES.find(s => s.id === bg.id) || SCENES[0];
          setBaseBg(scene.base);
          const url = getSceneURL(scene, width);
          if (canceled) return;
          const nextLayer = activeLayerRef.current === 0 ? 1 : 0;
          const lCurr = activeLayerRef.current === 0 ? layer0Ref.current : layer1Ref.current;
          const lNext = nextLayer === 0 ? layer0Ref.current : layer1Ref.current;
          if (lNext) {
            lNext.style.display = 'block';
            lNext.style.backgroundColor = 'transparent';
            lNext.style.backgroundImage = `url("${url}")`;
          }
          if (lCurr) lCurr.classList.remove('on');
          if (lNext) lNext.classList.add('on');
          setActiveLayer(nextLayer);
        }
      } catch (e) {
        console.warn('Background unavailable', e);
        if (onUpdateModeBg) {
          onUpdateModeBg(mode, clone(DEFAULTS.modes[mode].bg));
        }
        if (onErrorToast) {
          onErrorToast('Could not load background; restored default.');
        }
      }
    };

    applyBg();
    return () => {
      canceled = true;
    };
  }, [bg.kind, bg.id, bg.color, bg.youtubeId, bg.videoUploadId, bg.videoUrl, mode]);

  // Position layers
  useEffect(() => {
    const pos = `${cfg.posX}% ${cfg.posY}%`;
    if (layer0Ref.current) layer0Ref.current.style.backgroundPosition = pos;
    if (layer1Ref.current) layer1Ref.current.style.backgroundPosition = pos;
  }, [cfg.posX, cfg.posY]);

  // Animation canvas loop (only for static scenes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isVideoOrEmbed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number | null = null;
    let anim: AnimationInstance | null = null;
    let animId: string | null = null;
    let t0 = performance.now();
    let lastT = performance.now();

    const scene = bg.kind === 'scene' ? SCENES.find(s => s.id === bg.id) : null;
    const wantAnim = scene && scene.anim && animEnabled && !document.hidden;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      if (anim) anim.resize(vw, vh);
    };

    if (wantAnim) {
      anim = scene.anim!();
      resize();
      t0 = performance.now();
      lastT = performance.now();

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (now - lastT < 30) return;
        const dt = Math.min(0.1, (now - lastT) / 1000);
        lastT = now;
        const t = (now - t0) / 1000;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (anim!.scene) {
          const s = Math.max(vw / W0, vh / H0);
          const ox = ((vw - W0 * s) * cfg.posX) / 100;
          const oy = ((vh - H0 * s) * cfg.posY) / 100;
          ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
          anim!.frame(ctx, dt, t, vw, vh);
        } else if (anim!.full) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          anim!.frame(ctx, dt, t, vw, vh);
        } else {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          anim!.frame(ctx, dt, t, vw, vh);
        }
      };

      raf = requestAnimationFrame(loop);
      window.addEventListener('resize', resize);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [bg.id, bg.kind, animEnabled, cfg.posX, cfg.posY, isVideoOrEmbed]);

  const wrapStyle: React.CSSProperties = {
    filter: cfg.blur ? `blur(${cfg.blur}px)` : 'none',
    transform: cfg.blur ? `scale(${1 + cfg.blur / 200 + 0.02})` : 'none',
  };

  return (
    <div className="bg" style={{ backgroundColor: baseBg }} aria-hidden="true">
      <div ref={wrapRef} className="bg-wrap" style={wrapStyle}>
        {/* YouTube background video if selected */}
        {bg.kind === 'youtube' && bg.youtubeId && (
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center"
            style={{ zIndex: 1 }}
          >
            {/* High-res YouTube thumbnail as instant backdrop / fallback */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url("https://img.youtube.com/vi/${bg.youtubeId}/maxresdefault.jpg"), url("https://img.youtube.com/vi/${bg.youtubeId}/hqdefault.jpg")`,
              }}
            />
            <iframe
              src={buildBackgroundEmbedUrl(bg.youtubeId)}
              title={bg.youtubeTitle || 'YouTube Background Video'}
              className="pointer-events-none border-0"
              style={{
                width: '100vw',
                height: '56.25vw',
                minHeight: '100vh',
                minWidth: '177.77vh',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}

        {/* Uploaded local video background if selected */}
        {bg.kind === 'videoUpload' && uploadedVideoUrl && (
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <video
              ref={videoElRef}
              key={uploadedVideoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              src={uploadedVideoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              onCanPlay={e => {
                e.currentTarget.muted = true;
                e.currentTarget.play().catch(() => {});
              }}
              onError={() => {
                console.warn('Uploaded video failed to play');
                if (onErrorToast) onErrorToast('Could not play uploaded video file.');
                if (onUpdateModeBg) onUpdateModeBg(mode, clone(DEFAULTS.modes[mode].bg));
              }}
            />
          </div>
        )}

        {/* Direct video URL background if selected */}
        {bg.kind === 'videoUrl' && bg.videoUrl && (
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <video
              ref={videoElRef}
              key={bg.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              src={bg.videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              onCanPlay={e => {
                e.currentTarget.muted = true;
                e.currentTarget.play().catch(() => {});
              }}
              onError={() => {
                console.warn('Direct video URL failed to play:', bg.videoUrl);
                if (onErrorToast) onErrorToast('Could not play video link. Reverted to scenic background.');
                if (onUpdateModeBg) onUpdateModeBg(mode, clone(DEFAULTS.modes[mode].bg));
              }}
            />
          </div>
        )}

        {/* Static scene or image layers (only shown when not a video/embed) */}
        {!isVideoOrEmbed && (
          <>
            <div ref={layer0Ref} className="bg-layer on" />
            <div ref={layer1Ref} className="bg-layer" />
            <canvas ref={canvasRef} className="bg-fx" />
          </>
        )}
      </div>

      {/* Dim overlay and ambient shade */}
      <div className="bg-dim" style={{ opacity: cfg.dim / 100 }} />
      <div className="bg-shade" />
    </div>
  );
};
