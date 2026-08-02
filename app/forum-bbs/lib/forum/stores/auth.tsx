'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ForumUser } from '../types';
import { getCurrentUser, logout as apiLogout } from '../api/client';

interface AuthContextValue {
  user: ForumUser | null;
  loading: boolean;
  setUser: (u: ForumUser | null) => void;
  setToken: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function ForumAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ForumUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((token: string) => {
    localStorage.setItem('forum-auth-token', token);
  }, []);

  const logout = useCallback(async () => {
    // 乐观退出：先同步清本地登录态、立即更新 UI，再异步吊销服务端会话。
    // 顺序不能反——此前先 await 接口再清状态，接口挂掉/变慢时 UI 会一直停留在已登录状态
    const token = localStorage.getItem('forum-auth-token');
    localStorage.removeItem('forum-auth-token');
    setUser(null);
    if (token) {
      try { await apiLogout(token); } catch {}
    }
  }, []);

  // On mount: use token to fetch user data from API
  useEffect(() => {
    const token = localStorage.getItem('forum-auth-token');
    if (!token) {
      setLoading(false);
      return;
    }
    getCurrentUser()
      .then((u) => setUser(u))
      .catch((err: unknown) => {
        // Only clear token on 401 (expired/invalid), never on code crash
        const is401 = err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401;
        if (is401) {
          localStorage.removeItem('forum-auth-token');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useForumAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useForumAuth must be used within ForumAuthProvider');
  return ctx;
}
