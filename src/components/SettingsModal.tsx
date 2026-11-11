import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import type { Settings, ModeKey, Task, Session, LanguageCode, TimerState } from '../types';
import { SCENES, SOLIDS, CATEGORIES, renderScene } from '../lib/scenes';
import { DEFAULTS } from '../lib/constants';
import { fmtDur, fmtClock, dayKey, startOfDay, addDays, uid, clone } from '../lib/utils';
import { imageDB, type CustomImage } from '../lib/imageDB';
import { audioX } from '../lib/audio';
import { sync } from '../lib/sync';
import { Store } from '../lib/store';
import { t, MULTILINGUAL_QUOTES } from '../lib/i18n';
import {
  YOUTUBE_BG_PRESETS,
  YOUTUBE_MUSIC_PRESETS,
  DIRECT_VIDEO_PRESETS,
  extractYouTubeId,
  isDirectVideoUrl,
  buildYouTubeWatchUrl,
  type YouTubePreset,
} from '../lib/youtube';
import { saveLink, type SavedLinkItem } from '../lib/savedLinks';
import { SavedLinksList } from './SavedLinksList';
import { FocusAnalyticsGraph } from './FocusAnalyticsGraph';
import { type PomodoroPreset, saveCustomPreset, applyPresetToSettings } from '../lib/presets';
import { PeakusMountainLogo } from './PeakusMountainLogo';
import { CloudAccountSection } from './CloudAccountSection';
import { computeStats } from '../lib/statsEngine';
import {
  TALLY_THEMES,
  getTallyTheme,
  resolveTallyEmojis,
  DEFAULT_TALLY_THEME,
  DEFAULT_CUSTOM_EMOJIS,
  type TallyTheme,
} from '../lib/tallyThemes';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (s: Settings, path?: string) => void;
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  sessions: Session[];
  onUpdateSessions: (sessions: Session[]) => void;
  onToast: (msg: string, type?: '' | 'err') => void;
  onConfirm: (
    title: string,
    text: string,
    okLabel: string,
    fn: () => void,
    danger?: boolean
  ) => void;
  presets?: PomodoroPreset[];
  onSavePreset?: (preset: PomodoroPreset) => void;
  onSelectPreset?: (preset: PomodoroPreset) => void;
  timerState?: TimerState;
}

type SectionKey = 'themes' | 'clock' | 'timer' | 'stats' | 'quotes' | 'language' | 'music' | 'cloud' | 'extras';

