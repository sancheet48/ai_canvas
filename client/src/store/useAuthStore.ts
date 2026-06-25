import { create } from 'zustand';

export interface User {
  id: number;
  email: string;
  role: 'user' | 'admin';
  verified: boolean;
  plan: 'free' | 'pro' | 'team';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  clearError: () => void;
}

// Client-side JWT decoder
function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  loading: true,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const decoded = parseJwt(data.accessToken);
      const user: User = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        verified: decoded.verified || false,
        plan: decoded.plan || 'free'
      };

      set({ user, accessToken: data.accessToken, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      const decoded = parseJwt(data.accessToken);
      const user: User = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        verified: decoded.verified || false,
        plan: decoded.plan || 'free'
      };

      set({ user, accessToken: data.accessToken, loading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      set({ user: null, accessToken: null, loading: false });
    }
  },

  restoreSession: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh token');
      }

      const decoded = parseJwt(data.accessToken);
      const user: User = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        verified: decoded.verified || false,
        plan: decoded.plan || 'free'
      };

      set({ user, accessToken: data.accessToken, loading: false });
      return true;
    } catch (err) {
      // Clean fail - user is just unauthenticated
      set({ user: null, accessToken: null, loading: false });
      return false;
    }
  }
}));
