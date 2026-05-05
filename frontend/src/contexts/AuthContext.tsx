'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { setGatewayTokenFromSession } from '@/lib/gatewayToken';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function getSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setGatewayTokenFromSession(session);
          setLoading(false);

          if (!session && !pathname.startsWith('/login')) {
            router.push('/login');
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
        if (mounted) {
          setLoading(false);
          if (!pathname.startsWith('/login')) {
            router.push('/login');
          }
        }
      }
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setGatewayTokenFromSession(session);
        setLoading(false);

        if (!session && !pathname.startsWith('/login')) {
          router.replace('/login');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  const logout = useCallback(async () => {
    setGatewayTokenFromSession(null);
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, session, loading, logout }),
    [user, session, loading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return ctx;
}
