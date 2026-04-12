'use client';

import { Header } from '@/components/layout/Header';

export default function OpportunitiesPage() {
  return (
    <div>
      <Header title="Opportunités" subtitle="Gestion des devis" action={{ label: 'Nouveau devis' }} />
      <div className="p-8">
        <p className="text-gray-500">Liste des opportunités à venir.</p>
      </div>
    </div>
  );
}
