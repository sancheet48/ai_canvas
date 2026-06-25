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
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sliders,
  Sparkles,
  Keyboard,
  X,
  Save,
  Sun,
  Moon,
  Home,
  Plus
} from 'lucide-react';

import { useCanvasStore, CanvasElement, ToolType } from '../store/useCanvasStore';
import { useAuthStore } from '../store/useAuthStore';
import { Toolbar } from '../components/Toolbar';
import { StylePanel } from '../components/StylePanel';
import { AiChatPanel } from '../components/AiChatPanel';
import { ShareModal } from '../components/ShareModal';
import { SocialExportModal } from '../components/SocialExportModal';
import { CreateBoardModal } from '../components/CreateBoardModal';
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

const generateId = () => Math.random().toString(36).substring(2, 9);

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<any>(null);

  // Viewport/Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Action drag state variables
  const [action, setAction] = useState<'none' | 'drawing' | 'moving' | 'resizing' | 'rotating' | 'panning' | 'selecting' | 'erasing'>('none');
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [boardVisibility, setBoardVisibility] = useState<'private' | 'public' | 'link-only'>('private');
  const [boardShareToken, setBoardShareToken] = useState('');

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const isLoadedRef = useRef(false);

  const boardId = id || 'local-fallback-board';

  const [boardTitle, setBoardTitle] = useState('Untitled Board');
  const [openTabs, setOpenTabs] = useState<{ id: string; title: string }[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Sync open workspace tabs list
  useEffect(() => {
    if (!id || !user?.email) return;

    const storageKey = `whiteboard_open_tabs_${user.email}`;
    let list: { id: string; title: string }[] = [];
    try {
      list = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {
      console.error(e);
    }

    // Update or append active board
    const existingIndex = list.findIndex(t => t.id === id);
    if (existingIndex === -1) {
      list.push({ id, title: boardTitle });
    } else if (list[existingIndex].title !== boardTitle && boardTitle !== 'Untitled Board') {
      list[existingIndex].title = boardTitle;
    }

    localStorage.setItem(storageKey, JSON.stringify(list));
    setOpenTabs(list);
  }, [id, boardTitle, user?.email]);

  const handleSelectTab = (tabId: string) => {
    navigate(`/board/${tabId}`);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (!user?.email) return;

    const storageKey = `whiteboard_open_tabs_${user.email}`;
    const updated = openTabs.filter(t => t.id !== tabId);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setOpenTabs(updated);

    if (tabId === id) {
      if (updated.length > 0) {
        navigate(`/board/${updated[0].id}`);
      } else {
        navigate('/explore');
      }
    }
  };

  const handleCreateTabBoard = async (title: string, description: string, visibility: 'private' | 'public') => {
    if (creating) return;
    setCreating(true);

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title,
          description,
          data: [],
          visibility
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        if (user?.email) {
          const storageKey = `whiteboard_open_tabs_${user.email}`;
          const list = [...openTabs];
          if (!list.some(t => t.id === data.id)) {
            list.push({ id: data.id, title: data.title || 'Untitled Board' });
            localStorage.setItem(storageKey, JSON.stringify(list));
            setOpenTabs(list);
          }
        }
        navigate(`/board/${data.id}`);
      } else {
        throw new Error(data.error || 'Failed to create whiteboard');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setCreating(false);
    }
  };

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
      withCredentials: true
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

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Fetch board metadata/visibility settings from database or local storage fallback
  useEffect(() => {
    isLoadedRef.current = false;
    
    if (id) {
      if (!accessToken) return;
      
      const loadBoard = async () => {
        try {
          const res = await fetch(`/api/boards/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          const boardData = await res.json();
          if (res.ok) {
            setBoardVisibility(boardData.visibility);
            setBoardShareToken(boardData.share_token);
            setBoardTitle(boardData.title || 'Untitled Board');
            if (boardData.data) {
              setElements(boardData.data, true); // load board elements without pushing history
            }
            if (user?.email && id) {
              const key = `whiteboard_recent_${user.email}`;
              const recent = JSON.parse(localStorage.getItem(key) || '[]');
              const updated = [id, ...recent.filter((item: string) => item !== id)].slice(0, 4);
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        } catch (err) {
          console.error('Failed to load board from server:', err);
        } finally {
          isLoadedRef.current = true;
          setSaveStatus('idle');
        }
      };

      loadBoard();
    } else {
      // Local storage fallback for guest board
      const saved = localStorage.getItem('local-fallback-board-data');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setElements(parsed, true);
        } catch (e) {
          console.error('Failed to parse local fallback board data:', e);
        }
      } else {
        setElements([], true);
      }
      setBoardTitle('Local Workspace');
      isLoadedRef.current = true;
      setSaveStatus('idle');
    }
  }, [id, accessToken]);

  // Periodic autosave to database or local storage
  useEffect(() => {
    if (!isLoadedRef.current) return;

    setSaveStatus('saving');

    if (!id) {
      // Local storage autosave for guest board
      const timer = setTimeout(() => {
        localStorage.setItem('local-fallback-board-data', JSON.stringify(elements));
        setSaveStatus('saved');
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (!accessToken) {
      setSaveStatus('error');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/boards/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ data: elements })
        });
        if (res.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('error');
      }
    }, 2000); // 2 seconds debounced autosave

    return () => clearTimeout(timer);
  }, [elements, id, accessToken]);

  // Manual save handler
  const handleManualSave = async () => {
    setSaveStatus('saving');
    
    if (!id) {
      localStorage.setItem('local-fallback-board-data', JSON.stringify(elements));
      setSaveStatus('saved');
      return;
    }

    if (!accessToken) {
      setSaveStatus('error');
      return;
    }

    try {
      const res = await fetch(`/api/boards/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ data: elements })
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Manual save failed:', err);
      setSaveStatus('error');
    }
  };

  // Theme toggle helper
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
  };

  // Record board visit to recently-opened list
  useEffect(() => {
    if (!id || !user?.email) return;
    
    try {
      const storageKey = `whiteboard_recent_${user.email}`;
      const savedRecent = localStorage.getItem(storageKey);
      let list: string[] = savedRecent ? JSON.parse(savedRecent) : [];
      
      // Filter out this id if it already exists, to move it to the front
      list = list.filter(item => item !== id);
      
      // Prepend this id
      list.unshift(id);
      
      // Keep maximum of 4 elements
      list = list.slice(0, 4);
      
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save recently opened board:', e);
    }
  }, [id, user?.email]);

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
      if (el.id === editingTextElementId) return;
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
      setAction('erasing');
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

    if (action === 'erasing') {
      const hitElement = [...elements].reverse().find(el => isPointOverElement(worldPt, el));
      if (hitElement) {
        const nextElements = elements.filter(el => el.id !== hitElement.id);
        setElements(nextElements);
        broadcastCanvasState(nextElements);
      }
      return;
    }

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
      let finalElements = elements;
      if (action === 'resizing' && selectedIds.length === 1) {
        finalElements = elements.map(el => {
          if (
            el.id === selectedIds[0] &&
            (el.type === 'rectangle' ||
             el.type === 'ellipse' ||
             el.type === 'diamond')
          ) {
            return {
              ...el,
              x: Math.min(el.x, el.x + el.width),
              y: Math.min(el.y, el.y + el.height),
              width: Math.abs(el.width),
              height: Math.abs(el.height)
            };
          }
          return el;
        });
      }
      setElements(finalElements); 
      broadcastCanvasState(finalElements);
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
        let normalizedElement = { ...tempDrawingElement };
        if (
          normalizedElement.type === 'rectangle' ||
          normalizedElement.type === 'ellipse' ||
          normalizedElement.type === 'diamond'
        ) {
          const x = normalizedElement.x;
          const y = normalizedElement.y;
          const w = normalizedElement.width;
          const h = normalizedElement.height;
          normalizedElement.x = Math.min(x, x + w);
          normalizedElement.y = Math.min(y, y + h);
          normalizedElement.width = Math.abs(w);
          normalizedElement.height = Math.abs(h);
        }

        const finishedElements = [...elements, normalizedElement];
        setElements(finishedElements);
        broadcastCanvasState(finishedElements);

        // Switch tool to selection and select the newly drawn shape
        if (
          normalizedElement.type === 'rectangle' ||
          normalizedElement.type === 'ellipse' ||
          normalizedElement.type === 'diamond'
        ) {
          setTool('selection');
          setSelectedIds([normalizedElement.id]);
        }
      }
      setTempDrawingElement(null);
    }

    setAction('none');
    setResizeHandleIndex(null);
    setDraggingStartOffsets([]);
  };

  // 5. MOUSE WHEEL PAN & ZOOM HANDLERS
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // Zoom if Ctrl key is pressed (or pinch-to-zoom on touchpads)
    if (e.ctrlKey || e.metaKey) {
      const zoomIntensity = 0.05;
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
    } 
    // Otherwise, pan the canvas (scroll vertically and horizontally)
    else {
      if (e.shiftKey) {
        // Shift + scroll maps vertical wheel movement to horizontal panning
        const dx = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        const dy = e.deltaX !== 0 ? e.deltaY : 0;
        setPan({
          x: pan.x - dx,
          y: pan.y - dy
        });
      } else {
        setPan({
          x: pan.x - e.deltaX,
          y: pan.y - e.deltaY
        });
      }
    }
  };

  // 6. TEXT SUBMIT ACTIONS
  const handleTextSubmit = () => {
    if (!editingTextElementId) return;
    
    if (editingTextVal.trim() === '') {
      const nextElements = elements.filter(el => el.id !== editingTextElementId);
      setElements(nextElements);
      broadcastCanvasState(nextElements);
      setEditingTextElementId(null);
      setEditingTextVal('');
      return;
    }
    
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
    
    // Switch to selection tool and select the text element
    setTool('selection');
    setSelectedIds([editingTextElementId]);
    
    setEditingTextElementId(null);
    setEditingTextVal('');
  };

  // Focus and select the default "Text here" text when text editor opens
  useEffect(() => {
    if (editingTextElementId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingTextElementId]);

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
      
      {/* Workspace Tabs Bar */}
      {user?.email && openTabs.length > 0 && (
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between z-30 pointer-events-auto h-12 bg-dark-900/60 backdrop-blur-md border border-white/5 rounded-2xl px-4 shadow-2xl select-none">
          {/* Left: Explore Catalog Link & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/explore')}
              className="flex items-center justify-center p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
              title="Return to Explore Dashboard"
            >
              <Home className="w-4 h-4 text-brand-500" />
            </button>
            <div className="w-[1px] h-4 bg-dark-800" />
            <span className="text-[10px] font-bold text-dark-200 uppercase tracking-wider hidden sm:inline">Active Rooms:</span>
          </div>

          {/* Middle: Horizontal scrollable tab list */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar px-4 max-w-full">
            {openTabs.map((t) => {
              const isActive = t.id === id;
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all border text-xs font-semibold select-none flex-shrink-0 group ${
                    isActive
                      ? 'bg-brand-600/10 border-brand-500 text-white shadow-lg shadow-brand-600/5'
                      : 'bg-dark-950/40 border-white/5 text-dark-200 hover:text-white hover:border-white/10'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse flex-shrink-0" />
                  <span className="truncate max-w-[120px]">{isActive ? boardTitle : t.title}</span>
                  <button
                    onClick={(e) => handleCloseTab(e, t.id)}
                    className="p-0.5 rounded hover:bg-dark-800 text-dark-200 hover:text-red-500 transition-colors flex items-center justify-center flex-shrink-0"
                    title="Close tab"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right: + Create Tab Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-[10px] font-bold text-white shadow-lg shadow-brand-600/15 hover-scale transition-all"
              title="Open a new whiteboard tab"
            >
              <Plus className="w-3.5 h-3.5" /> New Tab
            </button>
          </div>
        </div>
      )}

      {/* Top toolbar banner */}
      <div className={`absolute left-6 right-6 flex items-center justify-between z-30 pointer-events-none ${
        user?.email && openTabs.length > 0 ? 'top-20' : 'top-6'
      }`}>
        
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
            <h1 className="text-xs font-bold text-white tracking-wide truncate max-w-[200px]" title={boardTitle}>
              {boardTitle}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-dark-200 uppercase font-mono">{boardVisibility} room</span>
              <span className="text-[9px] text-dark-300">•</span>
              <span className={`text-[9px] font-medium transition-all ${
                saveStatus === 'saved' ? 'text-green-500' :
                saveStatus === 'saving' ? 'text-brand-500 animate-pulse' :
                saveStatus === 'error' ? 'text-red-500' : 'text-dark-300'
              }`}>
                {saveStatus === 'saved' ? 'Autosaved' :
                 saveStatus === 'saving' ? 'Saving...' :
                 saveStatus === 'error' ? 'Save failed' : 'All saved'}
              </span>
            </div>
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

          <button
            onClick={handleManualSave}
            className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
            title="Save changes manually"
          >
            <Save className="w-4 h-4" />
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

          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors animate-in spin-in-12 duration-300"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          <div className="w-[1px] h-5 bg-dark-800 mx-1" />

          <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-0.5 rounded-lg bg-dark-950/40 text-[10px] text-dark-200">
            <User className="w-3.5 h-3.5 text-brand-500" />
            <span className="font-medium max-w-28 truncate">{user?.email.split('@')[0]}</span>
            {user?.plan && user.plan !== 'free' && (
              <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] font-bold text-amber-500 uppercase tracking-wider">
                {user.plan}
              </span>
            )}
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
            ref={textareaRef}
            autoFocus
            value={editingTextVal}
            onChange={(e) => setEditingTextVal(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="bg-dark-900 text-xs text-white p-2 border border-white/5 rounded-lg outline-none w-56 h-20 resize font-sans"
          />
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => {
                const targetEl = elements.find(el => el.id === editingTextElementId);
                if (targetEl && (targetEl.text === 'Text here' || !targetEl.text || targetEl.text.trim() === '')) {
                  const nextElements = elements.filter(el => el.id !== editingTextElementId);
                  setElements(nextElements);
                  broadcastCanvasState(nextElements);
                }
                setTool('selection');
                setEditingTextElementId(null);
              }}
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

      {/* KEYBOARD SHORTCUTS FLOATING TOGGLE BUTTON */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-6 left-6 p-3 rounded-full bg-dark-900 border border-white/5 text-dark-200 hover:text-white hover-scale shadow-2xl z-30 flex items-center justify-center w-11 h-11"
        title="Keyboard Shortcuts"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {/* KEYBOARD SHORTCUTS MODAL DIALOG */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-brand-500" /> Keyboard Shortcuts
              </h3>
              <button 
                onClick={() => setShowShortcuts(false)} 
                className="p-1 rounded-lg text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto text-xs pr-1">
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Selection Tool</span>
                <span className="font-mono text-brand-400 text-right">V or 1</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Rectangle</span>
                <span className="font-mono text-brand-400 text-right">R or 2</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Ellipse</span>
                <span className="font-mono text-brand-400 text-right">O or 3</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Diamond</span>
                <span className="font-mono text-brand-400 text-right">D or 4</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Line</span>
                <span className="font-mono text-brand-400 text-right">L or 5</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Arrow</span>
                <span className="font-mono text-brand-400 text-right">A or 6</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Pencil (Freehand)</span>
                <span className="font-mono text-brand-400 text-right">P or 7</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Text</span>
                <span className="font-mono text-brand-400 text-right">T or 8</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Image Upload</span>
                <span className="font-mono text-brand-400 text-right">I or 9</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Eraser</span>
                <span className="font-mono text-brand-400 text-right">E or 0</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Undo / Redo</span>
                <span className="font-mono text-brand-400 text-right">Ctrl+Z / Ctrl+Shift+Z</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Delete Selection</span>
                <span className="font-mono text-brand-400 text-right">Delete / Backspace</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Toggle Grid</span>
                <span className="font-mono text-brand-400 text-right">G</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Toggle Snapping</span>
                <span className="font-mono text-brand-400 text-right">S</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Pan Canvas</span>
                <span className="font-mono text-brand-400 text-right">Space + Drag</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Horizontal Scroll</span>
                <span className="font-mono text-brand-400 text-right">Shift + Scroll Wheel</span>
              </div>
              <div className="grid grid-cols-2 py-1.5 border-b border-dark-900/50">
                <span className="text-dark-200">Touchpad Pan</span>
                <span className="font-mono text-brand-400 text-right">Two-finger Swipe</span>
              </div>
              <div className="grid grid-cols-2 py-1.5">
                <span className="text-dark-200">Nudge Elements</span>
                <span className="font-mono text-brand-400 text-right">Arrows (Shift to speed-up)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateTabBoard}
        creating={creating}
      />
    </div>
  );
};
