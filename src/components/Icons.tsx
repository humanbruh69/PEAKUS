import React from 'react';
import { ICON_PATHS } from '../lib/constants';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', ...rest }) => {
  const path = ICON_PATHS[name];
  if (!path) return null;

  return (
    <svg
      className={`i ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
      {...rest}
    />
  );
};

export const FlameIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <defs>
      <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#ff3d00" />
        <stop offset=".6" stopColor="#ff8a00" />
        <stop offset="1" stopColor="#ffc400" />
      </linearGradient>
    </defs>
    <path
      fill="url(#fl)"
      d="M12 22c4 0 7-2.7 7-6.6 0-4-2.8-6.2-4-9.7-.3 2-1.3 3.4-2.7 3.9.2-3.2-1.1-6-4-8.6.4 3.6-1.6 5.8-3.1 8A8.2 8.2 0 0 0 5 15.4C5 19.3 8 22 12 22Z"
    />
    <path
      fill="#ffe08a"
      d="M12 21c1.9 0 3.3-1.3 3.3-3.1 0-1.9-1.4-2.9-2-4.6-.5 1.3-1.5 2-2.5 2.2-.8.5-2.1 1.3-2.1 2.6 0 1.7 1.4 2.9 3.3 2.9Z"
    />
  </svg>
);
