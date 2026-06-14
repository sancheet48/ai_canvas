import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Folder, 
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
  Moon
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface PublicBoard {
  id: string;
  title: string;
  thumbnail_url: string | null;
  view_count: number;
  fork_count: number;
  created_at: string;
  updated_at: string;
  owner_email: string;
}

export const Explore: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken, logout } = useAuthStore();
  
  const [publicBoards, setPublicBoards] = useState<PublicBoard[]>([]);
  const [userBoards, setUserBoards] = useState<any[]>([]);
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
      const res = await fetch('/api/boards', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) setUserBoards(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  };

  // 2. CREATE NEW BOARD
  const handleCreateBoard = async () => {
    if (creating) return;
    const titleInput = prompt("Enter a name for your new whiteboard:");
    if (titleInput === null) return; // User clicked Cancel in the browser prompt

    const boardTitle = titleInput.trim() || 'Untitled Board';
    setCreating(true);

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: boardTitle,
          data: [],
          visibility: 'private'
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        navigate(`/board/${data.id}`);
      } else {
        alert(data.error || 'Failed to create board. Free accounts are limited to 3 boards max.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to connect to backend.');
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
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
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
      const res = await fetch(`/api/boards/${boardId}/fork`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
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

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex flex-col">
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 flex flex-col gap-10">
        
        {/* 1. NEW WORKSPACE QUICK ACTIONS */}
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold tracking-wider text-dark-200 uppercase flex items-center gap-2">
              <Folder className="w-4 h-4 text-brand-500" /> Your Workspaces
            </h2>
            <button
              onClick={handleCreateBoard}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-lg shadow-brand-600/15 hover-scale transition-all"
            >
              <Plus className="w-4 h-4" /> New Whiteboard
            </button>
          </div>

          {loadingUser ? (
            <div className="text-center py-6 text-dark-200 text-xs">Loading boards...</div>
          ) : userBoards.length === 0 ? (
            <div className="p-8 border border-dashed border-dark-800 rounded-3xl text-center flex flex-col items-center gap-2">
              <Folder className="w-10 h-10 text-dark-200" />
              <h4 className="text-xs font-bold text-white">No active workspaces</h4>
              <p className="text-[10px] text-dark-200 max-w-sm">Click "New Whiteboard" to spin up an infinite workspace mapping. Free accounts can host up to 3 rooms.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {userBoards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/board/${b.id}`)}
                  className="glass-card rounded-3xl p-5 cursor-pointer hover-scale hover-glow transition-all flex flex-col gap-3 group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-brand-500 px-2 py-0.5 bg-brand-500/10 rounded-full border border-brand-500/10 uppercase tracking-wide">
                      {b.visibility}
                    </span>
                    <div className="flex items-center gap-1.5 z-10">
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
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-brand-500 transition-colors">{b.title}</h3>
                    <p className="text-[10px] text-dark-200 mt-1 truncate">ID: {b.id}</p>
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

        {/* 2. EXPLORE PUBLIC DISCOVER SECTION */}
        <section className="flex flex-col gap-4">
          <div className="border-t border-dark-800 pt-8 mb-2">
            <h2 className="text-sm font-semibold tracking-wider text-dark-200 uppercase flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-500" /> Discover Public Sketches
            </h2>
            <p className="text-[11px] text-dark-200 mt-1">Fork or clone premium community visual structures directly into your dashboard</p>
          </div>

          {loadingPublic ? (
            <div className="text-center py-6 text-dark-200 text-xs">Loading discover feed...</div>
          ) : publicBoards.length === 0 ? (
            <div className="p-8 border border-dashed border-dark-800 rounded-3xl text-center text-dark-200 text-[11px]">
              No public boards available. Set one of your rooms to public visibility in the whiteboard to display it here!
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {publicBoards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/board/${b.id}`)}
                  className="glass-card rounded-3xl p-5 cursor-pointer hover-scale hover-glow transition-all flex flex-col gap-3 group relative"
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
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-brand-500 transition-colors">{b.title}</h3>
                    <p className="text-[9px] text-dark-200 mt-1">Shared by {b.owner_email}</p>
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

      </main>
    </div>
  );
};
