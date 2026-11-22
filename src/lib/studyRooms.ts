import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { TimerState } from '../types';
import { pickNextHostMember, sortRoomMessagesChronologically } from './roomEngine';

export interface StudyRoomTimer {
  status: string;
  phase: string;
  remainingMs: number;
  durationMs: number;
  cycle: number;
  startedAt: number | null;
  targetEndTime?: number | null;
}

export interface StudyRoom {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  timerMode: 'synced' | 'independent';
  timer?: StudyRoomTimer | null;
  locked?: boolean;
  closed?: boolean;
  maxMembers?: number;
  sharedGoalTitle?: string;
  sharedGoalTargetMs?: number;
  groupHardcore?: boolean;
  sprintStartAt?: number | null;
  mutedUserIds?: string[];
  kickedUserIds?: string[];
  createdAt: number;
  updatedAt: number;
  memberCount?: number;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  status: 'focusing' | 'break' | 'idle';
  currentTask?: string;
  activeTaskDone?: boolean;
  hardcoreMode?: boolean;
  todayFocusMs: number;
  isHost: boolean;
  joinedAt: number;
  lastActive: number;
}

export interface RoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'chat' | 'reaction' | 'system' | 'nudge';
  createdAt: number;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.warn('Firestore Room Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

/**
 * Generate a clean 6-character uppercase room code
 * Omit visually ambiguous characters (0, O, 1, I)
 */
export function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Clean & normalize a room code input (e.g. "focus-8" -> "FOCUS8")
 */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

/**
 * Get current user display name
 */
export function getCurrentUserName(): string {
  const user = auth.currentUser;
  if (!user) return 'Anonymous Friend';
  if (user.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user.email) return user.email.split('@')[0];
  return `Student-${user.uid.slice(0, 4)}`;
}

/**
 * Create a new Study Room in Firestore
 */
export async function createStudyRoom(
  name: string,
  timerMode: 'synced' | 'independent',
  currentTimer?: TimerState,
  customCode?: string,
  todayFocusMs: number = 0,
  activeTask?: string,
  options?: {
    sharedGoalTitle?: string;
    sharedGoalTargetMs?: number;
    groupHardcore?: boolean;
    maxMembers?: number;
    hardcoreMode?: boolean;
  }
): Promise<{ room: StudyRoom; member: RoomMember }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to create a room');

  const rawCode = customCode ? normalizeRoomCode(customCode) : generateRoomCode();
  const code = rawCode.length >= 4 ? rawCode : generateRoomCode();
  const roomPath = `rooms/${code}`;

  const displayName = getCurrentUserName();
  const now = Date.now();

  const newRoom: StudyRoom = {
    code,
    name: (name.trim() || `${displayName}'s Study Room`).slice(0, 80),
    hostId: user.uid,
    hostName: displayName,
    timerMode,
    timer:
      timerMode === 'synced' && currentTimer
        ? {
            status: currentTimer.status,
            phase: currentTimer.phase,
            remainingMs: currentTimer.remainingMs,
            durationMs: currentTimer.durationMs,
            cycle: currentTimer.cycle,
            startedAt: currentTimer.startedAt ?? null,
            targetEndTime: currentTimer.targetEndTime ?? null,
          }
        : null,
    locked: false,
    closed: false,
    maxMembers: Math.min(50, Math.max(2, options?.maxMembers || 12)),
    sharedGoalTitle: (options?.sharedGoalTitle || '').trim().slice(0, 100),
    sharedGoalTargetMs: Math.max(0, Number(options?.sharedGoalTargetMs) || 0),
    groupHardcore: !!options?.groupHardcore,
    sprintStartAt: null,
    mutedUserIds: [],
    kickedUserIds: [],
    createdAt: now,
    updatedAt: now,
    memberCount: 1,
  };

  const initialMember: RoomMember = {
    userId: user.uid,
    displayName,
    status:
      currentTimer?.status === 'running'
        ? currentTimer.phase === 'focus'
          ? 'focusing'
          : 'break'
        : 'idle',
    currentTask: (activeTask || '').slice(0, 120),
    activeTaskDone: false,
    hardcoreMode: !!options?.hardcoreMode,
    todayFocusMs,
    isHost: true,
    joinedAt: now,
    lastActive: now,
  };

  try {
    await setDoc(doc(db, 'rooms', code), newRoom);
    await setDoc(doc(db, 'rooms', code, 'members', user.uid), initialMember);

    const welcomeMsg: RoomMessage = {
      id: `sys_${now}`,
      senderId: user.uid,
      senderName: 'Peakus',
      text: `🎉 Room "${newRoom.name}" created! Share code ${code} or invite link with friends.`,
      type: 'system',
      createdAt: now,
    };
    await setDoc(doc(db, 'rooms', code, 'messages', welcomeMsg.id), welcomeMsg);

    return { room: newRoom, member: initialMember };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, roomPath);
    throw err;
  }
}

