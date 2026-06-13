import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Mail, Sparkles, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed request');

      setMessage(data.message || 'Verification link sent if email exists.');
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
              Password Reset <Sparkles className="w-4 h-4 text-brand-500" />
            </h2>
            <p className="text-xs text-dark-200 mt-1">Request a secure recovery magic link</p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-xs text-red-400 mb-5 animate-in slide-in-from-top-2 duration-200">
            {error}
          </div>
        )}

        {/* Success message */}
        {message ? (
          <div className="flex flex-col items-center gap-4 text-center p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in zoom-in-95 duration-200">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <div>
              <h4 className="text-xs font-bold text-white">Request Dispatched</h4>
              <p className="text-[10px] text-dark-200 mt-1.5 leading-relaxed">{message}</p>
            </div>
            <Link 
              to="/login"
              className="flex items-center justify-center gap-1.5 text-xs text-brand-500 font-bold hover:underline mt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-dark-200">Account Email</label>
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

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-xl shadow-brand-600/20 disabled:opacity-50 hover-scale transition-all mt-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Recovery Link
            </button>

            <Link 
              to="/login"
              className="flex items-center justify-center gap-1.5 text-xs text-dark-200 font-bold hover:underline mt-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </form>
        )}

      </div>
    </div>
  );
};
