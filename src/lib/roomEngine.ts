import { normalizeRoomCode } from './studyRooms';

export interface RoomTimerSnapshot {
  status: string;
  phase: string;
  remainingMs: number;
  durationMs: number;
  cycle: number;
  startedAt: number | null;
  targetEndTime?: number | null;
}

export interface RoomMemberLike {
  userId: string;
  displayName: string;
  status: 'focusing' | 'break' | 'idle';
  todayFocusMs: number;
  isHost: boolean;
  joinedAt: number;
  lastActive: number;
}

export interface RoomMessageLike {
  id: string;
  senderId: string;
  createdAt: number;
  type: 'chat' | 'reaction' | 'system' | 'nudge';
}

export function buildRoomInviteUrl(code: string, origin: string, pathname = '/'): string {
  const cleanCode = normalizeRoomCode(code);
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${cleanOrigin}${cleanPath}?room=${encodeURIComponent(cleanCode)}`;
}

export function extractInviteRoomCode(search: string): string | null {
  if (!search) return null;
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const raw = params.get('room');
    if (!raw) return null;
    const clean = normalizeRoomCode(raw);
    return clean.length >= 4 ? clean : null;
  } catch {
    return null;
  }
}

export function computeSyncedTimerDisplay(
  timer: RoomTimerSnapshot | null | undefined,
  now = Date.now()
): {
  status: 'idle' | 'running' | 'paused';
  phase: 'focus' | 'short' | 'long';
  remainingMs: number;
  durationMs: number;
  cycle: number;
  startedAt: number | null;
  targetEndTime: number | null;
} | null {
  if (!timer) return null;
  const status: 'idle' | 'running' | 'paused' =
    timer.status === 'running' ? 'running' : timer.status === 'paused' ? 'paused' : 'idle';
  const phase: 'focus' | 'short' | 'long' =
    timer.phase === 'short' ? 'short' : timer.phase === 'long' ? 'long' : 'focus';

  let remainingMs = Math.max(0, Number(timer.remainingMs) || 0);
  const targetEndTime =
    status === 'running' && typeof timer.targetEndTime === 'number' && timer.targetEndTime > 0
      ? timer.targetEndTime
      : null;

  if (status === 'running' && targetEndTime !== null) {
    remainingMs = Math.max(0, targetEndTime - now);
  }

  return {
    status,
    phase,
    remainingMs,
    durationMs: Math.max(1000, Number(timer.durationMs) || remainingMs || 25 * 60000),
    cycle: Math.max(0, Number(timer.cycle) || 0),
    startedAt: timer.startedAt ?? null,
    targetEndTime,
  };
}

export function sortMembersLeaderboard<T extends RoomMemberLike>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const focusDiff = (b.todayFocusMs || 0) - (a.todayFocusMs || 0);
    if (focusDiff !== 0) return focusDiff;
    const aFocusing = a.status === 'focusing' ? 1 : 0;
    const bFocusing = b.status === 'focusing' ? 1 : 0;
    if (bFocusing !== aFocusing) return bFocusing - aFocusing;
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
}

export function computeRoomTotalFocusMs(members: Array<{ todayFocusMs?: number }>): number {
  return members.reduce((sum, m) => sum + Math.max(0, Number(m.todayFocusMs) || 0), 0);
}

export function pickNextHostMember<T extends { userId: string; joinedAt: number }>(
  members: T[],
  leavingUid: string,
  kickedUserIds: string[] = []
): T | null {
  const kicked = new Set(kickedUserIds);
  const candidates = members
    .filter(m => m.userId !== leavingUid && !kicked.has(m.userId))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  return candidates[0] ?? null;
}

export function formatSprintCountdown(
  sprintStartAt: number | null | undefined,
  now = Date.now()
): { active: boolean; ready: boolean; secondsLeft: number } {
  if (!sprintStartAt || sprintStartAt <= 0) {
    return { active: false, ready: false, secondsLeft: 0 };
  }
  const diffMs = sprintStartAt - now;
  if (diffMs <= 0) {
    // Considered ready to fire within a 15s grace window
    return { active: false, ready: diffMs > -15000, secondsLeft: 0 };
  }
  return {
    active: true,
    ready: false,
    secondsLeft: Math.ceil(diffMs / 1000),
  };
}

export function computeUnreadMessagesCount(
  messages: RoomMessageLike[],
  currentUid: string | undefined,
  lastReadAt: number
): number {
  if (!currentUid) return 0;
  return messages.filter(
    m => m.senderId !== currentUid && m.createdAt > lastReadAt && m.type !== 'system'
  ).length;
}

export function sortRoomMessagesChronologically<T extends { id: string; createdAt: number }>(
  messages: T[]
): T[] {
  return [...messages].sort((a, b) => {
    const diff = (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0);
    if (diff !== 0) return diff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}
