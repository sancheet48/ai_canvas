import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = true,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-sm glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-250 text-left border border-white/5 bg-dark-900/90">
        
        {/* Close Button */}
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning Icon & Title */}
        <div className="flex flex-col items-center text-center gap-3 mt-2 mb-4">
          <div className={`p-3 rounded-2xl ${isDanger ? 'bg-red-500/10 text-red-500 border border-red-500/25' : 'bg-brand-600/10 text-brand-500 border border-brand-500/25'}`}>
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
            <p className="text-xs text-dark-200 mt-2 font-medium leading-relaxed px-2">
              {message}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-800">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-dark-950 hover:bg-dark-850 border border-white/5 hover:border-white/10 text-xs font-bold text-dark-200 hover:text-white transition-all text-center"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all text-center ${
              isDanger 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/15' 
                : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/15'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
