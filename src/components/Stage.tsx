import React, { useState, useEffect, useRef } from 'react';
import { Icon, FlameIcon } from './Icons';
import type { Settings, ModeKey, TimerPhase, Task, TimerStatus } from '../types';
import { fmtClock, dayKey, hashStr } from '../lib/utils';
import { t } from '../lib/i18n';
import { selectStageQuote } from '../lib/toxicQuotes';
import { AmbientTimer } from './AmbientTimer';
import type { PomodoroPreset } from '../lib/presets';
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
  onOpenThemes?: () => void;
  tasksOpen: boolean;
  soundsOpen: boolean;
  notesOpen: boolean;
  musicOpen: boolean;
  settingsOpen: boolean;
  streakCount: number;
  streakGoalMet?: boolean;
  todayFocusMs?: number;
  todayGoalMs?: number;
  onOpenStats?: () => void;
  zenMode: boolean;
  onToggleZen: () => void;
  presets?: PomodoroPreset[];
  onSelectPreset?: (preset: PomodoroPreset) => void;
  flowMode?: boolean;
  onToggleFlowMode?: () => void;
  onResetSegments?: () => void;
  currentRoomCode?: string | null;
  studyBotOpen?: boolean;
  onOpenStudyBot?: () => void;
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
  onOpenThemes,
  tasksOpen,
  soundsOpen,
  notesOpen,
  musicOpen,
  settingsOpen,
  streakCount,
  streakGoalMet = false,
  todayFocusMs = 0,
  todayGoalMs = 25 * 60000,
  onOpenStats,
  zenMode,
  onToggleZen,
  onResetSegments,
  studyBotOpen = false,
  onOpenStudyBot,
}) => {
  const [now, setNow] = useState(new Date());
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [isFs, setIsFs] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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

  // Close mobile "more" drawer on outside tap
  useEffect(() => {
    if (!mobileMoreOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMobileMoreOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [mobileMoreOpen]);

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

  const [visitSeed] = useState(() => Math.floor(Math.random() * 10000));

  // Quote based on selected language and Toxic Motivation toggle
  const getQuote = () => selectStageQuote(settings.quotes, lang, now, visitSeed);

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

  const primaryCtaLabel =
    timerState.status === 'running'
      ? t('pause', lang)
      : timerState.status === 'paused'
      ? t('resume', lang)
      : t('start', lang);

  const showSkipBtn =
    timerState.status === 'running' ||
    timerState.status === 'paused' ||
    timerState.phase !== 'focus';

  const todayMins = Math.round(todayFocusMs / 60000);
  const goalMins = Math.max(1, Math.round(todayGoalMs / 60000));
  const showClockStreakIndicator =
    streakGoalMet && settings.timer.showStreak && !zenMode;
  const animDisabled = settings.appearance.animation === 'off';

  const renderClockStreakIndicator = () => {
    if (!showClockStreakIndicator) return null;
    const goalMetLabel =
      lang === 'es'
        ? 'Meta lograda'
        : lang === 'ta'
        ? 'இலக்கு நிறைவு'
        : 'Goal met';
    const dayWord =
      streakCount === 1 ? t('streakDaySingle', lang) : t('streakDays', lang);
    const fullAria = `${t('streak', lang)}: ${streakCount} ${dayWord} — ${goalMetLabel} (${todayMins}m / ${goalMins}m)`;
    return (
      <button
        type="button"
        id="clockStreakBadge"
        className={`clock-streak-badge has-tip ${animDisabled ? 'no-anim' : ''}`}
        onClick={onOpenStats || onOpenSettings}
        aria-label={fullAria}
      >
        <span className="csb-halo" aria-hidden="true" />
        <span className="csb-flame" aria-hidden="true">
          <FlameIcon />
        </span>
        <span className="csb-meta">
          <span className="csb-count">{streakCount}</span>
          <span className="csb-tag">{goalMetLabel}</span>
        </span>
        <span className="tip">
          {goalMetLabel} ({todayMins}m / {goalMins}m)
        </span>
      </button>
    );
  };

  return (
    <main className="stage" id="stage">
      {/* Top Left Brand Wordmark — typographic PEAKUS.COM only */}
      {settings.appearance.showLogo && !zenMode && (
        <div className="logo fadeable" id="logo" aria-hidden="true">
          <span className="logo-wordmark">
            PEAKUS<span className="logo-tld">.COM</span>
          </span>
        </div>
      )}

      {/* Top Right Quote */}
      {settings.quotes.show && mode !== 'ambient' && !zenMode && (
        <p
          className={`quote fadeable ${settings.quotes.toxicMotivation ? 'toxic' : ''}`.trim()}
          id="quote"
        >
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
              {renderClockStreakIndicator()}
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

            {/* Phase Switch (Pomodoro) — kept stable in layout to prevent vertical jumps */}
            {pomo && !zenMode && (
              <div
                className={`phase-switch fadeable ${timerState.status === 'running' ? 'is-running' : ''}`}
                id="phaseSwitch"
                role="group"
                aria-label="Timer phase"
              >
                <button
                  type="button"
                  aria-pressed={timerState.phase === 'focus'}
                  onClick={() => onSetPhase('focus')}
                >
                  {t('phaseFocus', lang)}
                </button>
                <button
                  type="button"
                  aria-pressed={timerState.phase === 'short'}
                  onClick={() => onSetPhase('short')}
                >
                  {t('phaseShort', lang)}
                </button>
                <button
                  type="button"
                  aria-pressed={timerState.phase === 'long'}
                  onClick={() => onSetPhase('long')}
                >
                  {t('phaseLong', lang)}
                </button>
              </div>
            )}

            {/* Session Tallies (Clean unboxed emojis / dots / numbers) */}
            {pomo && settings.timer.tallies !== 'none' && !zenMode && (() => {
              const totalCycles = Math.max(1, settings.timer.cycles || 4);
              const completedInCycle = Math.min(totalCycles, Math.max(0, timerState.cycle));
              const isEmoji = settings.timer.tallies === 'emoji';
              const emojis = isEmoji
                ? resolveTallyEmojis(settings.timer.tallyTheme, settings.timer.customTallyEmojis, totalCycles)
                : [];

              return (
                <button
                  type="button"
                  className={`tallies fadeable ${isEmoji ? 'tallies-emoji' : ''}`}
                  id="tallies"
                  onClick={onResetSegments || onResetTimer}
                  title={
                    lang === 'es'
                      ? `Segmentos: ${completedInCycle}/${totalCycles}. Clic para reiniciar.`
                      : lang === 'ta'
                      ? `சுற்றுகள்: ${completedInCycle}/${totalCycles}. மீட்டமைக்க கிளிக் செய்யவும்.`
                      : `Segments: ${completedInCycle}/${totalCycles}. Click to reset.`
                  }
                >
                  {isEmoji ? (
                    <span className="tally-emoji-row">
                      {emojis.map((emoji, i) => {
                        const isDone = i < completedInCycle;
                        const isCurrent = i === completedInCycle && timerState.status === 'running';
                        return (
                          <span
                            key={i}
                            className={`tally-emoji-item ${isDone ? 'done' : isCurrent ? 'current' : 'pending'}`}
                          >
                            <span className="tally-emoji-glyph">{emoji}</span>
                          </span>
                        );
                      })}
                    </span>
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
                </button>
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
                    <circle className="trk" cx="50" cy="50" r="42" fill="none" strokeWidth="8" />
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
                      stroke="var(--accent)"
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

            {/* Minimal Controls Row matching fwocus: [ Start / Pause ] + [ Reset ] (+ [ Skip ] when active) */}
            <div className="controls fadeable" id="controls">
              <button
                type="button"
                className={`ctl-pill ${timerState.status === 'running' ? 'running' : ''}`}
                id="btnToggle"
                aria-label={primaryCtaLabel}
                title={`${primaryCtaLabel} (Space)`}
                onClick={onToggleTimer}
              >
                <span>{primaryCtaLabel}</span>
              </button>

              <button
                type="button"
                className="ctl-icon"
                id="btnReset"
                aria-label={t('reset', lang)}
                title={`${t('reset', lang)} (R)`}
                onClick={onResetTimer}
              >
                <Icon name="reset" />
              </button>

              {showSkipBtn && (
                <button
                  type="button"
                  className="ctl-icon"
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
              )}
            </div>
          </>
        )}
      </section>

      {/* Corner Left Navigation — clean circular frosted glass icons */}
      {!zenMode && (
        <nav className="corner left fadeable" aria-label="Tools">
          <button
            type="button"
            className={`ib has-tip ${soundsOpen ? 'active' : ''}`}
            id="btnSounds"
            aria-label={t('sounds', lang)}
            aria-expanded={soundsOpen}
            onClick={() => {
              setMobileMoreOpen(false);
              onOpenSounds();
            }}
          >
            <Icon name="music" />
            <span className="tip">{t('sounds', lang)} (M)</span>
          </button>

          <button
            type="button"
            className={`ib has-tip ${notesOpen ? 'active' : ''}`}
            id="btnNotes"
            aria-label={t('notes', lang)}
            aria-expanded={notesOpen}
            onClick={() => {
              setMobileMoreOpen(false);
              onOpenNotes();
            }}
          >
            <Icon name="pencil" />
            <span className="tip">{t('notes', lang)}</span>
          </button>

          <button
            type="button"
            className={`ib has-tip ${tasksOpen ? 'active' : ''}`}
            id="btnTasks"
            aria-label={t('tasks', lang)}
            aria-expanded={tasksOpen}
            onClick={() => {
              setMobileMoreOpen(false);
              onOpenTasks();
            }}
          >
            <Icon name="tasks" />
            <span className="tip">{t('tasks', lang)} (T)</span>
          </button>

          {/* Desktop/Tablet direct icons (hidden into More menu on narrow portrait mobile) */}
          <button
            type="button"
            className={`ib has-tip desktop-tool ${musicOpen ? 'active' : ''} ${settings.music?.playing ? 'playing' : ''}`}
            id="btnMusic"
            aria-label={t('music', lang)}
            aria-expanded={musicOpen}
            onClick={onOpenMusic}
          >
            <Icon name="headphones" />
            <span className="tip">{t('music', lang)}</span>
          </button>

          <button
            type="button"
            className={`ib has-tip desktop-tool ${studyBotOpen ? 'active' : ''}`}
            id="btnStudyBot"
            aria-label={t('studyBot', lang)}
            aria-expanded={studyBotOpen}
            onClick={onOpenStudyBot}
          >
            <Icon name="bot" />
            <span className="tip">{t('studyBot', lang)} (B)</span>
          </button>

          {/* Compact More menu on narrow portrait mobile */}
          <div className="mobile-more-wrap" ref={moreRef}>
            <button
              type="button"
              className={`ib ${mobileMoreOpen ? 'active' : ''}`}
              id="btnMoreTools"
              aria-label="More study tools"
              aria-expanded={mobileMoreOpen}
              onClick={() => setMobileMoreOpen(prev => !prev)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {mobileMoreOpen && (
              <div className="mobile-more-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    onOpenStudyBot?.();
                  }}
                >
                  <Icon name="bot" />
                  <span>{t('studyBot', lang)}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    onOpenMusic();
                  }}
                >
                  <Icon name="headphones" />
                  <span>{t('music', lang)}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    onToggleZen();
                  }}
                >
                  <Icon name="zen" />
                  <span>{t('zenMode', lang)}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    toggleFullscreen();
                  }}
                >
                  <Icon name={isFs ? 'compress' : 'expand'} />
                  <span>{isFs ? t('exitFullscreen', lang) : t('fullscreen', lang)}</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Corner Right Navigation */}
      {!zenMode && (
        <nav className="corner right fadeable" aria-label="Modes and settings">
          {settings.timer.showStreak && (
            <button
              type="button"
              className={`streak has-tip ${streakGoalMet ? 'goal-met' : ''} ${animDisabled ? 'no-anim' : ''}`}
              id="streak"
              onClick={onOpenStats || onOpenSettings}
              aria-label={`${t('streak', lang)}: ${streakCount}`}
            >
              <span id="streakIc">
                <FlameIcon />
              </span>
              <span id="streakN">{streakCount}</span>
              <span className="tip">
                {t('streak', lang)}: {streakCount}{' '}
                {streakCount === 1 ? t('streakDaySingle', lang) : t('streakDays', lang)}
                {streakGoalMet ? ` · ${todayMins}m / ${goalMins}m ✓` : ''}
              </span>
            </button>
          )}

          <div className="right-controls-row">
            <div className="modes" role="group" aria-label="Mode">
              <button
                type="button"
                className="has-tip"
                data-mode="home"
                aria-label={t('modeHome', lang)}
                aria-pressed={mode === 'home'}
                onClick={() => onUpdateSettings({ ...settings, mode: 'home' as ModeKey }, 'mode')}
              >
                <Icon name="home" />
                <span className="tip">{t('modeHome', lang)} (1)</span>
              </button>

              <button
                type="button"
                className="has-tip"
                data-mode="focus"
                aria-label={t('modeFocus', lang)}
                aria-pressed={mode === 'focus'}
                onClick={() => onUpdateSettings({ ...settings, mode: 'focus' as ModeKey }, 'mode')}
              >
                <Icon name="clock" />
                <span className="tip">{t('modeFocus', lang)} (2)</span>
              </button>

              <button
                type="button"
                className="has-tip"
                data-mode="ambient"
                aria-label={t('modeAmbient', lang)}
                aria-pressed={mode === 'ambient'}
                onClick={() => onUpdateSettings({ ...settings, mode: 'ambient' as ModeKey }, 'mode')}
              >
                <Icon name="cloud" />
                <span className="tip">{t('modeAmbient', lang)} (3)</span>
              </button>
            </div>

            <button
              type="button"
              className="ib has-tip"
              id="btnThemes"
              aria-label={t('tabThemes', lang)}
              onClick={onOpenThemes || onOpenSettings}
            >
              <Icon name="palette" />
              <span className="tip">{t('tabThemes', lang)}</span>
            </button>

            <button
              type="button"
              className="ib has-tip desktop-tool"
              id="btnZen"
              aria-label={t('zenMode', lang)}
              onClick={onToggleZen}
            >
              <Icon name="zen" />
              <span className="tip">{t('zenMode', lang)} (Z)</span>
            </button>

            <button
              type="button"
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
              type="button"
              className="ib has-tip desktop-tool"
              id="btnFs"
              aria-label={isFs ? t('exitFullscreen', lang) : t('fullscreen', lang)}
              onClick={toggleFullscreen}
            >
              <Icon name={isFs ? 'compress' : 'expand'} />
              <span className="tip">
                {isFs ? t('exitFullscreen', lang) : t('fullscreen', lang)} (F)
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Floating Zen Mode Exit Pill */}
      {zenMode && (
        <button
          type="button"
          className="zen-exit-pill"
          aria-label={t('exitZen', lang)}
          title={`${t('exitZen', lang)} (Z / Esc)`}
          onClick={onToggleZen}
        >
          <Icon name="zen" />
          <span>{t('exitZen', lang)}</span>
        </button>
      )}
    </main>
  );
};
