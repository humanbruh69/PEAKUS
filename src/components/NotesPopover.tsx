import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Icon } from './Icons';
import { Store } from '../lib/store';
import { sync } from '../lib/sync';
import type { LanguageCode } from '../types';
import { t } from '../lib/i18n';
import {
  getNotesStats,
  isRichNotesEmpty,
  normalizeNotesInput,
  sanitizeRichNotesHtml,
} from '../lib/notesEngine';

interface NotesPopoverProps {
  open: boolean;
  onClose: () => void;
  language?: LanguageCode;
  notes?: string;
  onUpdateNotes?: (text: string) => void;
  onConfirm?: (
    title: string,
    text: string,
    okLabel: string,
    fn: () => void,
    danger?: boolean
  ) => void;
}

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  h1: boolean;
  h2: boolean;
  quote: boolean;
  ul: boolean;
  ol: boolean;
  checklist: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
}

const DEFAULT_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  h1: false,
  h2: false,
  quote: false,
  ul: false,
  ol: false,
  checklist: false,
  alignLeft: false,
  alignCenter: false,
  alignRight: false,
};

function findClosestInEditor(
  node: Node | null,
  root: HTMLElement,
  predicate: (el: HTMLElement) => boolean
): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (cur.nodeType === 1 && predicate(cur as HTMLElement)) {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

export const NotesPopover: React.FC<NotesPopoverProps> = ({
  open,
  onClose,
  language = 'en',
  notes,
  onUpdateNotes,
  onConfirm,
}) => {
  const [html, setHtml] = useState<string>(() =>
    normalizeNotesInput(notes ?? Store.loadNotesDoc().text)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [formatState, setFormatState] = useState<FormatState>(DEFAULT_FORMAT_STATE);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const lastCommittedRef = useRef<string>(html);
  const isFocusedRef = useRef(false);
  const onUpdateNotesRef = useRef(onUpdateNotes);
  onUpdateNotesRef.current = onUpdateNotes;

  const stats = useMemo(() => getNotesStats(html), [html]);
  const empty = useMemo(() => isRichNotesEmpty(html), [html]);

  const commitNotes = useCallback((val: string) => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    const clean = sanitizeRichNotesHtml(val);
    const normalized = isRichNotesEmpty(clean) ? '' : clean;
    pendingValueRef.current = null;
    lastCommittedRef.current = normalized;
    Store.saveNotes(normalized, Date.now());
    setIsSaving(false);
    sync.touch();
    if (onUpdateNotesRef.current) onUpdateNotesRef.current(normalized);
  }, []);

  const flushPendingSave = useCallback(() => {
    if (pendingValueRef.current !== null) {
      commitNotes(pendingValueRef.current);
    }
  }, [commitNotes]);

  // Sync external note updates (e.g. Calculator -> Notes, StudyBot -> Notes, Cloud Sync)
  useEffect(() => {
    if (pendingValueRef.current !== null) return;
    const rawSource = typeof notes === 'string' ? notes : open ? Store.loadNotesDoc().text : '';
    const nextNormalized = normalizeNotesInput(rawSource);
    if (nextNormalized !== lastCommittedRef.current || open) {
      lastCommittedRef.current = nextNormalized;
      setHtml(nextNormalized);
      if (editorRef.current && !isFocusedRef.current && editorRef.current.innerHTML !== nextNormalized) {
        editorRef.current.innerHTML = nextNormalized;
      }
    }
    if (open) {
      setIsSaving(false);
    }
  }, [open, notes]);

  // Ensure editor DOM matches state when opened
  useEffect(() => {
    if (!open || !editorRef.current) return;
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [open]);

  const updateToolbarState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
      setFormatState(DEFAULT_FORMAT_STATE);
      return;
    }

    const anchor = sel.anchorNode;
    const blockEl = findClosestInEditor(anchor, editor, el =>
      ['P', 'DIV', 'H1', 'H2', 'BLOCKQUOTE', 'LI'].includes(el.tagName)
    );
    const checklistEl = findClosestInEditor(
      anchor,
      editor,
      el => el.tagName === 'UL' && el.classList.contains('notes-checklist')
    );
    const ulEl = findClosestInEditor(
      anchor,
      editor,
      el => el.tagName === 'UL' && !el.classList.contains('notes-checklist')
    );
    const olEl = findClosestInEditor(anchor, editor, el => el.tagName === 'OL');
    const quoteEl = findClosestInEditor(anchor, editor, el => el.tagName === 'BLOCKQUOTE');
    const h1El = findClosestInEditor(anchor, editor, el => el.tagName === 'H1');
    const h2El = findClosestInEditor(anchor, editor, el => el.tagName === 'H2');

    let alignLeft = false;
    let alignCenter = false;
    let alignRight = false;
    try {
      alignLeft = document.queryCommandState('justifyLeft');
      alignCenter = document.queryCommandState('justifyCenter');
      alignRight = document.queryCommandState('justifyRight');
    } catch {}
    if (blockEl && blockEl.style.textAlign) {
      alignLeft = blockEl.style.textAlign === 'left';
      alignCenter = blockEl.style.textAlign === 'center';
      alignRight = blockEl.style.textAlign === 'right';
    }

    let bold = false;
    let italic = false;
    let underline = false;
    let strike = false;
    try {
      bold = document.queryCommandState('bold');
      italic = document.queryCommandState('italic');
      underline = document.queryCommandState('underline');
      strike = document.queryCommandState('strikeThrough');
    } catch {}

    setFormatState({
      bold,
      italic,
      underline,
      strike,
      h1: !!h1El,
      h2: !!h2El,
      quote: !!quoteEl,
      ul: !!ulEl,
      ol: !!olEl,
      checklist: !!checklistEl,
      alignLeft,
      alignCenter,
      alignRight,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onSelectionChange = () => {
      updateToolbarState();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [open, updateToolbarState]);

  const handleClose = useCallback(() => {
    flushPendingSave();
    onClose();
  }, [flushPendingSave, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    const handleVisibility = () => {
      if (document.hidden) flushPendingSave();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('pagehide', flushPendingSave);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('pagehide', flushPendingSave);
      document.removeEventListener('visibilitychange', handleVisibility);
      flushPendingSave();
    };
  }, [open, handleClose, flushPendingSave]);

  const scheduleNotesSave = useCallback(
    (rawHtml: string) => {
      const sanitized = sanitizeRichNotesHtml(rawHtml);
      const normalized = isRichNotesEmpty(sanitized) ? '' : sanitized;
      setHtml(normalized);
      pendingValueRef.current = normalized;
      setIsSaving(true);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        commitNotes(normalized);
      }, 280);
    },
    [commitNotes]
  );

  const syncFromEditorDom = useCallback(
    (immediate = false) => {
      const editor = editorRef.current;
      if (!editor) return;
      const raw = editor.innerHTML;
      if (immediate) {
        const clean = sanitizeRichNotesHtml(raw);
        const normalized = isRichNotesEmpty(clean) ? '' : clean;
        setHtml(normalized);
        commitNotes(normalized);
      } else {
        scheduleNotesSave(raw);
      }
      updateToolbarState();
    },
    [commitNotes, scheduleNotesSave, updateToolbarState]
  );

  const ensureEditorSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const execInlineCommand = (cmd: 'bold' | 'italic' | 'underline' | 'strikeThrough') => {
    ensureEditorSelection();
    document.execCommand(cmd, false);
    syncFromEditorDom(false);
  };

  const toggleBlockTag = (targetTag: 'H1' | 'H2' | 'BLOCKQUOTE') => {
    ensureEditorSelection();
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    const existing = sel
      ? findClosestInEditor(sel.anchorNode, editor, el => el.tagName === targetTag)
      : null;
    document.execCommand('formatBlock', false, existing ? '<p>' : `<${targetTag.toLowerCase()}>`);
    syncFromEditorDom(false);
  };

  const execListCommand = (cmd: 'insertUnorderedList' | 'insertOrderedList') => {
    ensureEditorSelection();
    document.execCommand(cmd, false);
    syncFromEditorDom(false);
  };

  const execAlignCommand = (align: 'Left' | 'Center' | 'Right') => {
    ensureEditorSelection();
    document.execCommand(`justify${align}`, false);
    syncFromEditorDom(false);
  };

  const toggleChecklist = () => {
    ensureEditorSelection();
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const existingItem = findClosestInEditor(
      sel.anchorNode,
      editor,
      el => el.tagName === 'LI' && el.classList.contains('notes-check-item')
    );

    if (existingItem) {
      // Unwrap checklist item into a normal paragraph
      const p = document.createElement('p');
      const span = existingItem.querySelector('span');
      const text = span ? span.textContent || '' : existingItem.textContent || '';
      p.textContent = text;
      if (!p.textContent) p.innerHTML = '<br>';
      const list = existingItem.parentElement;
      if (list && list.parentNode) {
        if (list.children.length === 1) {
          list.parentNode.replaceChild(p, list);
        } else {
          list.parentNode.insertBefore(p, list.nextSibling);
          existingItem.remove();
        }
      }
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      syncFromEditorDom(false);
      return;
    }

    // Grab text from current block if non-empty
    const currentBlock = findClosestInEditor(sel.anchorNode, editor, el =>
      ['P', 'DIV', 'H1', 'H2', 'BLOCKQUOTE', 'LI'].includes(el.tagName)
    );
    const seedText =
      currentBlock && currentBlock !== editor ? (currentBlock.textContent || '').trim() : '';

    const ul = document.createElement('ul');
    ul.className = 'notes-checklist';

    const li = document.createElement('li');
    li.className = 'notes-check-item';
    li.setAttribute('data-checked', 'false');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'notes-checkbox';

    const textSpan = document.createElement('span');
    if (seedText) {
      textSpan.textContent = seedText;
    } else {
      textSpan.innerHTML = '<br>';
    }

    li.appendChild(cb);
    li.appendChild(textSpan);
    ul.appendChild(li);

    if (currentBlock && currentBlock.parentNode === editor) {
      editor.replaceChild(ul, currentBlock);
    } else {
      editor.appendChild(ul);
    }

    const range = document.createRange();
    range.selectNodeContents(textSpan);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    syncFromEditorDom(false);
  };

  const handleClearFormatting = () => {
    ensureEditorSelection();
    document.execCommand('removeFormat', false);
    document.execCommand('formatBlock', false, '<p>');
    document.execCommand('justifyLeft', false);
    syncFromEditorDom(false);
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      const cb = target as HTMLInputElement;
      if (cb.checked) {
        cb.setAttribute('checked', 'checked');
      } else {
        cb.removeAttribute('checked');
      }
      const li = cb.closest('li.notes-check-item');
      if (li) {
        li.classList.toggle('is-checked', cb.checked);
        li.setAttribute('data-checked', cb.checked ? 'true' : 'false');
      }
      syncFromEditorDom(true);
      return;
    }
    updateToolbarState();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        execInlineCommand('bold');
        return;
      }
      if (k === 'i') {
        e.preventDefault();
        execInlineCommand('italic');
        return;
      }
      if (k === 'u') {
        e.preventDefault();
        execInlineCommand('underline');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const editor = editorRef.current;
      const sel = window.getSelection();
      if (editor && sel && sel.rangeCount > 0) {
        const headingEl = findClosestInEditor(
          sel.anchorNode,
          editor,
          el => el.tagName === 'H1' || el.tagName === 'H2'
        );
        if (headingEl) {
          e.preventDefault();
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          if (headingEl.parentNode) {
            headingEl.parentNode.insertBefore(p, headingEl.nextSibling);
          }
          const range = document.createRange();
          range.selectNodeContents(p);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          syncFromEditorDom(false);
          return;
        }

        const item = findClosestInEditor(
          sel.anchorNode,
          editor,
          el => el.tagName === 'LI' && el.classList.contains('notes-check-item')
        );
        if (item) {
          e.preventDefault();
          const span = item.querySelector('span');
          const content = (span ? span.textContent : item.textContent) || '';
          const list = item.parentElement;

          if (!content.trim() && list && list.parentNode) {
            // Exit checklist on empty item Enter
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            list.parentNode.insertBefore(p, list.nextSibling);
            item.remove();
            if (list.children.length === 0) list.remove();

            const range = document.createRange();
            range.selectNodeContents(p);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            syncFromEditorDom(false);
            return;
          }

          const nextLi = document.createElement('li');
          nextLi.className = 'notes-check-item';
          nextLi.setAttribute('data-checked', 'false');

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'notes-checkbox';

          const nextSpan = document.createElement('span');
          nextSpan.innerHTML = '<br>';

          nextLi.appendChild(cb);
          nextLi.appendChild(nextSpan);

          if (item.parentNode) {
            item.parentNode.insertBefore(nextLi, item.nextSibling);
          }

          const range = document.createRange();
          range.selectNodeContents(nextSpan);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          syncFromEditorDom(false);
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const htmlData = e.clipboardData.getData('text/html');
    const plainData = e.clipboardData.getData('text/plain');
    if (htmlData) {
      e.preventDefault();
      const safe = sanitizeRichNotesHtml(htmlData);
      document.execCommand('insertHTML', false, safe || plainData);
      syncFromEditorDom(false);
    } else if (plainData) {
      e.preventDefault();
      document.execCommand('insertText', false, plainData);
      syncFromEditorDom(false);
    }
  };

  const performClearAll = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    pendingValueRef.current = null;
    lastCommittedRef.current = '';
    setHtml('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    Store.saveNotes('', Date.now());
    setIsSaving(false);
    sync.touch();
    if (onUpdateNotesRef.current) onUpdateNotesRef.current('');
  }, []);

  const handleClearAll = () => {
    if (!empty && onConfirm) {
      onConfirm(
        t('confirmClearNotesTitle', language),
        t('confirmClearNotesDesc', language),
        t('clearNotes', language),
        performClearAll,
        true
      );
      return;
    }
    performClearAll();
  };

  if (!open) return null;

  return (
    <div
      className="pop notes-pop"
      role="dialog"
      aria-label={t('notepadTitle', language)}
    >
      {/* Mobile grab handle accent matching reference screenshot */}
      <div className="notes-grab-bar" aria-hidden="true" />

      {/* Clean Header */}
      <div className="notes-head">
        <h2>{t('notepadTitle', language)}</h2>
        <button
          type="button"
          className="x-btn"
          aria-label="Close notepad"
          onClick={handleClose}
        >
          <Icon name="x" />
        </button>
      </div>

      {/* Meta Row: Word & Character Counter + Trash Button */}
      <div className="notes-meta-bar">
        <div className="notes-counts" data-testid="notesWordCount">
          <span>
            {stats.words} {t('wordsLabel', language)} · {stats.characters}{' '}
            {t('charactersLabel', language)}
          </span>
          {isSaving && (
            <span className="notes-saving-pill">{t('notesSaving', language)}</span>
          )}
        </div>
        <button
          type="button"
          className="notes-trash-btn"
          aria-label={t('clearNotes', language)}
          title={t('clearNotes', language)}
          disabled={empty}
          onClick={handleClearAll}
        >
          <Icon name="trash" />
        </button>
      </div>

      {/* Formatting Toolbar */}
      <div className="notes-toolbar" role="toolbar" aria-label="Text formatting">
        <button
          type="button"
          className={`ntb-btn ${formatState.bold ? 'on' : ''}`}
          aria-label="Bold"
          aria-pressed={formatState.bold}
          title="Bold (Ctrl+B)"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execInlineCommand('bold')}
        >
          <span className="ntb-glyph bold">B</span>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.italic ? 'on' : ''}`}
          aria-label="Italic"
          aria-pressed={formatState.italic}
          title="Italic (Ctrl+I)"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execInlineCommand('italic')}
        >
          <span className="ntb-glyph italic">I</span>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.underline ? 'on' : ''}`}
          aria-label="Underline"
          aria-pressed={formatState.underline}
          title="Underline (Ctrl+U)"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execInlineCommand('underline')}
        >
          <span className="ntb-glyph underline">U</span>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.strike ? 'on' : ''}`}
          aria-label="Strikethrough"
          aria-pressed={formatState.strike}
          title="Strikethrough"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execInlineCommand('strikeThrough')}
        >
          <span className="ntb-glyph strike">S</span>
        </button>

        <span className="ntb-sep" aria-hidden="true" />

        <button
          type="button"
          className={`ntb-btn ${formatState.h1 ? 'on' : ''}`}
          aria-label="Heading 1"
          aria-pressed={formatState.h1}
          title="Heading 1"
          onMouseDown={e => e.preventDefault()}
          onClick={() => toggleBlockTag('H1')}
        >
          <span className="ntb-heading">
            H<sub>1</sub>
          </span>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.h2 ? 'on' : ''}`}
          aria-label="Heading 2"
          aria-pressed={formatState.h2}
          title="Heading 2"
          onMouseDown={e => e.preventDefault()}
          onClick={() => toggleBlockTag('H2')}
        >
          <span className="ntb-heading">
            H<sub>2</sub>
          </span>
        </button>

        <span className="ntb-sep" aria-hidden="true" />

        <button
          type="button"
          className={`ntb-btn ${formatState.quote ? 'on' : ''}`}
          aria-label="Blockquote"
          aria-pressed={formatState.quote}
          title="Blockquote"
          onMouseDown={e => e.preventDefault()}
          onClick={() => toggleBlockTag('BLOCKQUOTE')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <path
              fill="currentColor"
              d="M7.5 14.5c0-2.5 1.3-4.6 3.5-5.8l1 1.6c-1.4.9-2.1 2-2.2 3.2.9.2 1.7 1 1.7 2.1 0 1.3-1 2.4-2.3 2.4-1.4 0-2.7-1.2-2.7-3.5Zm7.2 0c0-2.5 1.3-4.6 3.5-5.8l1 1.6c-1.4.9-2.1 2-2.2 3.2.9.2 1.7 1 1.7 2.1 0 1.3-1 2.4-2.3 2.4-1.4 0-2.7-1.2-2.7-3.5Z"
            />
          </svg>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.ul ? 'on' : ''}`}
          aria-label="Bullet list"
          aria-pressed={formatState.ul}
          title="Bullet list"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execListCommand('insertUnorderedList')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <circle cx="5" cy="7" r="1.4" fill="currentColor" />
            <circle cx="5" cy="12" r="1.4" fill="currentColor" />
            <circle cx="5" cy="17" r="1.4" fill="currentColor" />
            <path d="M9.5 7h10M9.5 12h10M9.5 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.ol ? 'on' : ''}`}
          aria-label="Numbered list"
          aria-pressed={formatState.ol}
          title="Numbered list"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execListCommand('insertOrderedList')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <path
              d="M4.2 6.2h1.3V9M4 11.7c.4-.5 1.4-.5 1.7 0 .3.6-.3 1.1-1.7 2.1h1.9M4 16.3h1.6l-.8 1c.6.1 1 .5.9 1.1-.1.5-.6.9-1.3.9-.3 0-.6-.1-.8-.3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M10 7h9.5M10 12h9.5M10 17h9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.checklist ? 'on' : ''}`}
          aria-label="Checklist"
          aria-pressed={formatState.checklist}
          title="Checklist"
          onMouseDown={e => e.preventDefault()}
          onClick={toggleChecklist}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <rect x="3.5" y="4.5" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m5 7.5 1 1 2-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3.5" y="13.5" width="6" height="6" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12.5 7.5h8M12.5 16.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <span className="ntb-sep" aria-hidden="true" />

        <button
          type="button"
          className={`ntb-btn ${formatState.alignLeft ? 'on' : ''}`}
          aria-label="Align left"
          aria-pressed={formatState.alignLeft}
          title="Align left"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execAlignCommand('Left')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <path d="M4 6h16M4 10h11M4 14h16M4 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.alignCenter ? 'on' : ''}`}
          aria-label="Align center"
          aria-pressed={formatState.alignCenter}
          title="Align center"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execAlignCommand('Center')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <path d="M4 6h16M7 10h10M4 14h16M7 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className={`ntb-btn ${formatState.alignRight ? 'on' : ''}`}
          aria-label="Align right"
          aria-pressed={formatState.alignRight}
          title="Align right"
          onMouseDown={e => e.preventDefault()}
          onClick={() => execAlignCommand('Right')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="ntb-svg">
            <path d="M4 6h16M9 10h11M4 14h16M9 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className="ntb-btn"
          aria-label="Clear formatting"
          title="Clear formatting"
          onMouseDown={e => e.preventDefault()}
          onClick={handleClearFormatting}
        >
          <span className="ntb-clearfmt">
            T<sub>x</sub>
          </span>
        </button>
      </div>

      {/* Rich-Text Editable Body */}
      <div className="notes-editor-wrap">
        {empty && (
          <div className="notes-placeholder" aria-hidden="true">
            {t('notepadPlaceholder', language)}
          </div>
        )}
        <div
          ref={editorRef}
          id="notesEditor"
          className="notes-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={t('notepadTitle', language)}
          onFocus={() => {
            isFocusedRef.current = true;
            updateToolbarState();
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            flushPendingSave();
          }}
          onInput={() => syncFromEditorDom(false)}
          onClick={handleEditorClick}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={updateToolbarState}
          onMouseUp={updateToolbarState}
          onPaste={handlePaste}
        />
      </div>
    </div>
  );
};
