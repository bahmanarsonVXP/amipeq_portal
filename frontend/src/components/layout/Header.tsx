import { Button } from '@/components/ui/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick?: () => void };
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <Button variant="primary" onClick={action.onClick}>
            + {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