/**
 * Join an existing Study Room by code
 */
export async function joinStudyRoom(
  code: string,
  currentTimerStatus: 'focusing' | 'break' | 'idle' = 'idle',
  activeTask?: string,
  todayFocusMs: number = 0,
  hardcoreMode: boolean = false
): Promise<{ room: StudyRoom; member: RoomMember }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to join a room');

  const normalized = normalizeRoomCode(code);
  const roomPath = `rooms/${normalized}`;

  try {
    const roomSnap = await getDoc(doc(db, 'rooms', normalized));
    if (!roomSnap.exists()) {
      throw new Error(`Room with code "${normalized}" was not found. Please check the code.`);
    }

    const room = roomSnap.data() as StudyRoom;
    if (room.closed) {
      throw new Error('This study room has been closed by the host.');
    }
    if (room.kickedUserIds?.includes(user.uid)) {
      throw new Error('You were removed from this study room by the host.');
    }
    const isHost = room.hostId === user.uid;
    if (room.locked && !isHost) {
      throw new Error('This room is currently locked by the host.');
    }

    const membersSnap = await getDocs(collection(db, 'rooms', normalized, 'members'));
    const maxMembers = room.maxMembers || 12;
    const alreadyMember = membersSnap.docs.some(d => d.id === user.uid);
    const activeCount = membersSnap.docs.filter(d => {
      const m = d.data() as RoomMember;
      return Date.now() - (m.lastActive || 0) < 15 * 60 * 1000;
    }).length;
    if (!alreadyMember && !isHost && activeCount >= maxMembers) {
      throw new Error(`This room is full (${maxMembers}/${maxMembers} members).`);
    }

    const displayName = getCurrentUserName();
    const now = Date.now();

    const member: RoomMember = {
      userId: user.uid,
      displayName,
      status: currentTimerStatus,
      currentTask: (activeTask || '').slice(0, 120),
      activeTaskDone: false,
      hardcoreMode,
      todayFocusMs,
      isHost,
      joinedAt: now,
      lastActive: now,
    };

    await setDoc(doc(db, 'rooms', normalized, 'members', user.uid), member);
    await updateDoc(doc(db, 'rooms', normalized), {
      updatedAt: now,
      memberCount: alreadyMember ? activeCount : activeCount + 1,
    }).catch(() => {});

    if (!room.mutedUserIds?.includes(user.uid)) {
      const joinMsg: RoomMessage = {
        id: `sys_join_${user.uid.slice(0, 6)}_${now}`,
        senderId: user.uid,
        senderName: displayName,
        text: `${displayName} joined the study room 👋`,
        type: 'system',
        createdAt: now,
      };
      await setDoc(doc(db, 'rooms', normalized, 'messages', joinMsg.id), joinMsg).catch(() => {});
    }

    return { room, member };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, roomPath);
    throw err;
  }
}

/**
 * Leave a Study Room cleanly, handing off host if others remain
 */
