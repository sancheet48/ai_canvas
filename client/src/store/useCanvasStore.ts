import { create } from 'zustand';

export type ElementType = 'rectangle' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freehand' | 'text' | 'image' | 'document';
export type DashStyle = 'solid' | 'dashed' | 'dotted';
export type ToolType = ElementType | 'selection' | 'eraser';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  fillColor: string;
  opacity: number;
  strokeWidth: number;
  roughness: number; // 0-3
  dashStyle: DashStyle;
  points?: [number, number][]; // for freehand, line, arrow
  text?: string; // for text
  imageUrl?: string; // for image upload
  seed: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  pageIndex?: number;
  collapsed?: boolean;
  expandedHeight?: number;
}

interface HistoryState {
  past: CanvasElement[][];
  future: CanvasElement[][];
}

interface CanvasState {
  elements: CanvasElement[];
  selectedIds: string[];
  tool: ToolType;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridType: 'grid' | 'lines' | 'dots';
  canvasMode: 'infinite' | 'pages';
  currentPage: number;
  totalPages: number;
  editorMode: 'canvas' | 'document';
  documentContent: string;
  
  // Default style state
  strokeColor: string;
  fillColor: string;
  opacity: number;
  strokeWidth: number;
  dashStyle: DashStyle;
  roughness: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';

  // Viewport transforms
  pan: { x: number; y: number };
  zoom: number;

  // History Stack
  history: HistoryState;

