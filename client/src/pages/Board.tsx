import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import rough from 'roughjs';
import { 
  Undo, 
  Redo, 
  Share, 
  Trash2, 
  User, 
  Settings, 
  Grid,
  Bot,
  Export,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sliders,
  Sparkles
} from 'lucide-react';

import { useCanvasStore, CanvasElement, ToolType } from '../store/useCanvasStore';
import { useAuthStore } from '../store/useAuthStore';
import { Toolbar } from '../components/Toolbar';
import { StylePanel } from '../components/StylePanel';
import { AiChatPanel } from '../components/AiChatPanel';
import { ShareModal } from '../components/ShareModal';
import { SocialExportModal } from '../components/SocialExportModal';
import { 
  screenToWorld, 
  worldToScreen, 
  isPointOverElement, 
  isOverRotationHandle, 
  isElementInsideBox,
  snap,
  getElementCenter,
  rotatePoint
} from '../canvas/transforms';
import { drawElement, drawGrid, drawSelectionBox, drawCollaboratorCursor } from '../canvas/renderer';

export const Board: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user, accessToken, logout } = useAuthStore();
  const {
    elements,
    setElements,
    updateElement,
    deleteSelected,
    clearCanvas,
    selectedIds,
    setSelectedIds,
    tool,
    setTool,
    gridEnabled,
    snapToGrid,
    pan,
    setPan,
    zoom,
    setZoom,
    undo,
    redo,
    // defaults styles
    strokeColor,
    fillColor,
    opacity,
    strokeWidth,
    dashStyle,
    roughness
  } = useCanvasStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<any>(null);

  // Viewport/Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Action drag state variables
  const [action, setAction] = useState<'none' | 'drawing' | 'moving' | 'resizing' | 'rotating' | 'panning' | 'selecting'>('none');
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [resizeHandleIndex, setResizeHandleIndex] = useState<number | null>(null);
  const [draggingStartOffsets, setDraggingStartOffsets] = useState<{ id: string; dx: number; dy: number }[]>([]);
  const [tempDrawingElement, setTempDrawingElement] = useState<CanvasElement | null>(null);
  
  // Selection box dragging
  const [selectionBoxStart, setSelectionBoxStart] = useState({ x: 0, y: 0 });
  const [selectionBoxEnd, setSelectionBoxEnd] = useState({ x: 0, y: 0 });

  // Text editing overlay
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [editingTextVal, setEditingTextVal] = useState('');
  const [textInputPos, setTextInputPos] = useState({ x: 0, y: 0 });

  // Collaborative multiplayer cursors state
  const [collaborators, setCollaborators] = useState<{ [socketId: string]: any }>({});

  // Dialog modals states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [boardVisibility, setBoardVisibility] = useState<'private' | 'public' | 'link-only'>('private');
  const [boardShareToken, setBoardShareToken] = useState('');

  const boardId = id || 'local-fallback-board';

  // 1. WINDOW RESIZE EVENTS
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. SOCKET MULTIPLAYER SYNC
  useEffect(() => {
    if (!accessToken) return;

    // Connect to WebSocket namespace
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket'],
      credentials: true
    });
    socketRef.current = socket;

    // Join room
    socket.emit('join-room', {
      boardId,
      userId: user?.id || 0,
      userName: user?.email.split('@')[0] || 'Anonymous',
      userColor: '#' + Math.floor(Math.random()*16777215).toString(16) // random cursor color
    });

    // Sockets listeners
    socket.on('user-joined', (data: any) => {
      console.log('Collaborator joined:', data.userName);
    });

    socket.on('user-left', (data: any) => {
      setCollaborators(prev => {
        const copy = { ...prev };
        delete copy[data.socketId];
        return copy;
      });
    });

    // Live mouse updates
    socket.on('cursor-update', (data: any) => {
      setCollaborators(prev => ({
        ...prev,
        [data.socketId]: data
      }));
    });

    // Complete layout sync updates
    socket.on('canvas-synced', (syncedElements: CanvasElement[]) => {
      setElements(syncedElements, true); // skip recording in local history stack to prevent loops
    });

    // Periodically sync local state to others (on mount / after loads)
    socket.emit('canvas-sync', { boardId, elements });

    return () => {
      socket.disconnect();
    };
  }, [boardId, accessToken]);

  // Sync elements changes to other collaborators
  const broadcastCanvasState = (nextElements: CanvasElement[]) => {
    if (socketRef.current) {
      socketRef.current.emit('canvas-sync', { boardId, elements: nextElements });
    }
  };

  // Fetch board metadata/visibility settings from database
  useEffect(() => {
    if (!accessToken || !id) return;
    
    const loadBoard = async () => {
      try {
        const res = await fetch(`/api/boards/${id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const boardData = await res.json();
        if (res.ok) {
          setBoardVisibility(boardData.visibility);
          setBoardShareToken(boardData.share_token);
          if (boardData.data) {
            setElements(boardData.data, true); // load board elements without pushing history
          }
        }
      } catch (err) {
        console.error('Failed to load board from server:', err);
      }
    };

    loadBoard();
  }, [id, accessToken]);

  // Periodic autosave to database
  useEffect(() => {
    if (!accessToken || !id || elements.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/boards/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ data: elements })
        });
        console.log('Autosaved drawing state.');
      } catch (err) {
        console.error('Autosave failed:', err);
      }
    }, 3000); // 3 seconds debounced autosave

    return () => clearTimeout(timer);
  }, [elements, id, accessToken]);

  // 3. CANVAS REDRAW CYCLE
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear context
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    ctx.save();
    // Apply viewport scale and translation transforms
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw Snapping Grid
    if (gridEnabled) {
      drawGrid(ctx, dimensions.width, dimensions.height, pan, zoom);
    }

    // Draw Elements
    elements.forEach(el => {
      const rc = rough.canvas(canvas);
      drawElement(ctx, rc, el);
    });

    // Draw Temporary Shape while dragging/drawing
    if (tempDrawingElement) {
      const rc = rough.canvas(canvas);
      drawElement(ctx, rc, tempDrawingElement);
    }

    // Draw Selection Bounds Box
    if (tool === 'selection' && selectedIds.length === 1) {
      const selectedEl = elements.find(el => el.id === selectedIds[0]);
      if (selectedEl) {
        drawSelectionBox(ctx, selectedEl, zoom);
      }
    }

    // Draw Multi-Selection drag box
    if (action === 'selecting') {
      ctx.strokeStyle = '#8b5cf6';
      ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
      ctx.lineWidth = 1 / zoom;
      ctx.fillRect(
        selectionBoxStart.x,
        selectionBoxStart.y,
        selectionBoxEnd.x - selectionBoxStart.x,
        selectionBoxEnd.y - selectionBoxStart.y
      );
      ctx.strokeRect(
        selectionBoxStart.x,
        selectionBoxStart.y,
        selectionBoxEnd.x - selectionBoxStart.x,
        selectionBoxEnd.y - selectionBoxStart.y
      );
    }

    // Draw remote collaborator cursors
    Object.values(collaborators).forEach(c => {
      drawCollaboratorCursor(ctx, c, zoom);
    });

    ctx.restore();
  }, [elements, tempDrawingElement, selectedIds, action, selectionBoxStart, selectionBoxEnd, pan, zoom, gridEnabled, collaborators, dimensions]);

  // 4. MOUSE EVENT HANDLERS
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editingTextElementId) return; // ignore actions during active text editor input

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert to infinite canvas coordinates
    const worldPt = screenToWorld(screenX, screenY, pan, zoom);

    // Panning canvas trigger (Space bar down or Middle mouse click)
    const isPanTrigger = e.button === 1 || (tool !== 'selection' && e.shiftKey);
    if (isPanTrigger) {
      setAction('panning');
      setStartPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    // Selection tool flow
    if (tool === 'selection') {
      // 1. Check if user clicked rotation handle of single selected element
      if (selectedIds.length === 1) {
        const selectedEl = elements.find(el => el.id === selectedIds[0]);
        if (selectedEl && isOverRotationHandle(worldPt, selectedEl, zoom)) {
          setAction('rotating');
          setStartPoint(worldPt);
          return;
        }
      }

      // 2. Check if clicked over handles (to resize)
      if (selectedIds.length === 1) {
        const selectedEl = elements.find(el => el.id === selectedIds[0]);
        if (selectedEl) {
          // Simplistic corners check for handle sizing index
          const handles = [
            { x: selectedEl.x, y: selectedEl.y }, // top-left
            { x: selectedEl.x + selectedEl.width, y: selectedEl.y + selectedEl.height } // bottom-right
          ];
          for (let i = 0; i < handles.length; i++) {
            const h = handles[i];
            const dist = Math.hypot(worldPt.x - h.x, worldPt.y - h.y);
            if (dist < 10 / zoom) {
              setAction('resizing');
              setResizeHandleIndex(i);
              setStartPoint(worldPt);
              return;
            }
          }
        }
      }

      // 3. Find if point is over any element (from top to bottom layer)
      const hitElement = [...elements].reverse().find(el => isPointOverElement(worldPt, el));
      
      if (hitElement) {
        // Toggle/multi select with Cmd/Ctrl key
        if (e.metaKey || e.ctrlKey) {
          if (selectedIds.includes(hitElement.id)) {
            setSelectedIds(selectedIds.filter(id => id !== hitElement.id));
          } else {
            setSelectedIds([...selectedIds, hitElement.id]);
          }
        } else if (!selectedIds.includes(hitElement.id)) {
          setSelectedIds([hitElement.id]);
        }

        // Prepare elements drag offsets
        const targetIds = selectedIds.includes(hitElement.id) ? selectedIds : [hitElement.id];
        const offsets = elements
          .filter(el => targetIds.includes(el.id))
          .map(el => ({
            id: el.id,
            dx: worldPt.x - el.x,
            dy: worldPt.y - el.y
          }));
        
        setDraggingStartOffsets(offsets);
        setAction('moving');
        setStartPoint(worldPt);
      } else {
        // Clicked empty space: clear selection and enter selection drag box
        setSelectedIds([]);
        setAction('selecting');
        setSelectionBoxStart(worldPt);
        setSelectionBoxEnd(worldPt);
      }
    } 
    // Shapes drawing tools flow
    else if (tool !== 'eraser') {
      setAction('drawing');
      setStartPoint(worldPt);
      
      // Seed initial shape
      const newEl: CanvasElement = {
        id: generateId(),
        type: tool as any,
        x: snapToGrid ? snap(worldPt.x) : worldPt.x,
        y: snapToGrid ? snap(worldPt.y) : worldPt.y,
        width: 0,
        height: 0,
        angle: 0,
        strokeColor,
        fillColor,
        opacity,
        strokeWidth,
        dashStyle,
        roughness,
        seed: Math.floor(Math.random() * 100000)
      };

      if (tool === 'freehand') {
        newEl.points = [[0, 0]];
      } else if (tool === 'line' || tool === 'arrow') {
        newEl.points = [[0, 0], [0, 0]];
      }

      setTempDrawingElement(newEl);
    }
    // Eraser flow
    else {
      // Find element clicked and delete it
      const hitElement = [...elements].reverse().find(el => isPointOverElement(worldPt, el));
      if (hitElement) {
        const nextElements = elements.filter(el => el.id !== hitElement.id);
        setElements(nextElements);
        broadcastCanvasState(nextElements);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const worldPt = screenToWorld(screenX, screenY, pan, zoom);

    // Throttle cursor websocket broadcasts
    if (socketRef.current) {
      socketRef.current.emit('cursor-move', { boardId, x: worldPt.x, y: worldPt.y });
    }

    if (action === 'none') return;

    if (action === 'panning') {
      const dx = e.clientX - startPoint.x;
      const dy = e.clientY - startPoint.y;
      setPan({ x: pan.x + dx, y: pan.y + dy });
      setStartPoint({ x: e.clientX, y: e.clientY });
    }

    else if (action === 'selecting') {
      setSelectionBoxEnd(worldPt);
    }

    else if (action === 'moving') {
      // Drag/move items based on calculated offsets
      elements.forEach(el => {
        const offset = draggingStartOffsets.find(o => o.id === el.id);
        if (offset) {
          let nextX = worldPt.x - offset.dx;
          let nextY = worldPt.y - offset.dy;
          if (snapToGrid) {
            nextX = snap(nextX);
            nextY = snap(nextY);
          }
          updateElement(el.id, { x: nextX, y: nextY }, true);
        }
      });
    }

    else if (action === 'resizing' && selectedIds.length === 1) {
      const selectedEl = elements.find(el => el.id === selectedIds[0]);
      if (selectedEl) {
        let nextW = worldPt.x - selectedEl.x;
        let nextH = worldPt.y - selectedEl.y;
        if (snapToGrid) {
          nextW = snap(nextW);
          nextH = snap(nextH);
        }
        updateElement(selectedEl.id, { width: nextW, height: nextH }, true);
      }
    }

    else if (action === 'rotating' && selectedIds.length === 1) {
      const selectedEl = elements.find(el => el.id === selectedIds[0]);
      if (selectedEl) {
        const center = getElementCenter(selectedEl);
        // Calculate angle based on vector from element center to current mouse
        const dy = worldPt.y - center.y;
        const dx = worldPt.x - center.x;
        let angle = Math.atan2(dy, dx) + Math.PI / 2; // Offset rotation to top anchor
        
        // Snap to 15 degree increments if shift is pressed
        if (e.shiftKey) {
          const step = Math.PI / 12;
          angle = Math.round(angle / step) * step;
        }
        
        updateElement(selectedEl.id, { angle }, true);
      }
    }

    else if (action === 'drawing' && tempDrawingElement) {
      let width = worldPt.x - startPoint.x;
      let height = worldPt.y - startPoint.y;
      if (snapToGrid) {
        width = snap(width);
        height = snap(height);
      }

      if (tool === 'freehand') {
        const offsetPt: [number, number] = [
          worldPt.x - tempDrawingElement.x,
          worldPt.y - tempDrawingElement.y
        ];
        const points = [...(tempDrawingElement.points || []), offsetPt];
        setTempDrawingElement({
          ...tempDrawingElement,
          points
        });
      } else if (tool === 'line' || tool === 'arrow') {
        const points: [number, number][] = [
          [0, 0],
          [worldPt.x - tempDrawingElement.x, worldPt.y - tempDrawingElement.y]
        ];
        setTempDrawingElement({
          ...tempDrawingElement,
          points
        });
      } else {
        setTempDrawingElement({
          ...tempDrawingElement,
          width,
          height
        });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (action === 'none') return;

    if (action === 'selecting') {
      // Find all elements inside selection box bounds
      const boxedIds = elements
        .filter(el => isElementInsideBox(el, selectionBoxStart, selectionBoxEnd))
        .map(el => el.id);
      setSelectedIds(boxedIds);
    }

    else if (action === 'moving' || action === 'resizing' || action === 'rotating') {
      // Save changes to history (by force saving current elements to history)
      setElements(elements); 
      broadcastCanvasState(elements);
    }

    else if (action === 'drawing' && tempDrawingElement) {
      // Save newly drawn element
      if (tool === 'text') {
        // Open overlay text editor at canvas coordinates
        setEditingTextElementId(tempDrawingElement.id);
        setEditingTextVal('Text here');
        
        const textScrPt = worldToScreen(tempDrawingElement.x, tempDrawingElement.y, pan, zoom);
        setTextInputPos(textScrPt);
        
        setElements([...elements, {
          ...tempDrawingElement,
          width: 120,
          height: 30,
          text: 'Text here'
        }]);
      } else {
        const finishedElements = [...elements, tempDrawingElement];
        setElements(finishedElements);
        broadcastCanvasState(finishedElements);
      }
      setTempDrawingElement(null);
    }

    setAction('none');
    setResizeHandleIndex(null);
    setDraggingStartOffsets([]);
  };

  // 5. MOUSE WHEEL ZOOM HANDLERS
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomIntensity = 0.05;
    
    // Zoom centered around cursor coordinate
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const worldPt = screenToWorld(cursorX, cursorY, pan, zoom);

    const nextZoom = e.deltaY < 0 
      ? zoom * (1 + zoomIntensity) 
      : zoom * (1 - zoomIntensity);
    
    // Clamp zoom
    const clampedZoom = Math.max(0.1, Math.min(10, nextZoom));

    // Shift pan offset to center around world coordinate
    const nextPan = {
      x: cursorX - worldPt.x * clampedZoom,
      y: cursorY - worldPt.y * clampedZoom
    };

    setZoom(clampedZoom);
    setPan(nextPan);
  };

  // 6. TEXT SUBMIT ACTIONS
  const handleTextSubmit = () => {
    if (!editingTextElementId) return;
    
    const nextElements = elements.map(el => {
      if (el.id === editingTextElementId) {
        return {
          ...el,
          text: editingTextVal,
          // Recalculate basic sizing based on characters length
          width: Math.max(80, editingTextVal.length * 11),
          height: Math.max(30, editingTextVal.split('\n').length * 26)
        };
      }
      return el;
    });

    setElements(nextElements);
    broadcastCanvasState(nextElements);
    
    setEditingTextElementId(null);
    setEditingTextVal('');
  };

  // 7. KEYBOARD HOTKEYS & ARROWS NUDGES
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut hotkeys if user is editing text inputs
      if (editingTextElementId) return;

      const step = e.shiftKey ? 10 : 2;

      // Element Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
        broadcastCanvasState(elements.filter(el => !selectedIds.includes(el.id)));
      }

      // Undo/Redo: Ctrl+Z / Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        setTimeout(() => broadcastCanvasState(useCanvasStore.getState().elements), 100);
      }

      // Grid/Snap toggles: G and S
      if (e.key === 'g' || e.key === 'G') {
        useCanvasStore.getState().setGridEnabled(!useCanvasStore.getState().gridEnabled);
      }
      if (e.key === 's' || e.key === 'S') {
        useCanvasStore.getState().setSnapToGrid(!useCanvasStore.getState().snapToGrid);
      }

      // Arrows Nudges
      if (selectedIds.length > 0) {
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          const nextElements = elements.map(el => {
            if (selectedIds.includes(el.id)) {
              return { ...el, x: el.x + dx, y: el.y + dy };
            }
            return el;
          });
          setElements(nextElements);
          broadcastCanvasState(nextElements);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, elements, editingTextElementId]);

  // Image Upload helper click trigger
  useEffect(() => {
    if (tool === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            
            // Add image shape in world coordinates centered
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const worldCenter = screenToWorld(screenCenterX, screenCenterY, pan, zoom);

            const newImgEl: CanvasElement = {
              id: generateId(),
              type: 'image',
              x: worldCenter.x - 150,
              y: worldCenter.y - 100,
              width: 300,
              height: 200,
              angle: 0,
              strokeColor,
              fillColor,
              opacity,
              strokeWidth,
              dashStyle,
              roughness,
              imageUrl: dataUrl,
              seed: Math.floor(Math.random() * 100000)
            };

            const nextElements = [...elements, newImgEl];
            setElements(nextElements);
            broadcastCanvasState(nextElements);
            
            setTool('selection'); // switch tool back to pointer
          };
          reader.readAsDataURL(file);
        } else {
          setTool('selection');
        }
      };
      input.click();
    }
  }, [tool]);

  // Visibility toggle proxy action
  const handleUpdateVisibility = async (visibility: 'private' | 'public' | 'link-only') => {
    try {
      const res = await fetch(`/api/boards/${boardId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ visibility })
      });
      const data = await res.json();
      if (res.ok) {
        setBoardVisibility(data.visibility);
        setBoardShareToken(data.share_token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-dark-950 overflow-hidden">
      
      {/* Top toolbar banner */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-30 pointer-events-none">
        
        {/* Navigation / Workspace info */}
        <div className="flex items-center gap-3 p-1.5 rounded-2xl glass-panel shadow-2xl pointer-events-auto">
          <button 
            onClick={() => navigate('/explore')}
            className="flex items-center justify-center p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
            title="Explore boards"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-2">
            <h1 className="text-xs font-bold text-white tracking-wide">AI Whiteboard Canvas</h1>
            <span className="text-[9px] text-dark-200 uppercase font-mono">{boardVisibility} room</span>
          </div>
        </div>

        {/* Action controllers */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel shadow-2xl pointer-events-auto">
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-brand-500 hover:bg-dark-800 transition-colors"
              title="Admin Dashboard"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={undo}
            className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-dark-800 mx-1" />

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-dark-900 border border-white/5 text-xs font-bold text-dark-200 hover:text-white transition-colors"
            title="Manage sharing visibilities"
          >
            <Share className="w-3.5 h-3.5" /> Share
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 transition-all"
            title="Export files & publish social posts"
          >
            <Sparkles className="w-3.5 h-3.5" /> Export
          </button>

          <div className="w-[1px] h-5 bg-dark-800 mx-1" />

          <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-0.5 rounded-lg bg-dark-950/40 text-[10px] text-dark-200">
            <User className="w-3.5 h-3.5 text-brand-500" />
            <span className="font-medium max-w-28 truncate">{user?.email.split('@')[0]}</span>
          </div>

          <button
            onClick={() => logout().then(() => navigate('/login'))}
            className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* FLOATING TOOLS & CONTROLS */}
      <Toolbar />
      <StylePanel />
      <AiChatPanel />

      {/* CANVAS VIEWPORT */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block cursor-crosshair"
      />

      {/* TEXT AREA INPUT FIELD (OVERLAY ON TEXT SELECTION) */}
      {editingTextElementId && (
        <div 
          className="absolute z-40 bg-dark-950/80 border border-brand-500 rounded-xl p-2.5 shadow-2xl flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200"
          style={{ left: textInputPos.x, top: textInputPos.y }}
        >
          <textarea
            autoFocus
            value={editingTextVal}
            onChange={(e) => setEditingTextVal(e.target.value)}
            className="bg-dark-900 text-xs text-white p-2 border border-white/5 rounded-lg outline-none w-56 h-20 resize-none font-sans"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setEditingTextElementId(null)}
              className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-dark-900 border border-white/5 text-dark-200"
            >
              Cancel
            </button>
            <button
              onClick={handleTextSubmit}
              className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-brand-600 text-white"
            >
              Save Text
            </button>
          </div>
        </div>
      )}

      {/* SHARING CONFIG MODAL DIALOG */}
      {showShareModal && (
        <ShareModal
          board={{
            id: boardId,
            visibility: boardVisibility,
            share_token: boardShareToken
          }}
          onClose={() => setShowShareModal(false)}
          onUpdateVisibility={handleUpdateVisibility}
        />
      )}

      {/* EXPORTS & SOCIAL MODAL DIALOG */}
      {showExportModal && (
        <SocialExportModal
          canvasRef={canvasRef}
          onClose={() => setShowExportModal(false)}
        />
      )}

    </div>
  );
};
