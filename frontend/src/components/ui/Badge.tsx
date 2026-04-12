import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  success: 'bg-success-50 text-success-500',
  warning: 'bg-warning-50 text-warning-500',
  danger:  'bg-danger-50 text-danger-500',
  neutral: 'bg-gray-100 text-gray-600',
  info:    'bg-blue-50 text-blue-600',
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', styles[variant], className)}>
      {children}
    </span>
  );
}

export function getStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    GAGNE: 'success', CLIENT_ACTIF: 'success',
    EN_ATTENTE: 'warning', PROSPECT: 'warning',
    REFUSE: 'danger', PERDU: 'danger', EN_RETARD: 'danger',
    CLIENT_INACTIF: 'neutral',
  };
  return map[status] ?? 'neutral';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    GAGNE: 'Gagné', REFUSE: 'Refusé', EN_ATTENTE: 'En attente',
    CLIENT_ACTIF: 'Actif', CLIENT_INACTIF: 'Inactif',
    PROSPECT: 'Prospect', PERDU: 'Perdu', EN_RETARD: 'En retard',
    AUJOURD_HUI: "Aujourd'hui", A_VENIR: 'À venir',
  };
  return map[status] ?? status;
}
