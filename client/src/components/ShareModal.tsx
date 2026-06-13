import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  Lock, 
  Link as LinkIcon, 
  Copy, 
  Check, 
  QrCode, 
  ChevronRight 
} from 'lucide-react';
import QRCode from 'qrcode';

interface ShareModalProps {
  board: {
    id: string;
    visibility: 'private' | 'public' | 'link-only';
    share_token: string;
  };
  onClose: () => void;
  onUpdateVisibility: (visibility: 'private' | 'public' | 'link-only') => Promise<any>;
}

export const ShareModal: React.FC<ShareModalProps> = ({ board, onClose, onUpdateVisibility }) => {
  const [currentVisibility, setCurrentVisibility] = useState(board.visibility);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Generate shareable link
  const clientUrl = window.location.origin;
  const shareUrl = currentVisibility === 'link-only'
    ? `${clientUrl}/shared/${board.share_token}`
    : `${clientUrl}/board/${board.id}`;

  // Re-generate QR Code when share URL changes
  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#1f2937' // match dark tailwind background
      }
    })
      .then(url => setQrUrl(url))
      .catch(err => console.error('QR code generation failed:', err));
  }, [shareUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleVisibilityChange = async (type: 'private' | 'public' | 'link-only') => {
    setUpdating(true);
    try {
      await onUpdateVisibility(type);
      setCurrentVisibility(type);
    } catch (err) {
      console.error('Failed to update visibility:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-800 pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Share Workspace</h2>
            <p className="text-xs text-dark-200">Configure sharing rules and link collaboration</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. VISIBILITY CHOICES */}
        <div className="flex flex-col gap-3.5 mb-6">
          <label className="text-xs font-semibold tracking-wider text-dark-200 uppercase">Visibility Settings</label>
          
          <div className="flex flex-col gap-2">
            {/* Private option */}
            <button
              onClick={() => handleVisibilityChange('private')}
              disabled={updating}
              className={`flex items-center gap-3.5 p-3 rounded-2xl border text-left transition-all ${
                currentVisibility === 'private'
                  ? 'bg-brand-600/10 border-brand-500 text-white'
                  : 'bg-dark-900/50 border-white/5 text-dark-200 hover:border-white/10'
              }`}
            >
              <div className="p-2 rounded-xl bg-dark-800 text-brand-500">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold">Private Board</h4>
                <p className="text-[10px] text-dark-200 mt-0.5">Only you and direct collaborators can view or edit</p>
              </div>
              {currentVisibility === 'private' && <ChevronRight className="w-4 h-4 text-brand-500" />}
            </button>

            {/* Link-only option */}
            <button
              onClick={() => handleVisibilityChange('link-only')}
              disabled={updating}
              className={`flex items-center gap-3.5 p-3 rounded-2xl border text-left transition-all ${
                currentVisibility === 'link-only'
                  ? 'bg-brand-600/10 border-brand-500 text-white'
                  : 'bg-dark-900/50 border-white/5 text-dark-200 hover:border-white/10'
              }`}
            >
              <div className="p-2 rounded-xl bg-dark-800 text-brand-500">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold">Anyone with link</h4>
                <p className="text-[10px] text-dark-200 mt-0.5">Viewers can access without needing to authenticate</p>
              </div>
              {currentVisibility === 'link-only' && <ChevronRight className="w-4 h-4 text-brand-500" />}
            </button>

            {/* Public option */}
            <button
              onClick={() => handleVisibilityChange('public')}
              disabled={updating}
              className={`flex items-center gap-3.5 p-3 rounded-2xl border text-left transition-all ${
                currentVisibility === 'public'
                  ? 'bg-brand-600/10 border-brand-500 text-white'
                  : 'bg-dark-900/50 border-white/5 text-dark-200 hover:border-white/10'
              }`}
            >
              <div className="p-2 rounded-xl bg-dark-800 text-brand-500">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold">Public Explore</h4>
                <p className="text-[10px] text-dark-200 mt-0.5">Showcase your board on the public feeds catalog</p>
              </div>
              {currentVisibility === 'public' && <ChevronRight className="w-4 h-4 text-brand-500" />}
            </button>
          </div>
        </div>

        {/* 2. SHARING ACTION BUTTONS (Unless private) */}
        {currentVisibility !== 'private' && (
          <div className="flex flex-col gap-4 border-t border-dark-800 pt-5 mt-2 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-dark-900/80 border border-white/5 text-xs text-dark-200 rounded-xl px-3 py-2.5 focus:outline-none select-all font-mono"
              />
              <button
                onClick={handleCopyLink}
                className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 hover-scale transition-all"
                title="Copy Link"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setShowQr(!showQr)}
                className={`p-2.5 rounded-xl border transition-all ${
                  showQr 
                    ? 'bg-dark-800 border-brand-500/30 text-brand-500' 
                    : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10'
                }`}
                title="Show QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>

            {/* QR Code display */}
            {showQr && qrUrl && (
              <div className="flex flex-col items-center justify-center p-4 bg-dark-900 border border-white/5 rounded-2xl animate-in fade-in duration-200">
                <img 
                  src={qrUrl} 
                  alt="Board QR Code" 
                  className="w-44 h-44 border border-dark-800 rounded-xl shadow-md"
                />
                <span className="text-[10px] text-dark-200 mt-2 font-medium">Scan to open on phone/tablet</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
