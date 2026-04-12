'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Layers, Users, Clock, BarChart3, ExternalLink, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunités', icon: Layers },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/relances', label: 'Relances', icon: Clock },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const userName = user?.email ? user.email.split('@')[0].replace('.', ' ') : 'Utilisateur';

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200 flex justify-center py-6">
        <Link href="/dashboard" className="inline-block">
          <img
            src="/logo-amipeq.png"
            alt="AMIPEQ Logo"
            className="w-[100px] h-auto object-contain drop-shadow-sm"
          />
        </Link>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                    isActive
                      ? 'bg-primary-500 text-gray-900 font-semibold'
                      : 'text-gray-600 font-medium hover:bg-gray-50'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-gray-200 my-4" />

        <Link
          href="/stats"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
            pathname === '/stats'
              ? 'bg-primary-500 text-gray-900 font-semibold'
              : 'text-gray-600 font-medium hover:bg-gray-50'
          )}
        >
          <BarChart3 className="w-5 h-5 flex-shrink-0" />
          <span>Statistiques</span>
        </Link>

        <div className="border-t border-gray-200 my-4" />

        <a
          href="https://twenty-production-0500.up.railway.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 font-medium hover:bg-gray-50 transition-all"
        >
          <ExternalLink className="w-5 h-5 flex-shrink-0" />
          <span>Twenty CRM</span>
        </a>
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-gray-900">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate capitalize">{userName}</p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all focus:outline-none focus:ring-2 focus:ring-gray-300"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
