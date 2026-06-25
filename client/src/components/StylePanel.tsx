import React, { useState } from 'react';
import {
  BringToFront,
  SendToBack,
  Layers,
  Paintbrush,
  Maximize2,
  Grid3X3,
  Sliders,
  ChevronLeft,
  Type,
  Bold,
  Italic
} from 'lucide-react';
import { useCanvasStore, DashStyle } from '../store/useCanvasStore';

export const StylePanel: React.FC = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const {
    elements,
    selectedIds,
    setElements,
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    opacity,
    setOpacity,
    strokeWidth,
    setStrokeWidth,
    dashStyle,
    setDashStyle,
    roughness,
    setRoughness,
    fontFamily,
    setFontFamily,
    fontWeight,
    setFontWeight,
    fontStyle,
    setFontStyle,
    tool,
    gridEnabled,
    setGridEnabled,
    gridType,
    setGridType
  } = useCanvasStore();

  const isSelected = selectedIds.length > 0;

  // Curated premium color palettes
  const strokeColors = [
    '#ffffff', '#000000', '#4b5563', '#ef4444',
    '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  const fillColors = [
    'transparent', '#ffffff', '#e5e7eb', '#fca5a5',
    '#fde047', '#86efac', '#93c5fd', '#c084fc', '#fbcfe8'
  ];

  // Z-Order functions
  const handleBringToFront = () => {
    if (selectedIds.length === 0) return;
    const selected = elements.filter(el => selectedIds.includes(el.id));
    const unselected = elements.filter(el => !selectedIds.includes(el.id));
    setElements([...unselected, ...selected]);
  };

  const handleSendToBack = () => {
    if (selectedIds.length === 0) return;
    const selected = elements.filter(el => selectedIds.includes(el.id));
    const unselected = elements.filter(el => !selectedIds.includes(el.id));
    setElements([...selected, ...unselected]);
  };

  const selectedTextElement = elements.find(el => selectedIds.includes(el.id) && el.type === 'text');
  const isTextMode = tool === 'text' || (selectedIds.length === 1 && selectedTextElement !== undefined);

  const currentFontFamily = selectedTextElement?.fontFamily || fontFamily;
  const currentFontWeight = selectedTextElement?.fontWeight || fontWeight;
  const currentFontStyle = selectedTextElement?.fontStyle || fontStyle;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="absolute top-24 left-6 p-3 rounded-full bg-dark-900 border border-white/5 text-brand-500 hover:text-white hover-scale shadow-2xl z-30 flex items-center justify-center w-12 h-12"
        title="Show Styles Panel"
      >
        <Sliders className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="absolute top-24 left-6 w-72 glass-panel rounded-3xl p-5 shadow-2xl z-30 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-dark-800 pb-3">
        <h3 className="text-sm font-semibold tracking-wider text-dark-200 flex items-center gap-2 uppercase">
          <Sliders className="w-4 h-4 text-brand-500" />
          {isSelected ? 'Selection Styles' : 'Canvas Defaults'}
        </h3>

        <div className="flex items-center gap-2">
          {isSelected && (
            <span className="text-[10px] bg-brand-600/20 text-brand-500 font-semibold px-2 py-0.5 rounded-full border border-brand-500/20">
              {selectedIds.length} Selected
            </span>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-lg text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
            title="Minimize Panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. STROKE COLOR / TEXT COLOR */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
          <Paintbrush className="w-3.5 h-3.5" /> {isTextMode ? 'Text Color' : 'Stroke Color'}
        </label>
        <div className="grid grid-cols-9 gap-1.5">
          {strokeColors.map((color) => (
            <button
              key={color}
              onClick={() => setStrokeColor(color)}
              className="w-6 h-6 rounded-lg transition-transform hover:scale-110 relative border border-white/10"
              style={{ backgroundColor: color }}
              title={color === '#000000' ? 'Black' : color === '#ffffff' ? 'White' : color}
            >
              {strokeColor === color && (
                <div className="absolute inset-1 rounded-sm border-2 border-brand-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. FILL COLOR / HIGHLIGHT BACKGROUND */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> {isTextMode ? 'Highlight / Background' : 'Fill Color'}
        </label>
        <div className="grid grid-cols-9 gap-1.5">
          {fillColors.map((color) => (
            <button
              key={color}
              onClick={() => setFillColor(color)}
              className="w-6 h-6 rounded-lg transition-transform hover:scale-110 relative border border-white/10 overflow-hidden"
              style={{
                background: color === 'transparent'
                  ? 'linear-gradient(45deg, #ef4444 25%, transparent 25%), linear-gradient(-45deg, #ef4444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ef4444 75%), linear-gradient(-45deg, transparent 75%, #ef4444 75%)'
                  : color,
                backgroundSize: color === 'transparent' ? '8px 8px' : 'auto',
                backgroundPosition: color === 'transparent' ? '0 0' : 'auto'
              }}
              title={color === 'transparent' ? 'Transparent' : color}
            >
              {fillColor === color && (
                <div className="absolute inset-1 rounded-sm border-2 border-brand-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TEXT OPTIONS */}
      {isTextMode && (
        <>
          {/* FONT FAMILY */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-brand-500" /> Font Family
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "'Outfit', 'Inter', sans-serif", label: 'Outfit (Sans)' },
                { value: "Georgia, serif", label: 'Georgia (Serif)' },
                { value: "Courier New, monospace", label: 'Courier (Mono)' },
                { value: "cursive", label: 'Handwritten' }
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFontFamily(f.value)}
                  className={`py-1.5 text-[10px] font-semibold rounded-xl border transition-all truncate px-1 ${currentFontFamily === f.value
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/15'
                      : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10 hover:text-white'
                    }`}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* BOLD & ITALIC TOGGLES */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-brand-500" /> Text Formatting
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFontWeight(currentFontWeight === 'bold' ? 'normal' : 'bold')}
                className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-xl border transition-all ${currentFontWeight === 'bold'
                    ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/15'
                    : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10 hover:text-white'
                  }`}
                title="Toggle Bold"
              >
                <Bold className="w-3.5 h-3.5" /> Bold
              </button>
              <button
                onClick={() => setFontStyle(currentFontStyle === 'italic' ? 'normal' : 'italic')}
                className={`flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-xl border transition-all ${currentFontStyle === 'italic'
                    ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/15'
                    : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10 hover:text-white'
                  }`}
                title="Toggle Italic"
              >
                <Italic className="w-3.5 h-3.5" /> Italic
              </button>
            </div>
          </div>
        </>
      )}

      {/* SHAPE SPECIFIC OPTIONS */}
      {!isTextMode && (
        <>
          {/* 3. STROKE WIDTH */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" /> Stroke Width
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 1, label: 'Thin' },
                { value: 2, label: 'Medium' },
                { value: 4, label: 'Bold' }
              ]).map((w) => (
                <button
                  key={w.value}
                  onClick={() => setStrokeWidth(w.value)}
                  className={`py-1.5 text-[11px] font-semibold rounded-xl border transition-all ${strokeWidth === w.value
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/15'
                      : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10 hover:text-white'
                    }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. DASH STYLE */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5" /> Dash Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' }
              ] as { value: DashStyle; label: string }[]).map((styleOpt) => (
                <button
                  key={styleOpt.value}
                  onClick={() => setDashStyle(styleOpt.value)}
                  className={`py-1.5 text-[11px] font-semibold rounded-xl border transition-all ${dashStyle === styleOpt.value
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/15'
                      : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10 hover:text-white'
                    }`}
                >
                  {styleOpt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. ROUGHNESS */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-medium text-dark-200">
              <span>Roughness</span>
              <span className="text-brand-500 font-semibold">{roughness}</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.5"
              value={roughness}
              onChange={(e) => setRoughness(parseFloat(e.target.value))}
              className="w-full h-1 bg-dark-900 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
          </div>
        </>
      )}

      {/* 6. OPACITY */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-xs font-medium text-dark-200">
          <span>Opacity</span>
          <span className="text-brand-500 font-semibold">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full h-1 bg-dark-900 rounded-lg appearance-none cursor-pointer accent-brand-500"
        />
      </div>

      {/* 7. Z-ORDER ACTIONS (Only visible when elements are selected) */}
      {isSelected && (
        <div className="flex flex-col gap-2.5 border-t border-dark-800 pt-4 mt-1">
          <label className="text-[11px] font-semibold tracking-wider text-dark-200 uppercase">Z-Order Layers</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleBringToFront}
              className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-dark-900 border border-white/5 text-dark-200 hover:border-brand-500/30 hover:text-white transition-all"
              title="Bring selected shapes to top layer"
            >
              <BringToFront className="w-3.5 h-3.5 text-brand-500" /> Bring Front
            </button>
            <button
              onClick={handleSendToBack}
              className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-dark-900 border border-white/5 text-dark-200 hover:border-brand-500/30 hover:text-white transition-all"
              title="Send selected shapes to bottom layer"
            >
              <SendToBack className="w-3.5 h-3.5 text-brand-500" /> Send Back
            </button>
          </div>
        </div>
      )}

      {/* 8. CANVAS BACKGROUND STYLE (Only shown when no elements are selected) */}
      {!isSelected && (
        <div className="flex flex-col gap-2 border-t border-dark-800 pt-4 mt-1">
          <label className="text-xs font-medium text-dark-200 flex items-center gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5 text-brand-500" /> Background Pattern
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'none', label: 'Blank Canvas' },
              { value: 'grid', label: 'Grid Lines' },
              { value: 'lines', label: 'Ruled Lines' },
              { value: 'dots', label: 'Dotted Grid' }
            ] as { value: 'none' | 'grid' | 'lines' | 'dots'; label: string }[]).map((opt) => {
              const isActive = opt.value === 'none' ? !gridEnabled : (gridEnabled && gridType === opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (opt.value === 'none') {
                      setGridEnabled(false);
                    } else {
                      setGridEnabled(true);
                      setGridType(opt.value);
                    }
                  }}
                  className={`py-2 text-[10px] font-bold rounded-xl border transition-all truncate px-1 ${
                    isActive
                      ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/15'
                      : 'bg-dark-900 border-white/5 text-dark-200 hover:border-white/10 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
