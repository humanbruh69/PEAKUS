import React from 'react';

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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`peakus-mountain-logo ${className}`}
      style={{
        borderRadius: '12px',
        display: 'block',
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 16px rgba(99, 102, 241, 0.25)',
        ...style,
      }}
      aria-label="Peakus Mountain Logo"
    >
      <defs>
        <linearGradient id="pSkyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#141128" />
          <stop offset="100%" stopColor="#0a0815" />
        </linearGradient>
        <linearGradient id="pMainLight" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="45%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="pMainShadow" x1="30%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="60%" stopColor="#3730a3" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="pSubLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="pSubShadow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#082f49" />
        </linearGradient>
        <radialGradient id="pSunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#f97316" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dark Rounded Container */}
      <rect
        width="120"
        height="120"
        rx="26"
        fill="url(#pSkyGrad)"
        stroke="rgba(255, 255, 255, 0.16)"
        strokeWidth="2"
      />

      {/* Ambient Sunrise Glow */}
      <circle cx="70" cy="48" r="28" fill="url(#pSunGlow)" />

      {/* Spark at apex */}
      <circle cx="46" cy="28" r="2.2" fill="#ffffff" opacity="0.9" />

      {/* Secondary Mountain (Right Peak) */}
      <polygon points="76,46 102,96 76,96" fill="url(#pSubShadow)" />
      <polygon points="76,46 54,96 76,96" fill="url(#pSubLight)" opacity="0.92" />

      {/* Main Majestic Peak (Center-Left) */}
      <polygon points="46,28 16,96 46,96" fill="url(#pMainLight)" />
      <polygon points="46,28 46,96 82,96" fill="url(#pMainShadow)" />

      {/* Snowcap Ridge lines */}
      <polyline
        points="46,28 46,62 38,70 46,78"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <polyline
        points="46,28 26,72"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />

      {/* Ground horizon */}
      <line
        x1="12"
        y1="96"
        x2="108"
        y2="96"
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
