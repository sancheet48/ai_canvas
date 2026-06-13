import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Bot, Sparkles, Loader2, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link: Token parameter is missing.');
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');

        setSuccess(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

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
              Account Verification <Sparkles className="w-4 h-4 text-brand-500" />
            </h2>
            <p className="text-xs text-dark-200 mt-1">Verifying your email registration status</p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-4 text-center p-6 text-dark-200">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            <span className="text-xs">Processing token verification signature...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-center p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in zoom-in-95 duration-200">
            <AlertTriangle className="w-10 h-10 text-red-500" />
            <div>
              <h4 className="text-xs font-bold text-white">Verification Failed</h4>
              <p className="text-[10px] text-red-400 mt-1.5 leading-relaxed">{error}</p>
            </div>
            <Link 
              to="/login"
              className="flex items-center justify-center gap-1.5 text-xs text-brand-500 font-bold hover:underline mt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        )}

        {/* Success */}
        {!loading && success && (
          <div className="flex flex-col items-center gap-4 text-center p-4 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in zoom-in-95 duration-200">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <div>
              <h4 className="text-xs font-bold text-white">Email Verified!</h4>
              <p className="text-[10px] text-dark-200 mt-1.5">Thank you. Your email address has been verified successfully. You can now use all visual workspace elements.</p>
            </div>
            <Link 
              to="/login"
              className="flex items-center justify-center gap-1.5 text-xs text-brand-500 font-bold hover:underline mt-2"
            >
              Go to Workspace <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};
