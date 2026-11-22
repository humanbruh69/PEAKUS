import React, { useEffect, useRef, useState } from 'react';
import type { LanguageCode } from '../lib/i18n';

interface FlowPromptModalProps {
  open: boolean;
  language: LanguageCode;
  autoBreakSeconds?: number;
  onContinue: () => void; // Keep Working (+10 min)
  onCancel: () => void; // Take a Break
}

const COPY: Record<
  LanguageCode,
  {
    title: string;
    subtitle: string;
    takeBreak: string;
    keepWorking: string;
    startingIn: (s: number) => string;
  }
> = {
  en: {
    title: 'Great Focus Session!',
    subtitle: 'Time for a break. Would you like to rest?',
    takeBreak: 'Take a Break',
    keepWorking: 'Keep Working (+10 min)',
    startingIn: (s: number) => `Starting break in ${s}s`,
  },
  ta: {
    title: 'சிறந்த கவன அமர்வு!',
    subtitle: 'இடைவேளை நேரம். ஓய்வு எடுக்க விரும்புகிறீர்களா?',
    takeBreak: 'இடைவேளை எடு',
    keepWorking: 'தொடர்ந்து செய் (+10 நிமிடம்)',
    startingIn: (s: number) => `${s} வினாடிகளில் இடைவேளை தொடங்கும்`,
  },
  es: {
    title: '¡Gran sesión de foco!',
    subtitle: 'Es hora de descansar. ¿Querés tomar una pausa?',
    takeBreak: 'Tomar un descanso',
    keepWorking: 'Seguir trabajando (+10 min)',
    startingIn: (s: number) => `Iniciando descanso en ${s}s`,
  },
};

export const FlowPromptModal: React.FC<FlowPromptModalProps> = ({
  open,
  language,
  autoBreakSeconds = 10,
  onContinue,
  onCancel,
}) => {
  const totalMs = autoBreakSeconds * 1000;
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const triggeredRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Drift-free auto-countdown to start break automatically at 0s
  useEffect(() => {
    if (!open) {
      triggeredRef.current = false;
      setRemainingMs(totalMs);
      return;
    }

    triggeredRef.current = false;
    const deadline = Date.now() + totalMs;
    setRemainingMs(totalMs);

    const tick = () => {
      const rem = Math.max(0, deadline - Date.now());
      setRemainingMs(rem);
      if (rem <= 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        onCancelRef.current();
      }
    };

    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [open, totalMs]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!triggeredRef.current) {
          triggeredRef.current = true;
          onCancel();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onContinue, onCancel]);

  if (!open) return null;

  const c = COPY[language] || COPY.en;
  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressPct = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flowPromptTitle"
      aria-describedby="flowPromptDesc"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
        backgroundColor: 'rgba(6, 8, 16, 0.56)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        className="gui-scaled-modal"
        style={{
          width: '100%',
          maxWidth: '376px',
          background: 'rgba(20, 23, 36, 0.84)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '22px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
          padding: '28px 24px 24px',
          color: '#ffffff',
          textAlign: 'center',
          animation: 'popIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Clean circular checkmark */}
        <div
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255, 255, 255, 0.92)',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h2
          id="flowPromptTitle"
          style={{
            fontSize: '21px',
            fontWeight: 700,
            lineHeight: 1.25,
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          {c.title}
        </h2>

        <p
          id="flowPromptDesc"
          style={{
            fontSize: '14px',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.68)',
            margin: '0 0 22px',
          }}
        >
          {c.subtitle}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            autoFocus
            onClick={() => {
              if (!triggeredRef.current) {
                triggeredRef.current = true;
                onCancel();
              }
            }}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.16s ease, transform 0.16s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)';
            }}
          >
            {c.takeBreak}
          </button>

          <button
            type="button"
            onClick={() => {
              triggeredRef.current = true;
              onContinue();
            }}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(12, 14, 24, 0.45)',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '14.5px',
              fontWeight: 550,
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.16s ease, border-color 0.16s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(12, 14, 24, 0.45)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            {c.keepWorking}
          </button>
        </div>

        {/* Auto-countdown bar */}
        <div style={{ marginTop: '20px' }}>
          <div
            style={{
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.56)',
              marginBottom: '8px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.startingIn(secondsLeft)}
          </div>
          <div
            style={{
              width: '100%',
              height: '3px',
              borderRadius: '99px',
              background: 'rgba(255, 255, 255, 0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                borderRadius: 'inherit',
                background: 'rgba(255, 255, 255, 0.45)',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
