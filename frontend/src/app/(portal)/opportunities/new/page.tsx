'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useCompanies } from '@/hooks/useCompanies';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Prestation } from '@/types';
import { Search } from 'lucide-react';

const STAGES = [
  { value: 'DEVIS_ENVOYE', label: 'Devis envoyé' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'GAGNE', label: 'Gagné' },
  { value: 'PERDU', label: 'Perdu' },
] as const;

const STATUTS_DEVIS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'GAGNE', label: 'Gagné' },
  { value: 'PERDU', label: 'Perdu' },
] as const;

const PRESTATION_OPTIONS: { value: Prestation; label: string }[] = [
  { value: 'DUERP', label: 'DUERP' },
  { value: 'PPMS', label: 'PPMS' },
  { value: 'RPS', label: 'RPS' },
  { value: 'PSE', label: 'PSE' },
  { value: 'COVID', label: 'COVID' },
  { value: 'RGPD', label: 'RGPD' },
  { value: 'AUTRE', label: 'Autre' },
];

const selectClass =
  'w-full px-4 py-2.5 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500';

export default function NewOpportunityPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [companyQuery, setCompanyQuery] = useState('');
  const debouncedQuery = useDebouncedValue(companyQuery, 300);
  const { data: companiesData, isLoading: companiesLoading } = useCompanies(
    debouncedQuery.trim() || undefined
  );
  const companies = companiesData?.companies ?? [];

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [name, setName] = useState('');
  const [numeroDevis, setNumeroDevis] = useState('');
  const [amountEur, setAmountEur] = useState('');
  const [stage, setStage] = useState<string>('DEVIS_ENVOYE');
  const [dateDevis, setDateDevis] = useState('');
  const [statutDevis, setStatutDevis] = useState<string>('EN_ATTENTE');
  const [prestation, setPrestation] = useState<Prestation[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearDefault = useMemo(() => new Date().getFullYear(), []);

  const togglePrestation = (p: Prestation) => {
    setPrestation((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const selectCompany = (id: string, nm: string) => {
    setCompanyId(id);
    setCompanyName(nm);
    setPickerOpen(false);
    setCompanyQuery('');
    setName((prev) => (prev.trim() ? prev : `Devis ${yearDefault} — ${nm}`));
  };

  // Proposition de titre si vide
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyId) {
      setError('Sélectionnez une société (Twenty).');
      return;
    }
    const title = name.trim() || `Devis ${yearDefault}`;
    const tok = session?.access_token;
    if (!tok) {
      setError('Session expirée. Reconnectez-vous.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        companyId,
        name: title,
        stage,
        statutDevis,
        prestation: prestation.length ? prestation : undefined,
      };
      if (numeroDevis.trim()) payload.numeroDevis = numeroDevis.trim();
      if (amountEur.trim()) {
        const n = parseFloat(amountEur.replace(',', '.'));
        if (!Number.isNaN(n)) payload.amountEur = n;
      }
      if (dateDevis) payload.dateDevis = dateDevis;
      if (dateDevis) {
        const y = new Date(dateDevis).getFullYear();
        if (!Number.isNaN(y)) payload.anneeDevis = y;
      }

      const res = await apiFetch<{ id?: string }>('/api/opportunities', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.id) {
        router.push('/opportunities');
        router.refresh();
      } else {
        router.push('/opportunities');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Header
        title="Nouvelle opportunité"
        subtitle="Création dans Twenty CRM (API REST)"
      />
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <Link
          href="/opportunities"
          className="mb-6 inline-block text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Retour aux opportunités
        </Link>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Société (Twenty) <span className="text-red-500">*</span>
              </label>
              {companyId ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <span className="flex-1 font-medium text-gray-900">{companyName}</span>
                  <button
                    type="button"
                    className="text-sm text-primary-600 hover:underline"
                    onClick={() => {
                      setCompanyId(null);
                      setCompanyName('');
                    }}
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      className="pl-10"
                      placeholder="Rechercher une société…"
                      value={companyQuery}
                      onChange={(e) => {
                        setCompanyQuery(e.target.value);
                        setPickerOpen(true);
                      }}
                      onFocus={() => setPickerOpen(true)}
                      autoComplete="off"
                    />
                  </div>
                  {pickerOpen && (companyQuery.trim() || companiesLoading) && (
                    <ul
                      className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      role="listbox"
                    >
                      {companiesLoading && (
                        <li className="px-4 py-3 text-sm text-gray-500">Chargement…</li>
                      )}
                      {!companiesLoading &&
                        companies.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={cn(
                                'w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50',
                                'focus:bg-gray-50 focus:outline-none'
                              )}
                              onClick={() => selectCompany(c.id, c.name)}
                            >
                              {c.name}
                            </button>
                          </li>
                        ))}
                      {!companiesLoading && companies.length === 0 && companyQuery.trim() && (
                        <li className="px-4 py-3 text-sm text-gray-500">Aucun résultat</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Les sociétés proviennent de Twenty. Affinez la recherche si besoin.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Intitulé de l&apos;opportunité <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Ex. Devis ${yearDefault}-001`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">N° devis</label>
                <Input
                  value={numeroDevis}
                  onChange={(e) => setNumeroDevis(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Montant (€ HT)</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amountEur}
                  onChange={(e) => setAmountEur(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Étape (pipeline)</label>
                <select
                  className={selectClass}
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Statut devis</label>
                <select
                  className={selectClass}
                  value={statutDevis}
                  onChange={(e) => setStatutDevis(e.target.value)}
                >
                  {STATUTS_DEVIS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date du devis</label>
              <Input type="date" value={dateDevis} onChange={(e) => setDateDevis(e.target.value)} />
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-gray-700">Prestations</span>
              <div className="flex flex-wrap gap-2">
                {PRESTATION_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className={cn(
                      'cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors',
                      prestation.includes(p.value)
                        ? 'border-primary-500 bg-primary-50 font-medium text-gray-900'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={prestation.includes(p.value)}
                      onChange={() => togglePrestation(p.value)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Création…' : 'Créer dans Twenty'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/opportunities')}
              >
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