  // Operations
  setElements: (elements: CanvasElement[], skipHistory?: boolean) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>, skipHistory?: boolean) => void;
  deleteSelected: () => void;
  clearCanvas: () => void;
  setSelectedIds: (ids: string[]) => void;
  setTool: (tool: ToolType) => void;
  setGridEnabled: (enabled: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridType: (type: 'grid' | 'lines' | 'dots') => void;
  setCanvasMode: (mode: 'infinite' | 'pages') => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  addPage: () => void;
  deletePage: (pageIndex: number) => void;
  setEditorMode: (mode: 'canvas' | 'document') => void;
  setDocumentContent: (content: string) => void;
  
  // Style actions
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setOpacity: (opacity: number) => void;
  setStrokeWidth: (width: number) => void;
  setDashStyle: (style: DashStyle) => void;
  setRoughness: (roughness: number) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontWeight: (fontWeight: 'normal' | 'bold') => void;
  setFontStyle: (fontStyle: 'normal' | 'italic') => void;

  // Viewport Actions
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  setZoom: (zoom: number | ((prev: number) => number)) => void;

  // History operations
  undo: () => void;
  redo: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: [],
  selectedIds: [],
  tool: 'selection',
  gridEnabled: false,
  snapToGrid: false,
  gridType: 'grid',
  canvasMode: 'pages',
  currentPage: 1,
  totalPages: 1,
  editorMode: 'canvas',
  documentContent: '',
  
  // Style defaults
  strokeColor: '#8b5cf6', // purple brand
  fillColor: 'transparent',
  opacity: 1,
  strokeWidth: 2,
  dashStyle: 'solid',
  roughness: 1,
  fontFamily: "'Outfit', 'Inter', sans-serif",
  fontWeight: 'normal',
  fontStyle: 'normal',

  // Viewport defaults
  pan: { x: 0, y: 0 },
  zoom: 1,

  history: {
    past: [],
    future: []
  },

  setElements: (elements, skipHistory = false) => {
    const { history, elements: currentElements } = get();
    if (skipHistory) {
      set({ elements });
      return;
    }

    // Save previous state to past history
    set({
      elements,
      history: {
        past: [...history.past, currentElements],
        future: [] // clear redo stack on new action
      }
    });
  },

  updateElement: (id, updates, skipHistory = false) => {
    const { elements, history } = get();
    const prevElements = JSON.parse(JSON.stringify(elements));
    const nextElements = elements.map(el => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    });

    if (skipHistory) {
      set({ elements: nextElements });
      return;
    }

    set({
      elements: nextElements,
      history: {
        past: [...history.past, prevElements],
        future: []
      }
    });
  },

  deleteSelected: () => {
    const { elements, selectedIds, history } = get();
    if (selectedIds.length === 0) return;

    const prevElements = JSON.parse(JSON.stringify(elements));
    const nextElements = elements.filter(el => !selectedIds.includes(el.id));

    set({
      elements: nextElements,
      selectedIds: [],
      history: {
        past: [...history.past, prevElements],
        future: []
      }
    });
  },

  clearCanvas: () => {
    const { elements, history } = get();
    if (elements.length === 0) return;

    set({
      elements: [],
      selectedIds: [],
      history: {
        past: [...history.past, elements],
        future: []
      }
    });
  },

  setSelectedIds: (selectedIds) => set({ selectedIds }),
  
  setTool: (tool) => {
    // If switching away from selection, clear selectedIds
    if (tool !== 'selection') {
      set({ selectedIds: [] });
    }
    set({ tool });
  },

  setGridEnabled: (gridEnabled) => set({ gridEnabled }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setGridType: (gridType) => set({ gridType }),
  setCanvasMode: (canvasMode) => set({ canvasMode }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setTotalPages: (totalPages) => set({ totalPages }),
  addPage: () => {
    const { totalPages } = get();
    const nextTotal = totalPages + 1;
    set({
      totalPages: nextTotal,
      currentPage: nextTotal
    });
  },
  deletePage: (pageIndex: number) => {
    const { elements, totalPages, currentPage, history } = get();
    if (totalPages <= 1) return;

    const prevElements = JSON.parse(JSON.stringify(elements));
    
    // Filter out elements on the deleted page and shift down subsequent pages
    const nextElements = elements
      .filter(el => (el.pageIndex || 1) !== pageIndex)
      .map(el => {
        const elPage = el.pageIndex || 1;
        if (elPage > pageIndex) {
          return { ...el, pageIndex: elPage - 1 };
        }
        return el;
      });

    const nextTotalPages = totalPages - 1;
    const nextCurrentPage = currentPage > nextTotalPages ? nextTotalPages : currentPage;

    set({
      elements: nextElements,
      totalPages: nextTotalPages,
      currentPage: nextCurrentPage,
      history: {
        past: [...history.past, prevElements],
        future: []
      }
    });
  },

  setStrokeColor: (strokeColor) => {
    set({ strokeColor });
    // Update currently selected elements as well
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, strokeColor } : el))
      );
    }
  },

  setFillColor: (fillColor) => {
    set({ fillColor });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, fillColor } : el))
      );
    }
  },

  setOpacity: (opacity) => {
    set({ opacity });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, opacity } : el))
      );
    }
  },

  setStrokeWidth: (strokeWidth) => {
    set({ strokeWidth });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, strokeWidth } : el))
      );
    }
  },

  setDashStyle: (dashStyle) => {
    set({ dashStyle });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, dashStyle } : el))
      );
    }
  },

  setRoughness: (roughness) => {
    set({ roughness });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, roughness } : el))
      );
    }
  },

  setFontFamily: (fontFamily) => {
    set({ fontFamily });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, fontFamily } : el))
      );
    }
  },

  setFontWeight: (fontWeight) => {
    set({ fontWeight });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, fontWeight } : el))
      );
    }
  },

  setFontStyle: (fontStyle) => {
    set({ fontStyle });
    const { selectedIds, elements } = get();
    if (selectedIds.length > 0) {
      get().setElements(
        elements.map(el => (selectedIds.includes(el.id) ? { ...el, fontStyle } : el))
      );
    }
  },

  setPan: (panUpdate) => {
    set((state) => ({
      pan: typeof panUpdate === 'function' ? panUpdate(state.pan) : panUpdate,
    }));
  },

  setZoom: (zoomUpdate) => {
    set((state) => {
      const nextZoom = typeof zoomUpdate === 'function' ? zoomUpdate(state.zoom) : zoomUpdate;
      // Clamp zoom between 0.1 and 10
      return { zoom: Math.max(0.1, Math.min(10, nextZoom)) };
    });
  },

  undo: () => {
    const { history, elements } = get();
    if (history.past.length === 0) return;

    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, history.past.length - 1);

    set({
      elements: previous,
      history: {
        past: newPast,
        future: [elements, ...history.future]
      }
    });
  },

  redo: () => {
    const { history, elements } = get();
    if (history.future.length === 0) return;

    const next = history.future[0];
    const newFuture = history.future.slice(1);

    set({
      elements: next,
      history: {
        past: [...history.past, elements],
        future: newFuture
      }
    });
  },

  setEditorMode: (editorMode) => set({ editorMode }),
  setDocumentContent: (documentContent) => set({ documentContent })
}));
