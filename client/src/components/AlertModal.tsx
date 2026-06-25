import React from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  buttonLabel?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  buttonLabel = 'OK',
  type = 'error',
  onClose
}) => {
  if (!isOpen) return null;

  const getIconAndStyle = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          style: 'bg-green-500/10 text-green-500 border-green-500/25'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          style: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/25'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          style: 'bg-red-500/10 text-red-500 border-red-500/25'
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5" />,
          style: 'bg-brand-600/10 text-brand-500 border-brand-500/25'
        };
    }
  };

  const { icon, style } = getIconAndStyle();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-sm glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-250 text-left border border-white/5 bg-dark-900/90 flex flex-col gap-4">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-2.5 mt-1 pb-1">
          <div className={`p-2 rounded-xl border ${style}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h3>
            <p className="text-[10px] text-dark-200 mt-0.5 font-medium leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end mt-2 pt-4 border-t border-dark-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 transition-all"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
