'use client';

import { TopBar } from '@/components/layout/TopBar';
import { useAuth } from '@/hooks/useAuth';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // If useAuth redirects unauthenticated users, checking here avoids a flash of content
  if (!session) return null;

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <div className="sticky top-0 z-30 shrink-0">
        <TopBar />
      </div>
      <main className="flex-1">{children}</main>
    </div>
  );
}
