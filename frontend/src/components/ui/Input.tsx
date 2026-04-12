import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-2.5 text-sm rounded-lg border transition-all',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-red-300 focus:border-danger-500 focus:ring-danger-500/20'
            : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/20',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
