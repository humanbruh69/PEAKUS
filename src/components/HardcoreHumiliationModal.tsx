import React, { useEffect } from 'react';
import type { HumiliationLine } from '../lib/humiliation';
import { t } from '../lib/i18n';
import type { LanguageCode } from '../types';

interface HardcoreHumiliationModalProps {
  open: boolean;
  line: HumiliationLine | null;
  completedSessions: number;
  requiredSessions?: number;
  lang: LanguageCode;
  onClose: () => void;
}

export const HardcoreHumiliationModal: React.FC<HardcoreHumiliationModalProps> = ({
  open,
  line,
  completedSessions,
  requiredSessions = 4,
  lang,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !line) return null;

  const isTamil = lang === 'ta';
  const primaryText = isTamil ? line.tamil : line.english;
  const secondaryText = isTamil ? line.english : line.tamil;

  return (
    <>
      <div className="scrim" style={{ zIndex: 109 }} onClick={onClose} />
      <dialog
        className="confirm hardcore-humiliation-modal"
        open
        data-testid="hardcoreHumiliationModal"
        aria-labelledby="humiliationTitle"
        aria-describedby="humiliationQuote"
        style={{ zIndex: 110 }}
      >
        <div className="humiliation-header">
          <span className="humiliation-badge">
            HARDCORE QUIT · {Math.min(requiredSessions, Math.max(0, completedSessions))}/{requiredSessions}
          </span>
          <span className="humiliation-cat">{line.category.replace('_', ' ')}</span>
        </div>

        <h2 id="humiliationTitle" className="humiliation-title">
          You Quit Hardcore Mode
        </h2>

        <blockquote id="humiliationQuote" className="humiliation-quote">
          “{primaryText}”
        </blockquote>

        <div className="humiliation-sub">
          <p className="humiliation-alt">{secondaryText}</p>
          {line.tamil_transliteration && (
            <p className="humiliation-translit">{line.tamil_transliteration}</p>
          )}
        </div>

        <div className="acts" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn danger"
            id="btnCloseHumiliation"
            onClick={onClose}
          >
            {t('humiliationDismiss', lang)}
          </button>
        </div>
      </dialog>
    </>
  );
};
