'use client';

import { Header } from '@/components/layout/Header';

export default function DashboardPage() {
  return (
    <div>
      <Header title="Dashboard" subtitle="Vue d'ensemble de l'activité" />
      <div className="p-8">
        <p className="text-gray-500">Contenu du dashboard à venir.</p>
      </div>
    </div>
  );
}
