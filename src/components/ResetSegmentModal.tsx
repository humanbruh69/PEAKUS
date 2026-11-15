import React, { useEffect } from 'react';
import type { LanguageCode } from '../lib/i18n';

interface ResetSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetCurrent: () => void;
  onResetAll: () => void;
  currentCycle: number;
  totalCycles: number;
  lang?: LanguageCode | string;
}

const COPY: Record<
  LanguageCode,
  {
    title: string;
    subtitle: string;
    resetPart: string;
    resetWhole: string;
    footnote: string;
    closeLabel: string;
  }
> = {
  en: {
    title: 'Reset Timer',
    subtitle: 'Start over just this part, or the whole session?',
    resetPart: 'Reset this part',
    resetWhole: 'Reset whole session',
    footnote: 'Your focus time is saved, even when you reset.',
    closeLabel: 'Close reset dialog',
  },
  ta: {
    title: 'நேரத்தை மீட்டமை',
    subtitle: 'இந்த பகுதியை மட்டும் தொடங்கவா, அல்லது முழு அமர்வையுமா?',
    resetPart: 'இந்த பகுதியை மீட்டமை',
    resetWhole: 'முழு அமர்வை மீட்டமை',
    footnote: 'மீட்டமைத்தாலும் உங்கள் கவன நேரம் சேமிக்கப்படும்.',
    closeLabel: 'மூடு',
  },
  es: {
    title: 'Reiniciar temporizador',
    subtitle: '¿Reiniciar solo esta parte o toda la sesión?',
    resetPart: 'Reiniciar esta parte',
    resetWhole: 'Reiniciar toda la sesión',
    footnote: 'Tu tiempo de foco se guarda, incluso al reiniciar.',
    closeLabel: 'Cerrar',
  },
};

export const ResetSegmentModal: React.FC<ResetSegmentModalProps> = ({
  isOpen,
  onClose,
  onResetCurrent,
  onResetAll,
  lang = 'en',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const c = COPY[(lang as LanguageCode)] || COPY.en;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resetSegTitle"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(6, 8, 16, 0.56)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'rgba(20, 23, 36, 0.86)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
          padding: '28px 24px 22px',
          color: '#ffffff',
          position: 'relative',
          textAlign: 'center',
          animation: 'popIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Top-left subtle close icon matching reference */}
        <button
          type="button"
          onClick={onClose}
          aria-label={c.closeLabel}
          style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            display: 'grid',
            placeItems: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <h2
          id="resetSegTitle"
          style={{
            margin: '4px 0 8px',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#ffffff',
          }}
        >
          {c.title}
        </h2>

        <p
          style={{
            margin: '0 0 22px',
            fontSize: '14px',
            lineHeight: 1.45,
            color: 'rgba(255, 255, 255, 0.68)',
          }}
        >
          {c.subtitle}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onResetCurrent();
              onClose();
            }}
            style={{
              flex: '1 1 140px',
              minHeight: '42px',
              padding: '0 16px',
              borderRadius: '11px',
              backgroundColor: '#5b76f7',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'filter 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = 'none';
            }}
          >
            {c.resetPart}
          </button>

          <button
            type="button"
            onClick={() => {
              onResetAll();
              onClose();
            }}
            style={{
              flex: '1 1 155px',
              minHeight: '42px',
              padding: '0 16px',
              borderRadius: '11px',
              backgroundColor: '#e03e3e',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'filter 0.15s ease, transform 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.filter = 'brightness(1.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = 'none';
            }}
          >
            {c.resetWhole}
          </button>
        </div>

        <p
          style={{
            margin: '18px 0 0',
            fontSize: '12.5px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {c.footnote}
        </p>
      </div>
    </div>
  );
};
