import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import {
  StudyRoom,
  RoomMember,
  RoomMessage,
  createStudyRoom,
  joinStudyRoom,
  leaveStudyRoom,
  sendRoomMessage,
  subscribeToStudyRoom,
  subscribeToRoomMembers,
  subscribeToRoomMessages,
  normalizeRoomCode,
  generateRoomCode,
} from '../lib/studyRooms';
import { TimerState, Task } from '../types';
import { fmtDur } from '../lib/utils';
import { auth } from '../lib/firebase';

interface StudyRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  timerState: TimerState;
  activeTask?: Task;
  todayFocusMs: number;
  onToast: (msg: string, type?: 'err' | '') => void;
  currentRoomCode: string | null;
  onJoinedRoom: (code: string) => void;
  onLeftRoom: () => void;
}

const QUICK_REACTIONS = [
  { emoji: '🔥', label: 'Keep pushing!' },
  { emoji: '💯', label: 'Crushed it!' },
  { emoji: '☕', label: 'Coffee break!' },
  { emoji: '🧠', label: 'In the zone!' },
  { emoji: '👏', label: 'Great focus!' },
  { emoji: '🚀', label: 'Let’s gooo!' },
];

export const StudyRoomModal: React.FC<StudyRoomModalProps> = ({
  isOpen,
  onClose,
  timerState,
  activeTask,
  todayFocusMs,
  onToast,
  currentRoomCode,
  onJoinedRoom,
  onLeftRoom,
}) => {
  // Lobby state
  const [lobbyTab, setLobbyTab] = useState<'join' | 'create'>('join');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState(() => generateRoomCode());
  const [newTimerMode, setNewTimerMode] = useState<'synced' | 'independent'>('synced');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active room state
  const [activeTab, setActiveTab] = useState<'members' | 'chat'>('members');
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUid = auth.currentUser?.uid;

  // Subscribe to room data when in a room
  useEffect(() => {
    if (!currentRoomCode) {
      setRoom(null);
      setMembers([]);
      setMessages([]);
      return;
    }

    const unsubRoom = subscribeToStudyRoom(currentRoomCode, r => {
      setRoom(r);
      if (!r) {
        onToast('The study room was closed by the host.', 'err');
        onLeftRoom();
      }
    });

    const unsubMembers = subscribeToRoomMembers(currentRoomCode, m => {
      setMembers(m);
    });

    const unsubMessages = subscribeToRoomMessages(currentRoomCode, msgList => {
      setMessages(msgList);
    });

    return () => {
      unsubRoom();
      unsubMembers();
      unsubMessages();
    };
  }, [currentRoomCode, onToast, onLeftRoom]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  if (!isOpen) return null;

  // Handle Create Room
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const taskTitle = activeTask ? activeTask.title : undefined;
      const { room: created } = await createStudyRoom(
        newRoomName,
        newTimerMode,
        timerState,
        newRoomCode,
        todayFocusMs,
        taskTitle
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
        todayFocusMs
      );
      onJoinedRoom(joined.code);
      onToast(`Joined "${joined.name}"! Focusing with friends 🔥`);
    } catch (err: any) {
      onToast(err.message || 'Could not join room', 'err');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Leave Room
  const handleLeave = async () => {
    if (!currentRoomCode) return;
    try {
      await leaveStudyRoom(currentRoomCode);
      onLeftRoom();
      onToast('Left the study room.');
    } catch {
      onLeftRoom();
    }
  };

  // Handle Send Chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !currentRoomCode) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await sendRoomMessage(currentRoomCode, text, 'chat');
    } catch (err: any) {
      onToast('Failed to send message', 'err');
    }
  };

  // Handle Quick Reaction
  const handleSendReaction = async (reaction: { emoji: string; label: string }) => {
    if (!currentRoomCode) return;
    try {
      await sendRoomMessage(currentRoomCode, `${reaction.emoji} ${reaction.label}`, 'reaction');
    } catch (err: any) {
      onToast('Failed to send reaction', 'err');
    }
  };

  // Copy Room Code / Invite
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-[#14151c]/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white animate-scaleUp"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--accent)]/30 to-[var(--accent)]/10 border border-[var(--accent)]/40 flex items-center justify-center shrink-0">
              <Icon name="users" className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">
                  {room ? room.name : 'Focus with Friends'}
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
              </div>
              <p className="text-xs text-white/50 truncate">
                {room
                  ? `${members.length} student${members.length === 1 ? '' : 's'} focusing together • Code: ${room.code}`
                  : 'Experimental study rooms with synchronized timers & live presence.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {room && (
              <button
                type="button"
                onClick={handleLeave}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center gap-1.5"
                title="Leave room"
              >
                <Icon name="door" className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Alpha State Notice Banner */}
        <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <span className="text-amber-400 font-bold shrink-0 text-sm leading-none mt-0.5">⚠️</span>
          <div className="leading-relaxed">
            <span className="font-semibold text-amber-300">Very Alpha State:</span> This feature is an early experimental preview with minimal features, unrefined controls, and known sync bugs.
          </div>
        </div>

        {/* Content Body */}
        {!room ? (
          /* ================= LOBBY (JOIN OR CREATE) ================= */
          <div className="p-6 flex flex-col gap-6 overflow-y-auto">
            {/* Tab switch */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setLobbyTab('join')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  lobbyTab === 'join'
                    ? 'bg-[var(--accent)] text-white shadow-lg'
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
                    ? 'bg-[var(--accent)] text-white shadow-lg'
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
                  <label className="text-xs font-semibold text-white/80">
                    Enter 6-Character Room Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={8}
                      value={joinCodeInput}
                      onChange={e => setJoinCodeInput(normalizeRoomCode(e.target.value))}
                      placeholder="e.g. FOCUS8"
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-center text-xl font-mono tracking-[4px] uppercase text-white placeholder:text-white/25 focus:outline-none focus:border-[var(--accent)] transition-colors"
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-white/40">
                    Ask your friend for their room code to hop into their study session.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || isSubmitting}
                  className="w-full py-3 mt-2 font-semibold text-sm rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-[0.99] text-white shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white/80">Room Name</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="e.g. Physics Grind & Chill"
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white/80">Room Code</label>
                    <button
                      type="button"
                      onClick={() => setNewRoomCode(generateRoomCode())}
                      className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      <Icon name="reset" className="w-3 h-3" />
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={8}
                    value={newRoomCode}
                    onChange={e => setNewRoomCode(normalizeRoomCode(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm font-mono tracking-wider uppercase text-white focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-white/80">Timer Sync Mode</label>
                  <div className="grid grid-cols-2 gap-2">
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
                        <Icon name="timer" className="w-3.5 h-3.5 text-[var(--accent)]" />
                        Synchronized
                      </div>
                      <div className="text-[11px] text-white/50 leading-relaxed">
                        Host controls the clock; all friends focus & take breaks together.
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
                        <Icon name="zen" className="w-3.5 h-3.5 text-[var(--accent)]" />
                        Independent
                      </div>
                      <div className="text-[11px] text-white/50 leading-relaxed">
                        Study in the same room while keeping your personal timer pace.
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 mt-2 font-semibold text-sm rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-[0.99] text-white shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
            {/* Room Subheader with Code & Tabs */}
            <div className="px-6 py-2.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 font-medium">Room Code:</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2 py-0.5 rounded-md font-mono text-xs font-bold tracking-wider bg-white/10 hover:bg-white/20 text-[var(--accent)] border border-white/15 flex items-center gap-1.5 transition-colors"
                  title="Click to copy code"
                >
                  <Icon name="copy" className="w-3 h-3" />
                  {room.code}
                  {copiedCode && <span className="text-[10px] text-emerald-400 font-sans">Copied!</span>}
                </button>
              </div>

              <div className="flex p-0.5 bg-black/40 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
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
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === 'chat'
                      ? 'bg-[var(--accent)] text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Icon name="messageSquare" className="w-3.5 h-3.5" />
                  Study Chat ({messages.length})
                </button>
              </div>
            </div>

            {/* Tab 1: Study Hall (Members Grid) */}
            {activeTab === 'members' && (
              <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
                {room.timerMode === 'synced' && room.hostId === currentUid && (
                  <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-white">
                      <Icon name="crown" className="w-4 h-4 text-amber-400" />
                      <span>You are the Host. Your timer pace synchronizes with all members.</span>
                    </div>
                  </div>
                )}

                <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Active Study Partners ({members.length})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members.map(m => {
                    const isYou = m.userId === currentUid;
                    const isFocusing = m.status === 'focusing';
                    const isBreak = m.status === 'break';

                    return (
                      <div
                        key={m.userId}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                          isYou
                            ? 'bg-white/[0.06] border-[var(--accent)]/50'
                            : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                        }`}
                      >
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
                            <span className="font-semibold text-sm text-white truncate">
                              {m.displayName}
                            </span>
                            {isYou && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/70">
                                You
                              </span>
                            )}
                            {m.isHost && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                <Icon name="crown" className="w-2.5 h-2.5" />
                                Host
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
                            <span className="text-[11px] text-white/50">
                              {m.todayFocusMs > 0
                                ? `${Math.round(m.todayFocusMs / 60000)}m today`
                                : 'Just joined'}
                            </span>
                          </div>

                          {m.currentTask && (
                            <div className="mt-1.5 text-[11px] text-white/70 bg-white/5 px-2 py-0.5 rounded truncate">
                              🎯 {m.currentTask}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Study Chat & High-Fives */}
            {activeTab === 'chat' && (
              <div className="flex flex-col flex-1 min-h-0">
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

                      if (isSystem) {
                        return (
                          <div
                            key={msg.id}
                            className="py-1 px-3 my-1 rounded-lg bg-white/5 text-white/50 text-[11px] text-center border border-white/5 max-w-sm mx-auto"
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
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

                {/* Quick Reactions Bar */}
                <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {QUICK_REACTIONS.map(qr => (
                    <button
                      key={qr.label}
                      type="button"
                      onClick={() => handleSendReaction(qr)}
                      className="px-2.5 py-1 rounded-full text-xs bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 whitespace-nowrap transition-all flex items-center gap-1"
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
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type an encouraging study message..."
                    className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
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
    </div>
  );
};
