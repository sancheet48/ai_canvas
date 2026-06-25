import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Folder, 
  FolderOpen,
  FolderPlus,
  FolderTree,
  ChevronRight,
  Globe, 
  GitFork, 
  Eye, 
  Clock, 
  User, 
  Search,
  Sparkles,
  ArrowRight,
  LogOut,
  Settings,
  Sliders,
  Edit,
  Trash2,
  Sun,
  Moon,
  Image,
  FileText
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { CreateBoardModal } from '../components/CreateBoardModal';

interface PublicBoard {
  id: string;
  title: string;
  description?: string;
  thumbnail_url: string | null;
  view_count: number;
  fork_count: number;
  created_at: string;
  updated_at: string;
  owner_email: string;
}

interface Folder {
  id: string;
  name: string;
  boardIds: string[];
  color?: string;
}

export const Explore: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken, logout } = useAuthStore();
  
  const [publicBoards, setPublicBoards] = useState<PublicBoard[]>([]);
  const [userBoards, setUserBoards] = useState<any[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [activeDropdownBoardId, setActiveDropdownBoardId] = useState<string | null>(null);
  const [activeColorPickerFolderId, setActiveColorPickerFolderId] = useState<string | null>(null);
  const [recentBoards, setRecentBoards] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'my-workspaces' | 'discover'>('my-workspaces');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Wallpaper backgrounds
  const [wallpaper, setWallpaper] = useState<string>('default');
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string>('');
  const [showWallpaperSelector, setShowWallpaperSelector] = useState(false);

  // Initialize wallpaper on user load
  useEffect(() => {
    if (user?.email) {
      setWallpaper(localStorage.getItem(`whiteboard_wallpaper_selection_${user.email}`) || 'default');
      setCustomWallpaperUrl(localStorage.getItem(`whiteboard_wallpaper_custom_${user.email}`) || '');
    }
  }, [user?.email]);

  const PRESET_COLORS = [
    { name: 'Gray', hex: '#6b7280' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Violet', hex: '#8b5cf6' },
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Rose', hex: '#f43f5e' }
  ];

  // Load folders from localStorage
  useEffect(() => {
    if (user?.email) {
      const key = `whiteboard_folders_${user.email}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setFolders(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse folders:', e);
        }
      } else {
        setFolders([]);
      }
    }
  }, [user?.email]);

  // Save folders to localStorage helper
  const saveFolders = (newFolders: Folder[]) => {
    setFolders(newFolders);
    if (user?.email) {
      localStorage.setItem(`whiteboard_folders_${user.email}`, JSON.stringify(newFolders));
    }
  };

  // Track and prune recent boards list
  useEffect(() => {
    if (user?.email && userBoards.length > 0) {
      const key = `whiteboard_recent_${user.email}`;
      const recentIds: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      const validRecent = recentIds
        .map(id => userBoards.find(b => b.id === id))
        .filter(Boolean);
      
      setRecentBoards(validRecent);
      
      // Clean deleted boards from local storage
      const validRecentIds = validRecent.map(b => b.id);
      if (validRecentIds.length !== recentIds.length) {
        localStorage.setItem(key, JSON.stringify(validRecentIds));
      }
    } else {
      setRecentBoards([]);
    }
  }, [userBoards, user?.email]);

  // Click outside to close dropdowns
  useEffect(() => {
    const closeDropdown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('.color-picker-container') ||
        target.closest('.board-dropdown-container') ||
        target.closest('.wallpaper-container')
      ) {
        return;
      }
      setActiveDropdownBoardId(null);
      setActiveColorPickerFolderId(null);
      setShowWallpaperSelector(false);
    };
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  // Wrapper for authenticated fetch with automatic token refreshing
  const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let currentToken = useAuthStore.getState().accessToken || accessToken;
    const headers = new Headers(options.headers || {});
    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    
    let res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      // Try to refresh token
      const restored = await useAuthStore.getState().restoreSession();
      if (restored) {
        const newToken = useAuthStore.getState().accessToken;
        headers.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers });
      } else {
        logout().then(() => navigate('/login'));
        throw new Error('Session expired. Please log in again.');
      }
    }
    return res;
  };

  const handleSelectWallpaper = (val: string) => {
    setWallpaper(val);
    if (user?.email) {
      localStorage.setItem(`whiteboard_wallpaper_selection_${user.email}`, val);
    }
  };

  const handleCustomWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setCustomWallpaperUrl(base64String);
      setWallpaper('custom');
      if (user?.email) {
        localStorage.setItem(`whiteboard_wallpaper_selection_${user.email}`, 'custom');
        localStorage.setItem(`whiteboard_wallpaper_custom_${user.email}`, base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectFolderColor = (e: React.MouseEvent, folderId: string, colorHex: string) => {
    e.stopPropagation();
    const updated = folders.map(f => f.id === folderId ? { ...f, color: colorHex } : f);
    saveFolders(updated);
    setActiveColorPickerFolderId(null);
  };

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:");
    if (!name || !name.trim()) return;
    const newFolder: Folder = {
      id: Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      boardIds: [],
      color: '#6b7280' // default Gray
    };
    saveFolders([...folders, newFolder]);
  };

  const handleRenameFolder = (e: React.MouseEvent, folderId: string, currentName: string) => {
    e.stopPropagation();
    const newName = prompt("Enter new folder name:", currentName);
    if (!newName || !newName.trim()) return;
    const updated = folders.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f);
    saveFolders(updated);
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this folder? Workspaces inside it will not be deleted; they will become uncategorized.")) return;
    const updated = folders.filter(f => f.id !== folderId);
    saveFolders(updated);
    if (selectedFolderId === folderId) {
      setSelectedFolderId('all');
    }
  };

  const handleMoveBoardToFolder = (boardId: string, destFolderId: string | null) => {
    const updatedFolders = folders.map(f => {
      const filtered = f.boardIds.filter(id => id !== boardId);
      if (f.id === destFolderId) {
        filtered.push(boardId);
      }
      return { ...f, boardIds: filtered };
    });
    saveFolders(updatedFolders);
    setActiveDropdownBoardId(null);
  };

  const isBoardInAnyFolder = (boardId: string) => {
    return folders.some(f => f.boardIds.includes(boardId));
  };

  const filteredBoards = selectedFolderId === 'all'
    ? userBoards
    : selectedFolderId === 'uncategorized'
    ? userBoards.filter(b => !isBoardInAnyFolder(b.id))
    : userBoards.filter(b => {
        const f = folders.find(folder => folder.id === selectedFolderId);
        return f ? f.boardIds.includes(b.id) : false;
      });

  const getWallpaperStyle = (): React.CSSProperties => {
    if (wallpaper === 'custom' && customWallpaperUrl) {
      return {
        backgroundImage: `url(${customWallpaperUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      };
    }
    return {};
  };

  const getWallpaperClass = (): string => {
    if (wallpaper === 'purple-dusk') return 'bg-gradient-to-br from-indigo-950 via-dark-950 to-purple-950';
    if (wallpaper === 'midnight-forest') return 'bg-gradient-to-br from-slate-950 via-dark-950 to-emerald-950';
    if (wallpaper === 'aurora') return 'bg-gradient-to-br from-teal-950 via-dark-950 to-rose-950';
    return 'bg-dark-950'; // default
  };
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [creating, setCreating] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

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

  // 1. LOAD EXPLORE DATA
  useEffect(() => {
    if (!accessToken) return;
    loadPublicBoards();
    loadUserBoards();
  }, [accessToken]);

  const loadPublicBoards = async () => {
    setLoadingPublic(true);
    try {
      const res = await fetch('/api/boards/public');
      const data = await res.json();
      if (res.ok) setPublicBoards(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPublic(false);
    }
  };

  const loadUserBoards = async () => {
    setLoadingUser(true);
    try {
      const res = await authenticatedFetch('/api/boards');
      const data = await res.json();
      if (res.ok) setUserBoards(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  };

  // 2. CREATE NEW BOARD
  const handleCreateBoard = async (boardTitle: string, boardDesc: string, visibility: 'private' | 'public') => {
    if (creating) return;
    setCreating(true);

    try {
      const res = await authenticatedFetch('/api/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: boardTitle,
          description: boardDesc,
          data: [],
          visibility
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        if (selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized') {
          const updatedFolders = folders.map(f => {
            if (f.id === selectedFolderId) {
              const currentIds = f.boardIds || [];
              if (!currentIds.includes(data.id)) {
                return { ...f, boardIds: [...currentIds, data.id] };
              }
            }
            return f;
          });
          saveFolders(updatedFolders);
        }
        navigate(`/board/${data.id}`);
      } else {
        throw new Error(data.error || 'Failed to create board. Free accounts are limited to 3 boards max.');
      }
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  // 2.5 RENAME BOARD
  const handleRenameBoard = async (e: React.MouseEvent, boardId: string, currentTitle: string) => {
    e.stopPropagation(); // Prevent navigating to the board page
    const newTitle = prompt("Enter a new name for this whiteboard:", currentTitle);
    if (newTitle === null) return; // Cancelled
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      alert("Board name cannot be empty.");
      return;
    }

    try {
      const res = await authenticatedFetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: trimmedTitle })
      });
      if (res.ok) {
        setUserBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: trimmedTitle } : b));
        setPublicBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: trimmedTitle } : b));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to rename board.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server.");
    }
  };

  // 2.6 DELETE BOARD
  const handleDeleteBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation(); // Prevent navigating to the board page
    if (!confirm("Are you sure you want to permanently delete this whiteboard? This action cannot be undone.")) return;

    try {
      const res = await authenticatedFetch(`/api/boards/${boardId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setUserBoards(prev => prev.filter(b => b.id !== boardId));
        setPublicBoards(prev => prev.filter(b => b.id !== boardId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete board.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server.");
    }
  };

  // 3. DUPLICATE/FORK BOARD FLOW
  const handleForkBoard = async (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation(); // prevent opening raw board link
    setForkingId(boardId);
    try {
      const res = await authenticatedFetch(`/api/boards/${boardId}/fork`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.id) {
        navigate(`/board/${data.id}`);
      } else {
        alert(data.error || 'Fork failed. Confirm board allows cloning.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setForkingId(null);
    }
  };

  // 4. EDIT DESCRIPTION FLOW
  const handleEditDescription = async (e: React.MouseEvent, boardId: string, currentDesc: string) => {
    e.stopPropagation(); // Prevent navigating to the board page
    const newDesc = prompt("Enter a description for this whiteboard:", currentDesc || "");
    if (newDesc === null) return; // Cancelled
    const trimmedDesc = newDesc.trim();

    try {
      const res = await authenticatedFetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmedDesc })
      });
      if (res.ok) {
        setUserBoards(prev => prev.map(b => b.id === boardId ? { ...b, description: trimmedDesc } : b));
        setPublicBoards(prev => prev.map(b => b.id === boardId ? { ...b, description: trimmedDesc } : b));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update description.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to server.");
    }
  };

  const wallpaperClass = getWallpaperClass();
  const wallpaperStyle = getWallpaperStyle();

  return (
    <div 
      className={`min-h-screen text-dark-100 flex flex-col transition-all duration-300 ${wallpaperClass}`}
      style={wallpaperStyle}
    >
      {/* Navigation Banner */}
      <header className="px-8 py-5 border-b border-dark-800 flex justify-between items-center glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">Boards Dashboard</h1>
            <p className="text-[10px] text-dark-200">Catalog of your drawing workspaces and public models</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-dark-900 border border-white/5 hover:border-brand-500/30 text-xs font-bold text-brand-500 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" /> Admin Console
            </button>
          )}
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-900 border border-white/5 text-[11px] text-dark-200 font-medium">
            <User className="w-4 h-4 text-brand-500" />
            <span>{user?.email}</span>
            {user?.plan && user.plan !== 'free' && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                {user.plan}
              </span>
            )}
          </div>

          {/* Wallpaper Selector */}
          <div className="relative wallpaper-container" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowWallpaperSelector(!showWallpaperSelector)}
              className="p-2.5 rounded-xl bg-dark-900 border border-white/5 text-dark-200 hover:text-white hover:border-brand-500/30 transition-colors"
              title="Choose Wallpaper"
            >
              <Image className="w-4 h-4 text-brand-500" />
            </button>

            {showWallpaperSelector && (
              <div className="absolute right-0 mt-2 bg-dark-900 border border-white/5 rounded-2xl p-4 z-30 shadow-2xl w-64 flex flex-col gap-3">
                <p className="text-xs font-bold text-white uppercase tracking-wider pb-1 border-b border-dark-800">Select Wallpaper</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSelectWallpaper('default')}
                    className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold bg-dark-950 ${
                      wallpaper === 'default' ? 'border-brand-500 text-brand-500' : 'border-white/5 text-dark-200'
                    }`}
                  >
                    Default Dark
                  </button>
                  <button
                    onClick={() => handleSelectWallpaper('purple-dusk')}
                    className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold bg-gradient-to-br from-indigo-950 via-dark-950 to-purple-950 ${
                      wallpaper === 'purple-dusk' ? 'border-brand-500 text-brand-500' : 'border-white/5 text-dark-200'
                    }`}
                  >
                    Purple Dusk
                  </button>
                  <button
                    onClick={() => handleSelectWallpaper('midnight-forest')}
                    className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold bg-gradient-to-br from-slate-950 via-dark-950 to-emerald-950 ${
                      wallpaper === 'midnight-forest' ? 'border-brand-500 text-brand-500' : 'border-white/5 text-dark-200'
                    }`}
                  >
                    Midnight Forest
                  </button>
                  <button
                    onClick={() => handleSelectWallpaper('aurora')}
                    className={`h-12 rounded-xl border flex items-center justify-center text-[10px] font-bold bg-gradient-to-br from-teal-950 via-dark-950 to-rose-950 ${
                      wallpaper === 'aurora' ? 'border-brand-500 text-brand-500' : 'border-white/5 text-dark-200'
                    }`}
                  >
                    Aurora Dusk
                  </button>
                </div>

                <div className="border-t border-dark-800 pt-3 flex flex-col gap-2">
                  <p className="text-[9px] font-bold text-dark-200 uppercase tracking-wider">Custom Image</p>
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-dark-950 hover:bg-dark-900 border border-white/5 hover:border-brand-500/30 text-[10px] font-bold text-dark-200 hover:text-white transition-all cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCustomWallpaperUpload}
                    />
                  </label>
                  {customWallpaperUrl && (
                    <button
                      onClick={() => handleSelectWallpaper('custom')}
                      className={`h-8 rounded-xl border text-[9px] font-bold ${
                        wallpaper === 'custom' ? 'border-brand-500 text-brand-500' : 'border-white/5 text-dark-200'
                      }`}
                    >
                      Use Uploaded
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleToggleTheme}
            className="p-2.5 rounded-xl bg-dark-900 border border-white/5 text-dark-200 hover:text-white hover:border-brand-500/30 transition-colors animate-in spin-in-12 duration-300"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          <button
            onClick={() => logout().then(() => navigate('/login'))}
            className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Workspace Catalog Body */}
      <main className="flex-1 w-full px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Left Side Pane: Folders Sidebar */}
        <aside className="w-full md:w-64 flex flex-col gap-5 flex-shrink-0">
          <div className="glass-panel rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-dark-800">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-brand-500" /> Folders
              </h3>
              <button
                onClick={handleCreateFolder}
                className="p-1 rounded bg-dark-900 border border-white/5 hover:border-brand-500/30 text-brand-500 hover:text-white transition-colors"
                title="Create Folder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => setSelectedFolderId('all')}
                className={`flex justify-between items-center px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  selectedFolderId === 'all'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10'
                    : 'bg-dark-900 hover:bg-dark-900/60 border border-white/5 text-dark-200 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" /> All Workspaces
                </span>
                <span className="text-[10px] bg-dark-950/40 px-2 py-0.5 rounded-full border border-white/5">{userBoards.length}</span>
              </button>

              <button
                onClick={() => setSelectedFolderId('uncategorized')}
                className={`flex justify-between items-center px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                  selectedFolderId === 'uncategorized'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10'
                    : 'bg-dark-900 hover:bg-dark-900/60 border border-white/5 text-dark-200 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Folder className="w-4 h-4" /> Uncategorized
                </span>
                <span className="text-[10px] bg-dark-950/40 px-2 py-0.5 rounded-full border border-white/5">
                  {userBoards.filter(b => !isBoardInAnyFolder(b.id)).length}
                </span>
              </button>
            </div>

            {/* Custom Folders Section */}
            {folders.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-dark-800 pt-3">
                <p className="text-[10px] text-dark-200 font-bold uppercase tracking-wider px-1 mb-1">My Folders</p>
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {folders.map(f => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFolderId(f.id)}
                      className={`flex justify-between items-center px-3 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer group/folder border border-white/5 ${
                        selectedFolderId === f.id
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-600/10 border-brand-500/20'
                          : 'bg-dark-900 hover:bg-dark-900/60 text-dark-200 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate max-w-[120px]" title={f.name}>
                        <Folder className="w-4 h-4 flex-shrink-0" fill={f.color || '#6b7280'} style={{ color: f.color || '#6b7280' }} /> {f.name}
                      </span>
                      <div className="flex items-center gap-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                        {activeColorPickerFolderId === f.id ? (
                          <div className="flex items-center gap-1 bg-dark-950/80 px-2 py-1 rounded-xl border border-white/5 animate-in fade-in duration-150">
                            {PRESET_COLORS.map(c => (
                              <button
                                key={c.hex}
                                onClick={(e) => handleSelectFolderColor(e, f.id, c.hex)}
                                className="w-3.5 h-3.5 rounded-full border border-white/10 hover:scale-125 transition-all flex-shrink-0"
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              />
                            ))}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveColorPickerFolderId(null);
                              }}
                              className="text-dark-200 hover:text-white text-[10px] font-bold ml-1 px-1 rounded hover:bg-dark-800"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Folder Color Circle Picker */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveColorPickerFolderId(f.id);
                              }}
                              className="w-3.5 h-3.5 rounded-full border border-white/20 transition-all hover:scale-110 flex-shrink-0"
                              style={{ backgroundColor: f.color || '#6b7280' }}
                              title="Change folder color"
                            />

                            <span className="text-[9px] bg-dark-950/40 px-1.5 py-0.5 rounded-full border border-white/5 flex-shrink-0 font-bold text-dark-100">
                              {f.boardIds.length}
                            </span>
                            
                            <button
                              onClick={(e) => handleRenameFolder(e, f.id, f.name)}
                              className="p-0.5 rounded text-dark-200 hover:text-white transition-colors opacity-0 group-hover/folder:opacity-100"
                              title="Rename Folder"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFolder(e, f.id)}
                              className="p-0.5 rounded text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover/folder:opacity-100"
                              title="Delete Folder"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recently Opened Section */}
          {recentBoards.length > 0 && (
            <div className="glass-panel rounded-3xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-dark-800">
                <Clock className="w-4 h-4 text-brand-500" /> Recents
              </h3>
              <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                {recentBoards.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => navigate(`/board/${b.id}`)}
                    className="flex justify-between items-center px-3 py-2 rounded-2xl text-[11px] font-semibold bg-dark-900 hover:bg-dark-900/60 text-dark-200 hover:text-white transition-all cursor-pointer border border-white/5 truncate group"
                  >
                    <span className="truncate max-w-[170px]" title={b.title}>
                      {b.title}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-brand-500" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right Side Content Panel */}
        <div className="flex-1 flex flex-col gap-8 min-w-0">
          
          {/* Tabs Navigation */}
          <div className="flex border-b border-dark-800 gap-6">
            <button
              onClick={() => setActiveTab('my-workspaces')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'my-workspaces'
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-dark-200 hover:text-white'
              }`}
            >
              <Folder className="w-4 h-4 text-brand-500" />
              My Workspaces ({filteredBoards.length})
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'discover'
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-dark-200 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4 text-brand-500" />
              Discover Templates ({publicBoards.length})
            </button>
          </div>

          {/* Conditional rendering based on activeTab */}
          {activeTab === 'my-workspaces' ? (
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold tracking-wider text-dark-200 uppercase flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-brand-500" /> 
                  {selectedFolderId === 'all' 
                    ? 'All Workspaces' 
                    : selectedFolderId === 'uncategorized' 
                    ? 'Uncategorized Workspaces' 
                    : `${folders.find(f => f.id === selectedFolderId)?.name || 'Folder'} Workspaces`}
                </h2>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 hover-scale transition-all"
                >
                  <Plus className="w-4 h-4" /> New Whiteboard
                </button>
              </div>

              {loadingUser ? (
                <div className="text-center py-6 text-dark-200 text-xs">Loading boards...</div>
              ) : filteredBoards.length === 0 ? (
                <div className="p-8 border border-dashed border-dark-800 rounded-3xl text-center flex flex-col items-center gap-2">
                  <Folder className="w-10 h-10 text-dark-200" />
                  <h4 className="text-xs font-bold text-white">No workspaces here</h4>
                  <p className="text-[10px] text-dark-200 max-w-sm">
                    {selectedFolderId === 'all' 
                      ? 'Click "New Whiteboard" to spin up an infinite workspace mapping. Free accounts can host up to 3 rooms.'
                      : 'Assign existing workspaces to this folder or create a new whiteboard.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {filteredBoards.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => navigate(`/board/${b.id}`)}
                      className="glass-card rounded-3xl p-5 cursor-pointer hover-scale hover-glow transition-all flex flex-col gap-3 group relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-brand-500 px-2 py-0.5 bg-brand-500/10 rounded-full border border-brand-500/10 uppercase tracking-wide">
                          {b.visibility}
                        </span>
                        <div className="flex items-center gap-1.5 z-10">
                          {/* Folder Assignment Selector Dropdown */}
                          <div className="relative board-dropdown-container">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownBoardId(activeDropdownBoardId === b.id ? null : b.id);
                              }}
                              className="p-1 rounded bg-dark-900 border border-white/5 text-dark-200 hover:text-white hover:border-brand-500/30 transition-colors"
                              title="Move to folder"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>
                            
                            {activeDropdownBoardId === b.id && (
                              <div 
                                className="absolute right-0 mt-2 bg-dark-900 border border-white/5 rounded-2xl p-2 z-20 shadow-xl w-48 text-[11px] flex flex-col gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-[9px] font-bold text-dark-200 uppercase px-2 py-1 border-b border-dark-800 mb-1">Move to Folder</p>
                                
                                <button
                                  onClick={() => handleMoveBoardToFolder(b.id, null)}
                                  className={`text-left px-2 py-1.5 rounded-xl hover:bg-dark-950/40 text-dark-200 hover:text-white flex items-center gap-1.5 font-medium ${
                                    !isBoardInAnyFolder(b.id) ? 'text-brand-500 hover:text-brand-500' : ''
                                  }`}
                                >
                                  <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span>None (Uncategorized)</span>
                                </button>
                                
                                {folders.map(f => {
                                  const isAssigned = f.boardIds.includes(b.id);
                                  return (
                                    <button
                                      key={f.id}
                                      onClick={() => handleMoveBoardToFolder(b.id, f.id)}
                                      className={`text-left px-2 py-1.5 rounded-xl hover:bg-dark-950/40 text-dark-200 hover:text-white flex items-center gap-1.5 font-medium ${
                                        isAssigned ? 'text-brand-500 hover:text-brand-500' : ''
                                      }`}
                                    >
                                      <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                                      <span className="truncate">{f.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={(e) => handleEditDescription(e, b.id, b.description)}
                            className="p-1 rounded bg-dark-900 border border-white/5 text-dark-200 hover:text-white hover:border-brand-500/30 transition-colors"
                            title="Edit description"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleRenameBoard(e, b.id, b.title)}
                            className="p-1 rounded bg-dark-900 border border-white/5 text-dark-200 hover:text-white hover:border-brand-500/30 transition-colors"
                            title="Rename whiteboard"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteBoard(e, b.id)}
                            className="p-1 rounded bg-dark-900 border border-white/5 text-red-500 hover:bg-red-500/10 transition-colors"
                            title="Delete whiteboard"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 text-left">
                        <h3 className="text-sm font-bold text-white group-hover:text-brand-500 transition-colors">{b.title}</h3>
                        <p className="text-xs text-dark-200/80 line-clamp-2 font-medium" title={b.description || 'No description'}>
                          {b.description || <span className="text-dark-400 italic">No description</span>}
                        </p>
                        <p className="text-[9px] text-dark-400 font-mono mt-1 truncate">ID: {b.id}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-dark-800 pt-3 mt-1 text-[10px] text-dark-200 font-medium">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-brand-500" /> {b.view_count} views</span>
                        <span className="flex items-center gap-1"><GitFork className="w-3.5 h-3.5 text-brand-500" /> {b.fork_count} forks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="flex flex-col gap-4">
              <div className="mb-2">
                <h2 className="text-sm font-semibold tracking-wider text-dark-200 uppercase flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand-500" /> Discover Public Sketches
                </h2>
                <p className="text-[11px] text-dark-200 mt-1">Fork or clone premium community visual structures directly into your collection</p>
              </div>

              {loadingPublic ? (
                <div className="text-center py-6 text-dark-200 text-xs">Loading discover feed...</div>
              ) : publicBoards.length === 0 ? (
                <div className="p-8 border border-dashed border-dark-800 rounded-3xl text-center text-dark-200 text-[11px]">
                  No public boards available. Set one of your rooms to public visibility in the whiteboard to display it here!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {publicBoards.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => navigate(`/board/${b.id}`)}
                      className="glass-card rounded-3xl p-5 cursor-pointer hover-scale hover-glow transition-all flex flex-col gap-3 group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-dark-200 font-medium truncate max-w-44 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-brand-500" /> {b.owner_email.split('@')[0]}
                        </span>
                        <button
                          onClick={(e) => handleForkBoard(e, b.id)}
                          disabled={forkingId === b.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-dark-900 border border-white/5 hover:border-brand-500/30 text-[10px] font-bold text-dark-200 hover:text-white transition-colors"
                          title="Duplicate this drawing to your collection"
                        >
                          <GitFork className="w-3 h-3 text-brand-500" /> {forkingId === b.id ? 'Forking...' : 'Clone'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5 text-left">
                        <h3 className="text-sm font-bold text-white group-hover:text-brand-500 transition-colors">{b.title}</h3>
                        <p className="text-xs text-dark-200/80 line-clamp-2 font-medium" title={b.description || 'No description'}>
                          {b.description || <span className="text-dark-400 italic">No description</span>}
                        </p>
                        <p className="text-[9px] text-dark-400 mt-1">Shared by {b.owner_email}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-dark-800 pt-3 mt-1 text-[10px] text-dark-200 font-medium">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-brand-500" /> {b.view_count} views</span>
                        <span className="flex items-center gap-1"><GitFork className="w-3.5 h-3.5 text-brand-500" /> {b.fork_count} clones</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </main>

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateBoard}
        creating={creating}
      />
    </div>
  );
};
