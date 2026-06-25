import React, { useState } from 'react';
import { X, LayoutGrid, FileText, Globe, Lock } from 'lucide-react';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string, visibility: 'private' | 'public') => Promise<void>;
  creating: boolean;
}

export const CreateBoardModal: React.FC<CreateBoardModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  creating
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Workspace name is required');
      return;
    }

    try {
      await onCreate(trimmedTitle, description.trim(), visibility);
      setTitle('');
      setDescription('');
      setVisibility('private');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create workspace');
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
      <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-800 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-600/10 text-brand-500">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">New Whiteboard</h2>
              <p className="text-[10px] text-dark-200">Initialize a new infinite canvas room</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Workspace Name Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">Workspace Name</label>
            <input
              type="text"
              placeholder="e.g. Brainstorming session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={creating}
              maxLength={100}
              className="bg-dark-900 border border-white/5 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500/30 transition-colors w-full font-medium"
              required
            />
          </div>

          {/* Description Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">Description (Optional)</label>
            <textarea
              placeholder="Provide a brief summary of what this whiteboard maps out..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={creating}
              rows={3}
              maxLength={250}
              className="bg-dark-900 border border-white/5 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500/30 transition-colors w-full font-medium resize-none"
            />
          </div>

          {/* Visibility Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">Initial Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                disabled={creating}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  visibility === 'private'
                    ? 'bg-brand-600/10 border-brand-500 text-white'
                    : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Private Room</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('public')}
                disabled={creating}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  visibility === 'public'
                    ? 'bg-brand-600/10 border-brand-500 text-white'
                    : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Public Explore</span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-dark-800">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 rounded-xl bg-dark-900 hover:bg-dark-850 border border-white/5 hover:border-white/10 text-xs font-bold text-dark-200 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 transition-all flex items-center gap-1.5"
            >
              {creating ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
