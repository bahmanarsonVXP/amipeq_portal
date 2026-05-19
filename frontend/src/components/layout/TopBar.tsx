'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Layers,
  Building2,
  Contact,
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
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/contacts', label: 'Contacts', icon: Contact },
  { href: '/relances', label: 'Relances', icon: Clock },
  { href: '/stats', label: 'Statistiques', icon: BarChart3 },
];

const twentyHref = 'https://twenty-production-7352.up.railway.app';

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
  const [menuOpen, setMenuOpen] = useState(false);

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';
  const userName = user?.email ? user.email.split('@')[0].replace('.', ' ') : 'Utilisateur';

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="flex h-24 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
        <Link
          href="/dashboard"
          className="flex flex-shrink-0 items-center gap-3"
          onClick={closeMenu}
        >
          <img
            src="/logo-amipeq.png"
            alt=""
            className="h-[80px] w-auto object-contain drop-shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight text-gray-900 md:text-2xl">AMIPEQ</span>
        </Link>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
          aria-label="Navigation principale"
        >
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 py-1 pl-1 pr-2 md:flex">
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
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-expanded={menuOpen}
            aria-controls="nav-menu-panel"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Fermer le menu"
            onClick={closeMenu}
          />
          <div
            id="nav-menu-panel"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-gray-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={closeMenu}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Mobile : navigation complète */}
            <div className="flex flex-1 flex-col overflow-hidden md:hidden">
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
                          onClick={closeMenu}
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
              </nav>

              <div className="border-t border-gray-200 p-4 text-right">
                <a
                  href={twentyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 flex items-center justify-end gap-2 rounded-lg px-3 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <span>Twenty CRM</span>
                  <ExternalLink className="h-5 w-5 flex-shrink-0" />
                </a>
                <div className="mb-3 flex items-center justify-end gap-3">
                  <div className="text-right">
                    <p className="truncate text-sm font-semibold capitalize text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-500">Admin</p>
                  </div>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-500">
                    <span className="text-sm font-semibold text-gray-900">{userInitial}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="flex w-full items-center justify-end gap-2 rounded-lg border border-gray-200 py-2.5 pl-3 pr-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Déconnexion
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Desktop : Twenty CRM + déconnexion alignés à droite */}
            <div className="hidden flex-1 flex-col justify-start p-6 md:flex">
              <p className="mb-4 text-right text-xs font-medium uppercase tracking-wide text-gray-400">
                Liens & compte
              </p>
              <div className="flex flex-col items-end gap-3">
                <a
                  href={twentyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <span>Twenty CRM</span>
                  <ExternalLink className="h-5 w-5 flex-shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <span>Déconnexion</span>
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
