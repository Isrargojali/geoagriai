import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, UserDto } from '@geoagri/shared';
import { api, getTokens, setTokens } from './api';

interface AuthContextValue {
  user: UserDto | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserDto>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'geoagri.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserDto;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((next: UserDto | null) => {
    setUser(next);
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next));
    else localStorage.removeItem(USER_KEY);
  }, []);

  // Validate the stored session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getTokens()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api<UserDto>('/users/me');
        if (!cancelled) persistUser(me);
      } catch {
        if (!cancelled) {
          setTokens(null);
          persistUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistUser]);

  // Global logout when a refresh fails mid-session.
  useEffect(() => {
    const handler = () => persistUser(null);
    window.addEventListener('geoagri:logout', handler);
    return () => window.removeEventListener('geoagri:logout', handler);
  }, [persistUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api<AuthResponse>('/auth/login', { body: { email: email.trim(), password } });
      setTokens(result.tokens);
      persistUser(result.user);
      return result.user;
    },
    [persistUser],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }) => {
      const result = await api<AuthResponse>('/auth/register', { body: input });
      setTokens(result.tokens);
      persistUser(result.user);
    },
    [persistUser],
  );

  const logout = useCallback(() => {
    const tokens = getTokens();
    if (tokens?.refreshToken) {
      // Best-effort server-side revocation.
      void api('/auth/logout', { body: { refreshToken: tokens.refreshToken } }).catch(() => undefined);
    }
    setTokens(null);
    persistUser(null);
  }, [persistUser]);

  const refreshUser = useCallback(async () => {
    const me = await api<UserDto>('/users/me');
    persistUser(me);
  }, [persistUser]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
