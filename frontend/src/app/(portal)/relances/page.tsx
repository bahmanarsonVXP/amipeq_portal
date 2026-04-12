'use client';

import { Header } from '@/components/layout/Header';

export default function RelancesPage() {
  return (
    <div>
      <Header title="Relances" subtitle="Suivi des relances commerciales" />
      <div className="p-8">
        <p className="text-gray-500">Relances à venir.</p>
      </div>
    </div>
  );
}
