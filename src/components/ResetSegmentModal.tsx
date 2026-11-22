import React, { useEffect } from 'react';
import type { LanguageCode } from '../lib/i18n';

interface ResetSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetCurrent: () => void;
  onResetAll: () => void;
  currentCycle: number;
  totalCycles: number;
  hardcoreMode?: boolean;
  onQuitHardcore?: () => void;
  lang?: LanguageCode | string;
}

const COPY: Record<
  LanguageCode,
  {
    title: string;
    subtitle: string;
    hardcoreSubtitle: string;
    hardcoreBadge: string;
    hardcoreFootnote: string;
    resetPart: string;
    resetWhole: string;
    footnote: string;
    closeLabel: string;
  }
> = {
  en: {
    title: 'Reset Timer',
    subtitle: 'Start over just this part, or the whole session?',
    hardcoreSubtitle: 'Resetting is for the weak. Start over this part or the whole session?',
    hardcoreBadge: 'Hardcore Mode Active',
    hardcoreFootnote:
      'Hardcore Mode: Elapsed focus time is discarded and will NOT count toward stats or streak.',
    resetPart: 'Reset this part',
    resetWhole: 'Reset whole session',
    footnote: 'Normal Mode: Your elapsed focus time is saved in stats, even when you reset.',
    closeLabel: 'Close reset dialog',
  },
  ta: {
    title: 'நேரத்தை மீட்டமை',
    subtitle: 'இந்த பகுதியை மட்டும் தொடங்கவா, அல்லது முழு அமர்வையுமா?',
    hardcoreSubtitle: 'ஹார்ட்கோர் முறை: மீட்டமைத்தால் நேரம் சேமிக்கப்படாது. தொடரவா?',
    hardcoreBadge: 'ஹார்ட்கோர் முறை செயலில்',
    hardcoreFootnote:
      'ஹார்ட்கோர் முறை: மீட்டமைக்கும் போது கவன நேரம் புள்ளிவிவரத்தில் சேர்க்கப்படாது.',
    resetPart: 'இந்த பகுதியை மீட்டமை',
    resetWhole: 'முழு அமர்வை மீட்டமை',
    footnote: 'மீட்டமைத்தாலும் உங்கள் கவன நேரம் சேமிக்கப்படும்.',
    closeLabel: 'மூடு',
  },
  es: {
    title: 'Reiniciar temporizador',
    subtitle: '¿Reiniciar solo esta parte o toda la sesión?',
    hardcoreSubtitle: 'Reiniciar es de débiles. ¿Reiniciar esta parte o toda la sesión?',
    hardcoreBadge: 'Modo Hardcore Activo',
    hardcoreFootnote:
      'Modo Hardcore: el tiempo transcurrido se descarta y NO suma a estadísticas ni racha.',
    resetPart: 'Reiniciar esta parte',
    resetWhole: 'Reiniciar toda la sesión',
    footnote: 'Tu tiempo de foco se guarda en estadísticas, incluso al reiniciar.',
    closeLabel: 'Cerrar',
  },
};

export const ResetSegmentModal: React.FC<ResetSegmentModalProps> = ({
  isOpen,
  onClose,
  onResetCurrent,
  onResetAll,
  currentCycle,
  totalCycles,
  hardcoreMode = false,
  onQuitHardcore,
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
  const safeTotal = Math.max(1, totalCycles || 4);
  const completedCycles = Math.max(0, currentCycle || 0);

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
        className="gui-scaled-modal"
        style={{
          width: '100%',
          maxWidth: '410px',
          backgroundColor: 'rgba(20, 23, 36, 0.88)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
          border: hardcoreMode
            ? '1px solid rgba(244, 63, 94, 0.42)'
            : '1px solid rgba(255, 255, 255, 0.12)',
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

        {hardcoreMode && (
          <div
            data-testid="resetHardcoreBadge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: 'rgba(244, 63, 94, 0.16)',
              border: '1px solid rgba(244, 63, 94, 0.42)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#fda4af',
            }}
          >
            {c.hardcoreBadge}
          </div>
        )}

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
            margin: completedCycles > 0 ? '0 0 12px' : '0 0 20px',
            fontSize: '14px',
            lineHeight: 1.45,
            color: hardcoreMode ? '#fecdd3' : 'rgba(255, 255, 255, 0.72)',
          }}
        >
          {hardcoreMode ? c.hardcoreSubtitle : c.subtitle}
        </p>

        {completedCycles > 0 && (
          <div
            data-testid="resetCycleProgressNotice"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '18px',
              padding: '5px 12px',
              borderRadius: '999px',
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              border: '1px solid rgba(52, 211, 153, 0.28)',
              fontSize: '12px',
              fontWeight: 600,
              color: '#6ee7b7',
            }}
          >
            <span>
              {completedCycles}/{safeTotal} cycles completed (kept in stats)
            </span>
          </div>
        )}

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
            margin: '16px 0 0',
            fontSize: '12.5px',
            lineHeight: 1.4,
            color: hardcoreMode ? '#fda4af' : 'rgba(255, 255, 255, 0.56)',
          }}
        >
          {hardcoreMode ? c.hardcoreFootnote : c.footnote}
        </p>

        {hardcoreMode && onQuitHardcore && (
          <button
            type="button"
            id="btnResetModalQuitHardcore"
            onClick={() => {
              onClose();
              onQuitHardcore();
            }}
            style={{
              marginTop: '12px',
              background: 'transparent',
              border: 'none',
              color: '#fda4af',
              fontSize: '12.5px',
              fontWeight: 650,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Quit Hardcore Mode...
          </button>
        )}
      </div>
    </div>
  );
};
