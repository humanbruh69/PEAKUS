import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { clampVolume } from '../lib/ytMusicMath';

export interface MusicPlaybackTelemetry {
  currentTime: number;
  duration: number;
  isLive: boolean;
  ready: boolean;
  buffering: boolean;
  videoTitle?: string;
}

export interface YouTubeMusicPlayerHandle {
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

interface YouTubeMusicPlayerProps {
  youtubeId: string;
  playing: boolean;
  volume: number;
  muted: boolean;
  onTelemetry: (telemetry: MusicPlaybackTelemetry) => void;
  onEnded?: () => void;
  onTitleResolved?: (title: string) => void;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __peakusYtApiCallbacks?: Array<() => void>;
  }
}

function loadYouTubeIframeAPI(): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    if (window.YT && typeof window.YT.Player === 'function') {
      resolve();
      return;
    }

    if (!window.__peakusYtApiCallbacks) {
      window.__peakusYtApiCallbacks = [];
    }
    window.__peakusYtApiCallbacks.push(resolve);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prevReady?.();
      } catch {}
      const cbs = window.__peakusYtApiCallbacks || [];
      window.__peakusYtApiCallbacks = [];
      cbs.forEach(cb => {
        try {
          cb();
        } catch {}
      });
    };

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        const cbs = window.__peakusYtApiCallbacks || [];
        window.__peakusYtApiCallbacks = [];
        cbs.forEach(cb => cb());
      };
      document.head.appendChild(tag);
    }
  });
}

