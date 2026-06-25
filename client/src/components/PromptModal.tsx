import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  placeholder = 'Type here...',
  defaultValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  multiline = false,
  onConfirm,
  onCancel
}) => {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <form 
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-250 text-left border border-white/5 bg-dark-900/90 flex flex-col gap-4"
      >
        {/* Close Button */}
        <button 
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mt-1 pb-1">
          <div className="p-2 rounded-xl bg-brand-600/10 text-brand-500 border border-brand-500/25">
            <Edit3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h3>
            <p className="text-[10px] text-dark-200 mt-0.5">{message}</p>
          </div>
        </div>

        {/* Input Field */}
        <div className="flex flex-col gap-1.5 mt-1">
          {multiline ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              rows={3}
              maxLength={250}
              className="bg-dark-950 border border-white/5 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500/30 transition-colors w-full font-medium resize-none"
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              maxLength={100}
              className="bg-dark-950 border border-white/5 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500/30 transition-colors w-full font-medium"
              autoFocus
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-dark-800">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-dark-950 hover:bg-dark-850 border border-white/5 hover:border-white/10 text-xs font-bold text-dark-200 hover:text-white transition-all text-center"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 transition-all text-center"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