export async function leaveStudyRoom(
  code: string,
  knownMembers: RoomMember[] = [],
  roomSnapshot?: StudyRoom | null
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;

  const normalized = normalizeRoomCode(code);
  const displayName = getCurrentUserName();
  const now = Date.now();

  try {
    let room = roomSnapshot;
    if (!room) {
      const snap = await getDoc(doc(db, 'rooms', normalized));
      room = snap.exists() ? (snap.data() as StudyRoom) : null;
    }

    if (room && room.hostId === user.uid) {
      let membersList = knownMembers;
      if (!membersList.length) {
        const mSnap = await getDocs(collection(db, 'rooms', normalized, 'members'));
        membersList = mSnap.docs.map(d => d.data() as RoomMember);
      }
      const nextHost = pickNextHostMember(membersList, user.uid, room.kickedUserIds || []);
      if (nextHost) {
        // Promote member FIRST while leaving user is still hostId on parent doc
        await updateDoc(doc(db, 'rooms', normalized, 'members', nextHost.userId), {
          isHost: true,
        }).catch(() => {});
        await updateDoc(doc(db, 'rooms', normalized), {
          hostId: nextHost.userId,
          hostName: nextHost.displayName,
          updatedAt: now,
          memberCount: Math.max(1, membersList.length - 1),
        });
        await setDoc(doc(db, 'rooms', normalized, 'messages', `sys_host_${now}`), {
          id: `sys_host_${now}`,
          senderId: user.uid,
          senderName: displayName,
          text: `👑 ${displayName} left — ${nextHost.displayName} is now the host.`,
          type: 'system',
          createdAt: now,
        } satisfies RoomMessage).catch(() => {});
      } else {
        await updateDoc(doc(db, 'rooms', normalized), {
          closed: true,
          updatedAt: now,
          memberCount: 0,
        }).catch(() => {});
        await deleteDoc(doc(db, 'rooms', normalized)).catch(() => {});
      }
    } else if (room && !room.mutedUserIds?.includes(user.uid) && !room.kickedUserIds?.includes(user.uid)) {
      await setDoc(doc(db, 'rooms', normalized, 'messages', `sys_leave_${user.uid.slice(0, 6)}_${now}`), {
        id: `sys_leave_${user.uid.slice(0, 6)}_${now}`,
        senderId: user.uid,
        senderName: displayName,
        text: `${displayName} left the room.`,
        type: 'system',
        createdAt: now,
      } satisfies RoomMessage).catch(() => {});
      await updateDoc(doc(db, 'rooms', normalized), {
        updatedAt: now,
        memberCount: Math.max(1, (room.memberCount || 1) - 1),
      }).catch(() => {});
    }

    await deleteDoc(doc(db, 'rooms', normalized, 'members', user.uid)).catch(() => {});
  } catch (err) {
    console.warn('Error leaving room:', err);
  }
}

/**
 * Host closes the study room for all participants
 */
export async function closeStudyRoom(code: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;
  const normalized = normalizeRoomCode(code);
  try {
    await updateDoc(doc(db, 'rooms', normalized), {
      closed: true,
      updatedAt: Date.now(),
    });
    await deleteDoc(doc(db, 'rooms', normalized)).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${normalized}`);
  }
}

/**
 * Host transfers host privileges to another active member
 */
export async function transferRoomHost(
  code: string,
  newHostUid: string,
  newHostName: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code || newHostUid === user.uid) return;
  const normalized = normalizeRoomCode(code);
  const now = Date.now();
  try {
    await updateDoc(doc(db, 'rooms', normalized, 'members', newHostUid), { isHost: true });
    await updateDoc(doc(db, 'rooms', normalized), {
      hostId: newHostUid,
      hostName: newHostName,
      updatedAt: now,
    });
    await updateDoc(doc(db, 'rooms', normalized, 'members', user.uid), { isHost: false }).catch(() => {});
    await setDoc(doc(db, 'rooms', normalized, 'messages', `sys_xfer_${now}`), {
      id: `sys_xfer_${now}`,
      senderId: user.uid,
      senderName: getCurrentUserName(),
      text: `👑 ${newHostName} was promoted to Room Host.`,
      type: 'system',
      createdAt: now,
    } satisfies RoomMessage).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${normalized}`);
  }
}

/**
 * Host kicks a member from the room
 */