export const YouTubeMusicPlayer = React.forwardRef<YouTubeMusicPlayerHandle, YouTubeMusicPlayerProps>(
  ({ youtubeId, playing, volume, muted, onTelemetry, onEnded, onTitleResolved }, ref) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const readyRef = useRef(false);
    const activeVideoIdRef = useRef<string>('');
    const hasActivatedRef = useRef(false);

    const latestPropsRef = useRef({ youtubeId, playing, volume, muted, onTelemetry, onEnded, onTitleResolved });
    latestPropsRef.current = { youtubeId, playing, volume, muted, onTelemetry, onEnded, onTitleResolved };

    if (playing) {
      hasActivatedRef.current = true;
    }

    const postFallbackCommand = (func: string, args: any[] = []) => {
      const iframe = hostRef.current?.querySelector('iframe');
      if (!iframe?.contentWindow) return;
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch {}
    };

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const p = playerRef.current;
        if (p && readyRef.current && typeof p.seekTo === 'function') {
          try {
            p.seekTo(Math.max(0, seconds), true);
            const dur = Number(p.getDuration?.() || 0);
            latestPropsRef.current.onTelemetry({
              currentTime: Math.max(0, seconds),
              duration: dur,
              isLive: dur <= 0,
              ready: true,
              buffering: false,
            });
            return;
          } catch {}
        }
        postFallbackCommand('seekTo', [Math.max(0, seconds), true]);
      },
      setVolume: (vol: number) => {
        const safeVol = clampVolume(vol);
        const p = playerRef.current;
        if (p && readyRef.current && typeof p.setVolume === 'function') {
          try {
            p.setVolume(safeVol);
            if (safeVol > 0 && !latestPropsRef.current.muted) {
              p.unMute?.();
            }
            return;
          } catch {}
        }
        postFallbackCommand('setVolume', [safeVol]);
      },
      setMuted: (isMuted: boolean) => {
        const p = playerRef.current;
        if (p && readyRef.current) {
          try {
            if (isMuted) p.mute?.();
            else p.unMute?.();
            return;
          } catch {}
        }
        postFallbackCommand(isMuted ? 'mute' : 'unMute');
      },
    }));

    // Lazily create YT.Player once user presses play at least once
    useEffect(() => {
      if (!youtubeId || (!playing && !hasActivatedRef.current)) return;

      let canceled = false;

      const init = async () => {
        await loadYouTubeIframeAPI();
        if (canceled || !hostRef.current) return;

        // If player exists, swap video cleanly
        if (playerRef.current && readyRef.current && typeof playerRef.current.loadVideoById === 'function') {
          if (activeVideoIdRef.current !== youtubeId) {
            activeVideoIdRef.current = youtubeId;
            try {
              if (latestPropsRef.current.playing) {
                playerRef.current.loadVideoById(youtubeId);
              } else {
                playerRef.current.cueVideoById(youtubeId);
              }
            } catch {}
          }
          return;
        }

        if (!window.YT || typeof window.YT.Player !== 'function') {
          return;
        }

        const slot = document.createElement('div');
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(slot);
        activeVideoIdRef.current = youtubeId;
        readyRef.current = false;

        playerRef.current = new window.YT.Player(slot, {
          width: '200',
          height: '200',
          videoId: youtubeId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: latestPropsRef.current.playing ? 1 : 0,
            controls: 0,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev: any) => {
              if (canceled) return;
              readyRef.current = true;
              const p = ev.target;
              const { volume: v, muted: m, playing: shouldPlay, onTitleResolved: reportTitle, onTelemetry: reportTel } =
                latestPropsRef.current;
              try {
                p.setVolume?.(clampVolume(v));
                if (m) p.mute?.();
                else p.unMute?.();
                if (shouldPlay) p.playVideo?.();
                else p.pauseVideo?.();

                const dur = Number(p.getDuration?.() || 0);
                const cur = Number(p.getCurrentTime?.() || 0);
                const data = p.getVideoData?.();
                if (data?.title && reportTitle) reportTitle(data.title);
                reportTel({
                  currentTime: cur,
                  duration: dur,
                  isLive: dur <= 0 || !!data?.isLive,
                  ready: true,
                  buffering: false,
                  videoTitle: data?.title,
                });
              } catch {}
            },
            onStateChange: (ev: any) => {
              if (canceled) return;
              const YTState = window.YT?.PlayerState || { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };
              const p = ev.target;
              try {
                const dur = Number(p.getDuration?.() || 0);
                const cur = Number(p.getCurrentTime?.() || 0);
                const data = p.getVideoData?.();
                if (data?.title && latestPropsRef.current.onTitleResolved) {
                  latestPropsRef.current.onTitleResolved(data.title);
                }
                latestPropsRef.current.onTelemetry({
                  currentTime: cur,
                  duration: dur,
                  isLive: dur <= 0 || !!data?.isLive,
                  ready: true,
                  buffering: ev.data === YTState.BUFFERING,
                  videoTitle: data?.title,
                });
                if (ev.data === YTState.ENDED) {
                  // Loop single track seamlessly or notify parent
                  p.seekTo?.(0, true);
                  p.playVideo?.();
                  latestPropsRef.current.onEnded?.();
                }
              } catch {}
            },
          },
        });
      };

      init();
      return () => {
        canceled = true;
      };
    }, [youtubeId, playing]);

    // Sync play / pause without destroying player (keeps seek position!)
    useEffect(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      try {
        if (playing) {
          p.playVideo?.();
        } else {
          p.pauseVideo?.();
        }
      } catch {}
    }, [playing]);

    // Sync individual volume & mute state
    useEffect(() => {
      const safeVol = clampVolume(volume);
      const p = playerRef.current;
      if (!p || !readyRef.current) {
        postFallbackCommand('setVolume', [safeVol]);
        postFallbackCommand(muted ? 'mute' : 'unMute');
        return;
      }
      try {
        p.setVolume?.(safeVol);
        if (muted || safeVol === 0) {
          p.mute?.();
        } else {
          p.unMute?.();
        }
      } catch {}
    }, [volume, muted]);

    // Poll playback position smoothly while playing
    useEffect(() => {
      if (!playing) return;
      const interval = setInterval(() => {
        const p = playerRef.current;
        if (!p || !readyRef.current) return;
        try {
          const cur = Number(p.getCurrentTime?.() || 0);
          const dur = Number(p.getDuration?.() || 0);
          const data = p.getVideoData?.();
          const st = p.getPlayerState?.();
          latestPropsRef.current.onTelemetry({
            currentTime: cur,
            duration: dur,
            isLive: dur <= 0 || !!data?.isLive,
            ready: true,
            buffering: st === 3,
            videoTitle: data?.title,
          });
        } catch {}
      }, 250);
      return () => clearInterval(interval);
    }, [playing]);

    // Destroy YT.Player on unmount
    useEffect(() => {
      return () => {
        try {
          playerRef.current?.destroy?.();
        } catch {}
        playerRef.current = null;
        readyRef.current = false;
      };
    }, []);

    return (
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '200px',
          height: '200px',
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      />
    );
  }
);
