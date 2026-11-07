import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { t } from '../lib/i18n';
import type { LanguageCode } from '../lib/i18n';
import { APP_LOGO_SRC } from '../lib/branding';

interface ProPrankModalProps {
  language: LanguageCode;
  onClose: () => void;
}

export const PRO_PRANK_KEY = 'peakus.pro_prank_seen';

export const ProPrankModal: React.FC<ProPrankModalProps> = ({
  language,
  onClose,
}) => {
  // Step 1: "Hey 👋, upgrade to the pro version to continue"
  // Step 2: "Focus should be free, just kidding 😂 this is free for life time"
  const [step, setStep] = useState<1 | 2>(1);
  const [animating, setAnimating] = useState(false);

  const handleAction = () => {
    setAnimating(true);
    setTimeout(() => {
      setStep(2);
      setAnimating(false);
    }, 200);
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(PRO_PRANK_KEY, 'true');
    } catch {}
    onClose();
  };

  return (
    <>
      {/* Dark backdrop scrim */}
      <div
        className="scrim"
        style={{
          zIndex: 9998,
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(5, 5, 10, 0.75)',
          animation: 'fadeIn 0.25s ease-out',
        }}
      />

      {/* Center Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Peakus"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: '92%',
          maxWidth: '520px',
          background: 'linear-gradient(145deg, #181824 0%, #101018 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(124, 58, 237, 0.25)',
          borderRadius: '24px',
          padding: '32px 28px',
          color: '#f4f4f7',
          textAlign: 'center',
          boxSizing: 'border-box',
          opacity: animating ? 0.4 : 1,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {step === 1 ? (
          <div>
            {/* Peakus App Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <img
                src={APP_LOGO_SRC}
                alt="Peakus Logo"
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  objectFit: 'cover',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(124, 58, 237, 0.3)',
                }}
              />
            </div>

            {/* Crown / Sparkle Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.2), rgba(249, 115, 22, 0.2))',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                color: '#facc15',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: '18px',
              }}
            >
              <span>👑</span>
              <span>PEAKUS PRO MEMBERSHIP</span>
            </div>

            {/* Main Prompt */}
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 800,
                lineHeight: 1.3,
                margin: '0 0 12px',
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              {t('proPrankHeading', language)}
            </h2>

            <p
              style={{
                fontSize: '14.5px',
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.72)',
                margin: '0 0 24px',
              }}
            >
              {t('proPrankSub', language)}
            </p>

            {/* Feature Perks Box */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '26px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{ color: '#34d399' }}>✓</span>
                <span>Unlimited 4K scenic YouTube video backgrounds & loops</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{ color: '#34d399' }}>✓</span>
                <span>Curated YouTube Lo-Fi & Tamil chill melody streams</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span style={{ color: '#34d399' }}>✓</span>
                <span>Focus analytics graph, streaks & local history</span>
              </div>
            </div>

            {/* Buttons: Continue / Cancel */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={handleAction}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
              >
                {t('proPrankCancel', language)}
              </button>

              <button
                type="button"
                onClick={handleAction}
                style={{
                  flex: 1.3,
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.45)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(124, 58, 237, 0.45)';
                }}
              >
                {t('proPrankContinue', language)}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Joke punchline icon celebration */}
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '32px',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                animation: 'bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              😂
            </div>

            {/* Punchline Heading */}
            <h2
              style={{
                fontSize: '23px',
                fontWeight: 800,
                lineHeight: 1.35,
                margin: '0 0 14px',
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              {t('proPrankPunchline', language)}
            </h2>

            <p
              style={{
                fontSize: '14.5px',
                lineHeight: 1.6,
                color: 'rgba(255, 255, 255, 0.78)',
                margin: '0 0 26px',
              }}
            >
              {t('proPrankSubPunchline', language)}
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(52, 211, 153, 0.12)',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                color: '#34d399',
                fontSize: '13px',
                fontWeight: 650,
                marginBottom: '28px',
              }}
            >
              <span>🎉</span>
              <span>All Pro Features Unlocked Forever (Lifetime Free)</span>
            </div>

            <div>
              <button
                type="button"
                onClick={handleFinish}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.45)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.45)';
                }}
              >
                {t('proPrankCta', language)}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
