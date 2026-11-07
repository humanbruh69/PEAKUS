import React from 'react';

export interface ToastItem {
  id: string;
  msg: string;
  type?: 'err' | '';
  action?: {
    label: string;
    fn: () => void;
  };
}

interface ToastListProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export const ToastList: React.FC<ToastListProps> = ({ toasts, onRemove }) => {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast ${t.type === 'err' ? 'err' : ''}`.trim()}
          role={t.type === 'err' ? 'alert' : 'status'}
        >
          <span>{t.msg}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.fn();
                onRemove(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
