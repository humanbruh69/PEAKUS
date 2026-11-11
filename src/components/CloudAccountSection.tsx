import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Settings, TimerState } from '../types';
import { pushAllToCloud, clearLocalDeviceWorkspace } from '../lib/cloudSync';
import { Icon } from './Icons';

interface CloudAccountSectionProps {
  settings: Settings;
  timerState: TimerState;
  onToast: (msg: string, type?: '' | 'err') => void;
  lang?: string;
  onUpdateSettingsName?: (name: string) => void;
}

export const CloudAccountSection: React.FC<CloudAccountSectionProps> = ({
  settings,
  timerState,
  onToast,
  onUpdateSettingsName,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (user?.displayName) {
        setDisplayNameInput(user.displayName);
      } else if (settings.name) {
        setDisplayNameInput(settings.name);
      }
    });
    return () => unsub();
  }, [settings.name]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      onToast('Please enter both email and password.', 'err');
      return;
    }
    if (password.length < 6) {
      onToast('Password must be at least 6 characters.', 'err');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        onToast('Account created successfully.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onToast('Signed in successfully.');
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      const code = err?.code || '';
      let msg = 'Authentication failed. Please check your credentials.';
      if (code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Try signing in.';
        setMode('signin');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use 6+ characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Invalid email address format.';
      } else if (err?.message) {
        msg = err.message;
      }
      onToast(msg, 'err');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onToast('Signed in with Google.');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        onToast('Google sign-in was canceled or unavailable.', 'err');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      clearLocalDeviceWorkspace();
      await signOut(auth);
      onToast('Signed out of Cloud account.');
    } catch {
      onToast('Error signing out.', 'err');
    }
  };

  const handleSaveDisplayName = async () => {
    if (!currentUser) return;
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      onToast('Please enter a valid display name.', 'err');
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(currentUser, { displayName: trimmed });
      setCurrentUser({ ...currentUser, displayName: trimmed } as User);
      if (onUpdateSettingsName) {
        onUpdateSettingsName(trimmed);
      }
      await pushAllToCloud(currentUser.uid, { ...settings, name: trimmed }, timerState, {
        customDisplayName: trimmed,
      });
      setEditingName(false);
      onToast('Display name updated and synced to Cloud.');
    } catch {
      onToast('Failed to update display name.', 'err');
    } finally {
      setSavingName(false);
    }
  };

  if (currentUser) {
    return (
      <div className="card" style={{ borderColor: 'var(--accent-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-border)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent-text)',
              }}
            >
              <Icon name="cloud" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 650, color: '#fff' }}>
                  {currentUser.displayName || currentUser.email || 'Connected Account'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(52, 211, 153, 0.12)',
                    color: '#34d399',
                    border: '1px solid rgba(52, 211, 153, 0.25)',
                    fontWeight: 600,
                  }}
                >
                  Auto-sync active
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                {currentUser.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn ghost"
            style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>

        {/* Editable User Display Name synced to Cloud */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--muted)' }}>
              CLOUD DISPLAY NAME
            </span>
            {!editingName && (
              <button
                type="button"
                className="btn link"
                style={{ fontSize: '12px', padding: 0 }}
                onClick={() => setEditingName(true)}
              >
                Change Name
              </button>
            )}
          </div>

          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={displayNameInput}
                maxLength={40}
                placeholder="Enter your name"
                onChange={e => setDisplayNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveDisplayName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                style={{ flex: 1, padding: '7px 10px', fontSize: '13px' }}
              />
              <button
                type="button"
                className="btn primary"
                disabled={savingName}
                style={{ fontSize: '12.5px', padding: '7px 14px' }}
                onClick={handleSaveDisplayName}
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: '12.5px', padding: '7px 12px' }}
                onClick={() => setEditingName(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
              {currentUser.displayName || '(No display name set)'}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--line)',
            fontSize: '12.5px',
            color: 'rgba(255, 255, 255, 0.75)',
            lineHeight: 1.5,
          }}
        >
          All your settings, stats, YouTube links, notes, and tasks sync automatically in the background across devices. Active timers run independently on each device.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-border)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent-text)',
          }}
        >
          <Icon name="cloud" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 650 }}>Cloud Account</h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)' }}>
            Sign in to automatically sync your stats, tasks, links, and preferences across devices.
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div
        className="seg"
        style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '2px',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          aria-pressed={mode === 'signin'}
          onClick={() => setMode('signin')}
          style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
        >
          Sign In
        </button>
        <button
          type="button"
          aria-pressed={mode === 'signup'}
          onClick={() => setMode('signup')}
          style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '5px' }}>
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@domain.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '5px' }}>
            Password
          </label>
          <input
            type="password"
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="At least 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <button
          type="submit"
          className="btn primary"
          disabled={loading}
          style={{ width: '100%', marginTop: '4px', minHeight: '38px', fontWeight: 600 }}
        >
          {loading ? 'Connecting...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: '10px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
        <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
      </div>

      <button
        type="button"
        className="btn"
        disabled={loading}
        onClick={handleGoogleSignIn}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '38px' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        Sign in with Google
      </button>
    </div>
  );
};
