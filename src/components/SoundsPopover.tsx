import React, { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { audioX } from '../lib/audio';
import type { Settings } from '../types';
import { t } from '../lib/i18n';

interface SoundsPopoverProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (s: Settings, path?: string) => void;
}

export const SoundsPopover: React.FC<SoundsPopoverProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [, setTick] = useState(0);
  const lang = settings.language || 'en';

  useEffect(() => {
    return audioX.subscribe(() => {
      setTick(tCount => tCount + 1);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const ambients = audioX.getAmbients() as Record<string, { name: string; desc: string }>;
  const playingList = audioX.playing();
  const master = settings.sounds.master;

  const soundKeyMap: Record<string, [string, string]> = {
    lluvia: ['rain', 'rainDesc'],
    tormenta: ['storm', 'stormDesc'],
    olas: ['waves', 'wavesDesc'],
    viento: ['wind', 'windDesc'],
    fogata: ['campfire', 'campfireDesc'],
    marron: ['brownNoise', 'brownNoiseDesc'],
    rosa: ['pinkNoise', 'pinkNoiseDesc'],
    blanco: ['whiteNoise', 'whiteNoiseDesc'],
  };

  const toggleSound = (id: string) => {
    audioX.toggle(id);
    const active = audioX.isPlaying(id);
    const nextActive = (settings.sounds.active || []).filter(x => x !== id);
    if (active) nextActive.push(id);
    const nextSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        active: nextActive,
      },
    };
    onUpdateSettings(nextSettings, 'sounds.active');
  };

  const handleLevelChange = (id: string, val: number) => {
    audioX.setLevel(id, val);
    const nextLevels = { ...settings.sounds.levels, [id]: val };
    const nextSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        levels: nextLevels,
      },
    };
    onUpdateSettings(nextSettings, 'sounds.levels');
  };

  const handleMasterChange = (val: number) => {
    const nextSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        master: val,
      },
    };
    onUpdateSettings(nextSettings, 'sounds.master');
  };

  const stopAll = () => {
    audioX.stopAll();
    const nextSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        active: [],
      },
    };
    onUpdateSettings(nextSettings, 'sounds.active');
  };

  return (
    <div className="pop" role="dialog" aria-label={t('soundsTitle', lang)}>
      <div className="pop-head">
        <span className="badge-ic" aria-hidden="true">
          <Icon name="music" />
        </span>
        <h2>{t('soundsTitle', lang)}</h2>
        {playingList.length > 0 && (
          <button
            className="mini"
            title={t('stopAll', lang)}
            aria-label={t('stopAll', lang)}
            onClick={stopAll}
          >
            <Icon name="stop" />
          </button>
        )}
        <button
          className="x-btn"
          aria-label={t('soundsTitle', lang)}
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>

      <div className="pop-body">
        <div className="snd-list">
          {Object.entries(ambients).map(([id, item]) => {
            const isPlaying = audioX.isPlaying(id);
            const level = settings.sounds.levels[id] ?? 50;
            const keys = soundKeyMap[id];
            const name = keys ? t(keys[0] as any, lang) : item.name;
            const desc = keys ? t(keys[1] as any, lang) : item.desc;

            return (
              <div key={id} className={`snd ${isPlaying ? 'on' : ''}`}>
                <button
                  className="snd-toggle"
                  aria-pressed={isPlaying}
                  aria-label={`${isPlaying ? t('pause', lang) : t('start', lang)} ${name}`}
                  onClick={() => toggleSound(id)}
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} />
                </button>
                <div className="snd-name">
                  {name}
                  <small>{desc}</small>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={level}
                  aria-label={`${name} volume`}
                  style={{ '--p': `${level}%` } as React.CSSProperties}
                  onChange={e => handleLevelChange(id, Number(e.target.value))}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="pop-foot">
        <div className="master-row">
          <Icon name="volume" />
          <span className="snd-name grow">{t('masterVolume', lang)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={master}
            aria-label={t('masterVolume', lang)}
            style={{ '--p': `${master}%` } as React.CSSProperties}
            onChange={e => handleMasterChange(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};
