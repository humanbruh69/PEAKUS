import React, { useEffect, useState, useRef } from 'react';
import { Icon } from './Icons';
import { Store } from '../lib/store';
import { sync } from '../lib/sync';
import type { LanguageCode } from '../types';
import { t } from '../lib/i18n';

interface NotesPopoverProps {
  open: boolean;
  onClose: () => void;
  language?: LanguageCode;
  onUpdateNotes?: (text: string) => void;
}

export const NotesPopover: React.FC<NotesPopoverProps> = ({
  open,
  onClose,
  language = 'en',
  onUpdateNotes,
}) => {
  const [text, setText] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const saveTimeout = useRef<any>(null);

  useEffect(() => {
    if (open) {
      const doc = Store.loadNotesDoc();
      setText(doc.text);
      setStatus(t('notesSaved', language));
    }
  }, [open, language]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleChange = (val: string) => {
    setText(val);
    setStatus(t('notesSaving', language));
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      Store.saveNotes(val, Date.now());
      setStatus(t('notesSaved', language));
      sync.touch();
      if (onUpdateNotes) onUpdateNotes(val);
    }, 400);
  };

  const handleClear = () => {
    setText('');
    Store.saveNotes('', Date.now());
    setStatus(t('notesSaved', language));
    sync.touch();
    if (onUpdateNotes) onUpdateNotes('');
  };

  if (!open) return null;

  return (
    <div className="pop" role="dialog" aria-label={t('notesTitle', language)}>
      <div className="pop-head">
        <span className="badge-ic" aria-hidden="true">
          <Icon name="pencil" />
        </span>
        <h2>{t('notesTitle', language)}</h2>
        <button
          className="x-btn"
          aria-label={t('notesTitle', language)}
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="pop-body">
        <textarea
          id="notesTa"
          value={text}
          placeholder={t('notesPlaceholder', language)}
          rows={10}
          autoFocus
          onChange={e => handleChange(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--muted)' }}>
          <span>{status}</span>
          {text.length > 0 && (
            <button
              className="link-btn"
              onClick={handleClear}
              style={{ fontSize: '12px' }}
            >
              {t('clearNotes', language)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
