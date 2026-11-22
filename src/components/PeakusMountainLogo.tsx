import React from 'react';
import { APP_LOGO_SRC } from '../lib/branding';

interface PeakusMountainLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const PeakusMountainLogo: React.FC<PeakusMountainLogoProps> = ({
  size = 40,
  className = '',
  style = {},
}) => {
  return (
    <img
      src={APP_LOGO_SRC}
      width={size}
      height={size}
      alt="Peakus App Icon"
      draggable={false}
      className={`peakus-mountain-logo ${className}`.trim()}
      style={{
        borderRadius: '12px',
        display: 'block',
        flexShrink: 0,
        objectFit: 'cover',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45), 0 0 16px rgba(99, 102, 241, 0.22)',
        ...style,
      }}
    />
  );
};
