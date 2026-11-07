/**
 * Internationalization (i18n) for Peakus
 * Languages:
 *  - en: English (Default)
 *  - ta: தமிழ் (Tamil)
 *  - es: Español (Spanish)
 */

export type LanguageCode = 'en' | 'ta' | 'es';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  creditsLabel: string;
  creditsHandle: string;
  
  // Modes
  modeHome: string;
  modeFocus: string;
  modeAmbient: string;
  
  // Timer Phases
  phaseFocus: string;
  phaseShort: string;
  phaseLong: string;
  
  // Controls
  start: string;
  pause: string;
  resume: string;
  reset: string;
  skip: string;
  skipToBreak: string;
  skipToFocus: string;
  finish: string;
  
  // Tools & navigation
  tasks: string;
  sounds: string;
  notes: string;
  music: string;
  settings: string;
  fullscreen: string;
  exitFullscreen: string;
  streak: string;
  streakDays: string;
  streakDaySingle: string;
  streakGoalNote: string;
  
  // Tasks popover
  tasksTitle: string;
  noPendingTasks: string;
  noPendingTasksSub: string;
  completedTasks: string;
  clearCompleted: string;
  newTaskPlaceholder: string;
  add: string;
  delete: string;
  rename: string;
  subtasks: string;
  addSubtaskPlaceholder: string;
  estimatedFocus: string;
  focusMinutes: string;
  useInTimer: string;
  removeFromTimer: string;
  undo: string;
  taskDeletedToast: string;
  confirmClearTasksTitle: string;
  confirmClearTasksDesc: string;
  
  // Sounds popover
  soundsTitle: string;
  masterVolume: string;
  stopAll: string;
  ambientNote: string;
  rain: string;
  rainDesc: string;
  storm: string;
  stormDesc: string;
  waves: string;
  wavesDesc: string;
  wind: string;
  windDesc: string;
  campfire: string;
  campfireDesc: string;
  brownNoise: string;
  brownNoiseDesc: string;
  pinkNoise: string;
  pinkNoiseDesc: string;
  whiteNoise: string;
  whiteNoiseDesc: string;
  
  // Notes popover
  notesTitle: string;
  notesPlaceholder: string;
  notesSaved: string;
  notesSaving: string;
  clearNotes: string;
  confirmClearNotesTitle: string;
  confirmClearNotesDesc: string;
  
  // Music Stream popover
  musicTitle: string;
  musicDesc: string;
  playMusic: string;
  pauseMusic: string;
  musicVolume: string;
  presetStreams: string;
  customStreamUrl: string;
  enterYtMusicUrl: string;
  loadMusic: string;
  invalidYtUrl: string;
  nowStreaming: string;
  streamPlaying: string;
  streamPaused: string;
  
  // Settings tabs
  tabThemes: string;
  tabClock: string;
  tabTimer: string;
  tabStats: string;
  tabQuotes: string;
  tabLanguage: string;
  tabExtras: string;
  tabData: string;
  
  // Themes settings
  themesSubtitle: string;
  themeTabScenes: string;
  themeTabVideo: string;
  themeTabUploads: string;
  themeTabAtmosphere: string;
  allScenes: string;
  animatedOnly: string;
  minimalSolids: string;
  modeToEdit: string;
  preview: string;
  customBackgrounds: string;
  ytBackgroundTitle: string;
  ytBackgroundDesc: string;
  enterYtBgUrl: string;
  applyYtBg: string;
  ytBgPresets: string;
  uploadVideoTitle: string;
  uploadVideoDesc: string;
  uploadImageTitle: string;
  uploadImageDesc: string;
  dragOrChooseFile: string;
  bgDim: string;
  bgBlur: string;
  bgPosX: string;
  bgPosY: string;
  animatedBg: string;
  animatedBgAuto: string;
  animatedBgOn: string;
  animatedBgOff: string;
  restoreTheme: string;
  bgLibrary: string;
  accentColor: string;
  
  // Clock settings
  clockSubtitle: string;
  format12: string;
  format24: string;
  flipClock: string;
  flipClockDesc: string;
  showSeconds: string;
  showSecondsDesc: string;
  showDate: string;
  showDateDesc: string;
  dynamicGreetings: string;
  dynamicGreetingsDesc: string;
  showGreetings: string;
  showGreetingsDesc: string;
  yourName: string;
  clockStyleTitle: string;
  clockSize: string;
  clockColor: string;
  restoreClock: string;
  
  // Timer settings
  timerSubtitle: string;
  timerMode: string;
  pomoMode: string;
  countdownMode: string;
  etaModeTitle: string;
  etaModeDesc: string;
  durationsTitle: string;
  durationsDesc: string;
  focusDur: string;
  shortDur: string;
  longDur: string;
  sessionsUntilLong: string;
  countdownDur: string;
  timerStyleTitle: string;
  progressBar: string;
  progressBarDesc: string;
  notifyOnEnd: string;
  notifyOnEndDesc: string;
  autoBreak: string;
  autoBreakDesc: string;
  autoFocus: string;
  autoFocusDesc: string;
  showStreakSetting: string;
  showStreakDesc: string;
  streakGoalSetting: string;
  alertSoundTitle: string;
  alertSoundDesc: string;
  alertVolume: string;
  talliesTitle: string;
  talliesDesc: string;
  restoreTimer: string;
  
  // Stats
  statsSubtitle: string;
  statToday: string;
  statWeek: string;
  statMonth: string;
  stat3M: string;
  stat6M: string;
  stat1Y: string;
  statAll: string;
  currentStreak: string;
  bestStreak: string;
  focusTime: string;
  dailyAverage: string;
  tasksCompleted: string;
  sessionsStat: string;
  breakTime: string;
  focusCalendar: string;
  trendTitle: string;
  byTaskTitle: string;
  historyTitle: string;
  clearHistory: string;
  
  // Extras
  extrasSubtitle: string;
  autoHideTitle: string;
  autoHideDesc: string;
  autoHideDelay: string;
  showLogoTitle: string;
  showLogoDesc: string;
  shortcutsTitle: string;
  creditsTitle: string;
  creditsDesc: string;
  
  // Data
  dataSubtitle: string;
  cloudSyncTitle: string;
  backupTitle: string;
  backupDesc: string;
  exportJSON: string;
  importJSON: string;
  clearDataTitle: string;
  resetAll: string;

  // Pro Prank & First-time modal
  proPrankHeading: string;
  proPrankSub: string;
  proPrankContinue: string;
  proPrankCancel: string;
  proPrankPunchline: string;
  proPrankSubPunchline: string;
  proPrankCta: string;

  // Saved Links & Analytics
  savedLinksTitle: string;
  savedLinksDesc: string;
  savedLinksEmpty: string;
  analyticsTitle: string;
  analytics7d: string;
  analytics14d: string;
  dailyTarget: string;
  peakFocusDay: string;
  totalMinutes: string;
  goalAchieved: string;

  // Zen mode & Pomodoro presets
  zenMode: string;
  exitZen: string;
  zenHint: string;
  presetsTitle: string;
  presetsDesc: string;
  presetName: string;
  applyPreset: string;
  savePreset: string;
  presetAppliedToast: string;

  // Flow Mode
  flowMode: string;
  flowModeDesc: string;
  flowActive: string;
  continueFlowTitle: string;
  continueFlowDesc: string;
  continueFlowYes: string;
  continueFlowNo: string;
  flowAddedToast: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationDictionary> = {
  en: {
    appName: 'Peakus',
    tagline: 'max your focus',
    creditsLabel: 'Credits',
    creditsHandle: 'human.exr',
    
    // Modes
    modeHome: 'Home',
    modeFocus: 'Focus',
    modeAmbient: 'Ambient',
    
    // Timer Phases
    phaseFocus: 'Focus',
    phaseShort: 'Short Break',
    phaseLong: 'Long Break',
    
    // Controls
    start: 'Start',
    pause: 'Pause',
    resume: 'Resume',
    reset: 'Reset',
    skip: 'Skip',
    skipToBreak: 'Take a break (N)',
    skipToFocus: 'Start focus (N)',
    finish: 'Finish (N)',
    
    // Tools & navigation
    tasks: 'Tasks',
    sounds: 'Sounds',
    notes: 'Notes',
    music: 'Music',
    settings: 'Settings',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    streak: 'Streak',
    streakDays: 'days',
    streakDaySingle: 'day',
    streakGoalNote: 'daily goal',
    
    // Tasks popover
    tasksTitle: 'Tasks',
    noPendingTasks: 'No pending tasks',
    noPendingTasksSub: 'Add one below to get started.',
    completedTasks: 'Completed',
    clearCompleted: 'Clear completed',
    newTaskPlaceholder: 'What are you working on?',
    add: 'Add',
    delete: 'Delete',
    rename: 'Rename',
    subtasks: 'Subtasks',
    addSubtaskPlaceholder: 'Add subtask and hit Enter',
    estimatedFocus: 'Estimate',
    focusMinutes: 'min',
    useInTimer: 'Focus on this task in timer',
    removeFromTimer: 'Remove from timer',
    undo: 'Undo',
    taskDeletedToast: 'Task deleted',
    confirmClearTasksTitle: 'Clear completed tasks?',
    confirmClearTasksDesc: 'They will be removed from this list. Overall stats and focus time remain.',
    
    // Sounds popover
    soundsTitle: 'Ambient Sounds',
    masterVolume: 'Master Volume',
    stopAll: 'Stop All',
    ambientNote: 'Generated offline in browser. Mix and match to find your vibe.',
    rain: 'Rain',
    rainDesc: 'Steady downpour',
    storm: 'Thunderstorm',
    stormDesc: 'Heavy rain & distant thunder',
    waves: 'Ocean Waves',
    wavesDesc: 'Rhythmic sea tide',
    wind: 'Gentle Wind',
    windDesc: 'Soft rustling breeze',
    campfire: 'Campfire',
    campfireDesc: 'Cozy crackling wood',
    brownNoise: 'Brown Noise',
    brownNoiseDesc: 'Deep & warm rumble',
    pinkNoise: 'Pink Noise',
    pinkNoiseDesc: 'Balanced natural spectrum',
    whiteNoise: 'White Noise',
    whiteNoiseDesc: 'Even crisp hiss',
    
    // Notes popover
    notesTitle: 'Quick Notes',
    notesPlaceholder: 'Jot down thoughts, ideas, or distractions to review later...',
    notesSaved: 'Saved',
    notesSaving: 'Saving...',
    clearNotes: 'Clear Notes',
    confirmClearNotesTitle: 'Clear all notes?',
    confirmClearNotesDesc: 'All text in the quick notepad will be erased.',
    
    // Music Stream popover
    musicTitle: 'YouTube Music Stream',
    musicDesc: 'Stream lo-fi beats, ambient piano, or Tamil chill melodies directly while you study.',
    playMusic: 'Play Stream',
    pauseMusic: 'Pause Stream',
    musicVolume: 'Stream Volume',
    presetStreams: 'Curated Stations',
    customStreamUrl: 'Custom YouTube Link',
    enterYtMusicUrl: 'Paste YouTube URL (e.g. https://youtube.com/watch?v=...)',
    loadMusic: 'Play Track / Stream',
    invalidYtUrl: 'Please enter a valid YouTube video or stream link.',
    nowStreaming: 'Now Streaming',
    streamPlaying: 'Music Playing',
    streamPaused: 'Music Paused',
    
    // Settings tabs
    tabThemes: 'Themes',
    tabClock: 'Clock',
    tabTimer: 'Timer',
    tabStats: 'Stats',
    tabQuotes: 'Quotes',
    tabLanguage: 'Language',
    tabExtras: 'Extras',
    tabData: 'Data',
    
    // Themes settings
    themesSubtitle: 'Custom wallpapers, YouTube ambient loops, video backdrops, and aesthetic color themes.',
    themeTabScenes: 'Scenes & Art',
    themeTabVideo: 'YouTube & Video',
    themeTabUploads: 'Custom Media',
    themeTabAtmosphere: 'Atmosphere & Style',
    allScenes: 'All Scenes',
    animatedOnly: 'Animated Only',
    minimalSolids: 'Solids & Colors',
    modeToEdit: 'Mode to edit',
    preview: 'Preview',
    customBackgrounds: 'Custom Backgrounds',
    ytBackgroundTitle: 'YouTube Video Background',
    ytBackgroundDesc: 'Paste any YouTube link to use as an aesthetic looping background video.',
    enterYtBgUrl: 'Paste YouTube link (e.g. https://youtube.com/watch?v=...)',
    applyYtBg: 'Set as Background',
    ytBgPresets: 'Scenic YouTube Presets',
    uploadVideoTitle: 'Upload Video Background',
    uploadVideoDesc: 'Upload MP4, WebM or MOV video clips (up to 80MB). Loops seamlessly.',
    uploadImageTitle: 'Upload Custom Image',
    uploadImageDesc: 'Upload your own wallpapers (JPG, PNG, WebP).',
    dragOrChooseFile: 'Choose a file or drop it here',
    bgDim: 'Dim background',
    bgBlur: 'Blur background',
    bgPosX: 'Horizontal position',
    bgPosY: 'Vertical position',
    animatedBg: 'Animated Backgrounds',
    animatedBgAuto: 'Auto',
    animatedBgOn: 'Enabled',
    animatedBgOff: 'Paused',
    restoreTheme: 'Restore Mode Default',
    bgLibrary: 'Curated Background Library',
    accentColor: 'Accent Color',
    
    // Clock settings
    clockSubtitle: 'Customize time display, styles, and greetings.',
    format12: '12 Hours',
    format24: '24 Hours',
    flipClock: 'Flip clock animation',
    flipClockDesc: 'Digits flip smoothly on change.',
    showSeconds: 'Show seconds',
    showSecondsDesc: 'Displays seconds next to time.',
    showDate: 'Show date',
    showDateDesc: 'Date displayed below clock in Home mode.',
    dynamicGreetings: 'Dynamic Greetings',
    dynamicGreetingsDesc: 'Changes with time of day and day of week.',
    showGreetings: 'Show greetings',
    showGreetingsDesc: 'Greeting header above clock.',
    yourName: 'Your name for greetings',
    clockStyleTitle: 'Clock & Timer Typography',
    clockSize: 'Clock Size',
    clockColor: 'Digits Color',
    restoreClock: 'Restore Clock',
    
    // Timer settings
    timerSubtitle: 'Tailor the interval timer to your study routine.',
    timerMode: 'Timer Mode',
    pomoMode: 'Pomodoro (Focus + Breaks)',
    countdownMode: 'Simple Countdown',
    etaModeTitle: 'Match Active Task Estimate',
    etaModeDesc: 'Session duration automatically matches remaining task estimate.',
    durationsTitle: 'Interval Durations',
    durationsDesc: 'Applies to the next starting interval.',
    focusDur: 'Focus',
    shortDur: 'Short Break',
    longDur: 'Long Break',
    sessionsUntilLong: 'Cycles until Long Break',
    countdownDur: 'Countdown',
    timerStyleTitle: 'Timer Display Style',
    progressBar: 'Progress Bar',
    progressBarDesc: 'Sleek line showing session progress.',
    notifyOnEnd: 'Desktop Notifications',
    notifyOnEndDesc: 'Notify when a session finishes while in another tab.',
    autoBreak: 'Auto-start Breaks',
    autoBreakDesc: 'Break begins automatically when focus session completes.',
    autoFocus: 'Auto-start Focus',
    autoFocusDesc: 'Focus starts automatically after break finishes.',
    showStreakSetting: 'Show Streak Counter',
    showStreakDesc: 'Displays daily streak badge in the corner.',
    streakGoalSetting: 'Minutes per day required to advance streak',
    alertSoundTitle: 'Completion Alert Sound',
    alertSoundDesc: 'Chime played when interval completes. Click to preview.',
    alertVolume: 'Alert Volume',
    talliesTitle: 'Session Tallies',
    talliesDesc: 'Visual counter for sessions completed in current cycle.',
    restoreTimer: 'Restore Timer',
    
    // Stats
    statsSubtitle: 'Calculated from your verified study sessions.',
    statToday: 'Today',
    statWeek: 'This Week',
    statMonth: 'This Month',
    stat3M: '3 Months',
    stat6M: '6 Months',
    stat1Y: '1 Year',
    statAll: 'All Time',
    currentStreak: 'Current Streak',
    bestStreak: 'Best Streak',
    focusTime: 'Focus Time',
    dailyAverage: 'Daily Average',
    tasksCompleted: 'Tasks Completed',
    sessionsStat: 'Sessions',
    breakTime: 'Break Time',
    focusCalendar: 'Focus Activity Calendar',
    trendTitle: 'Focus Trend',
    byTaskTitle: 'Focus by Task',
    historyTitle: 'Session History',
    clearHistory: 'Clear History',
    
    // Extras
    extrasSubtitle: 'Aesthetic controls, shortcuts, and credits.',
    autoHideTitle: 'Auto-hide Controls during Focus',
    autoHideDesc: 'Fades out buttons while timer is running so you can stay immersed.',
    autoHideDelay: 'Hide after inactivity',
    showLogoTitle: 'Show Peakus Logo',
    showLogoDesc: 'Displays Peakus branding at top left.',
    shortcutsTitle: 'Keyboard Shortcuts',
    creditsTitle: 'Brand & Creator Credits',
    creditsDesc: 'Peakus - max your focus. Follow the creator on Instagram:',
    
    // Data
    dataSubtitle: 'Your settings, stats, and links are securely synced with the Cloud in real time.',
    cloudSyncTitle: 'Cloud Database Synchronization',
    backupTitle: 'Backup & Restore',
    backupDesc: 'Download or upload your settings, tasks, history, and notes as JSON.',
    exportJSON: 'Export JSON',
    importJSON: 'Import JSON',
    clearDataTitle: 'Clear Data & Factory Reset',
    resetAll: 'Reset All to Defaults',

    // Pro Prank & First-time modal
    proPrankHeading: 'Hey 👋, upgrade to the pro version to continue',
    proPrankSub: 'Unlock limitless 4K YouTube live backgrounds, curated ambient audio, deep analytics, and cloud sync.',
    proPrankContinue: 'Continue ($9.99/mo)',
    proPrankCancel: 'Cancel',
    proPrankPunchline: 'Focus should be free, just kidding 😂 this is free for life time',
    proPrankSubPunchline: 'No subscriptions. No paywalls. No ads. Peakus is and will always remain completely free for everyone.',
    proPrankCta: "Let's Focus! 🚀",

    // Saved Links & Analytics
    savedLinksTitle: 'Saved YouTube Links',
    savedLinksDesc: 'All YouTube links and video loops you paste are securely synced with your Cloud account.',
    savedLinksEmpty: 'No saved links yet. Paste any YouTube link above to save it!',
    analyticsTitle: 'Focus Analytics & Trends',
    analytics7d: '7 Days',
    analytics14d: '14 Days',
    dailyTarget: 'Daily Target',
    peakFocusDay: 'Peak Day',
    totalMinutes: 'Total Focus',
    goalAchieved: 'Target Reached',

    // Zen mode & Pomodoro presets
    zenMode: 'Zen Mode',
    exitZen: 'Exit Zen',
    zenHint: 'Only timer visible',
    presetsTitle: 'Custom Pomodoro Presets',
    presetsDesc: 'Configure 3 quick Pomodoro presets synced with your Cloud account.',
    presetName: 'Preset Name',
    applyPreset: 'Apply',
    savePreset: 'Save',
    presetAppliedToast: 'Pomodoro preset applied',

    // Flow Mode
    flowMode: 'Flow Mode (Continue Flow)',
    flowModeDesc: 'Ask to extend focus by 10 minutes when a session finishes before taking a break.',
    flowActive: 'Flow Mode Active',
    continueFlowTitle: 'Want to continue your flow?',
    continueFlowDesc: 'Great focus session! Would you like to add 10 more minutes to stay in your flow, or start your break?',
    continueFlowYes: 'Continue Flow (+10 min)',
    continueFlowNo: 'Start Break',
    flowAddedToast: 'Added 10 minutes to your flow state 🌊',
  },

  ta: {
    appName: 'Peakus',
    tagline: 'உங்கள் கவனத்தை அதிகரியுங்கள்',
    creditsLabel: 'உருவாக்கியவர்',
    creditsHandle: 'human.exr',
    
    // Modes
    modeHome: 'முகப்பு',
    modeFocus: 'கவனம்',
    modeAmbient: 'சூழல்',
    
    // Timer Phases
    phaseFocus: 'கவனம்',
    phaseShort: 'குறுகிய இடைவேளை',
    phaseLong: 'நீண்ட இடைவேளை',
    
    // Controls
    start: 'தொடங்கு',
    pause: 'இடைநிறுத்து',
    resume: 'மீண்டும் தொடங்கு',
    reset: 'மறுசீரமை',
    skip: 'அடுத்தது',
    skipToBreak: 'இடைவேளைக்குச் செல் (N)',
    skipToFocus: 'கவனத்தைத் தொடங்கு (N)',
    finish: 'முடி (N)',
    
    // Tools & navigation
    tasks: 'பணிகள்',
    sounds: 'ஒலிகள்',
    notes: 'குறிப்புகள்',
    music: 'இசை',
    settings: 'அமைப்புகள்',
    fullscreen: 'முழுத்திரை',
    exitFullscreen: 'முழுத்திரை விலகு',
    streak: 'தொடர் சாதனை',
    streakDays: 'நாட்கள்',
    streakDaySingle: 'நாள்',
    streakGoalNote: 'தினசரி இலக்கு',
    
    // Tasks popover
    tasksTitle: 'பணிகள்',
    noPendingTasks: 'நிலுவையில் பணிகள் இல்லை',
    noPendingTasksSub: 'தொடங்க கீழே ஒரு பணியைச் சேர்க்கவும்.',
    completedTasks: 'முடிக்கப்பட்டவை',
    clearCompleted: 'முடிக்கப்பட்டவற்றை நீக்கு',
    newTaskPlaceholder: 'இன்று என்ன படிக்க/வேலை செய்யப் போகிறீர்கள்?',
    add: 'சேர்',
    delete: 'நீக்கு',
    rename: 'பெயர் மாற்று',
    subtasks: 'துணைப் பணிகள்',
    addSubtaskPlaceholder: 'துணைப் பணியை உள்ளிட்டு Enter அழுத்தவும்',
    estimatedFocus: 'மதிப்பீடு',
    focusMinutes: 'நிமிடம்',
    useInTimer: 'நேரமானியில் இப்பணியைக் காட்டு',
    removeFromTimer: 'நேரமானியிலிருந்து அகற்று',
    undo: 'செயல்தவிர்',
    taskDeletedToast: 'பணி நீக்கப்பட்டது',
    confirmClearTasksTitle: 'முடிக்கப்பட்ட பணிகளை நீக்கவா?',
    confirmClearTasksDesc: 'இப்பட்டியலில் இருந்து பணிகள் நீக்கப்படும். உங்களின் வரலாற்றுப் புள்ளிவிவரங்கள் பாதுகாக்கப்படும்.',
    
    // Sounds popover
    soundsTitle: 'சூழல் ஒலிகள்',
    masterVolume: 'முதன்மை ஒலி அளவு',
    stopAll: 'அனைத்தையும் நிறுத்து',
    ambientNote: 'இணையம் தேவையில்லை. உங்கள் ரசனைக்கேற்ப ஒலிகளை கலந்து அமைதியான சூழலை உருவாக்குங்கள்.',
    rain: 'மழை',
    rainDesc: 'தொடர் அமைதியான மழை',
    storm: 'இடிமின்னல் புயல்',
    stormDesc: 'கனமழை மற்றும் தூரத்து இடி',
    waves: 'கடல் அலைகள்',
    wavesDesc: 'அமைதியான கடலோர அலைகள்',
    wind: 'மெல்லிய காற்று',
    windDesc: 'குளிர்ந்த மென் காற்று',
    campfire: 'நெருப்பு முகாம்',
    campfireDesc: 'மரக்கட்டை வெடிக்கும் சத்தம்',
    brownNoise: 'பழுப்பு இரைச்சல் (Brown Noise)',
    brownNoiseDesc: 'ஆழ்ந்த கவனத்திற்கான மென் ஒலி',
    pinkNoise: 'இளஞ்சிவப்பு இரைச்சல் (Pink Noise)',
    pinkNoiseDesc: 'இயற்கையான சமச்சீர் அதிர்வு',
    whiteNoise: 'வெள்ளை இரைச்சல் (White Noise)',
    whiteNoiseDesc: 'வெளிப்புற சத்தங்களை மறைக்கும் ஒலி',
    
    // Notes popover
    notesTitle: 'விரைவுக் குறிப்புகள்',
    notesPlaceholder: 'கவனம் சிதறாமல் இருக்க நினைவில் தோன்றுவதை இங்கே உடனே குறித்து வையுங்கள்...',
    notesSaved: 'சேமிக்கப்பட்டது',
    notesSaving: 'சேமிக்கிறது...',
    clearNotes: 'குறிப்புகளை நீக்கு',
    confirmClearNotesTitle: 'அனைத்து குறிப்புகளையும் நீக்கவா?',
    confirmClearNotesDesc: 'குறிப்பு நோட்டுப் புத்தகத்தில் உள்ள அனைத்து உரைகளும் அழிக்கப்படும்.',
    
    // Music Stream popover
    musicTitle: 'YouTube இசை ஸ்ட்ரீம்',
    musicDesc: 'லோஃபி பீட்ஸ், அமைதியான பியானோ, மற்றும் தமிழ் மெலடிகளை படிக்கும்போது நேரடியாகக் கேளுங்கள்.',
    playMusic: 'இசையைத் தொடங்கு',
    pauseMusic: 'இசையை நிறுத்து',
    musicVolume: 'இசை ஒலி அளவு',
    presetStreams: 'சிறந்த இசை நிலையங்கள்',
    customStreamUrl: 'தனிப்பயன் YouTube இணைப்பு',
    enterYtMusicUrl: 'YouTube பாடலின் இணைப்பை உள்ளிடவும் (https://youtube.com/watch?v=...)',
    loadMusic: 'இசையைக் கேள்',
    invalidYtUrl: 'சரியான YouTube வீடியோ இணைப்பை உள்ளிடவும்.',
    nowStreaming: 'தற்போது ஒலிப்பது',
    streamPlaying: 'இசை ஒலிக்கிறது',
    streamPaused: 'இசை நிறுத்தப்பட்டுள்ளது',
    
    // Settings tabs
    tabThemes: 'கருப்பொருள்கள்',
    tabClock: 'கடிகாரம்',
    tabTimer: 'நேரமானி',
    tabStats: 'புள்ளிவிவரம்',
    tabQuotes: 'பொன்மொழிகள்',
    tabLanguage: 'மொழி (Language)',
    tabExtras: 'கூடுதல்',
    tabData: 'தரவு',
    
    // Themes settings
    themesSubtitle: 'YouTube வீடியோ பின்னணிகள் அல்லது உங்கள் சொந்த வீடியோக்களை தேர்வு செய்யுங்கள்.',
    themeTabScenes: 'காட்சிகள் & கலை',
    themeTabVideo: 'YouTube & வீடியோ',
    themeTabUploads: 'சொந்த ஊடகம்',
    themeTabAtmosphere: 'வளிமண்டலம் & பாணி',
    allScenes: 'அனைத்து காட்சிகள்',
    animatedOnly: 'இயங்குபவை மட்டும்',
    minimalSolids: 'வண்ணங்கள்',
    modeToEdit: 'மாற்ற வேண்டிய பயன்முறை',
    preview: 'முன்னோட்டம்',
    customBackgrounds: 'தனிப்பயன் பின்னணிகள்',
    ytBackgroundTitle: 'YouTube வீடியோ பின்னணி',
    ytBackgroundDesc: 'எந்தவொரு YouTube இணைப்பையும் அழகான பின்னணி வீடியோவாக இயக்கலாம்.',
    enterYtBgUrl: 'YouTube வீடியோ இணைப்பை உள்ளிடவும்',
    applyYtBg: 'பின்னணியாக அமை',
    ytBgPresets: 'அழகிய YouTube பின்னணி மாதிரிகள்',
    uploadVideoTitle: 'வீடியோ பின்னணி பதிவேற்றம்',
    uploadVideoDesc: 'MP4 அல்லது WebM வீடியோவை பதிவேற்றி பின்னணியாக இயக்கலாம் (80MB வரை).',
    uploadImageTitle: 'படப் பின்னணி பதிவேற்றம்',
    uploadImageDesc: 'உங்கள் புகைப்படங்கள் அல்லது வால்பேப்பர்களை பதிவேற்றுங்கள்.',
    dragOrChooseFile: 'கோப்பை இழுத்து விடவும் அல்லது தேர்ந்தெடுக்கவும்',
    bgDim: 'மங்கலாக்கு (Darken)',
    bgBlur: 'தெளிவின்மை (Blur)',
    bgPosX: 'கிடைமட்ட நிலை',
    bgPosY: 'செங்குத்து நிலை',
    animatedBg: 'இயங்கு பின்னணிகள்',
    animatedBgAuto: 'தானியங்கி',
    animatedBgOn: 'இயக்கத்தில்',
    animatedBgOff: 'நிறுத்திவை',
    restoreTheme: 'இயல்பு நிலைக்கு மீட்டமை',
    bgLibrary: 'பின்னணி நூலகம்',
    accentColor: 'வண்ணத் தேர்வு',
    
    // Clock settings
    clockSubtitle: 'நேரக் காட்சி, எழுத்துருக்கள் மற்றும் வாழ்த்துகளைத் தனிப்பயனாக்குங்கள்.',
    format12: '12 மணி நேரம்',
    format24: '24 மணி நேரம்',
    flipClock: 'ஃபிளிப் கடிகார அனிமேஷன்',
    flipClockDesc: 'எண்கள் அழகாக சுழன்று மாறும்.',
    showSeconds: 'வினாடிகளைக் காட்டு',
    showSecondsDesc: 'நேரத்திற்கு அருகில் வினாடிகளைக் காட்டும்.',
    showDate: 'தேதியைக் காட்டு',
    showDateDesc: 'முகப்புத் திரையில் இன்றைய தேதியைக் காட்டும்.',
    dynamicGreetings: 'நேரத்திற்கேற்ற வாழ்த்துகள்',
    dynamicGreetingsDesc: 'காலை, மாலை மற்றும் கிழமைக்கேற்ப மாறும்.',
    showGreetings: 'வாழ்த்துகளைக் காட்டு',
    showGreetingsDesc: 'கடிகாரத்திற்கு மேல் வாழ்த்துரை.',
    yourName: 'வாழ்த்துகளில் உங்கள் பெயர்',
    clockStyleTitle: 'கடிகார எழுத்துரு வடிவம்',
    clockSize: 'கடிகார அளவு',
    clockColor: 'எண்களின் வண்ணம்',
    restoreClock: 'கடிகாரத்தை மீட்டமை',
    
    // Timer settings
    timerSubtitle: 'உங்கள் படிப்பு முறைக்கு ஏற்ப நேரத்தை ஒழுங்குபடுத்துங்கள்.',
    timerMode: 'நேரமானி முறை',
    pomoMode: 'பொமடோரோ (கவனம் + இடைவேளை)',
    countdownMode: 'எளிய பின்னணிக்கணிப்பு (Countdown)',
    etaModeTitle: 'செயலில் உள்ள பணியின் காலஅளவை அமை',
    etaModeDesc: 'பணிக்கு நிர்ணயித்த நேரத்திற்கு ஏற்ப நேரமானி இயங்கும்.',
    durationsTitle: 'கால அளவுகள்',
    durationsDesc: 'அடுத்த சுழற்சியிலிருந்து பொருந்தும்.',
    focusDur: 'கவனம்',
    shortDur: 'குறுகிய இடைவேளை',
    longDur: 'நீண்ட இடைவேளை',
    sessionsUntilLong: 'நீண்ட இடைவேளைக்கான சுழற்சிகள்',
    countdownDur: 'பின்னணிக்கணிப்பு நேரம்',
    timerStyleTitle: 'நேரமானி காட்சி வடிவம்',
    progressBar: 'முன்னேற்றப் பட்டை',
    progressBarDesc: 'சென்ற நேரத்தைக் காட்டும் மெல்லிய பட்டை.',
    notifyOnEnd: 'திரை அறிவிப்புகள்',
    notifyOnEndDesc: 'நேரம் முடிந்ததும் கணினி/மொபைல் அறிவிப்பு அனுப்பும்.',
    autoBreak: 'இடைவேளையைத் தானாகத் தொடங்கு',
    autoBreakDesc: 'கவனம் முடிந்ததும் இடைவேளை தானாகத் தொடங்கும்.',
    autoFocus: 'கவனத்தைத் தானாகத் தொடங்கு',
    autoFocusDesc: 'இடைவேளை முடிந்ததும் படிப்பு தானாகத் தொடங்கும்.',
    showStreakSetting: 'தொடர் சாதனைக் கவுன்ட்டரைக் காட்டு',
    showStreakDesc: 'கீழ் மூலையில் தினசரி இலக்கு சாதனையைக் காட்டும்.',
    streakGoalSetting: 'சாதனையைத் தொடர தினசரி தேவையான கவனம் (நிமிடம்)',
    alertSoundTitle: 'முடிவு எச்சரிக்கை ஒலி',
    alertSoundDesc: 'நேரம் முடிந்ததும் ஒலிக்கும் மெல்லிசை.',
    alertVolume: 'எச்சரிக்கை ஒலி அளவு',
    talliesTitle: 'சுழற்சி எண்ணிக்கைகள்',
    talliesDesc: 'இந்த சுழற்சியில் முடித்த அமர்வுகளின் குறிப்பான்.',
    restoreTimer: 'நேரமானியை மீட்டமை',
    
    // Stats
    statsSubtitle: 'நீங்கள் பயின்ற உண்மையான அமர்வுகளின் புள்ளிவிவரங்கள்.',
    statToday: 'இன்று',
    statWeek: 'இந்த வாரம்',
    statMonth: 'இந்த மாதம்',
    stat3M: '3 மாதங்கள்',
    stat6M: '6 மாதங்கள்',
    stat1Y: '1 வருடம்',
    statAll: 'மொத்தம்',
    currentStreak: 'தற்போதைய சாதனை',
    bestStreak: 'சிறந்த சாதனை',
    focusTime: 'கவன நேரம்',
    dailyAverage: 'தினசரி சராசரி',
    tasksCompleted: 'முடித்த பணிகள்',
    sessionsStat: 'அமர்வுகள்',
    breakTime: 'இடைவேளை நேரம்',
    focusCalendar: 'படிப்பு நாட்காட்டி',
    trendTitle: 'கவனப் போக்கு',
    byTaskTitle: 'பணி வாரியாக நேரம்',
    historyTitle: 'அமர்வு வரலாறு',
    clearHistory: 'வரலாற்றை நீக்கு',
    
    // Extras
    extrasSubtitle: 'அழகியல் கட்டுப்பாடுகள், குறுக்குவழிகள் மற்றும் தயாரிப்பாளர் விவரம்.',
    autoHideTitle: 'படிக்கையில் கட்டுப்பாடுகளை மறை',
    autoHideDesc: 'கவனம் சிதறாமல் இருக்க பொத்தான்கள் தானாக மறையும்.',
    autoHideDelay: 'மறைக்க வேண்டிய காலதாமதம்',
    showLogoTitle: 'Peakus லோகோவைக் காட்டு',
    showLogoDesc: 'மேல் இடது மூலையில் Peakus பெயரை வைக்கும்.',
    shortcutsTitle: 'விசைப்பலகைக் குறுக்குவழிகள்',
    creditsTitle: 'தயாரிப்பாளர் & பெருமை',
    creditsDesc: 'Peakus - உங்கள் கவனத்தை அதிகரியுங்கள். இன்ஸ்டாகிராமில் பின்தொடரவும்:',
    
    // Data
    dataSubtitle: 'உங்கள் தரவுகள் உலாவியில் பாதுகாப்பாக வைக்கப்பட்டுள்ளன.',
    cloudSyncTitle: 'மேகக்கணி தரவு ஒத்திசைவு (Cloud Sync)',
    backupTitle: 'காப்புப்பிரதி மற்றும் மீட்டெடுப்பு',
    backupDesc: 'அமைப்புகள், பணிகள், வரலாற்றை JSON கோப்பாகப் பதிவிறக்கலாம்.',
    exportJSON: 'JSON பதிவிறக்கு (Export)',
    importJSON: 'JSON ஏற்று (Import)',
    clearDataTitle: 'தரவு அழிப்பு & மீட்டமைப்பு',
    resetAll: 'அனைத்தையும் இயல்புநிலைக்கு மாற்று',

    // Pro Prank & First-time modal
    proPrankHeading: 'Hey 👋, upgrade to the pro version to continue',
    proPrankSub: '4K நேரடி பின்னணிகள், லோஃபி இசை, முழு புள்ளிவிவரங்கள் மற்றும் மேகக்கணி ஒத்திசைவு பெறுங்கள்.',
    proPrankContinue: 'தொடரவும் (Continue $9.99/mo)',
    proPrankCancel: 'ரத்து செய் (Cancel)',
    proPrankPunchline: 'Focus should be free, just kidding 😂 this is free for life time',
    proPrankSubPunchline: 'சந்தா எதுவும் தேவையில்லை! விளம்பரங்கள் இல்லை. Peakus எப்போதும் அனைவருக்கும் வாழ்நாள் முழுவதும் 100% இலவசம்.',
    proPrankCta: "கவனத்தைத் தொடங்குவோம்! 🚀",

    // Saved Links & Analytics
    savedLinksTitle: 'சேமிக்கப்பட்ட YouTube இணைப்புகள்',
    savedLinksDesc: 'நீங்கள் உள்ளிட்ட அனைத்து YouTube இணைப்புகளும் உங்கள் உலாவியில் தானாக சேமிக்கப்படும்.',
    savedLinksEmpty: 'சேமிக்கப்பட்ட இணைப்புகள் இல்லை. மேலே உள்ள பெட்டியில் YouTube இணைப்பை உள்ளிடவும்!',
    analyticsTitle: 'கவனப் பகுப்பாய்வு வரைபடம் (Analytics)',
    analytics7d: '7 நாட்கள்',
    analytics14d: '14 நாட்கள்',
    dailyTarget: 'தினசரி இலக்கு',
    peakFocusDay: 'அதிக கவனம் செலுத்திய நாள்',
    totalMinutes: 'மொத்தக் கவனம்',
    goalAchieved: 'இலக்கு எட்டப்பட்டது',

    // Zen mode & Pomodoro presets
    zenMode: 'ஜென் பயன்முறை',
    exitZen: 'ஜென் விலகு',
    zenHint: 'நேரமானி மட்டுமே தெரியும்',
    presetsTitle: 'பொமடோரோ முன்னமைவுகள் (Custom Presets)',
    presetsDesc: '3 தனிப்பயன் பொமடோரோ நேர அளவுகளை உங்கள் உலாவியில் சேமித்துக் கொள்ளலாம்.',
    presetName: 'முன்னமைவு பெயர்',
    applyPreset: 'பயன்படுத்து',
    savePreset: 'சேமி',
    presetAppliedToast: 'பொமடோரோ முன்னமைவு பயன்படுத்தப்பட்டது',

    // Flow Mode
    flowMode: 'ஓட்ட முறை (Flow Mode)',
    flowModeDesc: 'கவன அமர்வு முடிந்ததும் இடைவேளைக்கு முன் மேலும் 10 நிமிடங்கள் தொடர கேட்கும்.',
    flowActive: 'ஓட்ட முறை செயலில் உள்ளது',
    continueFlowTitle: 'உங்கள் ஓட்டத்தைத் தொடர விரும்புகிறீர்களா?',
    continueFlowDesc: 'அமர்வு முடிந்தது! உங்கள் கவன ஓட்டத்தைத் தொடர மேலும் 10 நிமிடங்களைச் சேர்க்க விரும்புகிறீர்களா, அல்லது இடைவேளை எடுக்கவா?',
    continueFlowYes: 'ஓட்டத்தைத் தொடர் (+10 நிமிடம்)',
    continueFlowNo: 'இடைவேளை தொடங்கு',
    flowAddedToast: 'உங்கள் கவன ஓட்டத்தில் 10 நிமிடங்கள் சேர்க்கப்பட்டது 🌊',
  },

  es: {
    appName: 'Peakus',
    tagline: 'max your focus',
    creditsLabel: 'Créditos',
    creditsHandle: 'human.exr',
    
    // Modes
    modeHome: 'Home',
    modeFocus: 'Focus',
    modeAmbient: 'Ambient',
    
    // Timer Phases
    phaseFocus: 'Foco',
    phaseShort: 'Descanso corto',
    phaseLong: 'Descanso largo',
    
    // Controls
    start: 'Iniciar',
    pause: 'Pausar',
    resume: 'Reanudar',
    reset: 'Reiniciar',
    skip: 'Saltar',
    skipToBreak: 'Pasar al descanso (N)',
    skipToFocus: 'Pasar al foco (N)',
    finish: 'Terminar (N)',
    
    // Tools & navigation
    tasks: 'Tareas',
    sounds: 'Sonidos',
    notes: 'Notas',
    music: 'Música',
    settings: 'Ajustes',
    fullscreen: 'Pantalla completa',
    exitFullscreen: 'Salir de pantalla completa',
    streak: 'Racha',
    streakDays: 'días',
    streakDaySingle: 'día',
    streakGoalNote: 'meta diaria',
    
    // Tasks popover
    tasksTitle: 'Tareas',
    noPendingTasks: 'Sin tareas pendientes',
    noPendingTasksSub: 'Agregá una abajo para ponerte a trabajar.',
    completedTasks: 'Completadas',
    clearCompleted: 'Borrar completadas',
    newTaskPlaceholder: '¿En qué vas a trabajar?',
    add: 'Agregar',
    delete: 'Eliminar',
    rename: 'Renombrar',
    subtasks: 'Subtareas',
    addSubtaskPlaceholder: 'Agregar subtarea y Enter',
    estimatedFocus: 'Estimación',
    focusMinutes: 'min',
    useInTimer: 'Usar en el temporizador',
    removeFromTimer: 'Quitar del temporizador',
    undo: 'Deshacer',
    taskDeletedToast: 'Tarea eliminada',
    confirmClearTasksTitle: '¿Borrar las tareas completadas?',
    confirmClearTasksDesc: 'Se quitan de la lista. Las estadísticas y el tiempo de foco se conservan.',
    
    // Sounds popover
    soundsTitle: 'Sonidos ambiente',
    masterVolume: 'Volumen general',
    stopAll: 'Detener todo',
    ambientNote: 'Se generan en el navegador sin conexión. Mezclalos como prefieras.',
    rain: 'Lluvia',
    rainDesc: 'Lluvia constante',
    storm: 'Tormenta',
    stormDesc: 'Lluvia fuerte y truenos',
    waves: 'Olas',
    wavesDesc: 'Mar que va y viene',
    wind: 'Viento',
    windDesc: 'Brisa suave',
    campfire: 'Fogata',
    campfireDesc: 'Leña crepitando',
    brownNoise: 'Ruido marrón',
    brownNoiseDesc: 'Grave y envolvente',
    pinkNoise: 'Ruido rosa',
    pinkNoiseDesc: 'Equilibrado y natural',
    whiteNoise: 'Ruido blanco',
    whiteNoiseDesc: 'Parejo y brillante',
    
    // Notes popover
    notesTitle: 'Notas rápidas',
    notesPlaceholder: 'Anotá dudas, fórmulas o lo que te distraiga para volver después...',
    notesSaved: 'Guardado',
    notesSaving: 'Guardando...',
    clearNotes: 'Borrar notas',
    confirmClearNotesTitle: '¿Borrar las notas?',
    confirmClearNotesDesc: 'Se elimina todo el texto del bloc de notas.',
    
    // Music Stream popover
    musicTitle: 'Música en vivo de YouTube',
    musicDesc: 'Transmití beats lo-fi, piano relajante o melodías chill mientras estudiás.',
    playMusic: 'Reproducir',
    pauseMusic: 'Pausar',
    musicVolume: 'Volumen de música',
    presetStreams: 'Estaciones recomendadas',
    customStreamUrl: 'Enlace personalizado de YouTube',
    enterYtMusicUrl: 'Pegá el link de YouTube (https://youtube.com/watch?v=...)',
    loadMusic: 'Cargar y escuchar',
    invalidYtUrl: 'Por favor ingresá un enlace válido de YouTube.',
    nowStreaming: 'Sonando ahora',
    streamPlaying: 'Música sonando',
    streamPaused: 'Música en pausa',
    
    // Settings tabs
    tabThemes: 'Temas',
    tabClock: 'Reloj',
    tabTimer: 'Temporizador',
    tabStats: 'Estadísticas',
    tabQuotes: 'Frases',
    tabLanguage: 'Idioma',
    tabExtras: 'Extras',
    tabData: 'Datos',
    
    // Themes settings
    themesSubtitle: 'Elegí fondos, videos en bucle de YouTube o subí videos propios.',
    themeTabScenes: 'Escenas & Arte',
    themeTabVideo: 'YouTube & Video',
    themeTabUploads: 'Subidas',
    themeTabAtmosphere: 'Atmósfera & Estilo',
    allScenes: 'Todas las escenas',
    animatedOnly: 'Solo animadas',
    minimalSolids: 'Colores sólidos',
    modeToEdit: 'Modo a editar',
    preview: 'Vista previa',
    customBackgrounds: 'Fondos personalizados',
    ytBackgroundTitle: 'Fondo de video de YouTube',
    ytBackgroundDesc: 'Pegá cualquier enlace de YouTube para usarlo como fondo de video en bucle.',
    enterYtBgUrl: 'Pegá link de YouTube (ej. https://youtube.com/watch?v=...)',
    applyYtBg: 'Fijar como fondo',
    ytBgPresets: 'Fondos de YouTube recomendados',
    uploadVideoTitle: 'Subir fondo de video',
    uploadVideoDesc: 'Subí archivos MP4, WebM o MOV (hasta 80MB). Se reproducen en bucle.',
    uploadImageTitle: 'Subir imagen propia',
    uploadImageDesc: 'Subí tus fotos o fondos (JPG, PNG, WebP).',
    dragOrChooseFile: 'Elegí un archivo o arrastralo acá',
    bgDim: 'Oscurecer',
    bgBlur: 'Desenfocar',
    bgPosX: 'Posición horizontal',
    bgPosY: 'Vertical',
    animatedBg: 'Fondos animados',
    animatedBgAuto: 'Automático',
    animatedBgOn: 'Activados',
    animatedBgOff: 'En pausa',
    restoreTheme: 'Restaurar modo',
    bgLibrary: 'Biblioteca de fondos',
    accentColor: 'Color de acento',
    
    // Clock settings
    clockSubtitle: 'Personalizá el reloj y los saludos.',
    format12: '12 Horas',
    format24: '24 Horas',
    flipClock: 'Reloj con efecto flip',
    flipClockDesc: 'Las cifras giran al cambiar.',
    showSeconds: 'Mostrar segundos',
    showSecondsDesc: 'Muestra la hora con segundos.',
    showDate: 'Mostrar fecha',
    showDateDesc: 'Día y fecha debajo del reloj en Home.',
    dynamicGreetings: 'Saludos dinámicos',
    dynamicGreetingsDesc: 'Cambian según el día y la hora.',
    showGreetings: 'Mostrar saludos',
    showGreetingsDesc: 'Saludo sobre el reloj en Home.',
    yourName: 'Tu nombre para los saludos',
    clockStyleTitle: 'Tipografía del reloj y temporizador',
    clockSize: 'Tamaño del reloj',
    clockColor: 'Color de cifras',
    restoreClock: 'Restaurar reloj',
    
    // Timer settings
    timerSubtitle: 'Ajustalo a tu forma de estudiar.',
    timerMode: 'Modo del temporizador',
    pomoMode: 'Pomodoro (foco + descansos)',
    countdownMode: 'Cuenta regresiva simple',
    etaModeTitle: 'Usar estimación de la tarea',
    etaModeDesc: 'El foco dura lo que falta de la estimación de la tarea activa.',
    durationsTitle: 'Duraciones',
    durationsDesc: 'Se aplican desde la próxima etapa.',
    focusDur: 'Foco',
    shortDur: 'Descanso corto',
    longDur: 'Descanso largo',
    sessionsUntilLong: 'Sesiones hasta descanso largo',
    countdownDur: 'Cuenta regresiva',
    timerStyleTitle: 'Estilo del temporizador',
    progressBar: 'Barra de progreso',
    progressBarDesc: 'Una línea fina debajo del temporizador.',
    notifyOnEnd: 'Notificación al terminar',
    notifyOnEndDesc: 'Aviso del sistema si estás en otra pestaña.',
    autoBreak: 'Iniciar descansos automáticamente',
    autoBreakDesc: 'Al terminar el foco, el descanso arranca solo.',
    autoFocus: 'Iniciar el foco automáticamente',
    autoFocusDesc: 'Al terminar un descanso, la siguiente sesión arranca sola.',
    showStreakSetting: 'Mostrar racha en pantalla',
    showStreakDesc: 'El contador abajo a la derecha.',
    streakGoalSetting: 'Minutos de foco diarios para sumar racha',
    alertSoundTitle: 'Sonido de alerta',
    alertSoundDesc: 'Suena al terminar cada etapa. Tocá uno para escucharlo.',
    alertVolume: 'Volumen de alerta',
    talliesTitle: 'Marcas de sesión',
    talliesDesc: 'Cada marca es una sesión de foco completa en el ciclo.',
    restoreTimer: 'Restaurar temporizador',
    
    // Stats
    statsSubtitle: 'Salen de tus sesiones reales en este navegador.',
    statToday: 'Hoy',
    statWeek: 'Semana',
    statMonth: 'Mes',
    stat3M: '3 Meses',
    stat6M: '6 Meses',
    stat1Y: '1 Año',
    statAll: 'Todo',
    currentStreak: 'Racha actual',
    bestStreak: 'Mejor racha',
    focusTime: 'Tiempo de foco',
    dailyAverage: 'Promedio por día',
    tasksCompleted: 'Tareas completadas',
    sessionsStat: 'Sesiones',
    breakTime: 'Descanso',
    focusCalendar: 'Calendario de foco',
    trendTitle: 'Tendencia',
    byTaskTitle: 'Por tarea',
    historyTitle: 'Historial de sesiones',
    clearHistory: 'Borrar historial',
    
    // Extras
    extrasSubtitle: 'Detalles para concentrarte mejor.',
    autoHideTitle: 'Ocultar controles al concentrarte',
    autoHideDesc: 'Con el temporizador corriendo, los controles se desvanecen.',
    autoHideDelay: 'Ocultar después de inactividad',
    showLogoTitle: 'Mostrar el logo',
    showLogoDesc: 'La palabra Peakus arriba a la izquierda.',
    shortcutsTitle: 'Atajos de teclado',
    creditsTitle: 'Créditos y autoría',
    creditsDesc: 'Peakus - max your focus. Seguí al creador en Instagram:',
    
    // Data
    dataSubtitle: 'Tus ajustes, estadísticas y enlaces se sincronizan en tiempo real con la nube.',
    cloudSyncTitle: 'Sincronización en la nube',
    backupTitle: 'Copia de seguridad',
    backupDesc: 'Archivo JSON con ajustes, tareas, historial y notas.',
    exportJSON: 'Exportar JSON',
    importJSON: 'Importar JSON',
    clearDataTitle: 'Borrar datos',
    resetAll: 'Restablecer todo',

    // Pro Prank & First-time modal
    proPrankHeading: 'Hey 👋, upgrade to the pro version to continue',
    proPrankSub: 'Desbloqueá fondos 4K ilimitados de YouTube, audio lo-fi, analíticas avanzadas y sincronización.',
    proPrankContinue: 'Continuar ($9.99/mo)',
    proPrankCancel: 'Cancelar',
    proPrankPunchline: 'Focus should be free, just kidding 😂 this is free for life time',
    proPrankSubPunchline: 'Sin suscripciones ni anuncios ni muros de pago. Peakus es 100% gratis de por vida para todos.',
    proPrankCta: "¡A concentrarse! 🚀",

    // Saved Links & Analytics
    savedLinksTitle: 'Enlaces de YouTube guardados',
    savedLinksDesc: 'Todos los enlaces y videos de YouTube que pegás se sincronizan de forma segura con tu cuenta en la nube.',
    savedLinksEmpty: 'No hay enlaces guardados. ¡Pegá cualquier link de YouTube arriba para guardarlo!',
    analyticsTitle: 'Analítica de Foco y Tendencias',
    analytics7d: '7 Días',
    analytics14d: '14 Días',
    dailyTarget: 'Meta diaria',
    peakFocusDay: 'Día pico',
    totalMinutes: 'Foco total',
    goalAchieved: 'Meta cumplida',

    // Zen mode & Pomodoro presets
    zenMode: 'Modo Zen',
    exitZen: 'Salir de Zen',
    zenHint: 'Solo temporizador visible',
    presetsTitle: 'Preajustes Pomodoro Personalizados',
    presetsDesc: 'Configurá 3 combinaciones rápidas de Pomodoro guardadas en tu navegador.',
    presetName: 'Nombre del preajuste',
    applyPreset: 'Aplicar',
    savePreset: 'Guardar',
    presetAppliedToast: 'Preajuste Pomodoro aplicado',

    // Flow Mode
    flowMode: 'Modo Flujo (Continuar)',
    flowModeDesc: 'Al terminar una sesión de foco, pregunta si querés sumar 10 minutos más antes del descanso.',
    flowActive: 'Modo Flujo Activo',
    continueFlowTitle: '¿Querés continuar tu flujo?',
    continueFlowDesc: '¡Excelente foco! ¿Querés sumar 10 minutos más para mantener tu concentración o empezar el descanso?',
    continueFlowYes: 'Continuar Flujo (+10 min)',
    continueFlowNo: 'Iniciar Descanso',
    flowAddedToast: 'Sumamos 10 minutos a tu estado de flujo 🌊',
  },
};

