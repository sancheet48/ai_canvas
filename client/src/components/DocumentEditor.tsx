import React, { useEffect, useRef, useState } from 'react';
import { 
  Bold as BoldIcon, 
  Italic as ItalicIcon, 
  Underline as UnderlineIcon, 
  Strikethrough as StrikeIcon,
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  List, 
  ListOrdered, 
  Palette,
  ChevronDown,
  FileText,
  Table
} from 'lucide-react';

interface DocumentEditorProps {
  initialValue: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

// Heading config: tag -> { label, fontSize, fontWeight, lineHeight }
const HEADING_CONFIG: Record<string, { label: string; fontSize: string; fontWeight: string; lineHeight: string }> = {
  p:  { label: 'Normal Text', fontSize: '15px', fontWeight: '400', lineHeight: '1.7' },
  h1: { label: 'Heading 1',   fontSize: '2em',  fontWeight: '700', lineHeight: '1.2' },
  h2: { label: 'Heading 2',   fontSize: '1.5em',fontWeight: '700', lineHeight: '1.3' },
  h3: { label: 'Heading 3',   fontSize: '1.25em',fontWeight: '600', lineHeight: '1.4' },
  h4: { label: 'Heading 4',   fontSize: '1.1em', fontWeight: '600', lineHeight: '1.5' },
  h5: { label: 'Heading 5',   fontSize: '1em',   fontWeight: '600', lineHeight: '1.5' },
  h6: { label: 'Heading 6',   fontSize: '0.875em',fontWeight: '600', lineHeight: '1.5' },
};

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ initialValue, onSave, onCancel }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  // Saved selection range (to restore after toolbar clicks blur the editor)
  const savedSelectionRef = useRef<Range | null>(null);
  
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [fontFamily, setFontFamily] = useState("'Outfit', sans-serif");
  const [fontSize, setFontSize] = useState("16px");
  const [headingValue, setHeadingValue] = useState('p');

  // Colors palette matching the theme
  const colors = [
    { name: 'White', value: '#ffffff' },
    { name: 'Slate', value: '#94a3b8' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
  ];

  // Map CSS font sizes to document.execCommand size values (1-7)
  const sizeMap: { [key: string]: string } = {
    "12px": "1",
    "14px": "2",
    "16px": "3",
    "18px": "4",
    "24px": "5",
    "32px": "6",
    "36px": "7"
  };

  // Initial load
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialValue || '';
      updateMetrics();
    }
  }, [initialValue]);

  const handleInput = () => {
    updateMetrics();
  };

  const updateMetrics = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const chars = text.length;
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      setCharCount(chars);
      setWordCount(words);
    }
  };

  // Save selection before toolbar buttons grab focus
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  // Restore a previously saved selection
  const restoreSelection = () => {
    const range = savedSelectionRef.current;
    if (!range) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // Formatting actions wrapper
  const executeCommand = (command: string, value: string = '') => {
    restoreSelection();
    document.execCommand(command, false, value);
    handleInput();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  // Robust heading application: uses formatBlock then applies inline styles
  const applyHeading = (tag: string) => {
    if (!editorRef.current) return;
    setHeadingValue(tag);
    restoreSelection();
    editorRef.current.focus();

    const config = HEADING_CONFIG[tag];
    if (!config) return;

    // execCommand formatBlock works with just the bare tag name in most browsers
    // but we try with and without angle brackets for maximum compatibility
    const success = document.execCommand('formatBlock', false, tag);
    if (!success) {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }

    // After formatBlock, find the block element the cursor is in and patch styles
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      let node: Node | null = sel.getRangeAt(0).startContainer;
      // Walk up to find the block element
      while (node && node !== editorRef.current) {
        if (node.nodeType === 1) {
          const el = node as HTMLElement;
          const nodeName = el.nodeName.toLowerCase();
          if (nodeName === tag || ['h1','h2','h3','h4','h5','h6','p','div'].includes(nodeName)) {
            // Apply inline styles for reliable rendering regardless of CSS resets
            el.style.fontSize = config.fontSize;
            el.style.fontWeight = config.fontWeight;
            el.style.lineHeight = config.lineHeight;
            el.style.marginTop = tag === 'p' ? '0' : '0.75em';
            el.style.marginBottom = tag === 'p' ? '0' : '0.4em';
            break;
          }
        }
        node = node.parentNode;
      }
      handleInput();
    }, 0);
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    setFontFamily(font);
    executeCommand('fontName', font);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    setFontSize(size);
    executeCommand('fontSize', sizeMap[size]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    // Try to get rich text first (strips external formatting), fall back to plain text
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    if (plain) {
      // Always insert as plain text to avoid pasted content breaking layout
      document.execCommand('insertText', false, plain);
    } else if (html) {
      // Sanitize: strip style attrs and paste as plain text
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      document.execCommand('insertText', false, tmp.innerText);
    }
  };

  const insertTable = () => {
    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; border: 1px solid rgba(128, 128, 128, 0.4);">
        <tbody>
          <tr>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
          </tr>
          <tr>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
            <td style="border: 1px solid rgba(128, 128, 128, 0.4); padding: 8px; min-width: 50px; height: 30px;"><br></td>
          </tr>
        </tbody>
      </table>
    `;
    executeCommand('insertHTML', tableHTML);
  };

  const addRow = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const activeCell = range.startContainer.parentElement?.closest('td, th');
    if (activeCell) {
      const activeRow = activeCell.parentElement as HTMLTableRowElement;
      const table = activeRow.closest('table');
      if (table && activeRow) {
        const newRow = table.insertRow(activeRow.rowIndex + 1);
        const cellCount = activeRow.cells.length;
        for (let i = 0; i < cellCount; i++) {
          const newCell = newRow.insertCell();
          newCell.style.border = '1px solid rgba(128, 128, 128, 0.4)';
          newCell.style.padding = '8px';
          newCell.style.minWidth = '50px';
          newCell.style.height = '30px';
          newCell.innerHTML = '<br>';
        }
        handleInput();
      }
    }
  };

  const addColumn = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const activeCell = range.startContainer.parentElement?.closest('td, th') as HTMLTableCellElement;
    if (activeCell) {
      const activeRow = activeCell.parentElement as HTMLTableRowElement;
      const table = activeRow.closest('table');
      if (table) {
        const cellIndex = activeCell.cellIndex;
        const rows = table.rows;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const newCell = row.insertCell(cellIndex + 1);
          newCell.style.border = '1px solid rgba(128, 128, 128, 0.4)';
          newCell.style.padding = '8px';
          newCell.style.minWidth = '50px';
          newCell.style.height = '30px';
          newCell.innerHTML = '<br>';
        }
        handleInput();
      }
    }
  };

  // Close dropdown on clicking outside
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (showColorDropdown && !(e.target as Element).closest('.color-picker-container')) {
        setShowColorDropdown(false);
      }
    };
    document.addEventListener('click', clickOutside);
    return () => document.removeEventListener('click', clickOutside);
  }, [showColorDropdown]);

  const handleSave = () => {
    if (editorRef.current) {
      onSave(editorRef.current.innerHTML);
    } else {
      onSave(initialValue);
    }
  };

  return (
    <div className="fixed inset-0 bg-dark-950/95 backdrop-blur-md z-50 flex flex-col text-white animate-in fade-in duration-200">
      {/* Scoped heading styles for contentEditable (override Tailwind reset) */}
      <style>{`
        .doc-editor-content h1 { font-size: 2em !important; font-weight: 700 !important; line-height: 1.2 !important; margin: 0.75em 0 0.4em !important; }
        .doc-editor-content h2 { font-size: 1.5em !important; font-weight: 700 !important; line-height: 1.3 !important; margin: 0.75em 0 0.4em !important; }
        .doc-editor-content h3 { font-size: 1.25em !important; font-weight: 600 !important; line-height: 1.4 !important; margin: 0.75em 0 0.4em !important; }
        .doc-editor-content h4 { font-size: 1.1em !important; font-weight: 600 !important; line-height: 1.5 !important; margin: 0.75em 0 0.4em !important; }
        .doc-editor-content h5 { font-size: 1em !important; font-weight: 600 !important; line-height: 1.5 !important; margin: 0.75em 0 0.4em !important; }
        .doc-editor-content h6 { font-size: 0.875em !important; font-weight: 600 !important; line-height: 1.5 !important; margin: 0.75em 0 0.4em !important; }
        .doc-editor-content p { margin: 0 0 0.5em !important; }
        .doc-editor-content ul { list-style: disc !important; padding-left: 1.5em !important; margin: 0.5em 0 !important; }
        .doc-editor-content ol { list-style: decimal !important; padding-left: 1.5em !important; margin: 0.5em 0 !important; }
        .doc-editor-content table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .doc-editor-content td, .doc-editor-content th { border: 1px solid rgba(128,128,128,0.4); padding: 8px; min-width: 50px; }
      `}</style>
      
      {/* MODAL HEADER */}
      <div className="flex items-center justify-between px-6 py-4 bg-dark-900/80 border-b border-white/5 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-brand-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-bold text-white">Document Card Editor</h2>
            <p className="text-[10px] text-dark-300 font-medium">Format and edit your rich-text canvas card</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-dark-950/40 border border-white/5 text-xs font-bold text-dark-200 hover:text-white hover:bg-dark-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 transition-all"
          >
            Save & Pin to Canvas
          </button>
        </div>
      </div>

      {/* RICH TEXT FORMATTING TOOLBAR */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-dark-900/60 backdrop-blur-md border-b border-white/5 shadow-md sticky top-0 z-20">
        
        {/* Font Family Dropdown */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl px-2.5 py-1 text-xs">
          <span className="text-[10px] text-dark-300 font-bold uppercase mr-2 tracking-wider">Font:</span>
          <select 
            value={fontFamily} 
            onChange={handleFontChange}
            className="bg-transparent text-white outline-none border-none cursor-pointer font-medium font-sans text-xs focus:ring-0"
          >
            <option value="'Outfit', sans-serif" className="bg-dark-900 text-white">Outfit</option>
            <option value="'Inter', sans-serif" className="bg-dark-900 text-white">Inter</option>
            <option value="Arial, sans-serif" className="bg-dark-900 text-white">Arial</option>
            <option value="'Times New Roman', serif" className="bg-dark-900 text-white">Times New Roman</option>
            <option value="'Courier New', monospace" className="bg-dark-900 text-white">Courier New</option>
            <option value="Georgia, serif" className="bg-dark-900 text-white">Georgia</option>
          </select>
        </div>

        {/* Font Size Dropdown */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl px-2.5 py-1 text-xs">
          <span className="text-[10px] text-dark-300 font-bold uppercase mr-2 tracking-wider">Size:</span>
          <select 
            value={fontSize} 
            onChange={handleFontSizeChange}
            className="bg-transparent text-white outline-none border-none cursor-pointer font-medium text-xs focus:ring-0"
          >
            <option value="12px" className="bg-dark-900 text-white">12px</option>
            <option value="14px" className="bg-dark-900 text-white">14px</option>
            <option value="16px" className="bg-dark-900 text-white">16px</option>
            <option value="18px" className="bg-dark-900 text-white">18px</option>
            <option value="24px" className="bg-dark-900 text-white">24px</option>
            <option value="32px" className="bg-dark-900 text-white">32px</option>
            <option value="36px" className="bg-dark-900 text-white">36px</option>
          </select>
        </div>

        {/* Headings Selector */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl px-2.5 py-1 text-xs">
          <span className="text-[10px] text-dark-300 font-bold uppercase mr-2 tracking-wider">Style:</span>
          <select 
            value={headingValue}
            onChange={(e) => applyHeading(e.target.value)}
            onMouseDown={saveSelection}
            className="bg-transparent text-white outline-none border-none cursor-pointer font-medium text-xs focus:ring-0"
          >
            {Object.entries(HEADING_CONFIG).map(([tag, cfg]) => (
              <option key={tag} value={tag} className="bg-dark-900 text-white">
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table tools */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl p-0.5">
          <button 
            onClick={insertTable}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors text-xs font-bold"
            title="Insert 3x3 Table"
          >
            <Table className="w-4 h-4 text-brand-500" />
            <span>Table</span>
          </button>
          <button 
            onClick={addRow}
            className="px-2 py-1 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors text-xs font-bold"
            title="Add Row Below"
          >
            +Row
          </button>
          <button 
            onClick={addColumn}
            className="px-2 py-1 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors text-xs font-bold"
            title="Add Column Right"
          >
            +Col
          </button>
        </div>

        <div className="w-[1px] h-5 bg-dark-800 mx-1" />

        {/* Inline styles */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl p-0.5">
          <button 
            onClick={() => executeCommand('bold')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Bold"
          >
            <BoldIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('italic')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Italic"
          >
            <ItalicIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('underline')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('strikeThrough')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Strikethrough"
          >
            <StrikeIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl p-0.5">
          <button 
            onClick={() => executeCommand('justifyLeft')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('justifyCenter')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('justifyRight')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('justifyFull')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center bg-dark-950/40 border border-white/5 rounded-xl p-0.5">
          <button 
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            onClick={() => executeCommand('insertOrderedList')}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-200 hover:text-white transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        <div className="w-[1px] h-5 bg-dark-800 mx-1" />

        {/* Text color and Clear Formatting */}
        <div className="flex items-center gap-1">
          {/* Color Picker Dropdown */}
          <div className="relative color-picker-container">
            <button 
              onClick={() => setShowColorDropdown(!showColorDropdown)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-dark-950/40 border border-white/5 hover:border-brand-500/30 text-xs font-bold text-dark-200 hover:text-white transition-all"
              title="Text Color"
            >
              <Palette className="w-3.5 h-3.5 text-brand-500" />
              <ChevronDown className="w-3.5 h-3.5 text-dark-300" />
            </button>

            {showColorDropdown && (
              <div className="absolute left-0 mt-2 bg-dark-900 border border-white/5 rounded-2xl p-2.5 z-50 shadow-2xl w-40">
                <p className="font-bold text-white text-[9px] uppercase tracking-wider mb-2 text-left">Text Color</p>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        executeCommand('foreColor', c.value);
                        setShowColorDropdown(false);
                      }}
                      className="w-6 h-6 rounded-lg border border-white/10 hover-scale transition-all"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clear formatting */}
          <button 
            onClick={() => executeCommand('removeFormat')}
            className="p-2 rounded-xl bg-dark-950/40 border border-white/5 hover:bg-dark-800 text-dark-200 hover:text-white transition-colors text-xs font-bold"
            title="Clear Formatting"
          >
            Clear Format
          </button>
        </div>
      </div>

      {/* PAPER SHEET EDITING CANVAS AREA */}
      <div className="flex-1 overflow-hidden w-full py-8 px-4 flex flex-col items-center">
        
        {/* A4 Paper styled page */}
        <div className="relative w-full max-w-[800px] flex-1 flex flex-col min-h-0">
          
          {/* Header watermark/details */}
          <div className="flex items-center justify-between text-dark-300 dark:text-dark-400 text-[10px] uppercase font-bold tracking-widest mb-3 select-none px-4">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-500" /> Document Workspace
            </span>
            <span>Edit Mode</span>
          </div>

          {/* Editable sheet */}
          <div 
            ref={editorRef}
            contentEditable={true}
            onInput={handleInput}
            onPaste={handlePaste}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            className="doc-editor-content flex-1 w-full bg-white dark:bg-dark-900 text-slate-900 dark:text-slate-100 rounded-3xl p-16 shadow-2xl border border-slate-200 dark:border-white/5 focus:outline-none overflow-y-auto leading-relaxed text-sm text-left select-text font-sans max-w-none"
            style={{ 
              fontFamily: fontFamily,
              maxHeight: 'calc(100vh - 260px)',
              minHeight: '400px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              overflowX: 'hidden'
            }}
          />
        </div>

        {/* Footer Metrics Stats */}
        <div className="w-full max-w-[800px] flex justify-end gap-4 text-[10px] text-dark-300 font-bold uppercase tracking-wider mt-4 pb-8 select-none px-4">
          <span>Words: <strong className="text-white font-mono">{wordCount}</strong></span>
          <span>•</span>
          <span>Characters: <strong className="text-white font-mono">{charCount}</strong></span>
        </div>
      </div>
    </div>
  );
};
