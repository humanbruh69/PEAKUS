import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './Icons';
import {
  StudyRoom,
  RoomMember,
  RoomMessage,
  createStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  closeStudyRoom,
  transferRoomHost,
  kickRoomMember,
  toggleMuteRoomMember,
  updateRoomSettings,
  scheduleRoomSprint,
  sendRoomMessage,
  sendRoomNudge,
  updateMemberPresence,
  subscribeToStudyRoom,
  subscribeToRoomMembers,
  subscribeToRoomMessages,
  normalizeRoomCode,
  generateRoomCode,
} from '../lib/studyRooms';
import {
  buildRoomInviteUrl,
  sortMembersLeaderboard,
  computeRoomTotalFocusMs,
  formatSprintCountdown,
} from '../lib/roomEngine';
import { TimerState, Task } from '../types';
import { fmtDur } from '../lib/utils';
import { auth } from '../lib/firebase';

export interface StudyRoomPanelProps {
  timerState: TimerState;
  activeTask?: Task;
  todayFocusMs: number;
  onToast: (msg: string, type?: 'err' | '') => void;
  currentRoomCode: string | null;
  onJoinedRoom: (code: string) => void;
  onLeftRoom: () => void;
  embedded?: boolean;
  onClose?: () => void;
  // Lifted optional props from App.tsx
  managedExternally?: boolean;
  room?: StudyRoom | null;
  members?: RoomMember[];
  messages?: RoomMessage[];
  initialJoinCode?: string | null;
  chatMuted?: boolean;
  onToggleChatMuted?: () => void;
  breakOnlyAlerts?: boolean;
  onToggleBreakOnlyAlerts?: () => void;
  unreadCount?: number;
  onActiveTabChange?: (tab: 'members' | 'chat') => void;
  onMarkChatRead?: () => void;
  isHardcoreMode?: boolean;
  onEnableHardcoreMode?: () => void;
  ownTaskText?: string;
  ownTaskDone?: boolean;
  onUpdateOwnTask?: (title: string, done: boolean) => void;
}

