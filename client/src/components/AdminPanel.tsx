import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Users, Eye, EyeOff, Key, Monitor, RefreshCw, Trash2, Plus, Save, Power, ChevronDown, ChevronRight, UserPlus, Lock, Unlock, Settings, Calendar, MessageSquare, BookOpen, Cloud, Wifi, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
  colorSettings: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
}

interface AdminStatus {
  uptime: number;
  sitePasswordSet: boolean;
  guestAccessEnabled: boolean;
  partnerAccessEnabled: boolean;
  sessions: Array<{ id: string; level: string; levelName: string; loginTime: number; lastActive: number; userAgent: string; ip: string }>;
  passwords: { admin: string; partner: string; guest: string };
  tunnel: { configured: boolean; domain: string };
  nodeVersion: string;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
  pid: number;
}

interface UserRecord {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  auth_level: string;
  profile_name: string | null;
  must_change_password: boolean;
  enabled: boolean;
  created_at: string;
  last_login: string | null;
}

interface ProfileRecord {
  id: number;
  profile_level: string;
  profile_name: string;
  show_outlook_calendar: boolean;
  show_google_calendar: boolean;
  show_second_google_calendar: boolean;
  show_tasks: boolean;
  show_weather: boolean;
  show_news_ticker: boolean;
  show_homework_panel: boolean;
  show_degree_tracking: boolean;
  show_bryn_assist: boolean;
  show_notepad: boolean;
  show_radio: boolean;
  show_admin_panel: boolean;
  show_add_task: boolean;
  show_completed_tasks: boolean;
  show_courses: boolean;
  show_library: boolean;
  show_spotify: boolean;
  show_home_assistant: boolean;
  show_astronomy: boolean;
  can_edit_tasks: boolean;
  can_add_calendar_events: boolean;
  can_access_settings: boolean;
  can_view_library: boolean;
  custom_calendars: string;
  enabled: boolean;
}

type TabId = 'overview' | 'users' | 'profiles' | 'passwords' | 'sessions';

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const LEVEL_COLORS: Record<string, string> = {
  '5747': '#4ade80',
  '4201': '#60a5fa',
  '1010': '#a78bfa',
};

const LEVEL_NAMES: Record<string, string> = {
  '5747': 'Admin',
  '4201': 'Partner',
  '1010': 'Guest',
};

