import {
  doc,
  collection,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { TimerState } from '../types';

export interface StudyRoom {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  timerMode: 'synced' | 'independent';
  timer?: {
    status: string;
    phase: string;
    remainingMs: number;
    durationMs: number;
    cycle: number;
    startedAt: number | null;
  } | null;
  theme?: any;
  createdAt: number;
  updatedAt: number;
  memberCount?: number;
}

export interface RoomMember {
  userId: string;
  displayName: string;
  status: 'focusing' | 'break' | 'idle';
  currentTask?: string;
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
  type: 'chat' | 'reaction' | 'system';
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
  activeTask?: string
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
    name: name.trim() || `${displayName}'s Study Room`,
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
          }
        : null,
    createdAt: now,
    updatedAt: now,
    memberCount: 1,
  };

  const initialMember: RoomMember = {
    userId: user.uid,
    displayName,
    status: currentTimer?.status === 'running' ? 'focusing' : 'idle',
    currentTask: activeTask || '',
    todayFocusMs,
    isHost: true,
    joinedAt: now,
    lastActive: now,
  };

  try {
    // Write room document
    await setDoc(doc(db, 'rooms', code), newRoom);

    // Add host as member
    await setDoc(doc(db, 'rooms', code, 'members', user.uid), initialMember);

    // Add welcome system message
    const welcomeMsg: RoomMessage = {
      id: `sys_${now}`,
      senderId: user.uid,
      senderName: 'Peakus',
      text: `🎉 Room "${newRoom.name}" created! Share code ${code} with friends to study together.`,
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
  todayFocusMs: number = 0
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
    const displayName = getCurrentUserName();
    const now = Date.now();
    const isHost = room.hostId === user.uid;

    const member: RoomMember = {
      userId: user.uid,
      displayName,
      status: currentTimerStatus,
      currentTask: activeTask || '',
      todayFocusMs,
      isHost,
      joinedAt: now,
      lastActive: now,
    };

    // Add / update member in room
    await setDoc(doc(db, 'rooms', normalized, 'members', user.uid), member);

    // Send friendly join message
    const joinMsg: RoomMessage = {
      id: `sys_join_${user.uid}_${now}`,
      senderId: user.uid,
      senderName: displayName,
      text: `${displayName} joined the study room 👋`,
      type: 'system',
      createdAt: now,
    };
    await setDoc(doc(db, 'rooms', normalized, 'messages', joinMsg.id), joinMsg);

    return { room, member };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, roomPath);
    throw err;
  }
}

/**
 * Leave a Study Room
 */
export async function leaveStudyRoom(code: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;

  const normalized = normalizeRoomCode(code);
  const memberPath = `rooms/${normalized}/members/${user.uid}`;

  try {
    await deleteDoc(doc(db, 'rooms', normalized, 'members', user.uid));
  } catch (err) {
    console.warn('Error leaving room:', err);
  }
}

/**
 * Update member live presence (heartbeat, status, active task)
 */
export async function updateMemberPresence(
  code: string,
  status: 'focusing' | 'break' | 'idle',
  currentTask?: string,
  todayFocusMs?: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code) return;

  const normalized = normalizeRoomCode(code);
  const memberRef = doc(db, 'rooms', normalized, 'members', user.uid);

  const updates: Partial<RoomMember> = {
    status,
    lastActive: Date.now(),
  };
  if (currentTask !== undefined) updates.currentTask = currentTask;
  if (todayFocusMs !== undefined) updates.todayFocusMs = todayFocusMs;

  try {
    await setDoc(memberRef, updates, { merge: true });
  } catch (err) {
    console.warn('Presence update error:', err);
  }
}

/**
 * Broadcast timer update (for Host in synced rooms)
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
 * Send chat message or emoji reaction in the study room
 */
export async function sendRoomMessage(
  code: string,
  text: string,
  type: 'chat' | 'reaction' = 'chat'
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !code || !text.trim()) return;

  const normalized = normalizeRoomCode(code);
  const now = Date.now();
  const id = `msg_${user.uid.slice(0, 5)}_${now}`;

  const message: RoomMessage = {
    id,
    senderId: user.uid,
    senderName: getCurrentUserName(),
    text: text.trim().slice(0, 300),
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
        // Filter out members who have been inactive for over 15 minutes
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
 * Real-time listener for Room Messages
 */
export function subscribeToRoomMessages(
  code: string,
  onMessages: (messages: RoomMessage[]) => void
): Unsubscribe {
  const normalized = normalizeRoomCode(code);
  const messagesQuery = query(
    collection(db, 'rooms', normalized, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(60)
  );

  return onSnapshot(
    messagesQuery,
    snap => {
      const list: RoomMessage[] = [];
      snap.forEach(d => {
        list.push(d.data() as RoomMessage);
      });
      onMessages(list);
    },
    err => {
      console.warn('Messages subscribe error:', err);
    }
  );
}
