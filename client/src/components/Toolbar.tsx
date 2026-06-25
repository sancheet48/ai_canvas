import React, { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { 
  MousePointer, 
  Square, 
  Circle, 
  Zap, 
  GitCommit, 
  ArrowRight, 
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil, 
  Type, 
  Image as ImageIcon, 
  Eraser, 
  ZoomIn, 
  ZoomOut, 
  Grid, 
  Magnet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2
} from 'lucide-react';
import { useCanvasStore, ToolType } from '../store/useCanvasStore';

interface ToolbarProps {
  onDeletePageTrigger?: () => void;
}export const Toolbar: React.FC<ToolbarProps> = ({ onDeletePageTrigger }) => {
  const { 
    tool, 
    setTool, 
    gridEnabled, 
    setGridEnabled,
    snapToGrid,
    setSnapToGrid,
    zoom, 
    setZoom,
    setPan,
    canvasMode,
    setCanvasMode,
    currentPage,
    setCurrentPage,
    totalPages,
    addPage,
    deletePage
  } = useCanvasStore();
  const tools: { type: ToolType; label: string; icon: React.ReactNode; hotkey: string }[] = [
    { type: 'selection', label: 'Selection (V or 1)', icon: <MousePointer className="w-5 h-5" />, hotkey: '1' },
    { type: 'rectangle', label: 'Rectangle (R or 2)', icon: <Square className="w-5 h-5" />, hotkey: '2' },
    { type: 'ellipse', label: 'Ellipse (O or 3)', icon: <Circle className="w-5 h-5" />, hotkey: '3' },
    { type: 'diamond', label: 'Diamond (D or 4)', icon: <Zap className="w-5 h-5" />, hotkey: '4' },
    { type: 'line', label: 'Line (L or 5)', icon: <GitCommit className="w-5 h-5" />, hotkey: '5' },
    { type: 'arrow', label: 'Arrow (A or 6)', icon: <ArrowRight className="w-5 h-5" />, hotkey: '6' },
    { type: 'freehand', label: 'Pencil (P or 7)', icon: <Pencil className="w-5 h-5" />, hotkey: '7' },
    { type: 'text', label: 'Text (T or 8)', icon: <Type className="w-5 h-5" />, hotkey: '8' },
    { type: 'image', label: 'Image Upload (I or 9)', icon: <ImageIcon className="w-5 h-5" />, hotkey: '9' },
    { type: 'eraser', label: 'Eraser (E or 0)', icon: <Eraser className="w-5 h-5" />, hotkey: '0' },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
      {/* Zoom / Viewport controls */}
      <div className="flex items-center gap-1 p-1.5 rounded-2xl glass-panel shadow-2xl">
        <button
          onClick={() => setZoom(z => z - 0.1)}
          className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="px-2 py-1 text-xs font-semibold rounded-lg text-brand-500 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => z + 0.1)}
          className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Scroll / Panning controls */}
      <div className="flex items-center gap-1 p-1.5 rounded-2xl glass-panel shadow-2xl">
        <button
          onClick={() => setPan(p => ({ ...p, x: p.x + 100 }))}
          className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Scroll Left"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPan(p => ({ ...p, y: p.y + 100 }))}
          className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Scroll Up"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPan(p => ({ ...p, y: p.y - 100 }))}
          className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Scroll Down"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPan(p => ({ ...p, x: p.x - 100 }))}
          className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Scroll Right"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Drawing tools */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel shadow-2xl">
        {tools.map((item) => {
          const isActive = tool === item.type;
          return (
            <button
              key={item.type}
              onClick={() => setTool(item.type)}
              className={`p-2.5 rounded-xl hover-scale transition-all relative group ${
                isActive 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' 
                  : 'text-dark-200 hover:bg-dark-800 hover:text-white'
              }`}
              title={item.label}
            >
              {item.icon}
              {/* Tooltip */}
              <span className="absolute bottom-12 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform bg-dark-900 text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-md whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Snapping controls */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel shadow-2xl">
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`p-2.5 rounded-xl transition-all ${
            snapToGrid 
              ? 'bg-dark-800 text-brand-500 border border-brand-500/20' 
              : 'text-dark-200 hover:bg-dark-800 hover:text-white'
          }`}
          title="Snap to Grid (S)"
        >
          <Magnet className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas Mode and Pagination controls */}
      <div className="flex items-center gap-2.5 p-1.5 rounded-2xl glass-panel shadow-2xl">
        {/* Page navigation controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (currentPage > 1) setCurrentPage(currentPage - 1);
            }}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-dark-950/40 border border-white/5 text-dark-200 hover:text-white hover:bg-dark-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page Overview Indicator List */}
          <div className="flex items-center gap-1 max-w-[140px] overflow-x-auto no-scrollbar py-0.5">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-6 h-6 rounded-lg text-[9px] font-bold transition-all border flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? 'bg-brand-600 border-brand-500 text-white shadow-md'
                      : 'bg-dark-950/40 border-white/5 text-dark-200 hover:text-white hover:border-white/10'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              if (currentPage < totalPages) setCurrentPage(currentPage + 1);
            }}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-dark-950/40 border border-white/5 text-dark-200 hover:text-white hover:bg-dark-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={addPage}
            className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 hover-scale transition-all flex items-center justify-center"
            title="Add Page"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {totalPages > 1 && (
            <button
              onClick={onDeletePageTrigger}
              className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
              title="Delete Page"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};






