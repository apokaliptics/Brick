/* eslint-disable */
import { useState } from 'react';
import { User } from '../../types';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onSignup: () => void;
}

export function LoginScreen({ onLogin, onSignup }: LoginScreenProps) {
  const [mode, setMode] = useState<'initial' | 'login' | 'register'>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { loginUser } = await import('../../utils/auth');
      const user = await loginUser(email, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async () => {
    if (!email || !password || !name) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { registerUser } = await import('../../utils/auth');
      const user = await registerUser(email, password, name);
      onSignup(); // This will trigger the import screen
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialLogin = () => {
    if (email) {
      setMode('login');
    }
  };

  const handleInitialSignup = () => {
    if (email) {
      setMode('register');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Animated Background - Subtle concrete texture */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)',
        }}
      >
        {/* Subtle animated texture overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(255, 255, 255, 0.03) 2px,
              rgba(255, 255, 255, 0.03) 4px
            )`,
            animation: 'slow-shift 20s linear infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes slow-shift {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(40px);
          }
        }
      `}</style>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-16 fade-in">
          <h1
            style={{
              fontSize: '4rem',
              letterSpacing: '0.2em',
              color: '#e0e0e0',
              textTransform: 'uppercase',
              fontWeight: 900,
            }}
          >
            BRICK
          </h1>
          <p
            className="mono mt-2"
            style={{
              color: '#a0a0a0',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
            }}
          >
            BUILD ON SOLID GROUND
          </p>
        </div>

        {/* Frosted Glass Container */}
        <div
          className="spring-in rounded-2xl p-8 overflow-hidden"
          style={{
            backgroundColor: 'rgba(30, 30, 30, 0.8)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          }}
        >
          {mode === 'initial' && (
            <>
              <h3 className="mb-6 text-center" style={{ color: '#e0e0e0' }}>
                Lay Your First Brick
              </h3>

              {/* Email Input */}
              <div className="mb-6">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && email && handleInitialLogin()}
                  className="w-full bg-transparent outline-none pb-3 transition-all"
                  style={{
                    color: '#e0e0e0',
                    borderBottom: '2px solid',
                    borderColor: email ? '#e0e0e0' : '#333333',
                    fontSize: '1rem',
                  }}
                />
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleInitialLogin}
                  disabled={!email}
                  className="w-full py-3 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #e0e0e0',
                    color: '#e0e0e0',
                    opacity: email ? 1 : 0.5,
                    cursor: email ? 'pointer' : 'not-allowed',
                  }}
                >
                  Enter (Log In)
                </button>

                <button
                  onClick={handleInitialSignup}
                  disabled={!email}
                  className="w-full py-3 rounded-full transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: email
                      ? 'linear-gradient(to bottom, #d32f2f, #b71c1c)'
                      : 'linear-gradient(to bottom, #333333, #2a2a2a)',
                    color: email ? '#e0e0e0' : '#666666',
                    boxShadow: email ? '0 4px 20px rgba(211, 47, 47, 0.4)' : 'none',
                    cursor: email ? 'pointer' : 'not-allowed',
                  }}
                >
                  Begin Construction (Sign Up)
                </button>
              </div>
            </>
          )}

          {mode === 'login' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    setMode('initial');
                    setPassword('');
                    setError('');
                  }}
                  className="text-sm mono"
                  style={{ color: '#a0a0a0' }}
                >
                  ← Back
                </button>
                <h3 style={{ color: '#e0e0e0' }}>Log In</h3>
                <div style={{ width: '60px' }} />
              </div>

              <div className="space-y-4 mb-6">
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-transparent outline-none pb-3 transition-all"
                  style={{
                    color: '#e0e0e0',
                    borderBottom: '2px solid #333333',
                    fontSize: '1rem',
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && email && password && handleLoginSubmit()}
                  className="w-full bg-transparent outline-none pb-3 transition-all"
                  style={{
                    color: '#e0e0e0',
                    borderBottom: '2px solid #333333',
                    fontSize: '1rem',
                  }}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', border: '1px solid rgba(211, 47, 47, 0.3)' }}>
                  <p className="text-sm" style={{ color: '#d32f2f' }}>{error}</p>
                </div>
              )}

              <button
                onClick={handleLoginSubmit}
                disabled={!email || !password || loading}
                className="w-full py-3 rounded-full transition-all duration-200"
                style={{
                  background: email && password
                    ? 'linear-gradient(to bottom, #d32f2f, #b71c1c)'
                    : 'linear-gradient(to bottom, #333333, #2a2a2a)',
                  color: email && password ? '#e0e0e0' : '#666666',
                  boxShadow: email && password ? '0 4px 20px rgba(211, 47, 47, 0.4)' : 'none',
                  cursor: (email && password && !loading) ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? 'Logging in...' : 'Enter'}
              </button>
            </>
          )}

          {mode === 'register' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    setMode('initial');
                    setPassword('');
                    setName('');
                    setError('');
                  }}
                  className="text-sm mono"
                  style={{ color: '#a0a0a0' }}
                >
                  ← Back
                </button>
                <h3 style={{ color: '#e0e0e0' }}>Sign Up</h3>
                <div style={{ width: '60px' }} />
              </div>

              <div className="space-y-4 mb-6">
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-transparent outline-none pb-3 transition-all"
                  style={{
                    color: '#e0e0e0',
                    borderBottom: '2px solid #333333',
                    fontSize: '1rem',
                  }}
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-transparent outline-none pb-3 transition-all"
                  style={{
                    color: '#e0e0e0',
                    borderBottom: '2px solid #333333',
                    fontSize: '1rem',
                  }}
                />
                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && email && password && name && handleRegisterSubmit()}
                  className="w-full bg-transparent outline-none pb-3 transition-all"
                  style={{
                    color: '#e0e0e0',
                    borderBottom: '2px solid #333333',
                    fontSize: '1rem',
                  }}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', border: '1px solid rgba(211, 47, 47, 0.3)' }}>
                  <p className="text-sm" style={{ color: '#d32f2f' }}>{error}</p>
                </div>
              )}

              <button
                onClick={handleRegisterSubmit}
                disabled={!email || !password || !name || loading}
                className="w-full py-3 rounded-full transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: (email && password && name)
                    ? 'linear-gradient(to bottom, #d32f2f, #b71c1c)'
                    : 'linear-gradient(to bottom, #333333, #2a2a2a)',
                  color: (email && password && name) ? '#e0e0e0' : '#666666',
                  boxShadow: (email && password && name) ? '0 4px 20px rgba(211, 47, 47, 0.4)' : 'none',
                  cursor: (email && password && name && !loading) ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? 'Creating account...' : 'Begin Construction'}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="mono" style={{ color: '#666666', fontSize: '0.65rem' }}>
            BY CONTINUING, YOU AGREE TO BRICK'S TERMS
          </p>
        </div>
      </div>
    </div>
  );
}
