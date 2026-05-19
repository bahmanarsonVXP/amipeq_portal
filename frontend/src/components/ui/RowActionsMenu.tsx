'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface RowAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  /** Si true, l'item est affiché en rouge (action destructrice). */
  danger?: boolean;
  /** Si true, l'item est désactivé (non cliquable). */
  disabled?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  /** Libellé d'accessibilité du bouton trigger. */
  ariaLabel?: string;
  className?: string;
}

const MENU_WIDTH_PX = 192;
const MENU_GAP_PX = 4;
const VIEWPORT_PADDING_PX = 8;
const ROW_HEIGHT_PX = 40;

function estimateMenuHeight(actionCount: number) {
  return actionCount * ROW_HEIGHT_PX + 8;
}

export function RowActionsMenu({
  actions,
  ariaLabel = 'Actions',
  className,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? estimateMenuHeight(actions.length);

      let top = rect.bottom + MENU_GAP_PX;
      if (top + menuHeight > window.innerHeight - VIEWPORT_PADDING_PX) {
        top = rect.top - MENU_GAP_PX - menuHeight;
      }
      top = Math.max(
        VIEWPORT_PADDING_PX,
        Math.min(top, window.innerHeight - menuHeight - VIEWPORT_PADDING_PX),
      );

      let left = rect.right - MENU_WIDTH_PX;
      left = Math.max(
        VIEWPORT_PADDING_PX,
        Math.min(left, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_PADDING_PX),
      );

      setMenuPosition({ top, left });
    }

    updatePosition();

    const menuEl = menuRef.current;
    const resizeObserver =
      menuEl && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updatePosition)
        : null;
    resizeObserver?.observe(menuEl!);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const menu =
    open && menuPosition ? (
      <div
        ref={menuRef}
        role="menu"
        style={{
          position: 'fixed',
          top: menuPosition.top,
          left: menuPosition.left,
          width: MENU_WIDTH_PX,
        }}
        className="z-[200] origin-top-right overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg ring-1 ring-black/5"
      >
        {actions.map((action, idx) => (
          <button
            key={`${action.label}-${idx}`}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (action.disabled) return;
              setOpen(false);
              action.onClick();
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-sm transition',
              action.disabled && 'cursor-not-allowed opacity-40',
              !action.disabled && action.danger && 'text-red-600 hover:bg-red-50',
              !action.disabled && !action.danger && 'text-gray-700 hover:bg-gray-50',
            )}
          >
            {action.icon && <span className="flex-shrink-0">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block text-left', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="3" r="1.4" fill="currentColor" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" />
          <circle cx="8" cy="13" r="1.4" fill="currentColor" />
        </svg>
      </button>

      {mounted && menu && createPortal(menu, document.body)}
    </div>
  );
}
