import React, { useState, useEffect } from 'react';
import { Icon, FlameIcon } from './Icons';
import type { Settings, ModeKey, TimerPhase, Task, TimerStatus } from '../types';
import { fmtClock, dayKey, hashStr } from '../lib/utils';
import { t, MULTILINGUAL_QUOTES } from '../lib/i18n';
import { AmbientTimer } from './AmbientTimer';
import type { PomodoroPreset } from '../lib/presets';
import { APP_LOGO_SRC } from '../lib/branding';
import { resolveTallyEmojis } from '../lib/tallyThemes';

interface StageProps {
  settings: Settings;
  onUpdateSettings: (s: Settings, path?: string) => void;
  activeTask?: Task;
  onRenameTask?: (id: string, newTitle: string) => void;
  timerState: {
    status: TimerStatus;
    phase: TimerPhase;
    remainingMs: number;
    durationMs: number;
    cycle: number;
  };
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onSkipTimer: () => void;
  onSetPhase: (p: TimerPhase) => void;
  onOpenTasks: () => void;
  onOpenSounds: () => void;
  onOpenNotes: () => void;
  onOpenMusic: () => void;
  onOpenSettings: () => void;
  tasksOpen: boolean;
  soundsOpen: boolean;
  notesOpen: boolean;
  musicOpen: boolean;
  settingsOpen: boolean;
  streakCount: number;
  zenMode: boolean;
  onToggleZen: () => void;
  presets?: PomodoroPreset[];
  onSelectPreset?: (preset: PomodoroPreset) => void;
  flowMode?: boolean;
  onToggleFlowMode?: () => void;
  onResetSegments?: () => void;
  roomOpen?: boolean;
  onOpenRoom?: () => void;
  currentRoomCode?: string | null;
}