export async function kickRoomMember(
  code: string,
  targetUid: string,
  targetName: string,
  currentKicked: string[] = []
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code || targetUid === user.uid) return;
  const normalized = normalizeRoomCode(code);
  const now = Date.now();
  const nextKicked = Array.from(new Set([...currentKicked, targetUid])).slice(0, 50);
  try {
    await updateDoc(doc(db, 'rooms', normalized), {
      kickedUserIds: nextKicked,
      updatedAt: now,
    });
    await deleteDoc(doc(db, 'rooms', normalized, 'members', targetUid)).catch(() => {});
    await setDoc(doc(db, 'rooms', normalized, 'messages', `sys_kick_${now}`), {
      id: `sys_kick_${now}`,
      senderId: user.uid,
      senderName: getCurrentUserName(),
      text: `🛡️ ${targetName} was removed from the room.`,
      type: 'system',
      createdAt: now,
    } satisfies RoomMessage).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${normalized}`);
  }
}

/**
 * Host mutes or unmutes a member in room chat
 */
export async function toggleMuteRoomMember(
  code: string,
  targetUid: string,
  targetName: string,
  currentMuted: string[] = []
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !code || targetUid === user.uid) return false;
  const normalized = normalizeRoomCode(code);
  const isMuted = currentMuted.includes(targetUid);
  const nextMuted = isMuted
    ? currentMuted.filter(id => id !== targetUid)
    : Array.from(new Set([...currentMuted, targetUid])).slice(0, 50);
  const now = Date.now();
  try {
    await updateDoc(doc(db, 'rooms', normalized), {
      mutedUserIds: nextMuted,
      updatedAt: now,
    });
    await setDoc(doc(db, 'rooms', normalized, 'messages', `sys_mute_${now}`), {
      id: `sys_mute_${now}`,
      senderId: user.uid,
      senderName: getCurrentUserName(),
      text: isMuted ? `🔊 ${targetName} can chat again.` : `🔇 ${targetName} was muted by host.`,
      type: 'system',
      createdAt: now,
    } satisfies RoomMessage).catch(() => {});
    return !isMuted;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${normalized}`);
    return isMuted;
  }
}

/**
 * Host updates room lock, capacity, shared goal, group hardcore, or sprint schedule
 */
