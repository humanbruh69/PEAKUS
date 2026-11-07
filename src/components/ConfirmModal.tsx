import React, { useEffect } from 'react';

export interface ConfirmState {
  open: boolean;
  title: string;
  text: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ConfirmModalProps {
  state: ConfirmState | null;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ state }) => {
  useEffect(() => {
    if (!state || !state.open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state.onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state]);

  if (!state || !state.open) return null;

  return (
    <>
      <div className="scrim" onClick={state.onCancel} />
      <dialog
        className="confirm"
        open
        aria-labelledby="cfTitle"
        aria-describedby="cfText"
        style={{ zIndex: 100 }}
      >
        <h2 id="cfTitle">{state.title}</h2>
        <p id="cfText">{state.text}</p>
        <div className="acts">
          <button className="btn" onClick={state.onCancel}>
            {state.cancelText || 'Cancelar'}
          </button>
          <button
            className={`btn ${state.danger ? 'danger' : 'primary'}`}
            onClick={() => {
              state.onConfirm();
            }}
          >
            {state.okText || 'Aceptar'}
          </button>
        </div>
      </dialog>
    </>
  );
};