interface StudyRoomModalProps extends Omit<StudyRoomPanelProps, 'embedded' | 'onClose'> {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_REACTIONS = [
  { emoji: '🔥', label: 'Keep pushing!' },
  { emoji: '💯', label: 'Crushed it!' },
  { emoji: '☕', label: 'Coffee break!' },
  { emoji: '🧠', label: 'In the zone!' },
  { emoji: '👏', label: 'Great focus!' },
  { emoji: '🚀', label: 'Let’s gooo!' },
];

export const StudyRoomPanel: React.FC<StudyRoomPanelProps> = ({
  timerState,
  activeTask,
  todayFocusMs,
  onToast,
  currentRoomCode,
  onJoinedRoom,
  onLeftRoom,
  embedded = false,
  onClose,
  managedExternally = false,
  room: roomProp,
  members: membersProp,
  messages: messagesProp,
  initialJoinCode = null,
  chatMuted = false,
  onToggleChatMuted,
  breakOnlyAlerts = false,
  onToggleBreakOnlyAlerts,
  unreadCount = 0,
  onActiveTabChange,
  onMarkChatRead,
  isHardcoreMode = false,
  onEnableHardcoreMode,
  ownTaskText,
  ownTaskDone = false,
  onUpdateOwnTask,
}) => {
  // Lobby state
  const [lobbyTab, setLobbyTab] = useState<'join' | 'create'>(
    initialJoinCode ? 'join' : 'join'
  );
  const [joinCodeInput, setJoinCodeInput] = useState(
    initialJoinCode ? normalizeRoomCode(initialJoinCode) : ''
  );
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState(() => generateRoomCode());
  const [newTimerMode, setNewTimerMode] = useState<'synced' | 'independent'>('synced');
  const [newSharedGoalTitle, setNewSharedGoalTitle] = useState('');
  const [newSharedGoalHours, setNewSharedGoalHours] = useState<number>(4);
  const [newMaxMembers, setNewMaxMembers] = useState<number>(12);
  const [newGroupHardcore, setNewGroupHardcore] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync incoming invite code into join form
  useEffect(() => {
    if (initialJoinCode) {
      setLobbyTab('join');
      setJoinCodeInput(normalizeRoomCode(initialJoinCode));
    }
  }, [initialJoinCode]);

  // Active room state
  const [activeTab, setActiveTab] = useState<'members' | 'chat'>('members');
  const [localRoom, setLocalRoom] = useState<StudyRoom | null>(null);
  const [localMembers, setLocalMembers] = useState<RoomMember[]>([]);
  const [localMessages, setLocalMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [leaderboardSort, setLeaderboardSort] = useState(true);
  const [confirmCloseRoom, setConfirmCloseRoom] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalTitleDraft, setGoalTitleDraft] = useState('');
  const [goalHoursDraft, setGoalHoursDraft] = useState(4);
  const [taskDraft, setTaskDraft] = useState(ownTaskText ?? activeTask?.title ?? '');
  const [nudgedUids, setNudgedUids] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUid = auth.currentUser?.uid;

  const room = managedExternally ? (roomProp ?? null) : localRoom;
  const members = managedExternally ? (membersProp ?? []) : localMembers;
  const messages = managedExternally ? (messagesProp ?? []) : localMessages;

  useEffect(() => {
    setTaskDraft(ownTaskText ?? activeTask?.title ?? '');
  }, [ownTaskText, activeTask?.title]);

  // Fallback internal subscriptions only if not managed by App.tsx
  useEffect(() => {
    if (managedExternally) return;
    if (!currentRoomCode) {
      setLocalRoom(null);
      setLocalMembers([]);
      setLocalMessages([]);
      return;
    }

    const unsubRoom = subscribeToStudyRoom(currentRoomCode, r => {
      setLocalRoom(r);
      if (!r || r.closed) {
        onToast('The study room was closed by the host.', 'err');
        onLeftRoom();
      }
    });

    const unsubMembers = subscribeToRoomMembers(currentRoomCode, m => {
      setLocalMembers(m);
    });

    const unsubMessages = subscribeToRoomMessages(currentRoomCode, msgList => {
      setLocalMessages(msgList);
    });

    return () => {
      unsubRoom();
      unsubMembers();
      unsubMessages();
    };
  }, [managedExternally, currentRoomCode, onToast, onLeftRoom]);

  // Update sprint countdown clock while active
  useEffect(() => {
    if (!room?.sprintStartAt) return;
    const interval = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(interval);
  }, [room?.sprintStartAt]);

  // Sync tab selection to App for unread tracking
  const selectTab = (tab: 'members' | 'chat') => {
    setActiveTab(tab);
    onActiveTabChange?.(tab);
    if (tab === 'chat') {
      onMarkChatRead?.();
    }
  };

  // Auto-scroll chat to bottom and keep read pointer fresh
  useEffect(() => {
    if (activeTab === 'chat' && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      onMarkChatRead?.();
    }
  }, [messages, activeTab, onMarkChatRead]);

  const isHost = !!room && room.hostId === currentUid;
  const isMutedInRoom = !!(currentUid && room?.mutedUserIds?.includes(currentUid));
  const sprintState = formatSprintCountdown(room?.sprintStartAt, nowTick);

  const displayedMembers = useMemo(() => {
    return leaderboardSort ? sortMembersLeaderboard(members) : members;
  }, [members, leaderboardSort]);

  const totalRoomFocusMs = useMemo(() => computeRoomTotalFocusMs(members), [members]);

  // Handle Create Room
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const taskTitle = activeTask ? activeTask.title : undefined;
      const goalTargetMs =
        newSharedGoalTitle.trim() && newSharedGoalHours > 0
          ? newSharedGoalHours * 3600000
          : 0;
      const { room: created } = await createStudyRoom(
        newRoomName,
        newTimerMode,
        timerState,
        newRoomCode,
        todayFocusMs,
        taskTitle,
        {
          sharedGoalTitle: newSharedGoalTitle.trim(),
          sharedGoalTargetMs: goalTargetMs,
          groupHardcore: newGroupHardcore,
          maxMembers: newMaxMembers,
          hardcoreMode: isHardcoreMode,
        }
      );
      onJoinedRoom(created.code);
      onToast(`🎉 Study room "${created.name}" created! Code: ${created.code}`);
    } catch (err: any) {
      onToast(err.message || 'Failed to create study room', 'err');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Join Room
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeRoomCode(joinCodeInput);
    if (!clean) {
      onToast('Please enter a valid 6-character room code', 'err');
      return;
    }

    try {
      setIsSubmitting(true);
      const currentStatus =
        timerState.status === 'running'
          ? timerState.phase === 'focus'
            ? 'focusing'
            : 'break'
          : 'idle';
      const taskTitle = activeTask ? activeTask.title : undefined;

      const { room: joined } = await joinStudyRoom(
        clean,
        currentStatus,
        taskTitle,
        todayFocusMs,
        isHardcoreMode
      );
      onJoinedRoom(joined.code);
      onToast(`Joined "${joined.name}"! Focusing with friends 🔥`);
    } catch (err: any) {
      onToast(err.message || 'Could not join room', 'err');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Leave Room (with host handoff)
  const handleLeave = async () => {
    if (!currentRoomCode) return;
    try {
      await leaveStudyRoom(currentRoomCode, members, room);
      onLeftRoom();
      onToast('Left the study room.');
    } catch {
      onLeftRoom();
    }
  };

  // Handle Close Room (Host only)
  const handleCloseRoom = async () => {
    if (!room || !isHost) return;
    if (!confirmCloseRoom) {
      setConfirmCloseRoom(true);
      setTimeout(() => setConfirmCloseRoom(false), 4000);
      return;
    }
    try {
      await closeStudyRoom(room.code);
      setConfirmCloseRoom(false);
      onLeftRoom();
      onToast('Study room closed.');
    } catch (err: any) {
      onToast(err.message || 'Failed to close room', 'err');
    }
  };

  // Handle Send Chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentRoomCode) return;
    if (isMutedInRoom) {
      onToast('You are muted in chat by the room host.', 'err');
      return;
    }
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await sendRoomMessage(currentRoomCode, text, 'chat');
    } catch (err: any) {
      setChatInput(prev => prev || text);
      onToast(err?.message || 'Failed to send message', 'err');
    }
  };