const thumbsCache = new Map<string, string>();
function getThumbURL(id: string): string {
  if (thumbsCache.has(id)) return thumbsCache.get(id)!;
  const scene = SCENES.find(s => s.id === id);
  if (!scene) return '';
  const cv = renderScene(scene, 400);
  const url = cv.toDataURL('image/jpeg', 0.82);
  thumbsCache.set(id, url);
  return url;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  tasks,
  onUpdateTasks,
  sessions,
  onUpdateSessions,
  onToast,
  onConfirm,
  presets = [],
  onSavePreset,
  onSelectPreset,
  timerState,
}) => {
  const [section, setSection] = useState<SectionKey>('themes');
  const [editMode, setEditMode] = useState<ModeKey>(settings.mode);
  const [themeTab, setThemeTab] = useState<'scenes' | 'video' | 'uploads' | 'atmosphere'>('scenes');
  const [libCat, setLibCat] = useState<string>('all');
  const [seeAll, setSeeAll] = useState<Set<string>>(new Set());
  const [accOpen, setAccOpen] = useState(false);
  const [customUploads, setCustomUploads] = useState<CustomImage[]>([]);

  // 3 Custom Pomodoro Presets
  const [editablePresets, setEditablePresets] = useState<PomodoroPreset[]>(presets);
  useEffect(() => {
    if (presets && presets.length) {
      setEditablePresets(presets);
    }
  }, [presets, open]);

  const handleUpdatePresetField = (id: string, field: keyof PomodoroPreset, val: any) => {
    setEditablePresets(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const handleSavePreset = (preset: PomodoroPreset) => {
    saveCustomPreset(preset);
    if (onSavePreset) onSavePreset(preset);
    onToast(`${preset.name} saved & synced.`);
  };

  const handleApplyPreset = (preset: PomodoroPreset) => {
    saveCustomPreset(preset);
    if (onSavePreset) onSavePreset(preset);
    if (onSelectPreset) {
      onSelectPreset(preset);
    } else {
      const nextSettings = applyPresetToSettings(settings, preset);
      onUpdateSettings(nextSettings, 'timer');
    }
    onToast(`Applied ${preset.name} (${preset.focus}m/${preset.short}m)`);
  };

  // YouTube Background Input
  const [ytBgUrlInput, setYtBgUrlInput] = useState('');

  // Custom Tally Emojis
  const [customEmojiDraft, setCustomEmojiDraft] = useState<string[]>(() =>
    settings.timer.customTallyEmojis && settings.timer.customTallyEmojis.length === 4
      ? settings.timer.customTallyEmojis
      : DEFAULT_CUSTOM_EMOJIS
  );
  useEffect(() => {
    if (settings.timer.customTallyEmojis && settings.timer.customTallyEmojis.length === 4) {
      setCustomEmojiDraft(settings.timer.customTallyEmojis);
    }
  }, [settings.timer.customTallyEmojis]);

  // Stats tab states
  const [statPeriod, setStatPeriod] = useState<string>('week');
  const [heatMetric, setHeatMetric] = useState<'hours' | 'sessions'>('hours');
  const [heatSpan, setHeatSpan] = useState<'6m' | '1y'>('6m');
  const [histLimit, setHistLimit] = useState<number>(20);

  // Sync tab states
  const [syncKeyInput, setSyncKeyInput] = useState('');
  const [genSyncKey, setGenSyncKey] = useState('');
  const [, setSyncTick] = useState(0);

  const lang = settings.language || 'en';

  const NAV_ITEMS: [SectionKey, string, string][] = [
    ['themes', t('tabThemes', lang), 'palette'],
    ['clock', t('tabClock', lang), 'clock'],
    ['timer', t('tabTimer', lang), 'timer'],
    ['stats', t('tabStats', lang), 'chart'],
    ['quotes', t('tabQuotes', lang), 'quote'],
    ['language', t('tabLanguage', lang), 'globe'],
    ['music', t('music', lang), 'headphones'],
    ['cloud', 'Account & Cloud', 'cloud'],
    ['extras', t('tabExtras', lang), 'sparkles'],
  ];

  useEffect(() => {
    if (!open) return;
    setEditMode(settings.mode);
  }, [open, settings.mode]);

  useEffect(() => {
    return sync.subscribe(() => {
      setSyncTick(tCount => tCount + 1);
    });
  }, []);

  useEffect(() => {
    if (accOpen || section === 'themes') {
      imageDB
        .list()
        .then((list: CustomImage[]) => setCustomUploads(list.sort((a, b) => b.createdAt - a.createdAt)))
        .catch(() => {});
    }
  }, [accOpen, section]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const currentModeCfg =
    settings.modes[editMode as keyof typeof settings.modes] ||
    DEFAULTS.modes[editMode as keyof typeof DEFAULTS.modes];

  const updateSettingField = (path: string, val: any) => {
    const keys = path.replace('@', editMode).split('.');
    const nextSettings = clone(settings);
    let o = nextSettings;
    for (let i = 0; i < keys.length - 1; i++) {
      o = (o as any)[keys[i]];
    }
    (o as any)[keys.at(-1)!] = val;
    onUpdateSettings(nextSettings, path.replace('@', editMode));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const f of Array.from(files)) {
      const isVideo =
        f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(f.name);
      const isImage =
        f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name);
      if (!isImage && !isVideo) {
        onToast(` ${f.name}  format not supported. Please upload an image or video.`, 'err');
        continue;
      }
      if (f.size > 80 * 1024 * 1024) {
        onToast(` ${f.name}  exceeds 80 MB limit.`, 'err');
        continue;
      }
      const id = uid(isVideo ? 'vid' : 'img');
      try {
        await imageDB.put({
          id,
          name: f.name.slice(0, 80),
          blob: f,
          type: isVideo ? 'video' : 'image',
          size: f.size,
          createdAt: Date.now(),
        });
        if (isVideo) {
          updateSettingField(`modes.@.bg`, { kind: 'videoUpload', videoUploadId: id, videoName: f.name });
          onToast(`Video background set for ${editMode}: ${f.name}`);
        } else {
          updateSettingField(`modes.@.bg`, { kind: 'upload', id });
          onToast(`Wallpaper set for ${editMode}: ${f.name}`);
        }
      } catch {
        onToast('Could not save media file (storage full or blocked).', 'err');
      }
    }
    imageDB.list().then((list: CustomImage[]) => setCustomUploads(list)).catch(() => {});
  };

  const deleteUpload = async (id: string, name: string) => {
    onConfirm(
      'Delete Media?',
      `Remove "${name}" from storage?`,
      'Delete',
      async () => {
        await imageDB.delete(id);
        if (
          (currentModeCfg.bg.kind === 'upload' && currentModeCfg.bg.id === id) ||
          (currentModeCfg.bg.kind === 'videoUpload' && currentModeCfg.bg.videoUploadId === id)
        ) {
          updateSettingField(
            `modes.@.bg`,
            clone(DEFAULTS.modes[editMode as keyof typeof DEFAULTS.modes].bg)
          );
        }
        setCustomUploads(prev => prev.filter(x => x.id !== id));
      }
    );
  };

  const handleApplyYtBgUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const input = ytBgUrlInput.trim();
    if (!input) return;

    const id = extractYouTubeId(input);
    if (id) {
      // Auto-save pasted YouTube link in browser storage
      saveLink(input, 'YouTube Video Background', 'bg');
      updateSettingField(`modes.@.bg`, {
        kind: 'youtube',
        youtubeId: id,
        youtubeTitle: 'YouTube Video',
      });
      setYtBgUrlInput('');
      onToast(t('applyYtBg', lang));
      return;
    }

    if (isDirectVideoUrl(input)) {
      // Auto-save direct video loop in browser storage
      saveLink(input, 'Direct Video Loop', 'bg');
      updateSettingField(`modes.@.bg`, {
        kind: 'videoUrl',
        videoUrl: input,
        videoName: 'Direct Video',
      });
      setYtBgUrlInput('');
      onToast('Video background set successfully.');
      return;
    }

    onToast('Please enter a valid YouTube link or video URL (.mp4, .webm).', 'err');
  };

  const handleSelectSavedBgLink = (item: SavedLinkItem) => {
    if (item.youtubeId) {
      updateSettingField(`modes.@.bg`, {
        kind: 'youtube',
        youtubeId: item.youtubeId,
        youtubeTitle: item.title,
      });
      onToast(`Background set: ${item.title}`);
    } else if (item.url) {
      updateSettingField(`modes.@.bg`, {
        kind: 'videoUrl',
        videoUrl: item.url,
        videoName: item.title,
      });
      onToast(`Background set: ${item.title}`);
    }
  };

  const handleApplyYtPreset = (preset: YouTubePreset) => {
    updateSettingField(`modes.@.bg`, {
      kind: 'youtube',
      youtubeId: preset.id,
      youtubeTitle: preset.title,
    });
    onToast(`Background set: ${preset.title}`);
  };

  /* ----- Themes Tab Render (Revamped Anti-Bloat Architecture) ----- */
  const renderThemes = () => {
    const bg = currentModeCfg.bg;
    const isEn = lang === 'en';

    const SCENE_NAMES_EN: Record<string, string> = {
      cafe: 'Rainy Cafe',
      bosque: 'Enchanted Forest',
      ventana: 'Window Rain Drops',
      calle: 'Rainy City Night',
      ciudad: 'Cyberpunk Metropolis',
      escritorio: 'Cozy Desk Night',
      chimenea: 'Fireplace Cabin',
      biblioteca: 'Grand Library',
      nubes: 'Pastel Lofi Clouds',
      pico: 'Sunset Mountain Peak',
      lago: 'Alpine Sunrise Lake',
      estrellas: 'Starry Galaxy',
      campina: 'Meadow Countryside',
      pinar: 'Misty Pine Forest',
      termal: 'Neon Thermal Glow',
      algodon: 'Cotton Candy Sky',
      otono: 'Golden Autumn Leaves',
      aurora: 'Boreal Northern Lights',
      medianoche: 'Deep Midnight Velvet',
      'a-ondas': 'Ocean Blue Waves',
      'a-ondas-rosa': 'Sakura Pink Waves',
      'a-dunas': 'Golden Desert Dunes',
      'a-orbes': 'Cosmic Twilight Orbs',
    };

    const SOLID_NAMES_EN: Record<string, string> = {
      '#0e1024': 'Midnight Navy',
      '#1f2126': 'Graphite Black',
      '#2a1538': 'Deep Plum',
      '#13261d': 'Forest Moss',
      '#0d2233': 'Ocean Abyss',
      '#3b2a22': 'Espresso Roast',
      '#c9b79c': 'Warm Sand',
      '#d8a7b1': 'Dusty Rose',
    };

    const ACCENT_PRESETS = [
      { color: '#5e6ad2', name: 'Indigo Focus' },
      { color: '#7c3aed', name: 'Electric Violet' },
      { color: '#06b6d4', name: 'Cyber Sky' },
      { color: '#10b981', name: 'Emerald Zen' },
      { color: '#f59e0b', name: 'Amber Sunset' },
      { color: '#ef4444', name: 'Crimson Flow' },
      { color: '#ec4899', name: 'Sakura Pink' },
      { color: '#64748b', name: 'Slate Minimal' },
    ];

    const getSceneTitle = (id: string, fallback: string) => {
      if (isEn && SCENE_NAMES_EN[id]) return SCENE_NAMES_EN[id];
      return fallback;
    };

    const bgDisplayName =
      bg.kind === 'scene' && bg.id
        ? getSceneTitle(bg.id, SCENES.find((s: any) => s.id === bg.id)?.name || 'Scene')
        : bg.kind === 'color' && bg.color
        ? (isEn && SOLID_NAMES_EN[bg.color]) ||
          (SOLIDS.find((s: [string, string]) => s[0] === bg.color) || [0, 'Solid Color'])[1]
        : bg.kind === 'youtube'
        ? bg.youtubeTitle || `YouTube (${bg.youtubeId})`
        : bg.kind === 'videoUpload'
        ? `Video: ${bg.videoName || 'Uploaded'}`
        : bg.kind === 'videoUrl'
        ? bg.videoName || 'HD Video Loop'
        : 'Uploaded Wallpaper';

    const uploadedVideos = customUploads.filter(u => u.type === 'video');
    const uploadedImages = customUploads.filter(u => u.type !== 'video');

    const SCENE_FILTER_CATEGORIES = [
      { id: 'all', label: isEn ? 'All Scenes' : t('allScenes', lang) },
      { id: 'animated', label: isEn ? '✨ Animated' : t('animatedOnly', lang) },
      { id: 'rain', label: isEn ? '🌧️ Rain & Lofi' : 'Lluvia' },
      { id: 'urban', label: isEn ? '🏙️ Urban Nights' : 'Urbano' },
      { id: 'nature', label: isEn ? '🌲 Nature & Forest' : 'Naturaleza' },
      { id: 'interior', label: isEn ? '☕ Cozy Indoors' : 'Interiores' },
      { id: 'scenic', label: isEn ? '🌄 Scenic Views' : 'Paisajes' },
      { id: 'abstract', label: isEn ? '🎨 Abstract' : 'Abstracto' },
      { id: 'gradient', label: isEn ? '⬛ Minimal Solids' : t('minimalSolids', lang) },
    ];

    const filteredScenes = SCENES.filter(s => {
      if (libCat === 'all') return true;
      if (libCat === 'animated') return !!s.anim;
      return s.cats.includes(libCat as any);
    });

    const isCurrentActiveMode = settings.mode === editMode;

    return (
      <div className="content-inner" style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h1 id="setTitle" style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            {t('tabThemes', lang)}
          </h1>
          <p className="sub-t" style={{ fontSize: '13.5px', margin: '4px 0 0', color: 'var(--muted)' }}>
            {t('themesSubtitle', lang)}
          </p>
        </div>

        {/* Mode Selector Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '6px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            {(['focus', 'home', 'ambient'] as ModeKey[]).map(m => {
              const isSelected = m === editMode;
              const isDesktopActive = settings.mode === m;
              const modeLabel =
                m === 'focus'
                  ? t('modeFocus', lang)
                  : m === 'home'
                  ? t('modeHome', lang)
                  : t('modeAmbient', lang);
              const iconName = m === 'focus' ? 'target' : m === 'home' ? 'home' : 'sun';

              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEditMode(m)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 650,
                    transition: 'all 0.18s ease',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    boxShadow: isSelected ? '0 2px 10px var(--accent-glow)' : 'none',
                    position: 'relative',
                  }}
                >
                  <Icon name={iconName} style={{ width: '15px', height: '15px' }} />
                  <span>{modeLabel}</span>
                  {isDesktopActive && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#34d399',
                        boxShadow: '0 0 6px #34d399',
                        marginLeft: '2px',
                      }}
                      title="Currently active on stage"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cinematic Live Mode Preview Card */}
        <div
          className="preview-card"
          aria-label={`${t('preview', lang)}: ${bgDisplayName}`}
          style={{
            position: 'relative',
            aspectRatio: '21/9',
            width: '100%',
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundImage:
              bg.kind === 'scene' && bg.id
                ? `url("${getThumbURL(bg.id)}")`
                : bg.kind === 'youtube'
                ? `url("https://img.youtube.com/vi/${bg.youtubeId}/hqdefault.jpg")`
                : undefined,
            backgroundColor: bg.kind === 'color' ? bg.color : '#0d0d14',
            backgroundSize: 'cover',
            backgroundPosition: `${currentModeCfg.posX}% ${currentModeCfg.posY}%`,
            marginBottom: '20px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          {bg.kind === 'videoUpload' && (
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              src={
                customUploads.find(u => u.id === bg.videoUploadId)?.blob
                  ? URL.createObjectURL(customUploads.find(u => u.id === bg.videoUploadId)!.blob)
                  : undefined
              }
            />
          )}
          {bg.kind === 'videoUrl' && bg.videoUrl && (
            <video
              autoPlay
              loop
              muted
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              src={bg.videoUrl}
            />
          )}

          {/* Dim and Blur Overlays */}
          <div
            className="pv-dim"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#000000',
              opacity: currentModeCfg.dim / 100,
              backdropFilter: currentModeCfg.blur ? `blur(${currentModeCfg.blur}px)` : undefined,
              WebkitBackdropFilter: currentModeCfg.blur ? `blur(${currentModeCfg.blur}px)` : undefined,
              transition: 'opacity 0.2s ease, backdrop-filter 0.2s ease',
            }}
          />

          {/* Key Tone Vignette in Preview */}
          {currentModeCfg.keyTone && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0, 0, 0, 0.45) 75%, rgba(0, 0, 0, 0.78) 100%)',
                mixBlendMode: 'multiply',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Live Top-Left Tag */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 9px',
              borderRadius: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isCurrentActiveMode ? '#34d399' : 'var(--accent)',
              }}
            />
            {editMode} mode preview
          </div>

          {/* Center Clock Preview */}
          <div
            className="pv-clock"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--display-font)',
              fontWeight: 800,
              fontSize: 'clamp(28px, 4.5vw, 48px)',
              color: settings.clock.color || '#ffffff',
              letterSpacing: '-0.03em',
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.65)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {editMode === 'focus'
              ? `${settings.timer.focus}:00`
              : editMode === 'home'
              ? '12:00'
              : 'Ambient'}
          </div>

          {/* Bottom metadata banner */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '8px 14px',
              background: 'linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, transparent 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bgDisplayName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)' }}>
              <span>Dim: {currentModeCfg.dim}%</span>
              <span>•</span>
              <span>Blur: {currentModeCfg.blur}px</span>
              {currentModeCfg.keyTone && (
                <>
                  <span>•</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>Key Tone ON</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Clean Revamped Sub-Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '20px',
            overflowX: 'auto',
          }}
        >
          {[
            { key: 'scenes', label: t('themeTabScenes', lang), icon: 'palette' },
            { key: 'video', label: t('themeTabVideo', lang), icon: 'youtube' },
            { key: 'uploads', label: t('themeTabUploads', lang), icon: 'upload' },
            { key: 'atmosphere', label: t('themeTabAtmosphere', lang), icon: 'sparkles' },
          ].map(tab => {
            const isTabActive = themeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setThemeTab(tab.key as any)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  fontWeight: 650,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  backgroundColor: isTabActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: isTabActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                  border: isTabActive ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid transparent',
                }}
              >
                <Icon
                  name={tab.icon}
                  style={{
                    width: '16px',
                    height: '16px',
                    color: isTabActive ? 'var(--accent-text)' : 'inherit',
                  }}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= SUB-TAB 1: SCENES & ART ================= */}
        {themeTab === 'scenes' && (
          <div>
            {/* Category Filter Pills */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '12px',
                marginBottom: '16px',
                scrollbarWidth: 'none',
              }}
            >
              {SCENE_FILTER_CATEGORIES.map(cat => {
                const isCatActive = libCat === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setLibCat(cat.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      backgroundColor: isCatActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                      color: isCatActive ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                      border: isCatActive ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                      boxShadow: isCatActive ? '0 2px 10px var(--accent-glow)' : 'none',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Scenes Grid */}
            {libCat !== 'gradient' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: '14px',
                  marginBottom: '24px',
                }}
              >
                {filteredScenes.map(scene => {
                  const isSelected = bg.kind === 'scene' && bg.id === scene.id;
                  const thumb = getThumbURL(scene.id);
                  const title = getSceneTitle(scene.id, scene.name);

                  return (
                    <div
                      key={scene.id}
                      onClick={() => {
                        updateSettingField(`modes.@.bg`, { kind: 'scene', id: scene.id });
                        onToast(`${title} applied to ${editMode}`);
                      }}
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 4px 18px var(--accent-glow)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: '16/10',
                          width: '100%',
                          backgroundImage: `url("${thumb}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                        }}
                      >
                        {scene.anim && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(0, 0, 0, 0.65)',
                              color: '#ffffff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backdropFilter: 'blur(6px)',
                            }}
                          >
                            <Icon name="sparkles" style={{ width: '11px', height: '11px', color: '#fbbf24' }} />
                            {isEn ? 'Animated' : 'Animado'}
                          </span>
                        )}
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--accent)',
                              display: 'grid',
                              placeItems: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            }}
                          >
                            <Icon name="check" style={{ width: '13px', height: '13px', color: '#fff' }} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '9px 12px', fontSize: '13px', fontWeight: 650, color: isSelected ? 'var(--accent-text)' : '#ffffff' }}>
                        {title}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Minimal Solids Section */}
            {(libCat === 'all' || libCat === 'gradient') && (
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  marginTop: libCat === 'all' ? '12px' : '0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                      {isEn ? 'Minimal Solid Colors' : 'Colores sólidos minimalistas'}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      {isEn ? 'Ultra clean, distraction-free matte backdrops.' : 'Fondos limpios sin distracciones.'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {(SOLIDS as [string, string][]).map(([color, defaultName]) => {
                    const isSelected = bg.kind === 'color' && Boolean(bg.color && bg.color.toLowerCase() === color.toLowerCase());
                    const displayName = isEn ? SOLID_NAMES_EN[color] || defaultName : defaultName;

                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          updateSettingField(`modes.@.bg`, { kind: 'color', color });
                          onToast(`${displayName} applied`);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'var(--accent-soft)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'}`,
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            backgroundColor: color,
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--accent-text)' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName}
                        </span>
                      </button>
                    );
                  })}

                  {/* Custom Solid Color */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px dashed rgba(255, 255, 255, 0.18)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="color"
                      value={bg.kind === 'color' ? bg.color : '#1e1b4b'}
                      onChange={e => updateSettingField(`modes.@.bg`, { kind: 'color', color: e.target.value })}
                      style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                      {isEn ? 'Custom Hex' : 'Color propio'}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SUB-TAB 2: YOUTUBE & VIDEO ================= */}
        {themeTab === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Input Bar */}
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Icon name="youtube" style={{ width: '20px', height: '20px', color: '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                  {t('ytBackgroundTitle', lang)}
                </h3>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--muted)' }}>
                {t('ytBackgroundDesc', lang)}
              </p>

              <form onSubmit={handleApplyYtBgUrl} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder={t('enterYtBgUrl', lang)}
                  value={ytBgUrlInput}
                  onChange={e => setYtBgUrlInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  className="btn primary"
                  disabled={!ytBgUrlInput.trim()}
                  style={{
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 650,
                    backgroundColor: 'var(--accent)',
                    color: '#ffffff',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: ytBgUrlInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: ytBgUrlInput.trim() ? 1 : 0.5,
                  }}
                >
                  {t('applyYtBg', lang)}
                </button>
              </form>
            </div>

            {/* Saved Links Section (Synced with Firestore) */}
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#ffffff' }}>
                  {t('savedLinksTitle', lang)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--accent-text)' }}>
                  <Icon name="cloud" style={{ width: '13px', height: '13px' }} />
                  Synced with Cloud
                </span>
              </div>
              <SavedLinksList
                currentActiveId={bg.kind === 'youtube' ? bg.youtubeId : (bg.kind === 'videoUrl' ? bg.videoUrl : undefined)}
                onSelect={handleSelectSavedBgLink}
                lang={lang}
                filterType="bg"
              />
            </div>

            {/* Curated YouTube Presets */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                {t('ytBgPresets', lang)}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px' }}>
                {YOUTUBE_BG_PRESETS.map(preset => {
                  const isSelected = bg.kind === 'youtube' && bg.youtubeId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyYtPreset(preset)}
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 4px 18px var(--accent-glow)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: '16/9',
                          width: '100%',
                          backgroundImage: `url("https://img.youtube.com/vi/${preset.id}/mqdefault.jpg")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Icon name="youtube" style={{ width: '11px', height: '11px' }} />
                          YouTube
                        </span>
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 650, color: isSelected ? 'var(--accent-text)' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {preset.title}
                        </div>
                        {preset.author && (
                          <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                            {preset.author}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Curated HD Video Loops */}
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                Curated HD Video Loops (MP4)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px' }}>
                {DIRECT_VIDEO_PRESETS.map(preset => {
                  const isSelected = bg.kind === 'videoUrl' && bg.videoUrl === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        updateSettingField(`modes.@.bg`, {
                          kind: 'videoUrl',
                          videoUrl: preset.url,
                          videoName: preset.title,
                        });
                        onToast(`Video background set: ${preset.title}`);
                      }}
                      style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 4px 18px var(--accent-glow)' : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: '16/9',
                          width: '100%',
                          backgroundColor: '#161622',
                          display: 'grid',
                          placeItems: 'center',
                          position: 'relative',
                        }}
                      >
                        <Icon name="video" style={{ width: '28px', height: '28px', color: 'var(--accent-text)' }} />
                        <span
                          style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: '#ffffff',
                          }}
                        >
                          HD Video
                        </span>
                      </div>
                      <div style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 650, color: isSelected ? 'var(--accent-text)' : '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preset.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= SUB-TAB 3: CUSTOM UPLOADS ================= */}
        {themeTab === 'uploads' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Upload Dropzones */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '28px 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*,.mp4,.webm,.mov"
                  className="sr-only"
                  onChange={e => handleFileUpload(e.target.files)}
                />
                <Icon name="video" style={{ width: '32px', height: '32px', color: 'var(--accent-text)', marginBottom: '10px' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Upload Video (.mp4, .webm)</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Up to 80MB • Seamless loop</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '28px 20px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  className="sr-only"
                  onChange={e => handleFileUpload(e.target.files)}
                />
                <Icon name="image" style={{ width: '32px', height: '32px', color: 'var(--accent-text)', marginBottom: '10px' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Upload Wallpaper (.jpg, .png)</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Crisp custom high-res art</span>
              </label>
            </div>

            {/* Offline Device Notice */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: 'rgba(94, 106, 210, 0.08)',
                border: '1px solid rgba(94, 106, 210, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12.5px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              <Icon name="cloud" style={{ width: '18px', height: '18px', color: 'var(--accent)', flexShrink: 0 }} />
              <div>
                <strong>Device-Local Storage:</strong> Files uploaded directly from your computer remain stored on this browser. For effortless cloud syncing across any phone or laptop, use YouTube links!
              </div>
            </div>

            {/* Uploaded Videos */}
            {uploadedVideos.length > 0 && (
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: '#ffffff' }}>
                  Your Uploaded Videos ({uploadedVideos.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
                  {uploadedVideos.map(up => {
                    const isSelected = bg.kind === 'videoUpload' && bg.videoUploadId === up.id;
                    const blobUrl = URL.createObjectURL(up.blob);

                    return (
                      <div
                        key={up.id}
                        style={{
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'}`,
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          position: 'relative',
                        }}
                      >
                        <div
                          onClick={() => {
                            updateSettingField(`modes.@.bg`, {
                              kind: 'videoUpload',
                              videoUploadId: up.id,
                              videoName: up.name,
                            });
                            onToast(`Set ${up.name}`);
                          }}
                          style={{ cursor: 'pointer', aspectRatio: '16/9', width: '100%', position: 'relative', overflow: 'hidden' }}
                        >
                          <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            src={blobUrl}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {up.name}
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete ${up.name}`}
                            onClick={() => deleteUpload(up.id, up.name)}
                            style={{ color: 'var(--muted)', padding: '4px', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                          >
                            <Icon name="trash" style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Uploaded Images */}
            {uploadedImages.length > 0 && (
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: '#ffffff' }}>
                  Your Uploaded Wallpapers ({uploadedImages.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
                  {uploadedImages.map(up => {
                    const isSelected = bg.kind === 'upload' && bg.id === up.id;
                    const blobUrl = URL.createObjectURL(up.blob);

                    return (
                      <div
                        key={up.id}
                        style={{
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'}`,
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          position: 'relative',
                        }}
                      >
                        <div
                          onClick={() => {
                            updateSettingField(`modes.@.bg`, { kind: 'upload', id: up.id });
                            onToast(`Set ${up.name}`);
                          }}
                          style={{
                            cursor: 'pointer',
                            aspectRatio: '16/9',
                            width: '100%',
                            backgroundImage: `url("${blobUrl}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {up.name}
                          </span>
                          <button
                            type="button"
                            aria-label={`Delete ${up.name}`}
                            onClick={() => deleteUpload(up.id, up.name)}
                            style={{ color: 'var(--muted)', padding: '4px', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                          >
                            <Icon name="trash" style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= SUB-TAB 4: ATMOSPHERE & ACCENTS ================= */}
        {themeTab === 'atmosphere' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Visual Atmosphere Card */}
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                Lighting & Readability ({editMode} mode)
              </h3>
              <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--muted)' }}>
                Fine-tune darkness, blur, and canvas alignment for optimal study contrast.
              </p>

              {/* Dim Slider */}
              <div className="slider-row" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>{t('bgDim', lang)}</label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={currentModeCfg.dim}
                  style={{ '--p': `${(currentModeCfg.dim / 90) * 100}%` } as any}
                  onChange={e => updateSettingField(`modes.@.dim`, Number(e.target.value))}
                />
                <output style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{currentModeCfg.dim}%</output>
              </div>

              {/* Blur Slider */}
              <div className="slider-row" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>{t('bgBlur', lang)}</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={currentModeCfg.blur}
                  style={{ '--p': `${(currentModeCfg.blur / 30) * 100}%` } as any}
                  onChange={e => updateSettingField(`modes.@.blur`, Number(e.target.value))}
                />
                <output style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{currentModeCfg.blur}px</output>
              </div>

              {/* PosX Slider */}
              <div className="slider-row" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>{t('bgPosX', lang)}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentModeCfg.posX}
                  style={{ '--p': `${currentModeCfg.posX}%` } as any}
                  onChange={e => updateSettingField(`modes.@.posX`, Number(e.target.value))}
                />
                <output style={{ fontWeight: 700 }}>{currentModeCfg.posX}%</output>
              </div>

              {/* PosY Slider */}
              <div className="slider-row" style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>{t('bgPosY', lang)}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={currentModeCfg.posY}
                  style={{ '--p': `${currentModeCfg.posY}%` } as any}
                  onChange={e => updateSettingField(`modes.@.posY`, Number(e.target.value))}
                />
                <output style={{ fontWeight: 700 }}>{currentModeCfg.posY}%</output>
              </div>

              {/* Particle Animations Switch */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <div style={{ fontWeight: 650, fontSize: '14px', color: '#ffffff' }}>{t('animatedBg', lang)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Raindrops, fireflies, sparks, glowing starry skies.
                  </div>
                </div>
                <div className="seg" role="group" aria-label={t('animatedBg', lang)}>
                  {(['auto', 'on', 'off'] as const).map(a => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={settings.appearance.animation === a}
                      onClick={() => updateSettingField('appearance.animation', a)}
                      style={{ fontSize: '12.5px', padding: '6px 12px' }}
                    >
                      {{ auto: t('animatedBgAuto', lang), on: t('animatedBgOn', lang), off: t('animatedBgOff', lang) }[a]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Key Tone Effect Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <div style={{ fontWeight: 650, fontSize: '14px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Key Tone Effect</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        background: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                        border: '1px solid var(--accent-border)',
                        fontWeight: 600,
                      }}
                    >
                      Cinematic
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Film-grade midtone contrast, highlight compression, and gentle vignette focus.
                  </div>
                </div>
                <label className="sw" aria-label="Key Tone Effect">
                  <input
                    type="checkbox"
                    checked={!!currentModeCfg.keyTone}
                    onChange={e => updateSettingField(`modes.@.keyTone`, e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>

            {/* Designer Accent Colors */}
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                {t('accentColor', lang)}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--muted)' }}>
                Synchronized across all timer highlights, button glows, and dashboard accents.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                {ACCENT_PRESETS.map(preset => {
                  const isSelected = settings.appearance.accent.toLowerCase() === preset.color.toLowerCase();
                  return (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => {
                        updateSettingField('appearance.accent', preset.color);
                        onToast(`${preset.name} applied`);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? preset.color : 'rgba(255, 255, 255, 0.08)'}`,
                        boxShadow: isSelected ? `0 0 12px ${preset.color}55` : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: preset.color,
                          boxShadow: `0 0 8px ${preset.color}88`,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: '12.5px', fontWeight: 650, color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.8)' }}>
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex Picker */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <input
                  type="color"
                  value={settings.appearance.accent}
                  title="Pick custom accent"
                  onChange={e => updateSettingField('appearance.accent', e.target.value)}
                  style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 650, color: '#ffffff' }}>Custom Accent Hex</div>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-text)' }}>
                    {settings.appearance.accent}
                  </div>
                </div>
              </div>
            </div>

            {/* Restore Mode Defaults */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  updateSettingField(`modes.@`, clone(DEFAULTS.modes[editMode as keyof typeof DEFAULTS.modes]));
                  onToast(t('restoreTheme', lang));
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  color: 'var(--muted)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {t('restoreTheme', lang)}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ----- Language Tab Render ----- */
  const renderLanguage = () => {
    const languages: { code: LanguageCode; name: string; native: string; desc: string }[] = [
      {
        code: 'en',
        name: 'English',
        native: 'English (US)',
        desc: 'Default international English interface and quotes.',
      },
      {
        code: 'ta',
        name: 'Tamil',
        native: 'தமிழ் (Tamil)',
        desc: 'தமிழ் இடைமுகம், பொன்மொழிகள் மற்றும் தனிப்பயன் நேரமானி.',
      },
      {
        code: 'es',
        name: 'Spanish',
        native: 'Español',
        desc: 'Interfaz y frases en español para estudiar con calma.',
      },
    ];

    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('tabLanguage', lang)}</h1>
        <p className="sub-t">
          {lang === 'ta'
            ? 'உங்கள் விருப்பத்திற்கேற்ப பயன்பாட்டின் மொழியைத் தேர்வு செய்யவும்.'
            : 'Select your preferred interface language. Peakus adapts all text and quotes instantly.'}
        </p>

        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {languages.map(l => {
              const isSelected = (settings.language || 'en') === l.code;
              return (
                <button
                  key={l.code}
                  onClick={() => {
                    const next = { ...settings, language: l.code };
                    onUpdateSettings(next, 'language');
                    onToast(`Language changed to ${l.native}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--card-2)',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line-2)'}`,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <b style={{ fontSize: '16px', color: isSelected ? '#fff' : 'var(--text)' }}>
                        {l.native}
                      </b>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>({l.name})</span>
                    </div>
                    <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                      {l.desc}
                    </span>
                  </div>

                  {isSelected && (
                    <span style={{ color: 'var(--accent-text)', width: '22px', height: '22px' }}>
                      <Icon name="check" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ----- Music Tab Render ----- */
  const renderMusic = () => {
    const music = settings.music;
    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('music', lang)}</h1>
        <p className="sub-t">{t('musicDesc', lang)}</p>

        <div className="card">
          <div className="row center-y">
            <div className="txt">
              <b>{t('musicTitle', lang)}</b>
              <span>{music.playing ? t('streamPlaying', lang) : t('streamPaused', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={music.playing}
              onClick={() => updateSettingField('music.playing', !music.playing)}
            />
          </div>

          <div className="slider-row" style={{ marginTop: '12px' }}>
            <label>{t('musicVolume', lang)}</label>
            <input
              type="range"
              min="0"
              max="100"
              value={music.volume}
              style={{ '--p': `${music.volume}%` } as any}
              onChange={e => updateSettingField('music.volume', Number(e.target.value))}
            />
            <output>{music.volume}%</output>
          </div>
        </div>

        <div className="card">
          <h3>{t('presetStreams', lang)}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {YOUTUBE_MUSIC_PRESETS.map(preset => {
              const isCurrent = music.youtubeId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
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
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: isCurrent ? 'var(--accent-soft)' : 'var(--card-2)',
                    border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--line-2)'}`,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: isCurrent ? 'var(--accent-text)' : 'var(--muted)' }}>
                      <Icon name="disc" />
                    </span>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{preset.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{preset.author}</div>
                    </div>
                  </div>
                  {isCurrent && music.playing ? (
                    <span style={{ color: '#34d399' }}>
                      <Icon name="volume" />
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>
                      <Icon name="play" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ----- Clock Tab Render ----- */
  const renderClock = () => {
    const c = settings.clock;
    const styles: [string, string][] = [
      ['bold', 'Bold Display'],
      ['thin', 'Thin Display'],
      ['minimal', 'Minimal Sans'],
      ['serif', 'Serif Elegant'],
      ['hand', 'Handwritten'],
      ['minimal-light', 'Light Sans'],
      ['serif-condensed', 'Condensed Serif'],
      ['outfit', 'Outfit Modern'],
      ['plus-jakarta', 'Plus Jakarta Sans'],
      ['dm-sans', 'DM Sans Geometric'],
      ['fraunces', 'Fraunces Editorial'],
      ['space-mono', 'Space Mono Code'],
      ['syne', 'Syne Brutalist'],
    ];

    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('tabClock', lang)}</h1>
        <p className="sub-t">{t('clockSubtitle', lang)}</p>

        <div className="card">
          <h3>{t('clockSubtitle', lang)}</h3>
          <div className="opt-grid two">
            {[
              ['12', t('format12', lang), '2:24'],
              ['24', t('format24', lang), '14:24'],
            ].map(([v, n, text]) => (
              <button
                key={v}
                className="opt"
                aria-pressed={c.format === v}
                onClick={() => updateSettingField('clock.format', v)}
              >
                <span className="face photo" style={{ backgroundColor: '#1a103c' }}>
                  <span
                    className="fclock"
                    style={{
                      fontFamily: 'var(--display-font)',
                      fontWeight: 800,
                      fontSize: '34px',
                    }}
                  >
                    {text}
                  </span>
                </span>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row center-y">
            <div className="txt">
              <b>{t('flipClock', lang)}</b>
              <span>{t('flipClockDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={c.flip}
              onClick={() => updateSettingField('clock.flip', !c.flip)}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('showSeconds', lang)}</b>
              <span>{t('showSecondsDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={c.seconds}
              onClick={() => updateSettingField('clock.seconds', !c.seconds)}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('showDate', lang)}</b>
              <span>{t('showDateDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={c.date}
              onClick={() => updateSettingField('clock.date', !c.date)}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('dynamicGreetings', lang)}</b>
              <span>{t('dynamicGreetingsDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={c.dynamicGreetings}
              onClick={() => updateSettingField('clock.dynamicGreetings', !c.dynamicGreetings)}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('showGreetings', lang)}</b>
              <span>{t('showGreetingsDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={c.greetings}
              onClick={() => updateSettingField('clock.greetings', !c.greetings)}
            />
          </div>

          <div className="field" style={{ marginTop: '8px' }}>
            <label htmlFor="nameIn">{t('yourName', lang)}</label>
            <input
              type="text"
              id="nameIn"
              maxLength={40}
              value={settings.name}
              style={{ maxWidth: '280px' }}
              onChange={e => updateSettingField('name', e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <h3>{t('clockStyleTitle', lang)}</h3>
          <div className="opt-grid">
            {styles.map(([v, n]) => (
              <button
                key={v}
                className="opt"
                aria-pressed={c.style === v}
                onClick={() => updateSettingField('clock.style', v)}
              >
                <span className="face photo" style={{ backgroundColor: '#1a103c' }}>
                  <span
                    className={`clock style-${v}`}
                    style={{ fontSize: '38px', color: '#fff' }}
                  >
                    9:24
                  </span>
                </span>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>{t('clockSize', lang)}</h3>
          <div className="slider-row">
            <label>{t('clockSize', lang)}</label>
            <input
              type="range"
              min="50"
              max="170"
              step="5"
              value={c.size}
              style={{ '--p': `${((c.size - 50) / 120) * 100}%` } as any}
              onChange={e => updateSettingField('clock.size', Number(e.target.value))}
            />
            <output>{c.size}%</output>
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('clockColor', lang)}</b>
            </div>
            <div className="swatches">
              {['#ffffff', '#fff4e0', '#e9ddff', '#d6f5e8', '#ffd9e6', '#cfe8ff'].map(col => (
                <button
                  key={col}
                  className="swatch"
                  style={{ background: col }}
                  aria-pressed={c.color === col}
                  onClick={() => updateSettingField('clock.color', col)}
                />
              ))}
              <input
                type="color"
                value={c.color}
                onChange={e => updateSettingField('clock.color', e.target.value)}
              />
            </div>
          </div>

          <div className="section-actions">
            <button
              className="btn ghost"
              onClick={() => {
                updateSettingField('clock', clone(DEFAULTS.clock));
                onToast(t('restoreClock', lang));
              }}
            >
              {t('restoreClock', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ----- Timer Tab Render ----- */
  const renderTimer = () => {
    const tSettings = settings.timer;
    const pomo = tSettings.mode === 'pomodoro';
    const activeTask = tasks.find(x => x.active && !x.deleted && !x.done);

    const timerStyles = [
      ['default', 'Default', <span key="def" style={{ fontSize: '24px', fontWeight: 600 }}>25:00</span>],
      [
        'flip',
        'Flip',
        <span key="flip" style={{ display: 'flex', gap: '6px' }}>
          <b style={{ background: '#2a2a32', padding: '6px 9px', borderRadius: '5px', fontSize: '20px' }}>2</b>
          <b style={{ background: '#2a2a32', padding: '6px 9px', borderRadius: '5px', fontSize: '20px' }}>5</b>
        </span>,
      ],
      [
        'bar',
        'Progress Bar',
        <span key="bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <small className="fsmall">25:00</small>
          <i style={{ display: 'block', width: '110px', height: '7px', borderRadius: '9px', background: 'linear-gradient(90deg,#fff 62%,#555 62%)' }} />
        </span>,
      ],
      [
        'gauge',
        'Gauge Ring',
        <span key="gauge" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#555" strokeWidth="5" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="88" strokeDashoffset="22" transform="rotate(-90 18 18)" />
          </svg>
          <small className="fsmall">25:00</small>
        </span>,
      ],
      [
        'dots',
        'Dot Matrix',
        <span key="dots" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <span style={{ display: 'grid', gridTemplateColumns: 'repeat(8,5px)', gap: '3px' }}>
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ width: '5px', height: '5px', background: '#fff', opacity: i < 17 ? 1 : 0.3 }} />
            ))}
          </span>
          <small className="fsmall">25:00</small>
        </span>,
      ],
      [
        'pie',
        'Pie Fill',
        <span key="pie" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="34" height="34" viewBox="0 0 34 34">
            <circle cx="17" cy="17" r="15" fill="#555" />
            <path d="M17 17V2a15 15 0 1 1-15 15z" fill="#fff" />
          </svg>
          <small className="fsmall">25:00</small>
        </span>,
      ],
    ];

    const alerts = audioX.getAlerts() as Record<string, { name: string }>;

    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('tabTimer', lang)}</h1>
        <p className="sub-t">{t('timerSubtitle', lang)}</p>

        <div className="card">
          <div className="field">
            <label htmlFor="tmMode">{t('timerMode', lang)}</label>
            <select
              id="tmMode"
              value={tSettings.mode}
              onChange={e => updateSettingField('timer.mode', e.target.value)}
            >
              <option value="pomodoro">{t('pomoMode', lang)}</option>
              <option value="countdown">{t('countdownMode', lang)}</option>
            </select>
          </div>

          {pomo && (
            <div className="row center-y">
              <div className="txt">
                <b>{t('etaModeTitle', lang)}</b>
                <span>
                  {t('etaModeDesc', lang)}{' '}
                  {activeTask
                    ? activeTask.estimate
                      ? `(${activeTask.title}: ${activeTask.estimate} min)`
                      : `(${activeTask.title})`
                    : ''}
                </span>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={tSettings.etaMode}
                onClick={() => updateSettingField('timer.etaMode', !tSettings.etaMode)}
              />
            </div>
          )}

          <h3 style={{ marginTop: '14px' }}>{t('durationsTitle', lang)}</h3>
          <p className="desc">{t('durationsDesc', lang)}</p>

          {/* Quick Apply Preset Chips */}
          {pomo && presets.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
                {t('presetsTitle', lang)}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {presets.map(p => {
                  const isCurrent =
                    settings.timer.focus === p.focus &&
                    settings.timer.short === p.short &&
                    settings.timer.long === p.long;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPreset && onSelectPreset(p)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 650,
                        backgroundColor: isCurrent ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
                        border: isCurrent ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
                        color: isCurrent ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {p.name} ({p.focus}m / {p.short}m)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="fields">
            {pomo ? (
              <>
                <div className="field">
                  <label>{t('focusDur', lang)}</label>
                  <span className="num">
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={tSettings.focus}
                      onChange={e => updateSettingField('timer.focus', Number(e.target.value))}
                    />
                    <span>min</span>
                  </span>
                </div>
                <div className="field">
                  <label>{t('shortDur', lang)}</label>
                  <span className="num">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={tSettings.short}
                      onChange={e => updateSettingField('timer.short', Number(e.target.value))}
                    />
                    <span>min</span>
                  </span>
                </div>
                <div className="field">
                  <label>{t('longDur', lang)}</label>
                  <span className="num">
                    <input
                      type="number"
                      min="1"
                      max="180"
                      value={tSettings.long}
                      onChange={e => updateSettingField('timer.long', Number(e.target.value))}
                    />
                    <span>min</span>
                  </span>
                </div>
                <div className="field">
                  <label>{t('sessionsUntilLong', lang)}</label>
                  <span className="num">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={tSettings.cycles}
                      onChange={e => updateSettingField('timer.cycles', Number(e.target.value))}
                    />
                    <span>ses.</span>
                  </span>
                </div>
              </>
            ) : (
              <div className="field">
                <label>{t('countdownDur', lang)}</label>
                <span className="num">
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={tSettings.countdown}
                    onChange={e => updateSettingField('timer.countdown', Number(e.target.value))}
                  />
                  <span>min</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3 Custom Pomodoro Presets Card (Saved in browser) */}
        {pomo && (
          <div className="card">
            <h3>
              <Icon name="timer" /> {t('presetsTitle', lang)}
            </h3>
            <p className="desc">{t('presetsDesc', lang)}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {editablePresets.map((preset, index) => {
                const isCurrent =
                  settings.timer.focus === preset.focus &&
                  settings.timer.short === preset.short &&
                  settings.timer.long === preset.long;

                return (
                  <div
                    key={preset.id}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: isCurrent ? 'var(--accent-soft)' : 'var(--card-2)',
                      border: `1.5px solid ${isCurrent ? 'var(--accent)' : 'var(--line-2)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                            color: '#fff',
                          }}
                        >
                          Preset #{index + 1}
                        </span>
                        <input
                          type="text"
                          value={preset.name}
                          placeholder={t('presetName', lang)}
                          style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            padding: '4px 8px',
                            maxWidth: '180px',
                          }}
                          onChange={e => handleUpdatePresetField(preset.id, 'name', e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => handleSavePreset(preset)}
                        >
                          {t('savePreset', lang)}
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          style={{ padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => handleApplyPreset(preset)}
                        >
                          {t('applyPreset', lang)}
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
                        gap: '8px',
                      }}
                    >
                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px' }}>{t('focusDur', lang)}</label>
                        <span className="num">
                          <input
                            type="number"
                            min="1"
                            max="240"
                            value={preset.focus}
                            onChange={e =>
                              handleUpdatePresetField(preset.id, 'focus', Number(e.target.value))
                            }
                          />
                          <span>m</span>
                        </span>
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px' }}>{t('shortDur', lang)}</label>
                        <span className="num">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={preset.short}
                            onChange={e =>
                              handleUpdatePresetField(preset.id, 'short', Number(e.target.value))
                            }
                          />
                          <span>m</span>
                        </span>
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px' }}>{t('longDur', lang)}</label>
                        <span className="num">
                          <input
                            type="number"
                            min="1"
                            max="180"
                            value={preset.long}
                            onChange={e =>
                              handleUpdatePresetField(preset.id, 'long', Number(e.target.value))
                            }
                          />
                          <span>m</span>
                        </span>
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px' }}>{t('sessionsUntilLong', lang)}</label>
                        <span className="num">
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={preset.cycles}
                            onChange={e =>
                              handleUpdatePresetField(preset.id, 'cycles', Number(e.target.value))
                            }
                          />
                          <span>ses</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="card">
          <h3>{t('timerStyleTitle', lang)}</h3>
          <div className="opt-grid">
            {timerStyles.map(([v, n, face]) => (
              <button
                key={v as string}
                className="opt"
                aria-pressed={tSettings.style === v}
                onClick={() => updateSettingField('timer.style', v)}
              >
                <span className="face">{face}</span>
                {n as string}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {/* Flow Mode Toggle */}
          <div className="row center-y">
            <div className="txt">
              <b>{t('flowMode', lang)}</b>
              <span>{t('flowModeDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={!!tSettings.flowMode}
              onClick={() => updateSettingField('timer.flowMode', !tSettings.flowMode)}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('progressBar', lang)}</b>
              <span>{t('progressBarDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={tSettings.progressBar}
              onClick={() => updateSettingField('timer.progressBar', !tSettings.progressBar)}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{t('notifyOnEnd', lang)}</b>
              <span>{t('notifyOnEndDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={tSettings.notify}
              onClick={async () => {
                if (!tSettings.notify && 'Notification' in window) {
                  const perm = await Notification.requestPermission();
                  if (perm !== 'granted') return;
                }
                updateSettingField('timer.notify', !tSettings.notify);
              }}
            />
          </div>

          <div className="row center-y">
            <div className="txt">
              <b>{pomo ? t('autoBreak', lang) : 'Auto-restart'}</b>
              <span>{pomo ? t('autoBreakDesc', lang) : 'Restart countdown on end.'}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={tSettings.autoBreak}
              onClick={() => updateSettingField('timer.autoBreak', !tSettings.autoBreak)}
            />
          </div>

          {pomo && (
            <div className="row center-y">
              <div className="txt">
                <b>{t('autoFocus', lang)}</b>
                <span>{t('autoFocusDesc', lang)}</span>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={tSettings.autoFocus}
                onClick={() => updateSettingField('timer.autoFocus', !tSettings.autoFocus)}
              />
            </div>
          )}

          <div className="row center-y">
            <div className="txt">
              <b>{t('showStreakSetting', lang)}</b>
              <span>{t('showStreakDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={tSettings.showStreak}
              onClick={() => updateSettingField('timer.showStreak', !tSettings.showStreak)}
            />
          </div>

          <div className="field" style={{ marginTop: '8px' }}>
            <label>{t('streakGoalSetting', lang)}</label>
            <span className="num">
              <input
                type="number"
                min="1"
                max="600"
                value={tSettings.streakGoal}
                onChange={e => updateSettingField('timer.streakGoal', Number(e.target.value))}
              />
              <span>min</span>
            </span>
          </div>
        </div>

        <div className="card">
          <h3>{t('alertSoundTitle', lang)}</h3>
          <p className="desc">{t('alertSoundDesc', lang)}</p>

          <div
            className="seg outline-chips"
            role="group"
            aria-label="Alert sound"
            style={{ marginBottom: '14px' }}
          >
            {Object.entries(alerts).map(([id, a]) => (
              <button
                key={id}
                aria-pressed={tSettings.sound === id}
                onClick={() => {
                  updateSettingField('timer.sound', id);
                  audioX.playAlert(id, tSettings.volume);
                }}
              >
                {a.name}
              </button>
            ))}
          </div>

          <div className="slider-row">
            <label>{t('alertVolume', lang)}</label>
            <input
              type="range"
              min="0"
              max="100"
              value={tSettings.volume}
              style={{ '--p': `${tSettings.volume}%` } as any}
              onChange={e => updateSettingField('timer.volume', Number(e.target.value))}
            />
            <output>{tSettings.volume}%</output>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                <Icon name="timer" /> Changing Icons (Session Tallies)
              </h3>
              <p className="desc" style={{ margin: '4px 0 0' }}>
                The icon advances as you finish more focus sessions.
              </p>
            </div>
            {tSettings.tallies === 'emoji' && (
              <span
                style={{
                  fontSize: '11.5px',
                  padding: '3px 9px',
                  borderRadius: '20px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-text)',
                  fontWeight: 650,
                  border: '1px solid var(--accent-border)',
                }}
              >
                Aesthetic Mode
              </span>
            )}
          </div>

          {/* Style Selector */}
          <div className="seg" role="group" aria-label="Tally display style" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              aria-pressed={tSettings.tallies === 'emoji'}
              onClick={() => updateSettingField('timer.tallies', 'emoji')}
            >
              🎨 Emoji Progression
            </button>
            <button
              type="button"
              aria-pressed={tSettings.tallies === 'dots'}
              onClick={() => updateSettingField('timer.tallies', 'dots')}
            >
              ● Classic Dots
            </button>
            <button
              type="button"
              aria-pressed={tSettings.tallies === 'numbers'}
              onClick={() => updateSettingField('timer.tallies', 'numbers')}
            >
              🔢 Numbers (1/4)
            </button>
            <button
              type="button"
              aria-pressed={tSettings.tallies === 'none'}
              onClick={() => updateSettingField('timer.tallies', 'none')}
            >
              ✕ Hidden
            </button>
          </div>

          {/* If Emoji Progression is selected, render live preview and themes grid */}
          {tSettings.tallies === 'emoji' && (
            <>
              {/* Live Preview Strip */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--line-2)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 650 }}>
                    Live Stage Preview
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
                    {resolveTallyEmojis(tSettings.tallyTheme, tSettings.customTallyEmojis, 4).map((emoji, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '24px',
                            opacity: idx < 2 ? 1 : idx === 2 ? 0.9 : 0.3,
                            filter: idx < 2 ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' : undefined,
                            transform: idx < 2 ? 'scale(1.05)' : undefined,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {emoji}
                        </span>
                        <span
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: idx < 2 ? 'var(--accent)' : idx === 2 ? '#ffffff' : 'rgba(255,255,255,0.2)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>
                  Current Theme:{' '}
                  <b style={{ color: '#ffffff' }}>
                    {tSettings.tallyTheme === 'custom'
                      ? 'Custom Emojis'
                      : getTallyTheme(tSettings.tallyTheme).name}
                  </b>
                  <div style={{ fontSize: '11px', color: 'var(--faint)' }}>
                    Progresses as you focus and complete sessions
                  </div>
                </div>
              </div>

              {/* Theme Grid Matching Reference Screenshot */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '10px',
                  marginBottom: '16px',
                }}
              >
                {TALLY_THEMES.map(theme => {
                  const isSelected = (tSettings.tallyTheme || DEFAULT_TALLY_THEME) === theme.id;
                  return (
                    <button
                      type="button"
                      key={theme.id}
                      onClick={() => updateSettingField('timer.tallyTheme', theme.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: isSelected ? 'var(--accent-soft)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--line-2)'}`,
                        boxShadow: isSelected ? '0 4px 16px var(--accent-glow)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      {/* Radio Circle */}
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'rgba(255, 255, 255, 0.3)'}`,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--accent)',
                            }}
                          />
                        )}
                      </span>

                      {/* 4 Emojis */}
                      <span
                        style={{
                          fontSize: '18px',
                          letterSpacing: '2px',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        {theme.emojis.join(' ')}
                      </span>

                      {/* Theme Name */}
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 550,
                          color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {theme.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Emojis ("Choose Your Own") Card */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: tSettings.tallyTheme === 'custom' ? 'var(--accent-soft)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1.5px solid ${tSettings.tallyTheme === 'custom' ? 'var(--accent)' : 'var(--line-2)'}`,
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => updateSettingField('timer.tallyTheme', 'custom')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${tSettings.tallyTheme === 'custom' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.3)'}`,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {tSettings.tallyTheme === 'custom' && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                        )}
                      </span>
                      <b style={{ fontSize: '14px', color: '#ffffff' }}>Choose Your Own Emojis (Custom Tally)</b>
                    </button>
                  </div>

                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                    Type or paste any 4 emojis for your sessions
                  </span>
                </div>

                {/* 4 Custom Emoji Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', maxWidth: '340px', marginBottom: '14px' }}>
                  {[0, 1, 2, 3].map(idx => (
                    <div key={idx} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                        Session {idx + 1}
                      </div>
                      <input
                        type="text"
                        maxLength={4}
                        value={customEmojiDraft[idx] || ''}
                        onChange={e => {
                          const val = e.target.value.trim();
                          const next = [...customEmojiDraft];
                          next[idx] = val || (idx === 0 ? '🌰' : idx === 1 ? '🌱' : idx === 2 ? '🌿' : '🌳');
                          setCustomEmojiDraft(next);
                          updateSettingField('timer.customTallyEmojis', next);
                          updateSettingField('timer.tallyTheme', 'custom');
                        }}
                        style={{
                          textAlign: 'center',
                          fontSize: '20px',
                          height: '42px',
                          padding: '4px',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--line-2)',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Quick Inspirations */}
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '8px' }}>
                    Quick presets:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { name: 'Cats & Dogs', emojis: ['🐱', '🐶', '🦊', '🦁'] },
                      { name: 'Power Crown', emojis: ['💎', '🔥', '⚡', '👑'] },
                      { name: 'Floral Bloom', emojis: ['🌸', '🌺', '🌼', '🌻'] },
                      { name: 'Arcade Legend', emojis: ['🎮', '🕹️', '⚔️', '🏆'] },
                      { name: 'Foodie Party', emojis: ['🍕', '🍔', '🍟', '🍦'] },
                      { name: 'Cosmic Star', emojis: ['✨', '🌟', '🌙', '🪐'] },
                    ].map(preset => (
                      <button
                        type="button"
                        key={preset.name}
                        className="btn ghost"
                        style={{ fontSize: '12px', padding: '4px 10px', height: '30px' }}
                        onClick={() => {
                          setCustomEmojiDraft(preset.emojis);
                          updateSettingField('timer.customTallyEmojis', preset.emojis);
                          updateSettingField('timer.tallyTheme', 'custom');
                          onToast(`Applied ${preset.name} emojis!`);
                        }}
                      >
                        {preset.emojis.join(' ')} {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="section-actions">
            <button
              className="btn ghost"
              onClick={() => {
                updateSettingField('timer', clone(DEFAULTS.timer));
                onToast(t('restoreTimer', lang));
              }}
            >
              {t('restoreTimer', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ----- Stats Tab Render ----- */
  const renderStats = () => {
    const stats = computeStats(sessions, tasks, settings.timer.streakGoal);
    const weeks = heatSpan === '6m' ? 26 : 53;
    const heatCells = stats.generateHeatmap(weeks).map(cell => (
      <i
        key={cell.dateStr}
        className={cell.isFuture ? 'future' : (cell.level ? `l${cell.level}` : '')}
        title={cell.label}
      />
    ));

    const handleDeleteSession = (id: string) => {
      const next = sessions.filter(s => s.id !== id);
      onUpdateSessions(next);
      Store.saveSessions(next);
      sync.touch();
    };

    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('tabStats', lang)}</h1>
        <p className="sub-t">{t('statsSubtitle', lang)}</p>

        <div className="stat-cards">
          <div className="stat c1">
            <div className="s-top">
              {t('currentStreak', lang)} <Icon name="flameO" />
            </div>
            <div className="s-val">
              {stats.currentStreak} {stats.currentStreak === 1 ? t('streakDaySingle', lang) : t('streakDays', lang)}
            </div>
            <div className="s-foot">
              {t('bestStreak', lang)}: {stats.bestStreak} • {t('streakGoalNote', lang)} {settings.timer.streakGoal} min/d
            </div>
          </div>

          <div className="stat c2">
            <div className="s-top">
              {t('focusTime', lang)} <Icon name="bolt" />
            </div>
            <div className="s-val">{fmtDur(stats.totalFocusMs)}</div>
            <div className="s-foot">Total verified</div>
          </div>

          <div className="stat c3">
            <div className="s-top">
              {t('sessionsStat', lang)} <Icon name="stopwatch" />
            </div>
            <div className="s-val">{stats.completedFocusSessionsCount}</div>
            <div className="s-foot">
              + {stats.interruptedFocusSessionsCount} interrupted
            </div>
          </div>

          <div className="stat c4">
            <div className="s-top">
              {t('tasksCompleted', lang)} <Icon name="listcheck" />
            </div>
            <div className="s-val">{stats.completedTasksCount}</div>
            <div className="s-foot">Done in list</div>
          </div>

          <div className="stat c5">
            <div className="s-top">
              {t('breakTime', lang)} <Icon name="coffee" />
            </div>
            <div className="s-val">{fmtDur(stats.totalBreakMs)}</div>
            <div className="s-foot">Recharge time</div>
          </div>

          <div className="stat c6">
            <div className="s-top">
              {t('dailyAverage', lang)} <Icon name="gauge" />
            </div>
            <div className="s-val">
              {fmtDur(stats.dailyAverageFocusMs)}
            </div>
            <div className="s-foot">Per active day</div>
          </div>
        </div>

        {/* Focus Analytics Graph */}
        <FocusAnalyticsGraph sessions={sessions} settings={settings} lang={lang} />

        {/* Heatmap */}
        <div className="card">
          <h3>{t('focusCalendar', lang)}</h3>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              margin: '10px 0 14px',
            }}
          >
            <div className="seg" role="group" aria-label="Span">
              {(['6m', '1y'] as const).map(s => (
                <button
                  key={s}
                  aria-pressed={heatSpan === s}
                  onClick={() => setHeatSpan(s)}
                >
                  {{ '6m': '6 Months', '1y': '1 Year' }[s]}
                </button>
              ))}
            </div>
          </div>

          <div
            className="heat-wrap"
            role="img"
            aria-label="Focus heatmap"
          >
            <div className="heat">{heatCells}</div>
          </div>

          <div className="legend">
            <span>Past</span>
            <span className="scale">
              Less <i style={{ background: '#1a1a26' }} />
              <i style={{ background: '#3b2a6b' }} />
              <i style={{ background: '#5431a8' }} />
              <i style={{ background: '#7440e0' }} />
              <i style={{ background: '#a07bff' }} /> More
            </span>
            <span>Today</span>
          </div>
        </div>

        {/* Distribution by task */}
        <div className="card">
          <h3>{t('byTaskTitle', lang)}</h3>
          <p className="desc">{t('byTaskTitle', lang)}</p>
          {stats.taskDistribution.length > 0 ? (
            <div className="dist">
              {stats.taskDistribution.slice(0, 8).map(d => (
                <div key={d.id} className="dist-row">
                  <span className="n">{d.title}</span>
                  <span className="v">
                    {fmtDur(d.ms)} • {Math.round((d.ms / (stats.totalFocusMs || 1)) * 100 || 0)}%
                  </span>
                  <span className="b">
                    <i
                      style={{
                        width: `${Math.min(100, Math.round((d.ms / (stats.totalFocusMs || 1)) * 100))}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="desc">No tasks logged yet</p>
          )}
        </div>

        {/* Session history */}
        <div className="card">
          <h3>{t('historyTitle', lang)}</h3>
          {sessions.length > 0 ? (
            <>
              <ul className="hist">
                {sessions.slice(0, histLimit).map(s => {
                  const d = new Date(s.start);
                  const e = new Date(s.end);
                  return (
                    <li key={s.id}>
                      <div>
                        <div className="h-t">
                          {s.title || (s.kind === 'focus' ? t('phaseFocus', lang) : t('phaseShort', lang))}
                          <span className={`pill ${s.completed ? 'ok' : 'warn'}`}>
                            {s.completed ? 'Complete' : 'Interrupted'}
                          </span>
                        </div>
                        <div className="h-s">
                          {d.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { day: 'numeric', month: 'short' })} •{' '}
                          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="h-d">{fmtDur(s.ms)}</div>
                      <button
                        className="mini"
                        aria-label="Delete session"
                        onClick={() => handleDeleteSession(s.id)}
                      >
                        <Icon name="trash" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {sessions.length > histLimit && (
                <div className="section-actions" style={{ justifyContent: 'center' }}>
                  <button
                    className="btn ghost"
                    onClick={() => setHistLimit(prev => prev + 20)}
                  >
                    View more ({sessions.length - histLimit})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <strong>No sessions yet</strong>
              Start the timer in Focus mode to record progress.
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ----- Quotes Tab Render ----- */
  const renderQuotes = () => {
    const q = settings.quotes;
    const currentQuoteList = MULTILINGUAL_QUOTES[lang] || MULTILINGUAL_QUOTES.en;
    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('tabQuotes', lang)}</h1>
        <p className="sub-t">Calming wisdom and inspiring quotes in top right corner.</p>

        <div className="card">
          <div className="row center-y">
            <div className="txt">
              <b>Show quotes</b>
              <span>Corner stays free when disabled.</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={q.show}
              onClick={() => updateSettingField('quotes.show', !q.show)}
            />
          </div>

          <div className="field" style={{ marginTop: '6px' }}>
            <label htmlFor="qRot">Rotation</label>
            <select
              id="qRot"
              value={q.rotation}
              onChange={e => updateSettingField('quotes.rotation', e.target.value)}
            >
              <option value="daily">Daily quote</option>
              <option value="hourly">Hourly quote</option>
              <option value="visit">Every time I open</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h3>Custom Quote</h3>
          <p className="desc">If enabled, replaces curated quotes with your own motto.</p>
          <textarea
            maxLength={200}
            rows={3}
            placeholder="e.g. Max your focus, master your day."
            value={q.custom}
            onChange={e => updateSettingField('quotes.custom', e.target.value)}
          />

          <div className="row center-y">
            <div className="txt">
              <b>Use custom quote</b>
              <span>{q.custom.trim() ? '' : 'Type a quote above to activate.'}</span>
            </div>
            <button
              className="switch"
              role="switch"
              disabled={!q.custom.trim()}
              aria-checked={q.useCustom}
              onClick={() => updateSettingField('quotes.useCustom', !q.useCustom)}
            />
          </div>
        </div>

        <div className="card">
          <h3>Included Quotes ({lang.toUpperCase()})</h3>
          <p className="desc">{currentQuoteList.length} curated quotes in {lang === 'ta' ? 'Tamil' : lang === 'es' ? 'Spanish' : 'English'}.</p>
          <ul
            style={{
              margin: 0,
              paddingLeft: '18px',
              color: 'var(--muted)',
              columns: 2,
              columnGap: '28px',
              fontSize: '13.5px',
            }}
          >
            {currentQuoteList.map((x, i) => (
              <li key={i} style={{ marginBottom: '6px' }}>
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  /* ----- Extras & Rebrand Tab Render ----- */
  const renderExtras = () => {
    const isFsActive = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    const toggleFs = async () => {
      try {
        if (isFsActive) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else if ((document as any).webkitExitFullscreen)
            await (document as any).webkitExitFullscreen();
        } else {
          if (document.documentElement.requestFullscreen)
            await document.documentElement.requestFullscreen();
          else if ((document as any).webkitRequestFullscreen)
            await (document as any).webkitRequestFullscreen();
        }
      } catch {
        onToast('Fullscreen not allowed here.', 'err');
      }
    };

    return (
      <div className="content-inner">
        <h1 id="setTitle">{t('tabExtras', lang)}</h1>
        <p className="sub-t">{t('extrasSubtitle', lang)}</p>

        {/* Rebranding & Credits Card */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, var(--accent-soft), rgba(255, 255, 255, 0.02))',
            borderColor: 'var(--accent-border)',
            boxShadow: '0 8px 24px -8px var(--accent-glow)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <PeakusMountainLogo size={42} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Peakus</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--accent-text)', fontWeight: 600 }}>
                max your focus
              </p>
            </div>
          </div>

          <p className="desc" style={{ marginTop: '10px', marginBottom: '14px', color: 'var(--text)' }}>
            {t('creditsDesc', lang)}{' '}
            <strong style={{ color: 'var(--accent-text)' }}>human.exr</strong>
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href="https://www.instagram.com/human.exr"
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="external" /> Instagram: @human.exr
            </a>
          </div>
        </div>

        <div className="card">
          <div className="row center-y">
            <div className="txt">
              <b>{t('autoHideTitle', lang)}</b>
              <span>{t('autoHideDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={settings.appearance.autoHide}
              onClick={() =>
                updateSettingField('appearance.autoHide', !settings.appearance.autoHide)
              }
            />
          </div>

          {settings.appearance.autoHide && (
            <div className="slider-row">
              <label>{t('autoHideDelay', lang)}</label>
              <input
                type="range"
                min="2"
                max="60"
                value={settings.appearance.autoHideDelay}
                style={
                  {
                    '--p': `${((settings.appearance.autoHideDelay - 2) / 58) * 100}%`,
                  } as any
                }
                onChange={e =>
                  updateSettingField('appearance.autoHideDelay', Number(e.target.value))
                }
              />
              <output>{settings.appearance.autoHideDelay} s</output>
            </div>
          )}

          <div className="row center-y">
            <div className="txt">
              <b>{t('showLogoTitle', lang)}</b>
              <span>{t('showLogoDesc', lang)}</span>
            </div>
            <button
              className="switch"
              role="switch"
              aria-checked={settings.appearance.showLogo}
              onClick={() =>
                updateSettingField('appearance.showLogo', !settings.appearance.showLogo)
              }
            />
          </div>
        </div>

        <div className="card">
          <h3>{t('fullscreen', lang)}</h3>
          <button className="btn" onClick={toggleFs}>
            <Icon name="expand" /> {isFsActive ? t('exitFullscreen', lang) : t('fullscreen', lang)}
          </button>
        </div>

        <div className="card">
          <h3>{t('shortcutsTitle', lang)}</h3>
          <div className="kbd-list">
            <kbd>Space</kbd>
            <span>Start / Pause timer</span>
            <kbd>R</kbd>
            <span>Reset current interval</span>
            <kbd>N</kbd>
            <span>Skip to next interval</span>
            <kbd>1</kbd>
            <span>Home mode</span>
            <kbd>2</kbd>
            <span>Focus mode</span>
            <kbd>3</kbd>
            <span>Ambient mode</span>
            <kbd>T</kbd>
            <span>Toggle Tasks</span>
            <kbd>M</kbd>
            <span>Toggle Ambient Sounds</span>
            <kbd>F</kbd>
            <span>Toggle Fullscreen</span>
            <kbd>,</kbd>
            <span>Open Settings</span>
            <kbd>Esc</kbd>
            <span>Close panels</span>
          </div>
        </div>
      </div>
    );
  };

  /* ----- Cloud Sync Tab Render ----- */
  const renderCloud = () => {
    return (
      <div className="content-inner">
        <h1 id="setTitle">Cloud Account</h1>
        <p className="sub-t">
          Automatic background sync for your stats, tasks, saved links, and preferences.
        </p>
        <CloudAccountSection
          settings={settings}
          timerState={
            timerState || {
              status: 'idle',
              phase: 'focus',
              remainingMs: 0,
              durationMs: 0,
              cycle: 0,
              startedAt: null,
              sessionStartedAt: null,
              interrupted: false,
            }
          }
          onToast={onToast}
          lang={lang}
        />
      </div>
    );
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setTitle"
      >
        <nav className="side" aria-label="Settings navigation">
          <button
            className="x-btn"
            aria-label="Close settings"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
          {NAV_ITEMS.map(([key, label, iconName]) => (
            <button
              key={key}
              className="nav-btn"
              data-nav={key}
              aria-current={section === key ? 'page' : false}
              onClick={() => setSection(key)}
            >
              <Icon name={iconName} /> {label}
            </button>
          ))}
          <div className="side-note" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PeakusMountainLogo size={28} />
            <div>
              <b>Peakus</b> — max your focus
              <br />
              <span style={{ fontSize: '11px', color: 'var(--accent-text)' }}>Credits: human.exr</span>
            </div>
          </div>
        </nav>

        <div className="content">
          {section === 'themes' && renderThemes()}
          {section === 'clock' && renderClock()}
          {section === 'timer' && renderTimer()}
          {section === 'stats' && renderStats()}
          {section === 'quotes' && renderQuotes()}
          {section === 'language' && renderLanguage()}
          {section === 'music' && renderMusic()}
          {section === 'cloud' && renderCloud()}
          {section === 'extras' && renderExtras()}
        </div>
      </div>
    </>
  );
};
