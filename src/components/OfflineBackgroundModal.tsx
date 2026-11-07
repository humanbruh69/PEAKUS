import React from 'react';
import { Icon } from './Icons';

interface OfflineBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenYouTubeBackgrounds: () => void;
  lang?: string;
}

export const OfflineBackgroundModal: React.FC<OfflineBackgroundModalProps> = ({
  isOpen,
  onClose,
  onOpenYouTubeBackgrounds,
  lang = 'en',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offlineBgTitle"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 10000,
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        className="modal-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#16161f',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(245, 158, 11, 0.1)',
          padding: '24px',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'grid',
              placeItems: 'center',
              color: '#f59e0b',
              flexShrink: 0,
            }}
          >
            <Icon name="upload" style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h2 id="offlineBgTitle" style={{ margin: 0, fontSize: '18px', fontWeight: 650, color: '#fef3c7' }}>
              Offline Background Detected
            </h2>
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                fontSize: '11px',
                fontWeight: 650,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              Device-Specific Media
            </span>
          </div>
        </div>

        {/* User-requested exact wording */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            lineHeight: 1.6,
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.88)',
          }}
        >
          <p style={{ margin: '0 0 10px', fontWeight: 600, color: '#ffffff' }}>
            It's an offline background. Switch to another device to get that background or use a YouTube link.
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
            Your background has been reset to default so you can continue focusing without interruption.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn primary"
            style={{
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 650,
              backgroundColor: 'var(--accent, #6366f1)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onClick={() => {
              onClose();
              onOpenYouTubeBackgrounds();
            }}
          >
            <Icon name="youtube" style={{ width: '18px', height: '18px' }} />
            Choose YouTube Video Background
          </button>

          <button
            type="button"
            className="btn ghost"
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
            }}
            onClick={onClose}
          >
            Continue with Default
          </button>
        </div>
      </div>
    </div>
  );
};
