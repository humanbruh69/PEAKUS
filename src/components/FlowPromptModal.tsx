import React, { useEffect } from 'react';
import { Icon } from './Icons';
import { t } from '../lib/i18n';
import type { LanguageCode } from '../lib/i18n';

interface FlowPromptModalProps {
  open: boolean;
  language: LanguageCode;
  onContinue: () => void;
  onCancel: () => void;
}

export const FlowPromptModal: React.FC<FlowPromptModalProps> = ({
  open,
  language,
  onContinue,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onContinue();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onContinue, onCancel]);

  if (!open) return null;

  return (
    <>
      {/* Dark backdrop scrim */}
      <div
        className="scrim"
        style={{
          zIndex: 9998,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(5, 5, 12, 0.78)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onCancel}
      />

      {/* Center Flow Prompt Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flowPromptTitle"
        aria-describedby="flowPromptDesc"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: '92%',
          maxWidth: '460px',
          background: 'linear-gradient(145deg, #181928 0%, #10111a 100%)',
          border: '1.5px solid var(--accent-border)',
          boxShadow: '0 25px 65px -15px rgba(0, 0, 0, 0.85), var(--accent-glow)',
          borderRadius: '24px',
          padding: '30px 26px',
          color: '#f4f4f7',
          textAlign: 'center',
          boxSizing: 'border-box',
          animation: 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Glowing Flow Wave Badge */}
        <div
          style={{
            width: '68px',
            height: '68px',
            margin: '0 auto 16px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--accent-soft) 0%, rgba(255, 255, 255, 0.05) 100%)',
            border: '1.5px solid var(--accent-border)',
            boxShadow: '0 8px 24px var(--accent-glow)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent-text)',
            fontSize: '32px',
          }}
        >
          <span style={{ width: '34px', height: '34px', display: 'grid', placeItems: 'center' }}>
            <Icon name="flow" />
          </span>
        </div>

        {/* Title */}
        <h2
          id="flowPromptTitle"
          style={{
            fontSize: '23px',
            fontWeight: 800,
            lineHeight: 1.3,
            margin: '0 0 10px',
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          {t('continueFlowTitle', language)}
        </h2>

        {/* Description */}
        <p
          id="flowPromptDesc"
          style={{
            fontSize: '14.5px',
            lineHeight: 1.55,
            color: 'rgba(255, 255, 255, 0.75)',
            margin: '0 0 24px',
          }}
        >
          {t('continueFlowDesc', language)}
        </p>

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Cancel / Start Break */}
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            {t('continueFlowNo', language)}
          </button>

          {/* Continue Flow (+10 min) */}
          <button
            type="button"
            autoFocus
            onClick={onContinue}
            style={{
              flex: 1.3,
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #ffffff) 100%)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px var(--accent-glow)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 22px var(--accent-glow)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px var(--accent-glow)';
            }}
          >
            {t('continueFlowYes', language)}
          </button>
        </div>
      </div>
    </>
  );
};
