import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border border-gray-200',
      padding === 'sm'  && 'p-4',
      padding === 'md'  && 'p-5',
      padding === 'lg'  && 'p-6',
      padding === 'none' && '',
      className
    )}>
      {children}
    </div>
  );
}
