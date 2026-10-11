import { createContext, useContext, useState, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { User } from '@supabase/supabase-js';
import { Mail, Lock, User as UserIcon, X, AlertCircle, Sparkles } from 'lucide-react';

interface AuthModalContextType {
  openLogin: () => void;
  openSignup: () => void;
  closeAuth: () => void;
  user: User | null;
  signOut: () => Promise<void>;
  isGuest: boolean;
  loading: boolean;
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
  const { user, isGuest, loading, signIn, signUp, signOut } = useAuth();
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
    <AuthModalContext.Provider value={{ openLogin, openSignup, closeAuth, user, signOut, isGuest, loading }}>
      <div className="min-h-screen bg-[#F4F5F7] text-gray-900 flex flex-col">
        {/* Main application content */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>

        {/* Auth Modal */}
        {showAuth && !user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white text-gray-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-200/80 relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    {authMode === 'login' ? 'Sign in to sync your tests and analytics across devices' : 'Start your prep journey with cross-device sync'}
                  </p>
                </div>
                <button
                  onClick={closeAuth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <div className="flex-1">
                    <p className="font-medium leading-relaxed">{error}</p>
                    <button
                      type="button"
                      onClick={closeAuth}
                      className="mt-2 text-[11px] font-bold text-gray-900 underline hover:no-underline block"
                    >
                      Continue in Guest Mode instead →
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={authMode === 'login' ? handleSignIn : handleSignUp} className="space-y-4">
                {authMode === 'signup' && (
                  <div>
                    <label className="text-xs font-bold text-gray-700 mb-1.5 block">Display Name</label>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Manish Singh"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 px-4 bg-gray-900 hover:bg-black text-white font-bold rounded-full transition-all shadow-md mt-2 flex items-center justify-center gap-2 text-xs"
                >
                  {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In to Account' : 'Create Free Account'}
                </button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-white px-2.5 text-gray-400 font-bold">Or continue without account</span>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAuth}
                className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-2 border border-gray-200"
              >
                <Sparkles size={14} className="text-amber-500" /> Continue as Guest (Offline Mode)
              </button>

              <div className="mt-5 text-center text-xs text-gray-500 border-t border-gray-100 pt-4">
                {authMode === 'login' ? (
                  <p>
                    Don't have an account?{' '}
                    <button onClick={openSignup} className="text-gray-900 font-bold hover:underline">
                      Sign Up Free
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button onClick={openLogin} className="text-gray-900 font-bold hover:underline">
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

