import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert,
  Activity, 
  Users, 
  Sparkles, 
  FolderLock, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  UserX,
  Unlock,
  Coins,
  ChevronLeft,
  Calendar,
  CheckCircle,
  Copy,
  Check
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface AdminStats {
  dbLatency: number;
  wsClientsCount: number;
  errorsTail: { message: string; timestamp: number }[];
  counts: {
    totalUsers: number;
    publicBoards: number;
    totalTokens: { input: number; output: number };
  };
  providerBreakdown: { provider: string; total_tokens: string; calls_count: string }[];
}

interface AdminUser {
  id: number;
  email: string;
  verified: boolean;
  suspended: boolean;
  role: 'user' | 'admin';
  created_at: string;
  last_login: string | null;
  plan: 'free' | 'pro' | 'team';
  plan_status: string;
  board_count: string;
}

interface ModerationBoard {
  id: string;
  title: string;
  owner_id: number;
  view_count: number;
  fork_count: number;
  created_at: string;
  owner_email: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'health' | 'users' | 'ai' | 'moderation'>('health');

  // Stats / Health metrics states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // User management states
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterSuspended, setFilterSuspended] = useState('');
  
  // Audited reset logs
  const [auditResetLogs, setAuditResetLogs] = useState<{ [userId: number]: any[] }>({});

  // Moderation states
  const [boards, setBoards] = useState<ModerationBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);

  // Recovery outputs on screen
  const [generatedResetLink, setGeneratedResetLink] = useState('');
  const [showResetLinkModal, setShowResetLinkModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/explore');
    }
  }, [user]);

  // Load diagnostics initially
  useEffect(() => {
    if (!accessToken) return;
    loadHealthStats();
    loadUsersList();
    loadModerationBoards();
  }, [accessToken]);

  const loadHealthStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUsersList = async () => {
    setLoadingUsers(true);
    try {
      const query = new URLSearchParams({
        search: searchEmail,
        plan: filterPlan,
        suspended: filterSuspended
      });
      const res = await fetch(`/api/admin/users?${query}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadModerationBoards = async () => {
    setLoadingBoards(true);
    try {
      const res = await fetch('/api/admin/boards', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) setBoards(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBoards(false);
    }
  };

  // Toggle user suspension
  const handleToggleSuspend = async (userId: number, isSuspended: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ suspend: !isSuspended })
      });
      if (res.ok) {
        loadUsersList();
        loadHealthStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Invalidate user sessions
  const handleInvalidateSessions = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/invalidate-sessions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      alert(data.message || 'Sessions terminated.');
      loadUsersList();
    } catch (err) {
      console.error(err);
    }
  };

  // Force reset recovery link creator
  const handleForceResetLink = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/force-reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok && data.resetLink) {
        setGeneratedResetLink(data.resetLink);
        setShowResetLinkModal(true);
      } else {
        alert(data.error || 'Failed to generate reset link.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load last 5 reset attempts audits
  const handleFetchResetAudits = async (userId: number) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-attempts`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAuditResetLogs(prev => ({
          ...prev,
          [userId]: data
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manual Subscription override
  const handleSubscriptionOverride = async (userId: number, plan: 'free' | 'pro' | 'team') => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ plan })
      });
      if (res.ok) {
        loadUsersList();
        loadHealthStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Moderator Delete Board action
  const handleDeleteBoard = async (boardId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this public board?')) return;
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        loadModerationBoards();
        loadHealthStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Delete user account and all owned boards permanently?')) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (res.ok) {
        loadUsersList();
        loadHealthStats();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyResetLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedResetLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex flex-col">
      {/* Header Banner */}
      <header className="px-8 py-5 border-b border-dark-800 flex justify-between items-center glass-panel">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/explore')}
            className="p-2 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-500" />
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">System Admin Dashboard</h1>
              <p className="text-[10px] text-dark-200">Track server latency health, users limits overrides, and moderate boards</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            loadHealthStats();
            loadUsersList();
            loadModerationBoards();
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-900 border border-white/5 hover:border-brand-500/30 text-xs font-bold text-dark-200 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </header>

      {/* Tabs list */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-dark-900 border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('health')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'health' ? 'bg-brand-600 text-white shadow-md' : 'text-dark-200 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" /> System Health
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'users' ? 'bg-brand-600 text-white shadow-md' : 'text-dark-200 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> User Controls
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'ai' ? 'bg-brand-600 text-white shadow-md' : 'text-dark-200 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" /> AI Audits
          </button>
          <button
            onClick={() => setActiveTab('moderation')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'moderation' ? 'bg-brand-600 text-white shadow-md' : 'text-dark-200 hover:text-white'
            }`}
          >
            <FolderLock className="w-4 h-4" /> Content Moderation
          </button>
        </div>

        {/* TAB 1: SYSTEM HEALTH */}
        {activeTab === 'health' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Health indicators */}
            <div className="grid grid-cols-3 gap-5">
              <div className="glass-card rounded-3xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">Websocket Clients</h4>
                  <p className="text-2xl font-black text-white mt-1">{stats?.wsClientsCount ?? 0}</p>
                </div>
                <Activity className="w-8 h-8 text-brand-500" />
              </div>

              <div className="glass-card rounded-3xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">DB Latency</h4>
                  <p className="text-2xl font-black text-white mt-1">
                    {stats?.dbLatency ? stats.dbLatency.toFixed(1) : '0.0'} ms
                  </p>
                </div>
                <Activity className="w-8 h-8 text-brand-500" />
              </div>

              <div className="glass-card rounded-3xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">Public Canvas Rooms</h4>
                  <p className="text-2xl font-black text-white mt-1">{stats?.counts.publicBoards ?? 0}</p>
                </div>
                <Activity className="w-8 h-8 text-brand-500" />
              </div>
            </div>

            {/* Error logs list */}
            <div className="glass-card rounded-3xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-semibold tracking-wider text-dark-200 uppercase flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Error log tail (last 50 errors)
              </h3>
              <div className="max-h-80 overflow-y-auto pr-1 border border-dark-800 rounded-2xl bg-dark-900/60 flex flex-col divide-y divide-dark-800">
                {stats?.errorsTail && stats.errorsTail.length > 0 ? (
                  stats.errorsTail.map((err, i) => (
                    <div key={i} className="p-3 text-[10px] font-mono leading-relaxed">
                      <div className="flex items-center justify-between text-dark-200 mb-1">
                        <span>Index: {i + 1}</span>
                        <span>{new Date(err.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-red-400 break-all">{err.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-5 text-center text-dark-200 text-xs">No logged server anomalies found. System running normally.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER PROFILE CONTROLS */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Filters bar */}
            <div className="flex gap-3 items-center">
              <div className="flex-1 flex items-center gap-2 bg-dark-900 border border-white/5 rounded-2xl px-3.5 py-2">
                <Search className="w-4 h-4 text-dark-200" />
                <input
                  type="text"
                  placeholder="Filter users by email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="flex-1 bg-transparent text-xs outline-none"
                />
              </div>

              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="bg-dark-900 border border-white/5 rounded-2xl px-3.5 py-2 text-xs text-dark-200 outline-none cursor-pointer"
              >
                <option value="">All Tiers</option>
                <option value="free">Free Plan</option>
                <option value="pro">Pro Plan</option>
                <option value="team">Team Plan</option>
              </select>

              <select
                value={filterSuspended}
                onChange={(e) => setFilterSuspended(e.target.value)}
                className="bg-dark-900 border border-white/5 rounded-2xl px-3.5 py-2 text-xs text-dark-200 outline-none cursor-pointer"
              >
                <option value="">Suspension status</option>
                <option value="true">Suspended Only</option>
                <option value="false">Active Only</option>
              </select>

              <button
                onClick={loadUsersList}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-xs font-bold rounded-2xl text-white shadow-lg shadow-brand-600/15"
              >
                Search
              </button>
            </div>

            {/* Users lists table */}
            <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-dark-800">
                  <thead className="bg-dark-900 text-dark-200 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4">ID / Email</th>
                      <th className="px-5 py-4">Verified</th>
                      <th className="px-5 py-4">Tier Status</th>
                      <th className="px-5 py-4">Boards Count</th>
                      <th className="px-5 py-4">Suspended</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800 bg-transparent">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-dark-200">Querying users list...</td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-dark-200">No users found matching search details.</td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-dark-900/40">
                          <td className="px-5 py-4">
                            <div className="font-bold text-white">{u.email}</div>
                            <div className="text-[10px] text-dark-200 mt-0.5">ID: {u.id} | Joined: {new Date(u.created_at).toLocaleDateString()}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              u.verified ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {u.verified ? 'VERIFIED' : 'PENDING'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {/* Override Subscription picker */}
                            <select
                              value={u.plan}
                              onChange={(e) => handleSubscriptionOverride(u.id, e.target.value as any)}
                              className="bg-dark-900 border border-white/5 rounded-xl px-2 py-1 text-[11px] text-brand-500 outline-none cursor-pointer focus:border-brand-500"
                            >
                              <option value="free">Free Tier</option>
                              <option value="pro">Pro ($9/mo)</option>
                              <option value="team">Team ($29/mo)</option>
                            </select>
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-center">{u.board_count}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              u.suspended ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                            }`}>
                              {u.suspended ? 'SUSPENDED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right flex items-center justify-end gap-1.5">
                            {/* Reset Audits */}
                            <button
                              onClick={() => {
                                handleFetchResetAudits(u.id);
                              }}
                              className="px-2 py-1 bg-dark-900 border border-white/5 hover:border-brand-500/20 text-[10px] rounded-lg text-dark-200"
                              title="Audit Password resets history"
                            >
                              Audits
                            </button>

                            <button
                              onClick={() => handleForceResetLink(u.id)}
                              className="px-2 py-1 bg-dark-900 border border-white/5 hover:border-brand-500/20 text-[10px] rounded-lg text-brand-500 font-bold"
                              title="Generate password reset link on-screen"
                            >
                              Recovery
                            </button>

                            <button
                              onClick={() => handleInvalidateSessions(u.id)}
                              className="px-2 py-1 bg-dark-900 border border-white/5 hover:border-brand-500/20 text-[10px] rounded-lg text-yellow-500 font-bold"
                              title="Force logout on all devices"
                            >
                              Kick
                            </button>

                            <button
                              onClick={() => handleToggleSuspend(u.id, u.suspended)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${
                                u.suspended 
                                  ? 'bg-green-500/10 border-green-500/10 text-green-500' 
                                  : 'bg-red-500/10 border-red-500/10 text-red-500'
                              }`}
                            >
                              {u.suspended ? 'Unban' : 'Suspend'}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg"
                              title="Delete user account"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit History display logs */}
            {Object.keys(auditResetLogs).map((userIdStr) => {
              const logs = auditResetLogs[parseInt(userIdStr)];
              const targetUser = users.find(u => u.id === parseInt(userIdStr));
              if (!logs || logs.length === 0) return null;
              
              return (
                <div key={userIdStr} className="p-4 bg-dark-900 border border-white/5 rounded-2xl animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex justify-between items-center border-b border-dark-800 pb-2 mb-2">
                    <h4 className="text-xs font-bold text-white">Reset History: {targetUser?.email}</h4>
                    <button 
                      onClick={() => setAuditResetLogs(prev => {
                        const copy = { ...prev };
                        delete copy[parseInt(userIdStr)];
                        return copy;
                      })}
                      className="text-[10px] text-dark-200 hover:text-white"
                    >
                      Clear View
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {logs.map((log: any) => (
                      <div key={log.id} className="flex justify-between items-center text-[10px] text-dark-200">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-brand-500" />
                          Expires: {new Date(log.expires_at).toLocaleString()}
                        </span>
                        <span>
                          {log.used_at 
                            ? `Used at: ${new Date(log.used_at).toLocaleString()}` 
                            : log.active ? 'Active (Unused)' : 'Expired (Unused)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: AI TOKENS AUDITS */}
        {activeTab === 'ai' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Total count */}
            <div className="glass-card rounded-3xl p-5 flex items-center justify-between">
              <div>
                <h4 className="text-[10px] font-bold text-dark-200 uppercase tracking-wider">Cumulative Token Overhead</h4>
                <p className="text-2xl font-black text-white mt-1">
                  {((stats?.counts.totalTokens.input ?? 0) + (stats?.counts.totalTokens.output ?? 0)).toLocaleString()}
                </p>
                <div className="flex gap-3 text-[10px] text-dark-200 mt-1">
                  <span>Input: {stats?.counts.totalTokens.input.toLocaleString()}</span>
                  <span>Output: {stats?.counts.totalTokens.output.toLocaleString()}</span>
                </div>
              </div>
              <Sparkles className="w-10 h-10 text-brand-500" />
            </div>

            {/* Provider Breakdown table */}
            <div className="glass-card rounded-3xl p-5 flex flex-col gap-3">
              <h3 className="text-xs font-semibold tracking-wider text-dark-200 uppercase flex items-center gap-2">
                AI Provider Usage Analysis
              </h3>
              <div className="overflow-x-auto border border-dark-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs divide-y divide-dark-800">
                  <thead className="bg-dark-900 text-dark-200 uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Provider</th>
                      <th className="px-5 py-3.5">Call frequency</th>
                      <th className="px-5 py-3.5 text-right">Tokens tally</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800 font-medium bg-transparent">
                    {stats?.providerBreakdown && stats.providerBreakdown.length > 0 ? (
                      stats.providerBreakdown.map((row) => (
                        <tr key={row.provider} className="hover:bg-dark-900/40">
                          <td className="px-5 py-4 font-bold text-white capitalize">{row.provider}</td>
                          <td className="px-5 py-4">{row.calls_count} requests</td>
                          <td className="px-5 py-4 text-right font-mono font-semibold text-brand-500">
                            {parseInt(row.total_tokens).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-dark-200">No tokens billing cycles tracked yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CONTENT MODERATION */}
        {activeTab === 'moderation' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <h3 className="text-xs font-semibold tracking-wider text-dark-200 uppercase mb-2">Public catalog moderation list</h3>
            
            {loadingBoards ? (
              <div className="text-center py-6 text-dark-200">Loading public boards catalog...</div>
            ) : boards.length === 0 ? (
              <div className="p-8 border border-dashed border-dark-800 rounded-3xl text-center text-dark-200 text-xs">
                No active public boards in the system.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {boards.map((b) => (
                  <div key={b.id} className="glass-card rounded-2xl p-4 flex justify-between items-start gap-4 hover-glow transition-all">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{b.title}</h4>
                      <p className="text-[10px] text-dark-200 mt-1 font-mono truncate">ID: {b.id}</p>
                      <p className="text-[10px] text-dark-200 mt-0.5 truncate">Owner: {b.owner_email}</p>
                      <div className="flex items-center gap-3 text-[10px] text-dark-200 mt-2">
                        <span>Views: {b.view_count}</span>
                        <span>Clones: {b.fork_count}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBoard(b.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-bold rounded-xl transition-all"
                    >
                      Delete Board
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* FORCE PASSWORD RESET ON SCREEN MODAL */}
      {showResetLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm" onClick={() => setShowResetLinkModal(false)} />
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl z-10 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> Reset URL Generated
              </h3>
              <button onClick={() => setShowResetLinkModal(false)} className="text-dark-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[10px] text-dark-200">Copy this link and send it to the user. This token expires in 1 hour and will invalidate all their existing sessions once used.</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                readOnly
                value={generatedResetLink}
                className="flex-1 bg-dark-900 border border-white/5 text-[10px] text-dark-200 rounded-xl px-3 py-2.5 outline-none select-all font-mono"
              />
              <button
                onClick={handleCopyResetLink}
                className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white hover-scale transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const X = ({ className, ...props }: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
