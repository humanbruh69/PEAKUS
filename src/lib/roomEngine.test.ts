import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoomInviteUrl,
  extractInviteRoomCode,
  computeSyncedTimerDisplay,
  sortMembersLeaderboard,
  computeRoomTotalFocusMs,
  pickNextHostMember,
  formatSprintCountdown,
  computeUnreadMessagesCount,
  sortRoomMessagesChronologically,
} from './roomEngine';

test('buildRoomInviteUrl and extractInviteRoomCode roundtrip cleanly', () => {
  const url = buildRoomInviteUrl('focus8', 'https://peakus.com/');
  assert.equal(url, 'https://peakus.com/?room=FOCUS8');

  const query = new URL(url).search;
  assert.equal(extractInviteRoomCode(query), 'FOCUS8');
  assert.equal(extractInviteRoomCode('?room=ab-cd_12'), 'ABCD12');
  assert.equal(extractInviteRoomCode('?room=ab'), null);
  assert.equal(extractInviteRoomCode('?autostart=1'), null);
});

test('computeSyncedTimerDisplay computes drift-free remaining time from targetEndTime when running', () => {
  const now = 1700000000000;
  const running = computeSyncedTimerDisplay(
    {
      status: 'running',
      phase: 'focus',
      remainingMs: 25 * 60000,
      durationMs: 25 * 60000,
      cycle: 1,
      startedAt: now - 10000,
      targetEndTime: now + 123456,
    },
    now
  );
  assert.ok(running);
  assert.equal(running.status, 'running');
  assert.equal(running.remainingMs, 123456);
  assert.equal(running.targetEndTime, now + 123456);

  const paused = computeSyncedTimerDisplay(
    {
      status: 'paused',
      phase: 'short',
      remainingMs: 180000,
      durationMs: 300000,
      cycle: 2,
      startedAt: now - 120000,
      targetEndTime: null,
    },
    now
  );
  assert.ok(paused);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.phase, 'short');
  assert.equal(paused.remainingMs, 180000);
  assert.equal(paused.targetEndTime, null);
});

test('sortMembersLeaderboard ranks by todayFocusMs descending then focusing status', () => {
  const members = [
    { userId: 'u1', displayName: 'Host', status: 'idle' as const, todayFocusMs: 600000, isHost: true, joinedAt: 1, lastActive: 10 },
    { userId: 'u2', displayName: 'Grinder', status: 'focusing' as const, todayFocusMs: 3600000, isHost: false, joinedAt: 2, lastActive: 10 },
    { userId: 'u3', displayName: 'Starter', status: 'focusing' as const, todayFocusMs: 600000, isHost: false, joinedAt: 3, lastActive: 10 },
  ];
  const sorted = sortMembersLeaderboard(members);
  assert.deepEqual(
    sorted.map(m => m.userId),
    ['u2', 'u3', 'u1']
  );
  assert.equal(computeRoomTotalFocusMs(members), 4800000);
});

test('pickNextHostMember selects longest-tenured active member excluding leaving & kicked users', () => {
  const members = [
    { userId: 'host', joinedAt: 100 },
    { userId: 'kicked', joinedAt: 150 },
    { userId: 'next', joinedAt: 200 },
    { userId: 'later', joinedAt: 300 },
  ];
  const nextHost = pickNextHostMember(members, 'host', ['kicked']);
  assert.equal(nextHost?.userId, 'next');
  assert.equal(pickNextHostMember([{ userId: 'host', joinedAt: 100 }], 'host'), null);
});

test('formatSprintCountdown tracks 60s sprint start and ready grace window', () => {
  const now = 1700000000000;
  assert.deepEqual(formatSprintCountdown(now + 45200, now), {
    active: true,
    ready: false,
    secondsLeft: 46,
  });
  assert.deepEqual(formatSprintCountdown(now - 2000, now), {
    active: false,
    ready: true,
    secondsLeft: 0,
  });
  assert.deepEqual(formatSprintCountdown(now - 30000, now), {
    active: false,
    ready: false,
    secondsLeft: 0,
  });
});

test('computeUnreadMessagesCount counts only non-system messages from others after lastReadAt', () => {
  const msgs = [
    { id: '1', senderId: 'other', createdAt: 100, type: 'chat' as const },
    { id: '2', senderId: 'me', createdAt: 200, type: 'chat' as const },
    { id: '3', senderId: 'other', createdAt: 250, type: 'system' as const },
    { id: '4', senderId: 'other', createdAt: 300, type: 'reaction' as const },
    { id: '5', senderId: 'other2', createdAt: 400, type: 'chat' as const },
  ];
  assert.equal(computeUnreadMessagesCount(msgs, 'me', 150), 2);
});

test('sortRoomMessagesChronologically orders descending recent messages oldest-to-newest with id tie-breaker', () => {
  const recentWindowDesc = [
    { id: 'msg_105', createdAt: 1050 },
    { id: 'msg_104b', createdAt: 1040 },
    { id: 'msg_104a', createdAt: 1040 },
    { id: 'msg_103', createdAt: 1030 },
  ];
  const sorted = sortRoomMessagesChronologically(recentWindowDesc);
  assert.deepEqual(
    sorted.map(m => m.id),
    ['msg_103', 'msg_104a', 'msg_104b', 'msg_105']
  );
  // Does not mutate input array
  assert.equal(recentWindowDesc[0].id, 'msg_105');
});