export default function AdminPanel({ open, onClose, colorSettings }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', displayName: '', authLevel: '1010', password: '' });
  const [editingPassword, setEditingPassword] = useState<{ admin: string; partner: string; guest: string }>({ admin: '', partner: '', guest: '' });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [expandedProfile, setExpandedProfile] = useState<number | null>(null);
  const [profileDrafts, setProfileDrafts] = useState<Record<number, Partial<ProfileRecord>>>({});
  const [settingPasswordForUser, setSettingPasswordForUser] = useState<number | null>(null);
  const [userPasswordInput, setUserPasswordInput] = useState('');
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, usersRes, profilesRes] = await Promise.all([
        fetch('/api/admin/status'),
        fetch('/api/admin/users'),
        fetch('/api/admin/profiles'),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (profilesRes.ok) setProfiles(await profilesRes.json());
    } catch (e) {
      console.error('Failed to fetch admin data', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.displayName) {
      toast({ title: 'Error', description: 'Username and display name are required', variant: 'destructive' });
      return;
    }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      toast({ title: 'User created' });
      setShowAddUser(false);
      setNewUser({ username: '', email: '', displayName: '', authLevel: '1010', password: '' });
      fetchAll();
    } else {
      const err = await res.json();
      toast({ title: 'Error', description: err.error, variant: 'destructive' });
    }
  };

  const handleToggleUser = async (user: UserRecord) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !user.enabled }),
    });
    fetchAll();
  };

  const handleDeleteUser = async (user: UserRecord) => {
    if (user.auth_level === '5747') {
      toast({ title: 'Cannot delete admin account', variant: 'destructive' });
      return;
    }
    await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    fetchAll();
  };

  const handleUpdatePasswords = async () => {
    const body: any = {};
    if (editingPassword.admin) body.adminPassword = editingPassword.admin;
    if (editingPassword.partner) body.partnerPassword = editingPassword.partner;
    if (editingPassword.guest) body.guestPassword = editingPassword.guest;
    const res = await fetch('/api/admin/update-passwords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast({ title: 'Passwords updated', description: 'Restart the app for changes to take effect.' });
      setEditingPassword({ admin: '', partner: '', guest: '' });
      fetchAll();
    }
  };

  const handleSetUserPassword = async (userId: number) => {
    if (!userPasswordInput || userPasswordInput.length < 4) {
      toast({ title: 'Error', description: 'Password must be at least 4 characters', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: userPasswordInput }),
    });
    if (res.ok) {
      toast({ title: 'Password set successfully' });
      setSettingPasswordForUser(null);
      setUserPasswordInput('');
      fetchAll();
    } else {
      toast({ title: 'Error', description: 'Failed to set password', variant: 'destructive' });
    }
  };

  const handleProfileToggle = async (profile: ProfileRecord, field: string, value: boolean) => {
    await fetch(`/api/admin/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    fetchAll();
  };

  const setProfileDraft = (profile: ProfileRecord, field: string, value: boolean) => {
    setProfileDrafts(prev => ({
      ...prev,
      [profile.id]: { ...(prev[profile.id] || {}), [field]: value },
    }));
  };

  const getProfileValue = (profile: ProfileRecord, field: string): boolean => {
    const draft = profileDrafts[profile.id];
    if (draft && field in draft) return (draft as any)[field];
    return (profile as any)[field];
  };

  const hasProfileChanges = (profile: ProfileRecord): boolean => {
    const draft = profileDrafts[profile.id];
    return !!draft && Object.keys(draft).length > 0;
  };

  const saveProfileDraft = async (profile: ProfileRecord) => {
    const draft = profileDrafts[profile.id];
    if (!draft || Object.keys(draft).length === 0) return;
    const res = await fetch(`/api/admin/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      toast({ title: `${profile.profile_name} saved` });
      setProfileDrafts(prev => { const n = { ...prev }; delete n[profile.id]; return n; });
      fetchAll();
    } else {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const cancelProfileDraft = (profile: ProfileRecord) => {
    setProfileDrafts(prev => { const n = { ...prev }; delete n[profile.id]; return n; });
  };

  const handleRevokeSession = async (sessionId: string) => {
    await fetch('/api/admin/revoke-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    fetchAll();
  };

  const handleRestart = async () => {
    toast({ title: 'Restarting server...' });
    await fetch('/api/admin/restart', { method: 'POST' });
  };

  if (!open) return null;

  const inputStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '11px', height: '28px', borderRadius: '4px', padding: '0 8px' };
  const labelStyle = { fontSize: '10px', color: '#fff', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '3px' };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Monitor },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'profiles', label: 'Profile Permissions', icon: Shield },
    { id: 'passwords', label: 'Access Codes', icon: Key },
    { id: 'sessions', label: 'Sessions', icon: Wifi },
  ];

  const visibilityToggles = [
    { field: 'show_outlook_calendar', label: 'Outlook Calendar', icon: Calendar },
    { field: 'show_google_calendar', label: 'Google Calendar', icon: Calendar },
    { field: 'show_second_google_calendar', label: '2nd Google Calendar', icon: Calendar },
    { field: 'show_tasks', label: 'Tasks', icon: BookOpen },
    { field: 'show_weather', label: 'Weather', icon: Cloud },
    { field: 'show_news_ticker', label: 'News Ticker', icon: Monitor },
    { field: 'show_homework_panel', label: 'Homework Panel', icon: BookOpen },
    { field: 'show_degree_tracking', label: 'Degree Tracking', icon: Settings },
    { field: 'show_bryn_assist', label: 'BrynAssist AI', icon: MessageSquare },
    { field: 'show_notepad', label: 'Notepad', icon: BookOpen },
    { field: 'show_radio', label: 'Radio', icon: Monitor },
    { field: 'show_admin_panel', label: 'Admin Panel', icon: Shield },
    { field: 'show_add_task', label: 'Add Task', icon: Plus },
    { field: 'show_completed_tasks', label: 'Completed Tasks', icon: BookOpen },
    { field: 'show_courses', label: 'Courses', icon: BookOpen },
    { field: 'show_library', label: 'Library', icon: BookOpen },
    { field: 'show_spotify', label: 'Spotify', icon: Monitor },
    { field: 'show_home_assistant', label: 'Home Assistant', icon: Wifi },
    { field: 'show_astronomy', label: 'Astronomy', icon: Cloud },
  ];

  const permissionToggles = [
    { field: 'can_edit_tasks', label: 'Edit Tasks' },
    { field: 'can_add_calendar_events', label: 'Add Calendar Events' },
    { field: 'can_access_settings', label: 'Access Settings' },
    { field: 'can_view_library', label: 'View Library' },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[10010] bg-black/50" onClick={onClose} />
      <div
        className="fixed z-[10010] overflow-hidden flex flex-col text-[11px] p-0 sm:rounded-lg"
        style={{
          left: '50%', transform: 'translateX(-50%)', top: 'calc(3vh - 6px)',
          width: 'calc(96vw + 24px)', maxWidth: '900px', bottom: 'calc(3vh + 32px)',
          background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`,
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg"
          style={{
            backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
            background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center gap-2">
            <Shield className="text-white" style={{ width: '15px', height: '15px' }} />
            <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>
              ADMIN PANEL
            </h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-white text-lg font-bold leading-none" data-testid="button-close-admin-panel">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-[160px] border-r border-white/10 flex-shrink-0 py-2 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.15)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                style={{
                  color: '#fff',
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  fontSize: '11px',
                  borderLeft: activeTab === tab.id ? '2px solid rgba(255,255,255,0.7)' : '2px solid transparent',
                }}
                data-testid={`tab-admin-${tab.id}`}
              >
                <tab.icon style={{ width: 13, height: 13 }} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-white">Loading...</div>
            ) : (
              <>
                {activeTab === 'overview' && status && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={labelStyle}>Server Uptime</div>
                        <div className="text-white text-[16px] font-medium">{formatUptime(status.uptime)}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={labelStyle}>Memory Usage</div>
                        <div className="text-white text-[16px] font-medium">{formatBytes(status.memoryUsage.heapUsed)} / {formatBytes(status.memoryUsage.heapTotal)}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={labelStyle}>Login Protection</div>
                        <div className="flex items-center gap-2">
                          {status.sitePasswordSet ? (
                            <><Lock style={{ width: 14, height: 14, color: '#4ade80' }} /><span className="text-[#4ade80] text-[13px]">Active</span></>
                          ) : (
                            <><Unlock style={{ width: 14, height: 14, color: '#f87171' }} /><span className="text-[#f87171] text-[13px]">Not Set</span></>
                          )}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={labelStyle}>Cloudflare Tunnel</div>
                        <div className="flex items-center gap-2">
                          <Wifi style={{ width: 14, height: 14, color: '#4ade80' }} />
                          <span className="text-white text-[13px]">{status.tunnel.domain}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={labelStyle}>System Info</div>
                      <div className="text-white text-[11px] space-y-1 mt-1">
                        <div>Node: {status.nodeVersion} &nbsp;|&nbsp; PID: {status.pid}</div>
                        <div>RSS: {formatBytes(status.memoryUsage.rss)}</div>
                        <div>Active Sessions: {status.sessions.length}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', height: '28px' }} data-testid="button-refresh-admin">
                        <RefreshCw style={{ width: 12, height: 12, marginRight: 4 }} /> Refresh
                      </Button>
                      <Button size="sm" onClick={handleRestart} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: '11px', height: '28px' }} data-testid="button-restart-server">
                        <Power style={{ width: 12, height: 12, marginRight: 4 }} /> Restart Server
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-[11px]">{users.length} user(s)</span>
                      <Button size="sm" onClick={() => setShowAddUser(!showAddUser)} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '11px', height: '28px' }} data-testid="button-add-user">
                        <UserPlus style={{ width: 12, height: 12, marginRight: 4 }} /> Add User
                      </Button>
                    </div>

                    {showAddUser && (
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(74,222,128,0.2)' }}>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <div style={labelStyle}>Username / Email</div>
                            <input style={inputStyle} className="w-full" value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} placeholder="user@example.com" data-testid="input-new-username" />
                          </div>
                          <div>
                            <div style={labelStyle}>Display Name</div>
                            <input style={inputStyle} className="w-full" value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} placeholder="Name" data-testid="input-new-display-name" />
                          </div>
                          <div>
                            <div style={labelStyle}>Access Level</div>
                            <select style={{ ...inputStyle, width: '100%' }} value={newUser.authLevel} onChange={e => setNewUser(p => ({ ...p, authLevel: e.target.value }))} data-testid="select-new-auth-level">
                              <option value="5747">Admin (5747)</option>
                              <option value="4201">Partner (4201)</option>
                              <option value="1010">Guest (1010)</option>
                            </select>
                          </div>
                          <div>
                            <div style={labelStyle}>Initial Password (optional)</div>
                            <input style={inputStyle} className="w-full" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Leave blank for code login" data-testid="input-new-password" />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" onClick={() => setShowAddUser(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', height: '26px' }}>Cancel</Button>
                          <Button size="sm" onClick={handleAddUser} style={{ background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', fontSize: '10px', height: '26px' }} data-testid="button-confirm-add-user">
                            <Plus style={{ width: 11, height: 11, marginRight: 3 }} /> Create
                          </Button>
                        </div>
                      </div>
                    )}

                    {users.map(user => (
                      <div
                        key={user.id}
                        style={{
                          background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px',
                          border: `1px solid ${user.enabled ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.2)'}`,
                          opacity: user.enabled ? 1 : 0.6,
                        }}
                        data-testid={`user-row-${user.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: LEVEL_COLORS[user.auth_level] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#000' }}>
                              {user.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-white text-[12px] font-medium">{user.display_name}</div>
                              <div className="text-white text-[10px]">{user.username}</div>
                            </div>
                            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: `${LEVEL_COLORS[user.auth_level] || '#888'}22`, color: LEVEL_COLORS[user.auth_level] || '#888', border: `1px solid ${LEVEL_COLORS[user.auth_level] || '#888'}44` }}>
                              {LEVEL_NAMES[user.auth_level] || user.auth_level}
                            </span>
                            {user.must_change_password && (
                              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                Must set password
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setSettingPasswordForUser(settingPasswordForUser === user.id ? null : user.id); setUserPasswordInput(''); }} className="p-1.5 rounded hover:bg-white/10" title="Set Password" data-testid={`button-set-password-${user.id}`}>
                              <Key style={{ width: 13, height: 13, color: settingPasswordForUser === user.id ? '#fbbf24' : 'rgba(255,255,255,0.5)' }} />
                            </button>
                            <button onClick={() => handleToggleUser(user)} className="p-1.5 rounded hover:bg-white/10" title={user.enabled ? 'Disable' : 'Enable'} data-testid={`button-toggle-user-${user.id}`}>
                              {user.enabled ? <Eye style={{ width: 13, height: 13, color: '#fff' }} /> : <EyeOff style={{ width: 13, height: 13, color: '#f87171' }} />}
                            </button>
                            {user.auth_level !== '5747' && (
                              <button onClick={() => handleDeleteUser(user)} className="p-1.5 rounded hover:bg-white/10" title="Delete" data-testid={`button-delete-user-${user.id}`}>
                                <Trash2 style={{ width: 13, height: 13, color: '#fff' }} />
                              </button>
                            )}
                          </div>
                        </div>
                        {settingPasswordForUser === user.id && (
                          <div className="flex items-center gap-2 mt-2" style={{ background: 'rgba(251,191,36,0.08)', borderRadius: '6px', padding: '8px 10px', border: '1px solid rgba(251,191,36,0.2)' }}>
                            <Key style={{ width: 12, height: 12, color: '#fbbf24', flexShrink: 0 }} />
                            <input
                              type="password"
                              placeholder="New password (min 4 chars)"
                              value={userPasswordInput}
                              onChange={e => setUserPasswordInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSetUserPassword(user.id); }}
                              style={{ ...inputStyle, flex: 1, border: '1px solid rgba(251,191,36,0.3)' }}
                              autoFocus
                              data-testid={`input-password-${user.id}`}
                            />
                            <Button size="sm" onClick={() => handleSetUserPassword(user.id)} style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24', fontSize: '10px', height: '26px', padding: '0 10px' }} data-testid={`button-save-password-${user.id}`}>
                              Save
                            </Button>
                            <Button size="sm" onClick={() => { setSettingPasswordForUser(null); setUserPasswordInput(''); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', height: '26px', padding: '0 8px' }}>
                              Cancel
                            </Button>
                          </div>
                        )}
                        <div className="text-white text-[9px] mt-1.5">
                          Created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                          {user.last_login && <> &nbsp;|&nbsp; Last login: {new Date(user.last_login).toLocaleDateString()}</>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'profiles' && (
                  <div className="space-y-3">
                    <div className="text-white text-[10px] mb-2">
                      Control what each access level can see and do. Click toggles, then press Save. Changes take effect on next page load.
                    </div>
                    {profiles.map(profile => {
                      const isExpanded = expandedProfile === profile.id;
                      const dirty = hasProfileChanges(profile);
                      const enabledVal = getProfileValue(profile, 'enabled');
                      return (
                        <div
                          key={profile.id}
                          style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', border: `1px solid ${dirty ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.08)'}`, overflow: 'hidden' }}
                          data-testid={`profile-row-${profile.profile_level}`}
                        >
                          <button
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5"
                            onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                          >
                            <div className="flex items-center gap-2">
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: LEVEL_COLORS[profile.profile_level] || '#888' }} />
                              <span className="text-white text-[12px] font-medium">{profile.profile_name}</span>
                              <span className="text-white text-[10px]">({profile.profile_level})</span>
                              {dirty && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }}>Unsaved</span>}
                            </div>
                            {isExpanded ? <ChevronDown style={{ width: 13, height: 13, color: '#fff' }} /> : <ChevronRight style={{ width: 13, height: 13, color: '#fff' }} />}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-white/5">
                              <div className="mt-2 mb-1" style={{ ...labelStyle, fontSize: '9px' }}>Visible Features</div>
                              <div className="grid grid-cols-2 gap-1">
                                {visibilityToggles.map(toggle => {
                                  const val = getProfileValue(profile, toggle.field);
                                  return (
                                    <button
                                      key={toggle.field}
                                      onClick={() => setProfileDraft(profile, toggle.field, !val)}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left"
                                      style={{
                                        background: val ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${val ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                      }}
                                      data-testid={`toggle-${profile.profile_level}-${toggle.field}`}
                                    >
                                      <div style={{ width: 14, height: 14, borderRadius: '3px', border: `1.5px solid ${val ? '#4ade80' : '#fff'}`, background: val ? '#4ade80' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {val && <span style={{ color: '#000', fontSize: '9px', fontWeight: 700 }}>✓</span>}
                                      </div>
                                      <span style={{ color: '#fff', fontSize: '10px' }}>{toggle.label}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-3 mb-1" style={{ ...labelStyle, fontSize: '9px' }}>Permissions</div>
                              <div className="grid grid-cols-2 gap-1">
                                {permissionToggles.map(toggle => {
                                  const val = getProfileValue(profile, toggle.field);
                                  return (
                                    <button
                                      key={toggle.field}
                                      onClick={() => setProfileDraft(profile, toggle.field, !val)}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left"
                                      style={{
                                        background: val ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${val ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                      }}
                                      data-testid={`toggle-${profile.profile_level}-${toggle.field}`}
                                    >
                                      <div style={{ width: 14, height: 14, borderRadius: '3px', border: `1.5px solid ${val ? '#60a5fa' : '#fff'}`, background: val ? '#60a5fa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {val && <span style={{ color: '#000', fontSize: '9px', fontWeight: 700 }}>✓</span>}
                                      </div>
                                      <span style={{ color: '#fff', fontSize: '10px' }}>{toggle.label}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <button
                                  onClick={() => setProfileDraft(profile, 'enabled', !enabledVal)}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
                                  style={{
                                    background: enabledVal ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
                                    border: `1px solid ${enabledVal ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.2)'}`,
                                    color: enabledVal ? '#f87171' : '#4ade80',
                                  }}
                                  data-testid={`toggle-profile-enabled-${profile.profile_level}`}
                                >
                                  {enabledVal ? <><EyeOff style={{ width: 11, height: 11 }} /> Disable Profile</> : <><Eye style={{ width: 11, height: 11 }} /> Enable Profile</>}
                                </button>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => cancelProfileDraft(profile)}
                                    disabled={!dirty}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', height: '26px', padding: '0 10px', opacity: dirty ? 1 : 0.4 }}
                                    data-testid={`button-cancel-profile-${profile.profile_level}`}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveProfileDraft(profile)}
                                    disabled={!dirty}
                                    style={{ background: dirty ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', fontSize: '10px', height: '26px', padding: '0 10px', opacity: dirty ? 1 : 0.4 }}
                                    data-testid={`button-save-profile-${profile.profile_level}`}
                                  >
                                    <Save style={{ width: 11, height: 11, marginRight: 3 }} /> Save
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'passwords' && status && (
                  <div className="space-y-4">
                    <div className="text-white text-[10px] mb-2">
                      These are the numeric access codes for the login screen. Changes are written to .env — restart required.
                    </div>
                    {[
                      { key: 'admin' as const, label: 'Admin (Bryn)', level: '5747', current: status.passwords.admin },
                      { key: 'partner' as const, label: 'Partner', level: '4201', current: status.passwords.partner },
                      { key: 'guest' as const, label: 'Guest', level: '1010', current: status.passwords.guest },
                    ].map(pw => (
                      <div key={pw.key} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-white text-[12px] font-medium">{pw.label}</span>
                            <span className="text-white text-[10px] ml-2">Level: {pw.level}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white text-[10px]">Current:</span>
                            <button onClick={() => setShowPasswords(p => ({ ...p, [pw.key]: !p[pw.key] }))} className="flex items-center gap-1 text-[10px]" style={{ color: '#fff' }}>
                              {showPasswords[pw.key] ? <><EyeOff style={{ width: 11, height: 11 }} /> {pw.current}</> : <><Eye style={{ width: 11, height: 11 }} /> ••••</>}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            type="text"
                            placeholder="New code..."
                            value={editingPassword[pw.key]}
                            onChange={e => setEditingPassword(p => ({ ...p, [pw.key]: e.target.value }))}
                            data-testid={`input-password-${pw.key}`}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdatePasswords} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '11px', height: '28px' }} data-testid="button-save-passwords">
                        <Save style={{ width: 12, height: 12, marginRight: 4 }} /> Save & Restart Later
                      </Button>
                      <Button size="sm" onClick={() => { handleUpdatePasswords().then(() => handleRestart()); }} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '11px', height: '28px' }} data-testid="button-save-and-restart">
                        <Power style={{ width: 12, height: 12, marginRight: 4 }} /> Save & Restart Now
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === 'sessions' && status && (
                  <div className="space-y-3">
                    <div className="text-white text-[10px] mb-2">
                      Active sessions tracked since last server restart. Sessions older than 24h are auto-cleaned.
                    </div>
                    {status.sessions.length === 0 ? (
                      <div className="text-white text-center py-8">No active sessions tracked yet</div>
                    ) : (
                      status.sessions.map((session, idx) => (
                        <div
                          key={idx}
                          style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)' }}
                          data-testid={`session-row-${idx}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                              <span className="text-white text-[11px]">{session.levelName}</span>
                              <span className="text-white text-[9px]">{session.id}</span>
                            </div>
                            <button onClick={() => handleRevokeSession(session.id)} className="text-[9px] px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }} data-testid={`button-revoke-session-${idx}`}>
                              Revoke
                            </button>
                          </div>
                          <div className="text-white text-[9px] mt-1 space-y-0.5">
                            <div>IP: {session.ip}</div>
                            <div>Device: {session.userAgent.substring(0, 80)}{session.userAgent.length > 80 ? '...' : ''}</div>
                            <div>Login: {timeAgo(session.loginTime)} &nbsp;|&nbsp; Last active: {timeAgo(session.lastActive)}</div>
                          </div>
                        </div>
                      ))
                    )}
                    <Button size="sm" onClick={fetchAll} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', height: '28px' }}>
                      <RefreshCw style={{ width: 12, height: 12, marginRight: 4 }} /> Refresh
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
