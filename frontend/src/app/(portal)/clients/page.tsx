'use client';

import { Header } from '@/components/layout/Header';

export default function ClientsPage() {
  return (
    <div>
      <Header title="Clients" subtitle="Base clients et prospects" action={{ label: 'Nouveau client' }} />
      <div className="p-8">
        <p className="text-gray-500">Liste des clients à venir.</p>
      </div>
    </div>
  );
}