/**
 * Returns translated string for given key and language
 */
export function t(key: keyof TranslationDictionary, lang: LanguageCode = 'en'): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}

/**
 * Multi-lingual Quotes collections
 */
export const MULTILINGUAL_QUOTES: Record<LanguageCode, string[]> = {
  en: [
    'Be kind to your mind.',
    'Focus on being productive instead of busy.',
    'One step at a time.',
    'What you do every day matters more than what you do once in a while.',
    'Start where you are, with what you have.',
    'Consistency beats talent.',
    'Done is better than perfect.',
    'Small progress is still progress.',
    'Breathe. Keep going.',
    'Your future self will thank you.',
    'Focus on what is in your control.',
    'Less tabs, more focus.',
    'The best time to start was yesterday. The next best time is right now.',
    'Every deep session counts.',
    'Slow and steady wins the race.',
    'Rest is an essential part of the work.',
    'One task at a time.',
    'A little better today than yesterday.',
    'Patience is the foundation of progress.',
    'Hard things become easy with regular practice.',
    'Your attention is your superpower.',
    'Make it simple. Make it today.',
    'Trust the process.',
    'Close one loop before opening another.',
    'If you feel stuck, return to step one.',
    'Understanding takes time, and that is okay.',
    'Less perfection, more consistency.',
    'Think big, start tiny.',
    'Calmness is productive.',
    'You are closer than you were yesterday.',
  ],
  ta: [
    'முயற்சி திருவினையாக்கும்.',
    'அமைதியான மனம் ஆழமான சிந்தனைக்கு வழிவகுக்கும்.',
    'ஒரு நேரத்தில் ஒரு பணியில் முழு கவனம் செலுத்துங்கள்.',
    'தொடர் பயிற்சியே வெற்றியை நிர்ணயிக்கிறது.',
    'சிறு துளி பெரு வெள்ளம்; சிறிய முன்னேற்றமும் மிகப்பெரிய மாற்றமாகும்.',
    'நாளைய உங்கள் வெற்றி இன்றைய உங்கள் கவனத்தில் உள்ளது.',
    'எண்ணிய எண்ணியாங்கு எய்துப எண்ணியார் திண்ணியர் ஆகப் பெறின்.',
    'தடைகளை படிக்கற்களாக மாற்றுங்கள்.',
    'எல்லாம் எளிதாகும் முன் கடினமாகவே தோன்றும்.',
    'உங்கள் நேரம் உங்கள் மிக உயர்ந்த சொத்து.',
    'ஒவ்வொரு நாளும் புதிதாக தொடங்குங்கள்.',
    'அமைதியான உழைப்பு அமைதியான வெற்றியைத் தரும்.',
    'பொறுமையும் நிலைத்தன்மையும் மகத்தான மாற்றங்களை உண்டாக்கும்.',
    'கற்றது கைமண் அளவு, கல்லாதது உலகளவு.',
    'மனம் ஒருமுகப்பட்டால் சாதனைகள் சாத்தியமாகும்.',
    'இன்றைய உழைப்பு நாளைய வெளிச்சம்.',
    'எண்ணம் போல் வாழ்வு.',
    'தொடங்குவதே பாதி வெற்றி.',
    'தோல்விகள் அனுபவத்தின் படிக்கட்டுகள்.',
    'உங்கள் இலக்கை நோக்கி தினமும் ஒரு அடி எடுத்து வையுங்கள்.',
  ],
  es: [
    'Sé amable con tu mente',
    'Concentrate en ser productivo, no en estar ocupado',
    'Un paso a la vez',
    'Lo que hacés todos los días importa más que lo que hacés de vez en cuando',
    'Empezá donde estás, con lo que tenés',
    'La constancia le gana al talento',
    'Hecho es mejor que perfecto',
    'Los avances chiquitos también son avances',
    'Respirá. Seguí.',
    'Tu yo del futuro te lo va a agradecer',
    'Enfocate en lo que depende de vos',
    'Menos pestañas, más foco',
    'El mejor momento para empezar es ahora',
    'Cada sesión suma',
    'Despacio también se llega',
    'Descansar también es parte del trabajo',
    'Una cosa por vez',
    'Hoy, un poco mejor que ayer',
    'El progreso ama la paciencia',
    'Lo difícil se vuelve fácil con práctica',
    'Tu atención vale oro',
    'Hacelo simple, hacelo hoy',
    'Confiá en el proceso',
    'Cerrá una tarea antes de abrir otra',
    'Si te trabás, volvé al primer paso',
    'Entender lleva tiempo, y está bien',
    'Menos perfecto, más constante',
    'Pensá en grande, empezá en chiquito',
    'La calma también es productiva',
    'Estás más cerca que ayer',
  ],
};
