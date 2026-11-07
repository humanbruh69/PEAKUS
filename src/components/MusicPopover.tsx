import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import type { Settings } from '../types';
import { t } from '../lib/i18n';
import {
  YOUTUBE_MUSIC_PRESETS,
  extractYouTubeId,
  buildYouTubeWatchUrl,
  type YouTubePreset,
} from '../lib/youtube';
import { saveLink, type SavedLinkItem } from '../lib/savedLinks';
import { SavedLinksList } from './SavedLinksList';

interface MusicPopoverProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (s: Settings, path?: string) => void;
  onToast: (msg: string, type?: '' | 'err') => void;
}

export const MusicPopover: React.FC<MusicPopoverProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onToast,
}) => {
  const lang = settings.language || 'en';
  const music = settings.music;
  const [customUrl, setCustomUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleTogglePlay = () => {
    const nextPlaying = !music.playing;
    const next = {
      ...settings,
      music: {
        ...music,
        playing: nextPlaying,
      },
    };
    onUpdateSettings(next, 'music.playing');
  };

  const handleSelectPreset = (preset: YouTubePreset) => {
    const next = {
      ...settings,
      music: {
        ...music,
        youtubeId: preset.id,
        title: preset.title,
        streamUrl: preset.url,
        playing: true,
      },
    };
    onUpdateSettings(next, 'music');
    onToast(`${t('nowStreaming', lang)}: ${preset.title}`);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYouTubeId(customUrl);
    if (!id) {
      onToast(t('invalidYtUrl', lang), 'err');
      return;
    }
    // Auto-save pasted YouTube link in browser storage
    saveLink(customUrl, 'Custom YouTube Stream', 'music');

    const next = {
      ...settings,
      music: {
        ...music,
        youtubeId: id,
        title: 'Custom YouTube Stream',
        streamUrl: buildYouTubeWatchUrl(id),
        playing: true,
      },
    };
    onUpdateSettings(next, 'music');
    setCustomUrl('');
    onToast(t('streamPlaying', lang));
  };

  const handleSelectSavedLink = (item: SavedLinkItem) => {
    const id = item.youtubeId || extractYouTubeId(item.url);
    if (!id) return;
    const next = {
      ...settings,
      music: {
        ...music,
        youtubeId: id,
        title: item.title,
        streamUrl: buildYouTubeWatchUrl(id),
        playing: true,
      },
    };
    onUpdateSettings(next, 'music');
    onToast(`${t('nowStreaming', lang)}: ${item.title}`);
  };

  return (
    <div className="pop" role="dialog" aria-label={t('musicTitle', lang)}>
      <div className="pop-head">
        <span className="badge-ic" aria-hidden="true">
          <Icon name="headphones" />
        </span>
        <h2>{t('musicTitle', lang)}</h2>
        <button
          className="x-btn"
          aria-label={t('musicTitle', lang)}
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="pop-body">
        {/* Now Playing Banner */}
        <div
          className="card"
          style={{
            padding: '16px',
            marginBottom: '14px',
            background: music.playing
              ? 'linear-gradient(135deg, var(--accent-soft), rgba(255, 255, 255, 0.03))'
              : 'rgba(255, 255, 255, 0.03)',
            borderColor: music.playing ? 'var(--accent)' : 'var(--line)',
            boxShadow: music.playing ? '0 8px 24px -6px var(--accent-glow)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: music.playing ? '#34d399' : '#a3a3ad',
                    display: 'inline-block',
                    boxShadow: music.playing ? '0 0 8px #34d399' : 'none',
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                  {music.playing ? t('streamPlaying', lang) : t('streamPaused', lang)}
                </span>
              </div>
              <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {music.title || 'Lofi Beats'}
              </h4>
            </div>

            <button
              className="ctl primary"
              style={{ width: '42px', height: '42px', borderRadius: '50%' }}
              onClick={handleTogglePlay}
              aria-label={music.playing ? t('pauseMusic', lang) : t('playMusic', lang)}
            >
              <Icon name={music.playing ? 'pause' : 'play'} />
            </button>
          </div>

          {/* Visualizer animation when playing */}
          {music.playing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '18px', marginTop: '12px' }}>
              {[0.4, 0.8, 0.5, 0.9, 0.6, 1.0, 0.7, 0.3, 0.8, 0.5, 0.9, 0.4].map((h, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: `${h * 100}%`,
                    backgroundColor: 'var(--accent-text)',
                    borderRadius: '2px',
                    opacity: 0.85,
                    animation: `pulse 1s ease-in-out infinite alternate`,
                    animationDelay: `${(i * 0.1).toFixed(1)}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Custom URL Input */}
        <div style={{ marginBottom: '16px' }}>
          <form onSubmit={handleApplyCustomUrl} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder={t('enterYtMusicUrl', lang)}
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              style={{ flex: 1, fontSize: '13px' }}
            />
            <button
              type="submit"
              className="btn primary"
              disabled={!customUrl.trim()}
              style={{ minHeight: '38px', padding: '0 12px', fontSize: '13px' }}
            >
              <Icon name="play" />
            </button>
          </form>

          {/* Saved / Pasted YouTube Links in browser */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)' }}>
                {t('savedLinksTitle', lang)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent)' }}>
                <Icon name="cloud" style={{ width: '12px', height: '12px' }} />
                Synced with Cloud
              </span>
            </div>
            <SavedLinksList
              currentActiveId={music.youtubeId}
              onSelect={handleSelectSavedLink}
              lang={lang}
              filterType="music"
            />
          </div>
        </div>

        {/* Preset Streams */}
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 650, color: 'var(--muted)' }}>
            {t('presetStreams', lang)}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {YOUTUBE_MUSIC_PRESETS.map(preset => {
              const isCurrent = music.youtubeId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '9px',
                    background: isCurrent ? 'var(--accent-soft)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isCurrent ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)'}`,
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ color: isCurrent ? 'var(--accent-text)' : 'var(--muted)' }}>
                      <Icon name="disc" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preset.title}
                      </div>
                      {preset.author && (
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {preset.author}
                        </div>
                      )}
                    </div>
                  </div>
                  {isCurrent && music.playing ? (
                    <span style={{ color: '#34d399', fontSize: '12px', fontWeight: 700 }}>
                      <Icon name="volume" />
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      <Icon name="play" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
