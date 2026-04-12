import { useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    async function getSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          
          if (!session && !pathname.startsWith('/login')) {
            router.replace('/login');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return { user, session, loading, logout };
}