  // Handle Quick Reaction
  const handleSendReaction = async (reaction: { emoji: string; label: string }) => {
    if (!currentRoomCode) return;
    if (isMutedInRoom) {
      onToast('You are muted in chat by the room host.', 'err');
      return;
    }
    try {
      await sendRoomMessage(currentRoomCode, `${reaction.emoji} ${reaction.label}`, 'reaction');
    } catch (err: any) {
      onToast(err?.message || 'Failed to send reaction', 'err');
    }
  };

  // Copy Room Code
  const handleCopyCode = () => {
    if (!room?.code) return;
    try {
      navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      onToast(`Code ${room.code} copied! Share with your friends 🚀`);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      onToast(`Room Code: ${room.code}`);
    }
  };

  // Copy One-Click Invite Link
  const handleCopyInviteLink = () => {
    if (!room?.code) return;
    const url = buildRoomInviteUrl(room.code, window.location.origin, '/');
    try {
      navigator.clipboard.writeText(url);
      setCopiedInvite(true);
      onToast('Invite link copied! Friends can join in 1 click.');
      setTimeout(() => setCopiedInvite(false), 2500);
    } catch {
      onToast(`Invite link: ${url}`);
    }
  };

  const handleSaveTaskInline = async (nextDone?: boolean) => {
    if (!room) return;
    const targetDone = typeof nextDone === 'boolean' ? nextDone : ownTaskDone;
    const trimmed = taskDraft.trim();
    if (onUpdateOwnTask) {
      onUpdateOwnTask(trimmed, targetDone);
    } else {
      const currentStatus =
        timerState.status === 'running'
          ? timerState.phase === 'focus'
            ? 'focusing'
            : 'break'
          : 'idle';
      await updateMemberPresence(
        room.code,
        currentStatus,
        trimmed,
        todayFocusMs,
        isHardcoreMode,
        targetDone
      );
    }
    onToast(targetDone ? 'Marked focus goal done ✓' : 'Updated visible room task');
  };

