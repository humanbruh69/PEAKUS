import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icons';
import type { LanguageCode } from '../types';
import { t } from '../lib/i18n';
import {
  evaluateExpression,
  toggleSignInExpression,
  type AngleMode,
  type CalcHistoryEntry,
} from '../lib/calculatorEngine';

interface CalculatorPopoverProps {
  open: boolean;
  onClose: () => void;
  language?: LanguageCode;
  onAppendToNotes?: (text: string) => void;
  onToast?: (msg: string, type?: '' | 'err') => void;
}

const HISTORY_STORAGE_KEY = 'peakus.calc.history.v1';

export const CalculatorPopover: React.FC<CalculatorPopoverProps> = ({
  open,
  onClose,
  language = 'en',
  onAppendToNotes,
  onToast,
}) => {
  const [expr, setExpr] = useState<string>('');
  const [display, setDisplay] = useState<string>('0');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ans, setAns] = useState<number>(0);
  const [scientific, setScientific] = useState<boolean>(false);
  const [angleMode, setAngleMode] = useState<AngleMode>('DEG');
  const [justEvaluated, setJustEvaluated] = useState<boolean>(false);
  const [history, setHistory] = useState<CalcHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 8);
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  const appendToken = useCallback(
    (token: string, isOperator = false) => {
      setErrorMsg(null);
      setExpr(prev => {
        const base =
          justEvaluated && !isOperator && prev !== ''
            ? ''
            : justEvaluated && isOperator
            ? display === 'Error'
              ? ''
              : display
            : prev;
        const next = base + token;
        setDisplay(next || '0');
        return next;
      });
      setJustEvaluated(false);
    },
    [justEvaluated, display]
  );

  const handleClear = useCallback(() => {
    setExpr('');
    setDisplay('0');
    setErrorMsg(null);
    setJustEvaluated(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setErrorMsg(null);
    if (justEvaluated) {
      setExpr('');
      setDisplay('0');
      setJustEvaluated(false);
      return;
    }
    setExpr(prev => {
      const next = prev.slice(0, -1);
      setDisplay(next || '0');
      return next;
    });
  }, [justEvaluated]);

  const handleToggleSign = useCallback(() => {
    setErrorMsg(null);
    const source = expr || (display !== '0' && display !== 'Error' ? display : '0');
    const toggled = toggleSignInExpression(source);
    setExpr(toggled);
    setDisplay(toggled);
    setJustEvaluated(false);
  }, [expr, display]);

  const handleEvaluate = useCallback(() => {
    const raw = expr.trim();
    if (!raw) return;
    const res = evaluateExpression(raw, angleMode, ans);
    if (!res.ok) {
      setErrorMsg(res.error || 'Error');
      setDisplay('Error');
      setJustEvaluated(true);
      return;
    }
    setErrorMsg(null);
    setDisplay(res.formatted);
    if (typeof res.value === 'number') setAns(res.value);
    setJustEvaluated(true);
    setHistory(prev =>
      [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          expression: raw,
          result: res.formatted,
          timestamp: Date.now(),
        },
        ...prev,
      ].slice(0, 8)
    );
  }, [expr, angleMode, ans]);

  // Live preview evaluation when expression is balanced & valid
  const livePreview = React.useMemo(() => {
    if (justEvaluated || !expr.trim()) return null;
    if (!/[+\-*/^%()√a-zA-Z]/.test(expr)) return null;
    const res = evaluateExpression(expr, angleMode, ans);
    return res.ok ? res.formatted : null;
  }, [expr, angleMode, ans, justEvaluated]);

  // Keyboard support while Calculator popover is open
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEvaluate();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        handleClear();
        return;
      }
      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        appendToken(e.key, false);
        return;
      }
      if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        appendToken(e.key, true);
        return;
      }
      if (e.key === '*') {
        e.preventDefault();
        appendToken('×', true);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        appendToken('÷', true);
        return;
      }
      if (e.key === '%' || e.key === '^') {
        e.preventDefault();
        appendToken(e.key, true);
        return;
      }
      if (e.key === '(' || e.key === ')') {
        e.preventDefault();
        appendToken(e.key, false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose, handleEvaluate, handleBackspace, handleClear, appendToken]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      onToast?.(`Copied ${display}`);
    } catch {
      onToast?.('Could not copy value', 'err');
    }
  };

  const handleSaveToNotes = () => {
    if (!onAppendToNotes) return;
    const line = expr.trim() && display !== 'Error' ? `${expr} = ${display}` : display;
    onAppendToNotes(line);
    onToast?.('Added calculation to Quick Notes');
  };

  return (
    <div
      className="pop calc-pop"
      id="calculatorPopover"
      role="dialog"
      aria-label={t('calculator', language)}
    >
      <div className="pop-head">
        <span className="badge-ic" aria-hidden="true">
          <Icon name="calculator" />
        </span>
        <h2>{t('calculator', language)}</h2>

        <div className="calc-mode-seg" role="group" aria-label="Calculator mode">
          <button
            type="button"
            className={!scientific ? 'on' : ''}
            onClick={() => setScientific(false)}
          >
            Std
          </button>
          <button
            type="button"
            className={scientific ? 'on' : ''}
            onClick={() => setScientific(true)}
          >
            Sci
          </button>
        </div>

        <button
          type="button"
          className="x-btn"
          aria-label="Close calculator"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="pop-body calc-body">
        {/* Frosted Display Screen */}
        <div className="calc-screen">
          <div className="calc-screen-top">
            <span className="calc-expr" title={expr || '0'}>
              {expr || '\u00A0'}
            </span>
            <div className="calc-screen-actions">
              {scientific && (
                <button
                  type="button"
                  className="calc-mini-btn"
                  onClick={() => setAngleMode(prev => (prev === 'DEG' ? 'RAD' : 'DEG'))}
                  title="Toggle Degrees / Radians"
                >
                  {angleMode}
                </button>
              )}
              <button
                type="button"
                className="calc-mini-btn"
                onClick={handleCopy}
                title="Copy result"
                aria-label="Copy calculation result"
              >
                <Icon name="copy" />
              </button>
              {onAppendToNotes && (
                <button
                  type="button"
                  className="calc-mini-btn"
                  onClick={handleSaveToNotes}
                  title="Send to Quick Notes"
                  aria-label="Send calculation to Quick Notes"
                >
                  <Icon name="pencil" />
                </button>
              )}
            </div>
          </div>

          <div
            className={`calc-display${errorMsg ? ' is-error' : ''}`}
            data-testid="calcDisplay"
            aria-live="polite"
          >
            {display}
          </div>

          <div className="calc-subline">
            {errorMsg ? (
              <span className="calc-err-text">{errorMsg}</span>
            ) : livePreview !== null ? (
              <span className="calc-preview">= {livePreview}</span>
            ) : (
              <span className="calc-ans">ANS {ans}</span>
            )}
          </div>
        </div>

        {/* Recent History Strip */}
        {history.length > 0 && (
          <div className="calc-history" aria-label="Calculation history">
            {history.slice(0, 5).map(item => (
              <button
                key={item.id}
                type="button"
                className="calc-hist-item"
                onClick={() => {
                  setExpr(item.result);
                  setDisplay(item.result);
                  setErrorMsg(null);
                  setJustEvaluated(false);
                }}
                title={`${item.expression} = ${item.result}`}
              >
                <span className="calc-hist-expr">{item.expression}</span>
                <span className="calc-hist-res">= {item.result}</span>
              </button>
            ))}
          </div>
        )}

        {/* Scientific Strip (Expandable) */}
        {scientific && (
          <div className="calc-sci-grid">
            <button type="button" className="calc-key fn" onClick={() => appendToken('sin(', false)}>
              sin
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('cos(', false)}>
              cos
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('tan(', false)}>
              tan
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('√(', false)}>
              √x
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('^2', true)}>
              x²
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('^', true)}>
              xʸ
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('ln(', false)}>
              ln
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('log(', false)}>
              log
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('(', false)}>
              (
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken(')', false)}>
              )
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('π', false)}>
              π
            </button>
            <button type="button" className="calc-key fn" onClick={() => appendToken('e', false)}>
              e
            </button>
          </div>
        )}

        {/* Primary Keypad */}
        <div className="calc-grid">
          <button type="button" className="calc-key util" onClick={handleClear}>
            AC
          </button>
          <button type="button" className="calc-key util" onClick={handleToggleSign}>
            ±
          </button>
          <button type="button" className="calc-key util" onClick={() => appendToken('%', true)}>
            %
          </button>
          <button type="button" className="calc-key op" onClick={() => appendToken('÷', true)}>
            ÷
          </button>

          <button type="button" className="calc-key" onClick={() => appendToken('7')}>
            7
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('8')}>
            8
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('9')}>
            9
          </button>
          <button type="button" className="calc-key op" onClick={() => appendToken('×', true)}>
            ×
          </button>

          <button type="button" className="calc-key" onClick={() => appendToken('4')}>
            4
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('5')}>
            5
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('6')}>
            6
          </button>
          <button type="button" className="calc-key op" onClick={() => appendToken('−', true)}>
            −
          </button>

          <button type="button" className="calc-key" onClick={() => appendToken('1')}>
            1
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('2')}>
            2
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('3')}>
            3
          </button>
          <button type="button" className="calc-key op" onClick={() => appendToken('+', true)}>
            +
          </button>

          <button type="button" className="calc-key" onClick={() => appendToken('0')}>
            0
          </button>
          <button type="button" className="calc-key" onClick={() => appendToken('.')}>
            .
          </button>
          <button
            type="button"
            className="calc-key util"
            onClick={handleBackspace}
            aria-label="Backspace"
          >
            ⌫
          </button>
          <button
            type="button"
            className="calc-key eq"
            onClick={handleEvaluate}
            aria-label="Equals"
          >
            =
          </button>
        </div>
      </div>
    </div>
  );
};