export async function updateRoomSettings(
  code: string,
  patch: Partial<
    Pick<
      StudyRoom,
      | 'locked'
      | 'maxMembers'
      | 'sharedGoalTitle'
      | 'sharedGoalTargetMs'
      | 'groupHardcore'
      | 'sprintStartAt'
    >
  >
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;
  const normalized = normalizeRoomCode(code);
  try {
    await updateDoc(doc(db, 'rooms', normalized), {
      ...patch,
      updatedAt: Date.now(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${normalized}`);
  }
}

/**
 * Host starts a 60-second synchronized sprint countdown
 */
export async function scheduleRoomSprint(code: string, durationSec = 60): Promise<number> {
  const user = auth.currentUser;
  if (!user || !code) return 0;
  const normalized = normalizeRoomCode(code);
  const now = Date.now();
  const sprintStartAt = now + durationSec * 1000;
  try {
    await updateDoc(doc(db, 'rooms', normalized), {
      sprintStartAt,
      updatedAt: now,
    });
    await setDoc(doc(db, 'rooms', normalized, 'messages', `sys_sprint_${now}`), {
      id: `sys_sprint_${now}`,
      senderId: user.uid,
      senderName: getCurrentUserName(),
      text: `🚀 Sprint starting in ${durationSec} seconds — lock in!`,
      type: 'system',
      createdAt: now,
    } satisfies RoomMessage).catch(() => {});
    return sprintStartAt;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${normalized}`);
    return 0;
  }
}

/**
 * Update member live presence (heartbeat, status, active task, hardcore flag)
 */
export async function updateMemberPresence(
  code: string,
  status: 'focusing' | 'break' | 'idle',
  currentTask?: string,
  todayFocusMs?: number,
  hardcoreMode?: boolean,
  activeTaskDone?: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;

  const normalized = normalizeRoomCode(code);
  const memberRef = doc(db, 'rooms', normalized, 'members', user.uid);

  const updates: Partial<RoomMember> = {
    userId: user.uid,
    displayName: getCurrentUserName(),
    status,
    lastActive: Date.now(),
  };
  if (currentTask !== undefined) updates.currentTask = currentTask.slice(0, 120);
  if (todayFocusMs !== undefined) updates.todayFocusMs = todayFocusMs;
  if (hardcoreMode !== undefined) updates.hardcoreMode = hardcoreMode;
  if (activeTaskDone !== undefined) updates.activeTaskDone = activeTaskDone;

  try {
    await setDoc(memberRef, updates, { merge: true });
  } catch (err) {
    console.warn('Presence update error:', err);
  }
}

/**
 * Broadcast timer update (for Host in synced rooms) with drift-free targetEndTime
 */
export async function broadcastRoomTimer(code: string, timer: TimerState): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;

  const normalized = normalizeRoomCode(code);
  const roomRef = doc(db, 'rooms', normalized);

  try {
    await setDoc(
      roomRef,
      {
        timer: {
          status: timer.status,
          phase: timer.phase,
          remainingMs: timer.remainingMs,
          durationMs: timer.durationMs,
          cycle: timer.cycle,
          startedAt: timer.startedAt ?? null,
          targetEndTime: timer.targetEndTime ?? null,
        },
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Broadcast timer error:', err);
  }
}

/**
 * Send chat message, emoji reaction, nudge, or system milestone in the study room
 */
export async function sendRoomMessage(
  code: string,
  text: string,
  type: 'chat' | 'reaction' | 'system' | 'nudge' = 'chat'
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to send messages.');
  if (!code || !text.trim()) return;

  const normalized = normalizeRoomCode(code);
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  const id = `msg_${user.uid.slice(0, 5)}_${now}_${rand}`;

  const message: RoomMessage = {
    id,
    senderId: user.uid,
    senderName: getCurrentUserName(),
    text: text.trim().slice(0, 360),
    type,
    createdAt: now,
  };

  try {
    await setDoc(doc(db, 'rooms', normalized, 'messages', id), message);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${normalized}/messages`);
  }
}

/**
 * Send an encouraging accountability nudge to an idle member
 */
export async function sendRoomNudge(code: string, targetName: string): Promise<void> {
  const senderName = getCurrentUserName();
  await sendRoomMessage(
    code,
    `👋 ${senderName} nudged ${targetName}: Time to start focusing!`,
    'nudge'
  );
}

/**
 * Real-time listener for Room Document
 */
export function subscribeToStudyRoom(
  code: string,
  onRoom: (room: StudyRoom | null) => void
): Unsubscribe {
  const normalized = normalizeRoomCode(code);
  const roomRef = doc(db, 'rooms', normalized);

  return onSnapshot(
    roomRef,
    snap => {
      if (!snap.exists()) {
        onRoom(null);
        return;
      }
      onRoom(snap.data() as StudyRoom);
    },
    err => {
      console.warn('Room subscribe error:', err);
    }
  );
}

/**
 * Real-time listener for Room Members
 */
export function subscribeToRoomMembers(
  code: string,
  onMembers: (members: RoomMember[]) => void
): Unsubscribe {
  const normalized = normalizeRoomCode(code);
  const membersRef = collection(db, 'rooms', normalized, 'members');

  return onSnapshot(
    membersRef,
    snap => {
      const list: RoomMember[] = [];
      const now = Date.now();
      snap.forEach(d => {
        const m = d.data() as RoomMember;
        if (now - m.lastActive < 15 * 60 * 1000) {
          list.push(m);
        }
      });
      list.sort((a, b) => {
        if (a.isHost && !b.isHost) return -1;
        if (!a.isHost && b.isHost) return 1;
        return a.joinedAt - b.joinedAt;
      });
      onMembers(list);
    },
    err => {
      console.warn('Members subscribe error:', err);
    }
  );
}

/**
 * Real-time listener for Room Messages (streams latest 120 messages in chronological order)
 */
export function subscribeToRoomMessages(
  code: string,
  onMessages: (messages: RoomMessage[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const normalized = normalizeRoomCode(code);
  const messagesQuery = query(
    collection(db, 'rooms', normalized, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(120)
  );

  return onSnapshot(
    messagesQuery,
    snap => {
      const list: RoomMessage[] = [];
      snap.forEach(d => {
        list.push(d.data() as RoomMessage);
      });
      onMessages(sortRoomMessagesChronologically(list));
    },
    err => {
      console.warn('Messages subscribe error:', err);
      onError?.(err);
    }
  );
}
