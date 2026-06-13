import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, Mail, Lock, LogIn, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, user, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Clear errors on load
  useEffect(() => {
    clearError();
    if (user) {
      navigate('/explore');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    const success = await login(email, password);
    if (success) {
      navigate('/explore');
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      {/* Login Card */}
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Banner Logo */}
        <div className="flex flex-col items-center gap-3.5 mb-8">
          <div className="p-3 rounded-2xl bg-brand-600 text-white shadow-xl shadow-brand-600/25">
            <Bot className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-1.5 justify-center">
              Whiteboard Assistant <Sparkles className="w-4 h-4 text-brand-500" />
            </h2>
            <p className="text-xs text-dark-200 mt-1">Sign in to sync your collaborative sketches</p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-400 mb-5 animate-in slide-in-from-top-2 duration-200">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-dark-200">Email Address</label>
            <div className="flex items-center gap-2.5 bg-dark-900 border border-white/5 rounded-2xl px-4 py-3 focus-within:border-brand-500/30 transition-all">
              <Mail className="w-4 h-4 text-dark-200" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder-dark-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-dark-200">Password</label>
              <Link to="/forgot-password" className="text-[11px] text-brand-500 font-bold hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="flex items-center gap-2.5 bg-dark-900 border border-white/5 rounded-2xl px-4 py-3 focus-within:border-brand-500/30 transition-all">
              <Lock className="w-4 h-4 text-dark-200" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder-dark-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-xl shadow-brand-600/20 disabled:opacity-50 hover-scale transition-all mt-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign In
          </button>
        </form>

        {/* Register Redirect link */}
        <div className="text-center text-xs text-dark-200 mt-6 border-t border-dark-800 pt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-500 font-bold hover:underline">
            Register for Free
          </Link>
        </div>

      </div>
    </div>
  );
};
