import React from 'react';
import { Icon } from './Icons';

interface ResetSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetCurrent: () => void;
  onResetAll: () => void;
  currentCycle: number;
  totalCycles: number;
  lang?: string;
}

export const ResetSegmentModal: React.FC<ResetSegmentModalProps> = ({
  isOpen,
  onClose,
  onResetCurrent,
  onResetAll,
  currentCycle,
  totalCycles,
  lang = 'en',
}) => {
  if (!isOpen) return null;

  const currentSegmentNum = Math.min(totalCycles, (currentCycle % totalCycles) + 1);

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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#16161e',
          border: '1px solid var(--accent-border, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.7)',
          padding: '24px',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: '#ef4444',
              flexShrink: 0,
            }}
          >
            <Icon name="timer" style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h2 id="resetSegTitle" style={{ margin: 0, fontSize: '18px', fontWeight: 650 }}>
              {lang === 'ta' ? 'சுற்றை மீட்டமைக்க வேண்டுமா?' : lang === 'es' ? '¿Reiniciar segmentos de enfoque?' : 'Reset Focus Segments?'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
              {lang === 'ta'
                ? `தற்போதைய சுற்று: ${currentSegmentNum}/${totalCycles}`
                : lang === 'es'
                ? `Progreso actual: ${currentSegmentNum}/${totalCycles}`
                : `Current progress: ${currentSegmentNum} of ${totalCycles} segments`}
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize: '13.5px',
            lineHeight: 1.55,
            color: 'rgba(255, 255, 255, 0.8)',
            margin: '0 0 20px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {lang === 'ta'
            ? 'இந்த சுற்றை தொடக்கத்திற்கு மீட்டமைக்கலாம் அல்லது அனைத்து 4 சுற்றுகளையும் மீட்டமைக்கலாம்.'
            : lang === 'es'
            ? '¿Deseas reiniciar únicamente el temporizador del segmento actual, o reiniciar los 4 segmentos del ciclo completo?'
            : 'Are you sure you want to reset your cycle progress? You can restart just the current segment or wipe all segments in this cycle back to zero.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              onResetCurrent();
              onClose();
            }}
          >
            <Icon name="timer" style={{ width: '16px', height: '16px' }} />
            {lang === 'ta' ? 'தற்போதைய சுற்றை மட்டும் மீட்டமை' : lang === 'es' ? 'Reiniciar solo segmento actual' : 'Reset Current Segment Only'}
          </button>

          <button
            type="button"
            className="btn"
            style={{
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 600,
              backgroundColor: 'rgba(239, 68, 68, 0.18)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
            onClick={() => {
              onResetAll();
              onClose();
            }}
          >
            <Icon name="trash" style={{ width: '16px', height: '16px' }} />
            {lang === 'ta' ? 'அனைத்து சுற்றுகளையும் மீட்டமை (0/4)' : lang === 'es' ? 'Reiniciar todos los segmentos (0/4)' : 'Reset All Segments (0/4)'}
          </button>

          <button
            type="button"
            className="btn ghost"
            style={{
              padding: '10px 16px',
              fontSize: '13.5px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginTop: '4px',
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            {lang === 'ta' ? 'ரத்துசெய்' : lang === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
