import React, { useState, useEffect, useRef } from 'react';
import type { TimerState, Settings } from '../types';
import { fmtClock } from '../lib/utils';
import { t } from '../lib/i18n';
import { Icon } from './Icons';

interface AmbientTimerProps {
  timerState: TimerState;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onSkipTimer: () => void;
  onRequestQuitHardcore?: () => void;
  lang: string;
  settings: Settings;
  zenMode: boolean;
}

const AMBIENT_POS_KEY = 'peakus.ambient_timer_pos';

export const AmbientTimer: React.FC<AmbientTimerProps> = ({
  timerState,
  onToggleTimer,
  onResetTimer,
  onSkipTimer,
  onRequestQuitHardcore,
  lang,
  settings,
  zenMode,
}) => {
  // Load saved position or default to top-right
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(AMBIENT_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {}
    // Default: corner top-right (will clamp after mount)
    return { x: window.innerWidth ? Math.max(20, window.innerWidth - 260) : 20, y: 70 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const readGuiScale = () => {
    const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gui-scale'));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  };

  // Clamp position to viewport bounds on resize
  useEffect(() => {
    const handleResize = () => {
      const scale = readGuiScale();
      setPosition(prev => {
        const el = elementRef.current;
        const w = el ? el.offsetWidth : 220;
        const h = el ? el.offsetHeight : 120;
        const maxX = Math.max(12, window.innerWidth / scale - w - 12);
        const maxY = Math.max(12, window.innerHeight / scale - h - 12);
        const clampedX = Math.max(12, Math.min(maxX, prev.x));
        const clampedY = Math.max(12, Math.min(maxY, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from handle or card background, not directly clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const scale = readGuiScale();
    const deltaX = (e.clientX - dragRef.current.startX) / scale;
    const deltaY = (e.clientY - dragRef.current.startY) / scale;
    const el = elementRef.current;
    const w = el ? el.offsetWidth : 220;
    const h = el ? el.offsetHeight : 120;

    const maxX = Math.max(8, window.innerWidth / scale - w - 8);
    const maxY = Math.max(8, window.innerHeight / scale - h - 8);
    const newX = Math.max(8, Math.min(maxX, dragRef.current.initX + deltaX));
    const newY = Math.max(8, Math.min(maxY, dragRef.current.initY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    dragRef.current = null;
    try {
      localStorage.setItem(AMBIENT_POS_KEY, JSON.stringify(position));
    } catch {}
  };

  const timeStr = fmtClock(timerState.remainingMs);
  const phaseLabel =
    timerState.phase === 'focus'
      ? t('phaseFocus', lang as any)
      : timerState.phase === 'short'
      ? t('phaseShort', lang as any)
      : t('phaseLong', lang as any);

  const isRunning = timerState.status === 'running';
  const hardcoreMode = !!settings.timer.hardcoreMode;
  const pauseLocked = hardcoreMode && isRunning;

  return (
    <div
      ref={elementRef}
      className="gui-scaled"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 50,
        width: 'auto',
        minWidth: '200px',
        maxWidth: '280px',
        padding: '12px 14px',
        borderRadius: '16px',
        background: 'rgba(12, 12, 22, 0.78)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isDragging
          ? '0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px var(--accent-soft)'
          : '0 8px 24px rgba(0, 0, 0, 0.45)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s, transform 0.15s',
      }}
      role="region"
      aria-label="Ambient movable timer"
    >
      {/* Header with drag grip & phase */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isRunning ? '#34d399' : '#a3a3ad',
              boxShadow: isRunning ? '0 0 8px #34d399' : 'none',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: isRunning ? '#34d399' : 'var(--muted)',
            }}
          >
            {phaseLabel}
          </span>
          {hardcoreMode && (
            <>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: 'rgba(244, 63, 94, 0.18)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  color: '#fda4af',
                }}
              >
                HC {Math.min(4, Math.max(0, timerState.cycle))}/4
              </span>
              {onRequestQuitHardcore && (
                <button
                  type="button"
                  onClick={onRequestQuitHardcore}
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    color: '#fecdd3',
                    cursor: 'pointer',
                  }}
                >
                  {t('quitHardcore', lang as any)}
                </button>
              )}
            </>
          )}
        </div>

        {/* Drag handle dots */}
        <div
          title="Drag to move timer"
          style={{
            display: 'flex',
            gap: '2px',
            opacity: 0.5,
            padding: '2px 4px',
            borderRadius: '4px',
          }}
        >
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#fff' }} />
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#fff' }} />
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#fff' }} />
        </div>
      </div>

      {/* Main Countdown Display */}
      <div
        style={{
          fontFamily: 'var(--display-font)',
          fontSize: '32px',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: 'var(--clock-color, #ffffff)',
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          textAlign: 'center',
          margin: '4px 0 8px',
        }}
      >
        {timeStr}
      </div>

      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '6px',
        }}
      >
        <button
          type="button"
          onClick={onToggleTimer}
          aria-label={isRunning ? t('pause', lang as any) : t('start', lang as any)}
          aria-disabled={pauseLocked}
          title={
            pauseLocked
              ? `${t('hardcoreMode', lang as any)}: Pausing disabled`
              : isRunning
              ? t('pause', lang as any)
              : t('start', lang as any)
          }
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: isRunning ? 'rgba(255, 255, 255, 0.14)' : 'var(--accent)',
            color: pauseLocked ? '#fda4af' : '#fff',
            opacity: pauseLocked ? 0.42 : 1,
            display: 'grid',
            placeItems: 'center',
            cursor: pauseLocked ? 'not-allowed' : 'pointer',
            border: pauseLocked ? '1px solid rgba(244, 63, 94, 0.4)' : 'none',
            transition: 'transform 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            if (pauseLocked) return;
            e.currentTarget.style.transform = 'scale(1.08)';
          }}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Icon name={isRunning ? 'pause' : 'play'} style={{ width: '14px', height: '14px' }} />
        </button>

        <button
          type="button"
          onClick={onResetTimer}
          aria-label={t('reset', lang as any)}
          title="Reset"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'var(--muted)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--muted)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <Icon name="reset" style={{ width: '13px', height: '13px' }} />
        </button>

        <button
          type="button"
          onClick={onSkipTimer}
          aria-label={t('skip', lang as any)}
          aria-disabled={hardcoreMode}
          title={hardcoreMode ? `${t('hardcoreMode', lang as any)}: Skipping disabled` : 'Skip'}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'var(--muted)',
            opacity: hardcoreMode ? 0.38 : 1,
            display: 'grid',
            placeItems: 'center',
            cursor: hardcoreMode ? 'not-allowed' : 'pointer',
            border: 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (hardcoreMode) return;
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--muted)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <Icon name="skip" style={{ width: '13px', height: '13px' }} />
        </button>
      </div>
    </div>
  );
};
