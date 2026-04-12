'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Layers,
  Users,
  Clock,
  BarChart3,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunités', icon: Layers },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/relances', label: 'Relances', icon: Clock },
  { href: '/stats', label: 'Statistiques', icon: BarChart3 },
];

const twentyHref = 'https://twenty-production-0500.up.railway.app';

function NavLink({
  href,
  label,
  icon: Icon,
  onNavigate,
  className,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
        isActive
          ? 'bg-primary-500 text-gray-900'
          : 'text-gray-600 hover:bg-gray-50',
        className
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const userName = user?.email ? user.email.split('@')[0].replace('.', ' ') : 'Utilisateur';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
        <Link href="/dashboard" className="flex flex-shrink-0 items-center" onClick={closeMobile}>
          <img
            src="/logo-amipeq.png"
            alt="AMIPEQ"
            className="h-9 w-auto object-contain drop-shadow-sm"
          />
        </Link>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
          aria-label="Navigation principale"
        >
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <a
            href={twentyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-all hover:bg-gray-50"
          >
            <ExternalLink className="h-5 w-5 flex-shrink-0" />
            <span>Twenty CRM</span>
          </a>
        </nav>

        <div className="hidden flex-shrink-0 items-center gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 py-1 pl-1 pr-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-500">
              <span className="text-sm font-semibold text-gray-900">{userInitial}</span>
            </div>
            <div className="min-w-0 max-w-[140px]">
              <p className="truncate text-sm font-semibold capitalize text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
            title="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        <div className="ml-auto flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Fermer le menu"
            onClick={closeMobile}
          />
          <div
            id="mobile-nav-panel"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={closeMobile}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3" aria-label="Navigation principale">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={closeMobile}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-primary-500 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="my-4 border-t border-gray-200" />
              <a
                href={twentyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <ExternalLink className="h-5 w-5 flex-shrink-0" />
                <span>Twenty CRM</span>
              </a>
            </nav>
            <div className="border-t border-gray-200 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-500">
                  <span className="text-sm font-semibold text-gray-900">{userInitial}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold capitalize text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500">Admin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  logout();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
