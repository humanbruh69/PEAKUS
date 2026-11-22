export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 70;
  return Math.max(0, Math.min(100, Math.round(volume)));
}

export function clampSeekSeconds(seconds: number, duration: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.floor(seconds);
  return Math.max(0, Math.min(duration, seconds));
}

export function fmtMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

export function computeProgressRatio(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, currentTime / duration));
}

export function isLiveYouTubeStream(duration: number, isLiveHint = false): boolean {
  if (isLiveHint) return true;
  return !Number.isFinite(duration) || duration <= 0;
}
