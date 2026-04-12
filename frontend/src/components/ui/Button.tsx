import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          size === 'sm' && 'px-3 py-1.5 text-xs',
          size === 'md' && 'px-4 py-2.5 text-sm',
          size === 'lg' && 'px-6 py-3 text-base',

          variant === 'primary' && 'bg-primary-500 text-gray-900 hover:bg-primary-600 focus:ring-primary-500',
          variant === 'secondary' && 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 focus:ring-gray-300',
          variant === 'ghost' && 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-300',
          variant === 'danger' && 'bg-white text-danger-500 border border-danger-500 hover:bg-danger-50 focus:ring-danger-500',
          variant === 'success' && 'bg-success-50 text-success-500 hover:bg-success-100 focus:ring-success-500',

          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
