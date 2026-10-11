import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { User } from '@supabase/supabase-js';
import { Mail, Lock, User as UserIcon, X, AlertCircle } from 'lucide-react';

interface AuthModalContextType {
  openLogin: () => void;
  openSignup: () => void;
  closeAuth: () => void;
  user: User | null;
  signOut: () => Promise<void>;
  isGuest: boolean;
}

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthGate');
  }
  return context;
}

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { user, isGuest, signIn, signUp, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const openLogin = () => {
    setAuthMode('login');
    setError('');
    setShowAuth(true);
  };

  const openSignup = () => {
    setAuthMode('signup');
    setError('');
    setShowAuth(true);
  };

  const closeAuth = () => {
    setShowAuth(false);
    setError('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message || 'Sign in failed');
    else setShowAuth(false);
    setAuthLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    const { data, error } = await signUp(email, password, name);

    if (error) {
      setError(error.message || 'Sign up failed');
    } else if (data && 'requiresEmailConfirmation' in data && data.requiresEmailConfirmation) {
      setError('');
      alert('Account created! Please check your email to verify your account before signing in.');
      setShowAuth(false);
      setEmail('');
      setPassword('');
      setName('');
    } else {
      setShowAuth(false);
      setEmail('');
      setPassword('');
      setName('');
    }
    setAuthLoading(false);
  };

  return (
    <AuthModalContext.Provider value={{ openLogin, openSignup, closeAuth, user, signOut, isGuest }}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Main application content */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>

        {/* Auth Modal */}
        {showAuth && !user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="glass-card rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-strong border border-white/30 dark:border-slate-800 relative bg-white/95 dark:bg-slate-900/95">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                    {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {authMode === 'login' ? 'Sign in to sync your tests and analytics across devices' : 'Start your prep journey with cross-device sync'}
                  </p>
                </div>
                <button
                  onClick={closeAuth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:rose-400 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={authMode === 'login' ? handleSignIn : handleSignUp} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Display Name</label>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Manish Singh"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn btn-primary w-full py-3 shadow-medium hover:shadow-strong transition-all mt-2"
                >
                  {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In to Account' : 'Create Free Account'}
                </button>
              </form>

              <div className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                {authMode === 'login' ? (
                  <p>
                    Don't have an account?{' '}
                    <button onClick={openSignup} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                      Sign Up Free
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button onClick={openLogin} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthModalContext.Provider>
  );
}

