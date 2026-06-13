import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Bot, Lock, KeyRound, Sparkles, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Token parameter is missing.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Banner Logo */}
        <div className="flex flex-col items-center gap-3.5 mb-8">
          <div className="p-3 rounded-2xl bg-brand-600 text-white shadow-xl shadow-brand-600/25">
            <Bot className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-1.5 justify-center">
              New Password <Sparkles className="w-4 h-4 text-brand-500" />
            </h2>
            <p className="text-xs text-dark-200 mt-1">Configure your new account password</p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-400 mb-5 animate-in slide-in-from-top-2 duration-200">
            {error}
          </div>
        )}

        {/* Success Alert */}
        {success ? (
          <div className="flex flex-col items-center gap-4 text-center p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in zoom-in-95 duration-200">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <div>
              <h4 className="text-xs font-bold text-white">Password Updated</h4>
              <p className="text-[10px] text-dark-200 mt-1.5">Your credentials have been successfully updated. All previous sessions have been logged out.</p>
            </div>
            <Link 
              to="/login"
              className="flex items-center justify-center gap-1.5 text-xs text-brand-500 font-bold hover:underline mt-2"
            >
              Go to Login <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-dark-200">New Password</label>
              <div className="flex items-center gap-2.5 bg-dark-900 border border-white/5 rounded-2xl px-4 py-3 focus-within:border-brand-500/30 transition-all">
                <Lock className="w-4 h-4 text-dark-200" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!token}
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder-dark-200"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-dark-200">Confirm Password</label>
              <div className="flex items-center gap-2.5 bg-dark-900 border border-white/5 rounded-2xl px-4 py-3 focus-within:border-brand-500/30 transition-all">
                <Lock className="w-4 h-4 text-dark-200" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={!token}
                  className="flex-1 bg-transparent text-xs text-white outline-none placeholder-dark-200"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-xl shadow-brand-600/20 disabled:opacity-50 hover-scale transition-all mt-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Update Password
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