  const handleNudgeMember = async (member: RoomMember) => {
    if (!room || isMutedInRoom) return;
    const lastNudged = nudgedUids[member.userId] || 0;
    if (Date.now() - lastNudged < 15000) return;
    setNudgedUids(prev => ({ ...prev, [member.userId]: Date.now() }));
    try {
      await sendRoomNudge(room.code, member.displayName);
      onToast(`Nudged ${member.displayName} 👋`);
    } catch {
      onToast('Could not send nudge', 'err');
    }
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !isHost) return;
    try {
      await updateRoomSettings(room.code, {
        sharedGoalTitle: goalTitleDraft.trim().slice(0, 100),
        sharedGoalTargetMs: Math.max(0, goalHoursDraft) * 3600000,
      });
      setEditingGoal(false);
      onToast('Updated shared room goal.');
    } catch {
      onToast('Could not update room goal', 'err');
    }
  };

  return (
    <div
      className={
        embedded
          ? 'w-full bg-[#101018] border border-white/10 rounded-2xl flex flex-col overflow-hidden text-white'
          : 'gui-scaled-modal w-full max-w-2xl bg-[#14151c]/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white animate-scaleUp'
      }
      style={embedded ? undefined : { maxHeight: 'calc(90vh / var(--gui-scale, 1))' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02] gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--accent)]/30 to-[var(--accent)]/10 border border-[var(--accent)]/40 flex items-center justify-center shrink-0">
            <Icon name="users" className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white truncate">
                {room ? room.name : 'Study Rooms'}
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                ALPHA
              </span>
              {room && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              )}
              {room?.locked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Icon name="lock" className="w-3 h-3" />
                  LOCKED
                </span>
              )}
              {room?.groupHardcore && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35">
                  🔥 HARDCORE
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 truncate">
              {room
                ? `${members.length}/${room.maxMembers || 12} focusing • ${
                    room.timerMode === 'synced' ? 'Synced Clock' : 'Independent Pace'
                  }`
                : 'Study together with drift-free synced timers, goals & live chat.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {room && onToggleChatMuted && (
            <button
              type="button"
              onClick={onToggleChatMuted}
              className={`p-2 rounded-lg border transition-colors ${
                chatMuted
                  ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
                  : 'text-white/60 hover:text-white bg-white/5 border-white/10'
              }`}
              title={chatMuted ? 'Unmute room chat alerts' : 'Mute room chat alerts'}
              aria-label={chatMuted ? 'Unmute room chat alerts' : 'Mute room chat alerts'}
            >
              <Icon name={chatMuted ? 'bellOff' : 'bell'} className="w-4 h-4" />
            </button>
          )}
          {room && isHost && (
            <button
              type="button"
              onClick={handleCloseRoom}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                confirmCloseRoom
                  ? 'text-white bg-rose-600 border-rose-500'
                  : 'text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/25'
              }`}
              title="Close room for everyone"
            >
              {confirmCloseRoom ? 'Confirm Close' : 'Close Room'}
            </button>
          )}
          {room && (
            <button
              type="button"
              onClick={handleLeave}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center gap-1.5"
              title="Leave room"
            >
              <Icon name="door" className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          )}
          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      {!room ? (
        /* ================= LOBBY (JOIN OR CREATE) ================= */
        <div className="p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
            <span className="text-amber-400 font-bold shrink-0 text-sm leading-none mt-0.5">⚡</span>
            <div className="leading-relaxed">
              Invite friends with a 6-character code or 1-click link, set a collective goal, and launch synchronized 60s sprints.
            </div>
          </div>

          {/* Tab switch */}
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setLobbyTab('join')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                lobbyTab === 'join'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Join with Room Code
            </button>
            <button
              type="button"
              onClick={() => setLobbyTab('create')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                lobbyTab === 'create'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Create New Room
            </button>
          </div>

          {lobbyTab === 'join' ? (
            /* JOIN FORM */
            <form onSubmit={handleJoin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="joinRoomCodeInput" className="text-xs font-semibold text-white/80">
                  Enter 6-Character Room Code
                </label>
                <input
                  id="joinRoomCodeInput"
                  type="text"
                  maxLength={8}
                  value={joinCodeInput}
                  onChange={e => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                  placeholder="e.g. FOCUS8"
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-center text-xl font-mono tracking-[4px] uppercase text-white placeholder:text-white/25 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  autoFocus
                />
                <p className="text-[11px] text-white/40">
                  Ask your friend for their room code or open their invite link to hop right in.
                </p>
              </div>

              <button
                type="submit"
                disabled={!joinCodeInput.trim() || isSubmitting}
                className="w-full py-3 mt-1 font-semibold text-sm rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-[0.99] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Icon name="users" className="w-4 h-4" />
                    Join Study Room
                  </>
                )}
              </button>
            </form>
          ) : (
            /* CREATE FORM */
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label htmlFor="newRoomNameInput" className="text-xs font-semibold text-white/80">
                    Room Name
                  </label>
                  <input
                    id="newRoomNameInput"
                    type="text"
                    maxLength={50}
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="e.g. Physics Grind & Chill"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <label htmlFor="newRoomCodeInput" className="text-xs font-semibold text-white/80">
                      Room Code
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewRoomCode(generateRoomCode())}
                      className="text-[11px] text-[var(--accent-text)] hover:underline flex items-center gap-1"
                    >
                      <Icon name="reset" className="w-3 h-3" />
                      Regenerate
                    </button>
                  </div>
                  <input
                    id="newRoomCodeInput"
                    type="text"
                    maxLength={8}
                    value={newRoomCode}
                    onChange={e => setNewRoomCode(normalizeRoomCode(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm font-mono tracking-wider uppercase text-white focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-white/80">Timer Sync Mode</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTimerMode('synced')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newTimerMode === 'synced'
                        ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold mb-1 flex items-center gap-1.5">
                      <Icon name="timer" className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      Synchronized
                    </div>
                    <div className="text-[11px] text-white/50 leading-relaxed">
                      Host controls the clock; everyone focuses & rests together.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTimerMode('independent')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      newTimerMode === 'independent'
                        ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold mb-1 flex items-center gap-1.5">
                      <Icon name="zen" className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      Independent
                    </div>
                    <div className="text-[11px] text-white/50 leading-relaxed">
                      Study side-by-side while keeping your personal timer pace.
                    </div>
                  </button>
                </div>
              </div>

              {/* Shared Goal & Room Options */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_92px_92px] gap-2.5">
                  <div className="flex flex-col gap-1 min-w-0">
                    <label htmlFor="newRoomGoalInput" className="text-[11px] font-semibold text-white/70">
                      Shared Room Goal (Optional)
                    </label>
                    <input
                      id="newRoomGoalInput"
                      type="text"
                      maxLength={80}
                      value={newSharedGoalTitle}
                      onChange={e => setNewSharedGoalTitle(e.target.value)}
                      placeholder="e.g. Finals Night Marathon"
                      className="w-full px-3 py-2 bg-white/5 border border-white/12 rounded-lg text-xs text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label htmlFor="newGoalHoursInput" className="text-[11px] font-semibold text-white/70">
                      Target Hrs
                    </label>
                    <input
                      id="newGoalHoursInput"
                      type="number"
                      min={1}
                      max={100}
                      value={newSharedGoalHours}
                      onChange={e => setNewSharedGoalHours(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/12 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <label htmlFor="newMaxMembersSelect" className="text-[11px] font-semibold text-white/70">
                      Max Seats
                    </label>
                    <select
                      id="newMaxMembersSelect"
                      value={newMaxMembers}
                      onChange={e => setNewMaxMembers(Number(e.target.value))}
                      className="w-full min-w-0 px-2.5 py-2 bg-[#1a1b26] border border-white/12 rounded-lg text-xs text-white"
                    >
                      {[4, 8, 12, 20, 30, 50].map(cap => (
                        <option key={cap} value={cap}>
                          {cap}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newGroupHardcore}
                    onChange={e => setNewGroupHardcore(e.target.checked)}
                    className="w-4 h-4 accent-rose-500 rounded"
                  />
                  <span>
                    <strong className="text-rose-300">Group Hardcore Mode</strong> — Challenge members to lock into 4 consecutive sessions
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 font-semibold text-sm rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-[0.99] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Icon name="sparkles" className="w-4 h-4" />
                    Create & Enter Room
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      ) : (
        /* ================= ACTIVE ROOM (MEMBERS & CHAT) ================= */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Room Subheader with Code, Invite Link & Tabs */}
          <div className="px-4 sm:px-5 py-2.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg font-mono text-xs font-bold tracking-wider bg-white/10 hover:bg-white/20 text-[var(--accent)] border border-white/15 flex items-center gap-1.5 transition-colors"
                title="Copy room code"
              >
                <Icon name="copy" className="w-3 h-3" />
                {room.code}
                {copiedCode && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
              </button>

              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/15 text-white/80 border border-white/10 flex items-center gap-1.5 transition-colors"
                title="Copy 1-click invite link"
              >
                <Icon name="link" className="w-3 h-3 text-[var(--accent-text)]" />
                <span>{copiedInvite ? 'Link Copied!' : 'Invite Link'}</span>
              </button>
            </div>

            <div className="flex p-0.5 bg-black/40 rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => selectTab('members')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'members'
                    ? 'bg-[var(--accent)] text-white shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon name="users" className="w-3.5 h-3.5" />
                Study Hall ({members.length})
              </button>
              <button
                type="button"
                onClick={() => selectTab('chat')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'bg-[var(--accent)] text-white shadow'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon name="messageSquare" className="w-3.5 h-3.5" />
                Study Chat
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tab 1: Study Hall */}
          {activeTab === 'members' && (
            <div className="p-4 sm:p-5 flex flex-col gap-3.5 overflow-y-auto flex-1">
              {/* 60s Sprint Countdown Banner */}
              {sprintState.active && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--accent)]/25 to-emerald-500/15 border border-[var(--accent)]/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <span>🚀</span>
                    <span>Synchronized Sprint starting in</span>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-emerald-300">
                    {sprintState.secondsLeft}s
                  </span>
                </div>
              )}

              {/* Group Hardcore Banner */}
              {room.groupHardcore && (
                <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/35 flex items-center justify-between gap-2 text-xs flex-wrap">
                  <div className="text-rose-200">
                    <strong className="text-rose-300">🔥 Group Hardcore Active:</strong>{' '}
                    {isHardcoreMode
                      ? 'You are locked in for 4 consecutive sessions.'
                      : 'Host challenged the room to a 4-session Hardcore lock-in.'}
                  </div>
                  {!isHardcoreMode && onEnableHardcoreMode && (
                    <button
                      type="button"
                      onClick={onEnableHardcoreMode}
                      className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors"
                    >
                      Join Hardcore
                    </button>
                  )}
                </div>
              )}

              {/* Shared Room Goal Card */}
              {(room.sharedGoalTitle || (room.sharedGoalTargetMs ?? 0) > 0 || isHost) && (
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name="target" className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                      <span className="text-xs font-bold text-white truncate">
                        {room.sharedGoalTitle || 'Shared Room Goal'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(room.sharedGoalTargetMs ?? 0) > 0 && (
                        <span className="text-[11px] font-semibold text-white/70">
                          {fmtDur(totalRoomFocusMs)} / {Math.round((room.sharedGoalTargetMs || 0) / 3600000)}h
                        </span>
                      )}
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            setGoalTitleDraft(room.sharedGoalTitle || '');
                            setGoalHoursDraft(
                              Math.max(1, Math.round((room.sharedGoalTargetMs || 4 * 3600000) / 3600000))
                            );
                            setEditingGoal(prev => !prev);
                          }}
                          className="text-[11px] text-[var(--accent-text)] hover:underline font-semibold"
                        >
                          {editingGoal ? 'Cancel' : room.sharedGoalTitle ? 'Edit' : '+ Set Goal'}
                        </button>
                      )}
                    </div>
                  </div>

                  {(room.sharedGoalTargetMs ?? 0) > 0 && (
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((totalRoomFocusMs / (room.sharedGoalTargetMs || 1)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  )}

                  {editingGoal && isHost && (
                    <form onSubmit={handleSaveGoal} className="flex items-center gap-2 pt-1 flex-wrap">
                      <input
                        type="text"
                        maxLength={80}
                        value={goalTitleDraft}
                        onChange={e => setGoalTitleDraft(e.target.value)}
                        placeholder="Shared goal title..."
                        className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs bg-white/5 border border-white/15 rounded-lg"
                      />
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={goalHoursDraft}
                        onChange={e => setGoalHoursDraft(Math.max(1, Number(e.target.value) || 1))}
                        aria-label="Target hours"
                        className="w-16 px-2 py-1.5 text-xs bg-white/5 border border-white/15 rounded-lg"
                      />
                      <span className="text-[11px] text-white/50">hrs</span>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-bold"
                      >
                        Save
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Host Controls Bar */}
              {isHost && (
                <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <Icon name="crown" className="w-4 h-4 text-amber-400" />
                    <span>Host Controls</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={sprintState.active}
                      onClick={() => scheduleRoomSprint(room.code, 60)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--accent)] hover:brightness-110 text-white font-semibold disabled:opacity-50"
                    >
                      {sprintState.active ? `Sprint (${sprintState.secondsLeft}s)` : '🚀 Start Sprint (60s)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRoomSettings(room.code, { locked: !room.locked })}
                      className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 ${
                        room.locked
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                          : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <Icon name="lock" className="w-3 h-3" />
                      {room.locked ? 'Unlock' : 'Lock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRoomSettings(room.code, { groupHardcore: !room.groupHardcore })}
                      className={`px-2.5 py-1 rounded-lg border font-semibold ${
                        room.groupHardcore
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                          : 'bg-white/5 border-white/15 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      🔥 Hardcore {room.groupHardcore ? 'ON' : 'OFF'}
                    </button>
                    <select
                      aria-label="Maximum members"
                      value={room.maxMembers || 12}
                      onChange={e => updateRoomSettings(room.code, { maxMembers: Number(e.target.value) })}
                      className="min-w-0 px-2.5 py-1 rounded-lg bg-[#1a1b26] border border-white/15 text-xs text-white"
                    >
                      {[4, 8, 12, 20, 30, 50].map(cap => (
                        <option key={cap} value={cap}>
                          Max {cap}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* My Visible Room Task Quick Bar */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  void handleSaveTaskInline();
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => void handleSaveTaskInline(!ownTaskDone)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    ownTaskDone
                      ? 'bg-emerald-500 border-emerald-400 text-white'
                      : 'border-white/30 text-transparent hover:border-white/60'
                  }`}
                  aria-label="Toggle my room task done"
                  title="Mark visible room task complete"
                >
                  <Icon name="check" className="w-3.5 h-3.5" />
                </button>
                <input
                  type="text"
                  maxLength={100}
                  value={taskDraft}
                  onChange={e => setTaskDraft(e.target.value)}
                  placeholder="Share what you're focusing on..."
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/35"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white"
                >
                  Update
                </button>
              </form>

              {/* Members Header + Leaderboard Toggle */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Study Partners ({members.length})
                </span>
                <button
                  type="button"
                  onClick={() => setLeaderboardSort(prev => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    leaderboardSort
                      ? 'bg-[var(--accent)]/20 border-[var(--accent)]/40 text-[var(--accent-text)]'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {leaderboardSort ? '🏆 Leaderboard On' : 'Default Order'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedMembers.map((m, idx) => {
                  const isYou = m.userId === currentUid;
                  const isFocusing = m.status === 'focusing';
                  const isBreak = m.status === 'break';
                  const memberMuted = !!room.mutedUserIds?.includes(m.userId);
                  const recentlyNudged = Date.now() - (nudgedUids[m.userId] || 0) < 15000;
                  const rankMedal = leaderboardSort
                    ? idx === 0
                      ? '🥇'
                      : idx === 1
                      ? '🥈'
                      : idx === 2
                      ? '🥉'
                      : `#${idx + 1}`
                    : null;

                  return (
                    <div
                      key={m.userId}
                      className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all ${
                        isYou
                          ? 'bg-white/[0.06] border-[var(--accent)]/50'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 relative ${
                            isFocusing
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isBreak
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : 'bg-white/10 text-white/80 border border-white/20'
                          }`}
                        >
                          {m.displayName.slice(0, 2).toUpperCase()}
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#14151c] ${
                              isFocusing
                                ? 'bg-amber-400'
                                : isBreak
                                ? 'bg-sky-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {rankMedal && (
                              <span className="text-[11px] font-bold text-amber-300">
                                {rankMedal}
                              </span>
                            )}
                            <span className="font-semibold text-sm text-white truncate">
                              {m.displayName}
                            </span>
                            {isYou && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                You
                              </span>
                            )}
                            {m.isHost && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                <Icon name="crown" className="w-2.5 h-2.5" />
                                Host
                              </span>
                            )}
                            {m.hardcoreMode && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                                🔥 HARDCORE
                              </span>
                            )}
                            {memberMuted && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                                Muted
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                isFocusing
                                  ? 'text-amber-400'
                                  : isBreak
                                  ? 'text-sky-400'
                                  : 'text-white/50'
                              }`}
                            >
                              {isFocusing && '🔥 Deep Focus'}
                              {isBreak && '☕ On Break'}
                              {!isFocusing && !isBreak && '⏳ Ready'}
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="text-[11px] text-white/60">
                              {m.todayFocusMs > 0 ? `${fmtDur(m.todayFocusMs)} today` : 'Just joined'}
                            </span>
                          </div>

                          {m.currentTask && (
                            <div
                              className={`mt-1.5 text-[11px] px-2 py-0.5 rounded truncate ${
                                m.activeTaskDone
                                  ? 'bg-emerald-500/15 text-emerald-300 line-through'
                                  : 'bg-white/5 text-white/75'
                              }`}
                            >
                              {m.activeTaskDone ? '✓ ' : '🎯 '}
                              {m.currentTask}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Member Actions (Nudge / Host Controls) */}
                      {!isYou && (m.status === 'idle' || isHost) && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
                          {m.status === 'idle' && !isMutedInRoom && (
                            <button
                              type="button"
                              disabled={recentlyNudged}
                              onClick={() => void handleNudgeMember(m)}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/30 disabled:opacity-40 transition-colors"
                            >
                              {recentlyNudged ? 'Nudged ✓' : '👋 Nudge'}
                            </button>
                          )}
                          {isHost && (
                            <>
                              <button
                                type="button"
                                onClick={() => void transferRoomHost(room.code, m.userId, m.displayName)}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white/5 hover:bg-white/15 text-white/80 border border-white/10"
                              >
                                Make Host
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleMuteRoomMember(
                                    room.code,
                                    m.userId,
                                    m.displayName,
                                    room.mutedUserIds || []
                                  )
                                }
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-white/5 hover:bg-white/15 text-white/80 border border-white/10"
                              >
                                {memberMuted ? 'Unmute' : 'Mute'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void kickRoomMember(
                                    room.code,
                                    m.userId,
                                    m.displayName,
                                    room.kickedUserIds || []
                                  )
                                }
                                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/25"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Study Chat & High-Fives */}
          {activeTab === 'chat' && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Alert Preferences Strip */}
              {(onToggleChatMuted || onToggleBreakOnlyAlerts) && (
                <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02] flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <span className="text-white/50 font-medium">Chat Notifications:</span>
                  <div className="flex items-center gap-2">
                    {onToggleChatMuted && (
                      <button
                        type="button"
                        onClick={onToggleChatMuted}
                        className={`px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                          chatMuted
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                            : 'bg-white/5 border-white/10 text-white/75'
                        }`}
                      >
                        {chatMuted ? '🔇 Alerts Muted' : '🔔 Alerts On'}
                      </button>
                    )}
                    {onToggleBreakOnlyAlerts && (
                      <button
                        type="button"
                        onClick={onToggleBreakOnlyAlerts}
                        className={`px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                          breakOnlyAlerts
                            ? 'bg-[var(--accent)]/25 border-[var(--accent)]/50 text-white'
                            : 'bg-white/5 border-white/10 text-white/75'
                        }`}
                      >
                        ☕ Break-Only {breakOnlyAlerts ? 'ON' : 'OFF'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Messages Feed */}
              <div className="p-4 flex flex-col gap-2.5 overflow-y-auto flex-1 text-xs">
                {messages.length === 0 ? (
                  <div className="my-auto text-center py-8 text-white/40">
                    <Icon name="messageSquare" className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No messages yet. Send a high-five or say hello!
                  </div>
                ) : (
                  messages.map(msg => {
                    const isYou = msg.senderId === currentUid;
                    const isSystem = msg.type === 'system';
                    const isReaction = msg.type === 'reaction';
                    const isNudge = msg.type === 'nudge';

                    if (isSystem) {
                      return (
                        <div
                          key={msg.id}
                          className="py-1 px-3 my-1 rounded-lg bg-white/5 text-white/55 text-[11px] text-center border border-white/5 max-w-md mx-auto"
                        >
                          {msg.text}
                        </div>
                      );
                    }

                    if (isNudge) {
                      return (
                        <div
                          key={msg.id}
                          className="py-1.5 px-3 my-1 rounded-xl bg-amber-500/15 text-amber-200 text-xs font-semibold text-center border border-amber-500/30 max-w-md mx-auto"
                        >
                          {msg.text}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isYou ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1 text-[10px] text-white/40 mb-0.5 px-1">
                          <span>{msg.senderName}</span>
                          <span>•</span>
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div
                          className={`px-3 py-2 rounded-2xl max-w-[80%] break-words ${
                            isReaction
                              ? 'bg-[var(--accent)]/20 border border-[var(--accent)]/40 text-white font-medium text-sm'
                              : isYou
                              ? 'bg-[var(--accent)] text-white rounded-tr-none'
                              : 'bg-white/10 text-white rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {isMutedInRoom && (
                <div className="px-4 py-2 bg-rose-500/15 border-t border-rose-500/30 text-xs text-rose-200 text-center">
                  🔇 You were muted in chat by the host.
                </div>
              )}

              {/* Quick Reactions Bar */}
              <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {QUICK_REACTIONS.map(qr => (
                  <button
                    key={qr.label}
                    type="button"
                    disabled={isMutedInRoom}
                    onClick={() => handleSendReaction(qr)}
                    className="px-2.5 py-1 rounded-full text-xs bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 whitespace-nowrap transition-all flex items-center gap-1 disabled:opacity-40"
                  >
                    <span>{qr.emoji}</span>
                    <span className="text-[11px] text-white/70">{qr.label}</span>
                  </button>
                ))}
              </div>

              {/* Input Field */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-white/10 bg-[#171821] flex items-center gap-2"
              >
                <input
                  type="text"
                  maxLength={300}
                  disabled={isMutedInRoom}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder={
                    isMutedInRoom ? 'Chat muted by host' : 'Type an encouraging study message...'
                  }
                  className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isMutedInRoom}
                  aria-label="Send message"
                  className="p-2.5 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Icon name="send" className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const StudyRoomModal: React.FC<StudyRoomModalProps> = ({ isOpen, onClose, ...rest }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Study Rooms"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <StudyRoomPanel {...rest} onClose={onClose} />
    </div>
  );
};
