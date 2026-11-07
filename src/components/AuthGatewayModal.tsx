import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Icon } from './Icons';

interface AuthGatewayModalProps {
  onSuccess?: () => void;
  onToast: (msg: string, type?: '' | 'err') => void;
  lang?: string;
}

export const AuthGatewayModal: React.FC<AuthGatewayModalProps> = ({
  onToast,
  lang = 'en',
}) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password.trim()) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signup') {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        onToast('Account created! Welcome to Peakus.');
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
        onToast('Welcome back! Cloud workspace synced.');
      }
    } catch (err: any) {
      const code = err?.code || '';
      let msg = 'Authentication error. Please check your credentials.';
      if (code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Switching to Sign In.';
        setTab('signin');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = 'Incorrect email or password.';
      } else if (code === 'auth/user-not-found') {
        msg = 'No user found with this email. Please create an account.';
        setTab('signup');
      } else if (code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err?.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
      onToast(msg, 'err');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onToast('Signed in with Google. Cloud workspace synced.');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        const msg = 'Google Sign-In was canceled or could not complete.';
        setErrorMessage(msg);
        onToast(msg, 'err');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-gateway-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0a0a0f',
        backgroundImage: 'radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.18), transparent 70%), radial-gradient(ellipse at 80% 80%, rgba(236, 72, 153, 0.12), transparent 70%)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 99999,
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        className="auth-gateway-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#12121a',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.9), 0 0 40px rgba(99, 102, 241, 0.1)',
          padding: '36px 32px',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 16px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 12px 24px -6px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Icon name="timer" style={{ width: '28px', height: '28px', color: '#ffffff' }} />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Peakus
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255, 255, 255, 0.65)' }}>
            Max your focus with real-time cloud sync
          </p>
        </div>

        {/* Cloud feature bullet badges */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '14px',
            padding: '12px 14px',
            marginBottom: '24px',
            fontSize: '12.5px',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Real-time streak and session stats sync across devices</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Your YouTube video backgrounds and themes stay preserved</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Never lose focus progress when browsing in incognito</span>
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            color: '#1a1a24',
            fontSize: '14.5px',
            fontWeight: 650,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'opacity 0.15s ease',
            opacity: loading ? 0.7 : 1,
            marginBottom: '20px',
          }}
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
          Continue with Google
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '0 0 20px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          <span>or with email</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
        </div>

        {/* Switch Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setErrorMessage(null);
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 650,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab === 'signup' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: tab === 'signup' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
              transition: 'all 0.15s ease',
            }}
          >
            Create Free Account
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              setErrorMessage(null);
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 650,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab === 'signin' ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: tab === 'signin' ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#fca5a5',
              marginBottom: '16px',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@domain.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#ffffff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              required
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              placeholder="At least 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: '#ffffff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '6px',
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              fontSize: '14.5px',
              fontWeight: 650,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)',
              transition: 'opacity 0.15s ease',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Connecting...' : tab === 'signup' ? 'Create Peakus Account' : 'Sign In to Workspace'}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.45)' }}>
          By continuing, you agree to store your focus sessions and workspace preferences securely in your private cloud account.
        </p>
      </div>
    </div>
  );
};