export const Stage: React.FC<StageProps> = ({
  settings,
  onUpdateSettings,
  activeTask,
  onRenameTask,
  timerState,
  onToggleTimer,
  onResetTimer,
  onSkipTimer,
  onSetPhase,
  onOpenTasks,
  onOpenSounds,
  onOpenNotes,
  onOpenMusic,
  onOpenSettings,
  tasksOpen,
  soundsOpen,
  notesOpen,
  musicOpen,
  settingsOpen,
  streakCount,
  zenMode,
  onToggleZen,
  presets = [],
  onSelectPreset,
  flowMode = false,
  onToggleFlowMode,
  onResetSegments,
  roomOpen = false,
  onOpenRoom,
  currentRoomCode = null,
}) => {
  const [now, setNow] = useState(new Date());
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [isFs, setIsFs] = useState(false);

  const lang = settings.language || 'en';

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const updateFs = () => {
      setIsFs(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', updateFs);
    document.addEventListener('webkitfullscreenchange', updateFs);
    return () => {
      document.removeEventListener('fullscreenchange', updateFs);
      document.removeEventListener('webkitfullscreenchange', updateFs);
    };
  }, []);

  const mode = settings.mode;
  const pomo = settings.timer.mode === 'pomodoro';

  // Format time parts
  const getTimeParts = (d: Date) => {
    const c = settings.clock;
    let h = d.getHours();
    const m = d.getMinutes();
    let ampm = '';
    if (c.format === '12') {
      ampm = h < 12 ? 'AM' : 'PM';
      h = h % 12 || 12;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      main: (c.format === '24' ? pad(h) : String(h)) + ':' + pad(m),
      secs: c.seconds ? pad(d.getSeconds()) : '',
      ampm,
    };
  };

  // Greeting in current language
  const getGreeting = (d: Date) => {
    const s = settings;
    const name = s.name.trim();
    const n = name ? `, ${name}` : '';
    const h = d.getHours();

    if (lang === 'ta') {
      const base =
        h < 5
          ? `இனிய இரவு${n}`
          : h < 12
          ? `காலை வணக்கம்${n}`
          : h < 18
          ? `மதிய வணக்கம்${n}`
          : `மாலை வணக்கம்${n}`;
      if (!s.clock.dynamicGreetings) return base;
      const opts = [
        `இன்றைய நாள் உங்கள் வசம்${n}!`,
        `${base}`,
        `இன்று புதிய சாதனைகளை படைப்போம்${n}`,
        h < 12 ? `இனிய காலைப் பொழுது${n}` : `கவனத்துடன் தொடருங்கள்${n}`,
        `தொடங்குவோமா${n}?`,
        `சிறு சிறு அடிகளே பெரு வெற்றி${n}`,
      ];
      return opts[hashStr(dayKey(d.getTime()) + ':' + Math.floor(h / 3)) % opts.length];
    }

    if (lang === 'es') {
      const base =
        h < 5
          ? `Buenas noches${n}`
          : h < 13
          ? `Buen día${n}`
          : h < 20
          ? `Buenas tardes${n}`
          : `Buenas noches${n}`;
      if (!s.clock.dynamicGreetings) return base;
      const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const day = days[d.getDay()];
      const opts = [
        `¡El ${day} está de tu lado${n}!`,
        `${base}`,
        `Hoy es un buen día para avanzar${n}`,
        h < 12 ? `Que tengas una linda mañana${n}` : `Que rinda la tarde${n}`,
        `¿Arrancamos${n}?`,
        `Paso a paso se llega lejos${n}`,
      ];
      return opts[hashStr(dayKey(d.getTime()) + ':' + Math.floor(h / 3)) % opts.length];
    }

    // Default English
    const base =
      h < 5
        ? `Good night${n}`
        : h < 12
        ? `Good morning${n}`
        : h < 18
        ? `Good afternoon${n}`
        : `Good evening${n}`;
    if (!s.clock.dynamicGreetings) return base;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[d.getDay()];
    const opts = [
      `Make this ${day} count${n}!`,
      `${base}`,
      `Ready to lock in and focus${n}?`,
      h < 12 ? `Have a productive morning${n}` : `Keep the momentum going${n}`,
      `One goal at a time${n}`,
      `Small steps lead to great achievements${n}`,
    ];
    return opts[hashStr(dayKey(d.getTime()) + ':' + Math.floor(h / 3)) % opts.length];
  };

  // Date line formatted for selected language
  const getDateLine = (d: Date) => {
    const locale = lang === 'ta' ? 'ta-IN' : lang === 'es' ? 'es-AR' : 'en-US';
    const s = d.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  // Quote based on selected language
  const getQuote = () => {
    const q = settings.quotes;
    if (q.useCustom && q.custom.trim()) return q.custom.trim();
    const quoteList = MULTILINGUAL_QUOTES[lang] || MULTILINGUAL_QUOTES.en;
    const d = now;
    let i: number;
    if (q.rotation === 'hourly') {
      i = hashStr(dayKey(d.getTime()) + d.getHours()) % quoteList.length;
    } else {
      i = hashStr(dayKey(d.getTime())) % quoteList.length;
    }
    return quoteList[i];
  };

  // Activity Label
  const getActivityLabel = () => {
    if (timerState.phase !== 'focus') {
      return timerState.phase === 'short' ? t('phaseShort', lang) : t('phaseLong', lang);
    }
    return activeTask ? activeTask.title : settings.timer.label || t('phaseFocus', lang);
  };

  const handleLabelCommit = () => {
    setIsEditingLabel(false);
    const val = customLabel.trim();
    if (!val) return;
    if (activeTask && onRenameTask) {
      onRenameTask(activeTask.id, val);
    } else {
      const nextSettings = {
        ...settings,
        timer: { ...settings.timer, label: val },
      };
      onUpdateSettings(nextSettings, 'timer.label');
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (isFs) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen)
          await (document as any).webkitExitFullscreen();
      } else {
        if (document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
        else if ((document as any).webkitRequestFullscreen)
          await (document as any).webkitRequestFullscreen();
      }
    } catch {}
  };

  const tp = getTimeParts(now);
  const timeRemainingStr = fmtClock(timerState.remainingMs);
  const progressRatio =
    timerState.durationMs > 0
      ? Math.max(0, Math.min(1, 1 - timerState.remainingMs / timerState.durationMs))
      : 0;

  // Render flip or standard digits
  const renderDigits = (timeStr: string, flip = false) => {
    return (
      <>
        {Array.from(timeStr).map((ch, idx) => {
          if (ch === ':') {
            return (
              <span key={`col-${idx}`} className="c">
                :
              </span>
            );
          }
          return (
            <span key={`d-${idx}`} className={`d ${flip ? 'flipping' : ''}`}>
              <span>{ch}</span>
            </span>
          );
        })}
      </>
    );
  };

  return (
    <main className="stage" id="stage">
      {/* Top Right Minimalist Zen Mode Button (Zero Distraction) */}
      <button
        type="button"
        className={`zen-top-btn ${zenMode ? 'zen-active' : ''}`}
        id="btnZenTop"
        aria-label={zenMode ? t('exitZen', lang) : t('zenMode', lang)}
        title={zenMode ? t('exitZen', lang) : t('zenMode', lang)}
        onClick={onToggleZen}
      >
        <Icon name="zen" />
        {zenMode && <span className="zen-btn-indicator" />}
      </button>

      {/* Top Left Logo & Rebranding Tagline */}
      {settings.appearance.showLogo && !zenMode && (
        <div
          className="logo fadeable"
          id="logo"
          aria-hidden="true"
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <img
            src={APP_LOGO_SRC}
            alt="Peakus Logo"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              objectFit: 'cover',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5), 0 0 14px rgba(124, 58, 237, 0.35)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: 800, letterSpacing: '-0.04em' }}>Peakus</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.72)',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                marginTop: '-2px',
              }}
            >
              {t('tagline', lang)}
            </span>
          </div>
        </div>
      )}

      {/* Top Right Quote */}
      {settings.quotes.show && mode !== 'ambient' && !zenMode && (
        <p className="quote fadeable" id="quote">
          “{getQuote()}”
        </p>
      )}

      {/* Ambient Movable / Corner Timer */}
      {mode === 'ambient' && (
        <AmbientTimer
          timerState={timerState}
          onToggleTimer={onToggleTimer}
          onResetTimer={onResetTimer}
          onSkipTimer={onSkipTimer}
          lang={lang}
          settings={settings}
          zenMode={zenMode}
        />
      )}

      {/* Center Section */}
      <section
        className="center"
        id="center"
        data-mode={mode}
        aria-label="Clock and timer"
      >
        {mode === 'home' && (
          <>
            {settings.clock.greetings && (
              <div id="labelWrap">
                <h1 className="label" id="label">
                  {getGreeting(now)}
                </h1>
              </div>
            )}
            <div id="clockWrap">
              <div
                className={`clock style-${settings.clock.style} ${
                  settings.clock.flip ? 'flip' : ''
                }`}
                aria-label={`Time ${tp.main}`}
              >
                {renderDigits(tp.main, settings.clock.flip)}
                {tp.secs && (
                  <span className="secs">
                    {renderDigits(tp.secs, settings.clock.flip)}
                  </span>
                )}
                {tp.ampm && settings.clock.format === '12' && (
                  <span className="ampm">{tp.ampm}</span>
                )}
              </div>
            </div>
            {settings.clock.date && (
              <div className="date-line" id="dateLine">
                {getDateLine(now)}
              </div>
            )}
          </>
        )}

        {mode === 'focus' && (
          <>

            {/* Phase Switch (Pomodoro) */}
            {pomo && timerState.status !== 'running' && !zenMode && (
              <div
                className="phase-switch fadeable"
                id="phaseSwitch"
                role="group"
                aria-label="Timer phase"
              >
                <button
                  aria-pressed={timerState.phase === 'focus'}
                  onClick={() => onSetPhase('focus')}
                >
                  {t('phaseFocus', lang)}
                </button>
                <button
                  aria-pressed={timerState.phase === 'short'}
                  onClick={() => onSetPhase('short')}
                >
                  {t('phaseShort', lang)}
                </button>
                <button
                  aria-pressed={timerState.phase === 'long'}
                  onClick={() => onSetPhase('long')}
                >
                  {t('phaseLong', lang)}
                </button>
              </div>
            )}

            {/* Activity Label */}
            {!zenMode && (
              <div id="labelWrap">
                {isEditingLabel ? (
                  <input
                    className="label-input"
                    autoFocus
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    onBlur={handleLabelCommit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleLabelCommit();
                      if (e.key === 'Escape') setIsEditingLabel(false);
                    }}
                  />
                ) : timerState.phase === 'focus' ? (
                  <button
                    className="label"
                    title="Click to edit activity title"
                    onClick={() => {
                      setCustomLabel(getActivityLabel());
                      setIsEditingLabel(true);
                    }}
                  >
                    {getActivityLabel()}
                  </button>
                ) : (
                  <h1 className="label">{getActivityLabel()}</h1>
                )}
              </div>
            )}

            {/* Session Tallies (Emojis / Dots / Numbers) */}
            {pomo && settings.timer.tallies !== 'none' && !zenMode && (() => {
              const totalCycles = Math.max(1, settings.timer.cycles || 4);
              const completedInCycle = timerState.phase === 'long' 
                ? totalCycles 
                : (timerState.cycle % totalCycles);
              const isEmoji = settings.timer.tallies === 'emoji';
              const emojis = isEmoji
                ? resolveTallyEmojis(settings.timer.tallyTheme, settings.timer.customTallyEmojis, totalCycles)
                : [];

              return (
                <div
                  className={`tallies fadeable ${isEmoji ? 'tallies-emoji' : ''}`}
                  id="tallies"
                  role="button"
                  tabIndex={0}
                  onClick={onResetSegments}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') onResetSegments?.();
                  }}
                  title={
                    lang === 'es'
                      ? `Segmentos: ${completedInCycle}/${totalCycles}. Clic para reiniciar.`
                      : lang === 'ta'
                      ? `சுற்றுகள்: ${completedInCycle}/${totalCycles}. மீட்டமைக்க கிளிக் செய்யவும்.`
                      : `Segments: ${completedInCycle}/${totalCycles}. Click to reset.`
                  }
                  style={{ cursor: 'pointer' }}
                >
                  {isEmoji ? (
                    <div className="tally-emoji-row">
                      {emojis.map((emoji, i) => {
                        const isDone = i < completedInCycle;
                        const isCurrent = i === completedInCycle && timerState.status === 'running';
                        return (
                          <span
                            key={i}
                            className={`tally-emoji-item ${isDone ? 'done' : isCurrent ? 'current' : 'pending'}`}
                            title={`Session ${i + 1} of ${totalCycles}`}
                          >
                            <span className="tally-emoji-glyph">{emoji}</span>
                            <span className="tally-emoji-dot" />
                          </span>
                        );
                      })}
                    </div>
                  ) : settings.timer.tallies === 'dots' ? (
                    Array.from({ length: totalCycles }, (_, i) => (
                      <i
                        key={i}
                        className={i < completedInCycle ? 'on' : ''}
                      />
                    ))
                  ) : (
                    <span className="tally-numbers">
                      {completedInCycle}/{totalCycles}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Visual Timer Display */}
            <div id="clockWrap">
              {settings.timer.style === 'default' && (
                <div
                  className={`clock style-${settings.clock.style}`}
                  aria-label={`Time remaining: ${timeRemainingStr}`}
                >
                  {renderDigits(timeRemainingStr, false)}
                </div>
              )}

              {settings.timer.style === 'flip' && (
                <div
                  className={`clock style-${settings.clock.style} flip`}
                  aria-label={`Time remaining: ${timeRemainingStr}`}
                >
                  {renderDigits(timeRemainingStr, true)}
                </div>
              )}

              {settings.timer.style === 'bar' && (
                <div className="timer-visual">
                  <div className={`clock style-${settings.clock.style}`}>
                    {timeRemainingStr}
                  </div>
                  <div className="tv-bar">
                    <i style={{ width: `${progressRatio * 100}%` }} />
                  </div>
                </div>
              )}

              {settings.timer.style === 'gauge' && (
                <div className="timer-visual">
                  <svg className="tv-ring" viewBox="0 0 100 100">
                    <circle
                      className="trk"
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      strokeWidth="8"
                    />
                    <circle
                      className="val"
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      strokeWidth="8"
                      strokeDasharray={264}
                      strokeDashoffset={264 * (1 - progressRatio)}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className={`clock style-${settings.clock.style} small`}>
                    {timeRemainingStr}
                  </div>
                </div>
              )}

              {settings.timer.style === 'dots' && (
                <div className="timer-visual">
                  <div className="tv-dots">
                    {Array.from({ length: 24 }, (_, i) => {
                      const on = i < Math.round(progressRatio * 24);
                      return <i key={i} className={on ? '' : 'off'} />;
                    })}
                  </div>
                  <div className={`clock style-${settings.clock.style} small`}>
                    {timeRemainingStr}
                  </div>
                </div>
              )}

              {settings.timer.style === 'pie' && (
                <div className="timer-visual">
                  <svg className="tv-pie" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,.2)" />
                    <circle
                      cx="50"
                      cy="50"
                      r="23"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="46"
                      strokeDasharray={145}
                      strokeDashoffset={145 * (1 - progressRatio)}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className={`clock style-${settings.clock.style} small`}>
                    {timeRemainingStr}
                  </div>
                </div>
              )}
            </div>

            {/* Optional Progress Bar */}
            {settings.timer.progressBar && (
              <div className="timer-progress" aria-hidden="true">
                <i style={{ width: `${progressRatio * 100}%` }} />
              </div>
            )}

            {/* Controls */}
            <div className="controls fadeable" id="controls">
              <button
                className="ctl primary"
                id="btnToggle"
                aria-label={
                  timerState.status === 'running'
                    ? t('pause', lang)
                    : timerState.status === 'paused'
                    ? t('resume', lang)
                    : t('start', lang)
                }
                title={
                  (timerState.status === 'running'
                    ? t('pause', lang)
                    : timerState.status === 'paused'
                    ? t('resume', lang)
                    : t('start', lang)) + ' (Space)'
                }
                onClick={onToggleTimer}
              >
                <Icon name={timerState.status === 'running' ? 'pause' : 'play'} />
              </button>
              <button
                className="ctl"
                id="btnReset"
                aria-label={t('reset', lang)}
                title={`${t('reset', lang)} (R)`}
                onClick={onResetTimer}
              >
                <Icon name="reset" />
              </button>
              <button
                className="ctl"
                id="btnSkip"
                aria-label={t('skip', lang)}
                title={
                  timerState.phase === 'focus'
                    ? pomo
                      ? t('skipToBreak', lang)
                      : t('finish', lang)
                    : t('skipToFocus', lang)
                }
                onClick={onSkipTimer}
              >
                <Icon name="skip" />
              </button>
              {pomo && (
                <button
                  className="ctl"
                  id="btnResetSegments"
                  aria-label={lang === 'es' ? 'Restablecer segmentos' : lang === 'ta' ? 'சுற்று மீட்டமை' : 'Reset segments'}
                  title={`${lang === 'es' ? 'Restablecer segmentos' : lang === 'ta' ? 'சுற்று மீட்டமை' : 'Reset segments'} (0/${settings.timer.cycles})`}
                  onClick={onResetSegments}
                >
                  <Icon name="dotsReset" />
                </button>
              )}
            </div>
          </>
        )}
      </section>


      {/* Corner Left Navigation (Hidden in Zen Mode) */}
      {!zenMode && (
        <nav className="corner left fadeable" aria-label="Tools">
          <button
            className={`ib has-tip ${tasksOpen ? 'active' : ''}`}
            id="btnTasks"
            aria-label={t('tasks', lang)}
            aria-expanded={tasksOpen}
            onClick={onOpenTasks}
          >
            <Icon name="tasks" />
            <span className="tip">{t('tasks', lang)} (T)</span>
          </button>

          <button
            className={`ib has-tip ${soundsOpen ? 'active' : ''}`}
            id="btnSounds"
            aria-label={t('sounds', lang)}
            aria-expanded={soundsOpen}
            onClick={onOpenSounds}
          >
            <Icon name="music" />
            <span className="tip">{t('sounds', lang)} (M)</span>
          </button>

          <button
            className={`ib has-tip ${notesOpen ? 'active' : ''}`}
            id="btnNotes"
            aria-label={t('notes', lang)}
            aria-expanded={notesOpen}
            onClick={onOpenNotes}
          >
            <Icon name="pencil" />
            <span className="tip">{t('notes', lang)}</span>
          </button>

          {/* YouTube Music Stream Player Button */}
          <button
            className={`ib has-tip ${musicOpen ? 'active' : ''} ${settings.music?.playing ? 'playing' : ''}`}
            id="btnMusic"
            aria-label={t('music', lang)}
            aria-expanded={musicOpen}
            onClick={onOpenMusic}
          >
            <Icon name="headphones" />
            {settings.music?.playing && (
              <span
                style={{
                  position: 'absolute',
                  top: '7px',
                  right: '7px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#34d399',
                  boxShadow: '0 0 6px #34d399',
                }}
              />
            )}
            <span className="tip">{t('music', lang)}</span>
          </button>

          {/* Study with Friends / Room Button (ALPHA) */}
          <button
            className={`ib has-tip ${roomOpen ? 'active' : ''}`}
            id="btnStudyRoom"
            aria-label="[ALPHA] Focus with Friends"
            aria-expanded={roomOpen}
            onClick={onOpenRoom}
            style={{
              position: 'relative',
              ...(currentRoomCode
                ? {
                    borderColor: 'var(--accent)',
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }
                : {}),
            }}
          >
            <Icon name="users" />
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-3px',
                fontSize: '8px',
                fontWeight: 800,
                padding: '1px 3px',
                borderRadius: '4px',
                backgroundColor: '#f59e0b',
                color: '#000000',
                letterSpacing: '0.04em',
                lineHeight: 1,
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              ALPHA
            </span>
            {currentRoomCode && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '5px',
                  right: '5px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
            )}
            <span className="tip">
              {currentRoomCode
                ? `[ALPHA] Room: ${currentRoomCode}`
                : '[ALPHA] Focus with Friends (Experimental)'}
            </span>
          </button>
        </nav>
      )}

      {/* Corner Right Navigation (Hidden in Zen Mode) */}
      {!zenMode && (
        <nav className="corner right fadeable" aria-label="Modes and settings">
          {settings.timer.showStreak && (
            <button className="streak has-tip" id="streak">
              <span id="streakIc">
                <FlameIcon />
              </span>
              <span id="streakN">{streakCount}</span>
              <span className="tip">
                {t('streak', lang)}: {streakCount}{' '}
                {streakCount === 1 ? t('streakDaySingle', lang) : t('streakDays', lang)} (
                {t('streakGoalNote', lang)} {settings.timer.streakGoal} min/
                {t('streakDaySingle', lang)})
              </span>
            </button>
          )}

          <div className="modes" role="group" aria-label="Mode">
            <button
              className="has-tip"
              data-mode="ambient"
              aria-label={t('modeAmbient', lang)}
              aria-pressed={mode === 'ambient'}
              onClick={() => {
                const next = { ...settings, mode: 'ambient' as ModeKey };
                onUpdateSettings(next, 'mode');
              }}
            >
              <Icon name="cloud" />
              <span className="tip">{t('modeAmbient', lang)} (3)</span>
            </button>

            <button
              className="has-tip"
              data-mode="home"
              aria-label={t('modeHome', lang)}
              aria-pressed={mode === 'home'}
              onClick={() => {
                const next = { ...settings, mode: 'home' as ModeKey };
                onUpdateSettings(next, 'mode');
              }}
            >
              <Icon name="home" />
              <span className="tip">{t('modeHome', lang)} (1)</span>
            </button>

            <button
              className="has-tip"
              data-mode="focus"
              aria-label={t('modeFocus', lang)}
              aria-pressed={mode === 'focus'}
              onClick={() => {
                const next = { ...settings, mode: 'focus' as ModeKey };
                onUpdateSettings(next, 'mode');
              }}
            >
              <Icon name="bulb" />
              <span className="tip">{t('modeFocus', lang)} (2)</span>
            </button>
          </div>

          <button
            className={`ib has-tip ${settingsOpen ? 'active' : ''}`}
            id="btnSettings"
            aria-label={t('settings', lang)}
            aria-expanded={settingsOpen}
            onClick={onOpenSettings}
          >
            <Icon name="gear" />
            <span className="tip">{t('settings', lang)} (,)</span>
          </button>

          <button
            className="ib has-tip"
            id="btnFs"
            aria-label={isFs ? t('exitFullscreen', lang) : t('fullscreen', lang)}
            onClick={toggleFullscreen}
          >
            <Icon name={isFs ? 'compress' : 'expand'} />
            <span className="tip">
              {isFs ? t('exitFullscreen', lang) : t('fullscreen', lang)} (F)
            </span>
          </button>
        </nav>
      )}
    </main>
  );
};
