'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetchWithSession } from '@/lib/api';
import { apiUploadWithSession, downloadQuoteDocument } from '@/lib/apiUpload';
import {
  PRESTATION_LABELS,
  PRESTATION_OPTIONS,
  quoteStatutSelectOptions,
} from '@/lib/devisConstants';
import {
  calcMontantNet,
  isDocStatutFrozen,
  quoteCommercialLabel,
  quoteStatutLabel,
  REMISE_PRESETS,
} from '@/lib/portailBundle';
import type {
  PortailBundle,
  PortailQuote,
  PortailQuoteCommercialStatus,
  PortailQuoteDocStatus,
} from '@/types';

export type DevisLayerMode = 'create' | 'edit';

interface Props {
  opportunityId: string;
  companyName?: string | null;
  mode: DevisLayerMode;
  quoteId: string | null;
  bundle: PortailBundle;
  stage: string;
  terminalOpp: boolean;
  onClose: () => void;
  onSaved: (bundle: PortailBundle, stage: string) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function DevisLayer({
  opportunityId,
  companyName,
  mode,
  quoteId: initialQuoteId,
  bundle,
  stage,
  terminalOpp,
  onClose,
  onSaved,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [quoteId, setQuoteId] = useState<string | null>(initialQuoteId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const sourceQuote =
    quoteId != null ? bundle.quotes.find((q) => q.id === quoteId) ?? null : null;

  const pilotEff =
    bundle.pilotageId ?? (bundle.quotes.length === 1 ? bundle.quotes[0]!.id : null);
  const isPilot = quoteId != null && pilotEff === quoteId;

  const [label, setLabel] = useState(sourceQuote?.label ?? 'Devis');
  const [statut, setStatut] = useState<PortailQuoteDocStatus>(
    sourceQuote?.statut ?? 'Q_DRAFT_NEW',
  );
  const [statutCommercial, setStatutCommercial] = useState<PortailQuoteCommercialStatus>(
    sourceQuote?.statutCommercial ?? 'EN_ATTENTE',
  );
  const [wantsPilot, setWantsPilot] = useState(isPilot);
  const [brut, setBrut] = useState(
    sourceQuote?.montantBrutEur != null ? String(sourceQuote.montantBrutEur) : '',
  );
  const [taux, setTaux] = useState(
    sourceQuote?.tauxRemise != null ? String(sourceQuote.tauxRemise) : '',
  );
  const [remiseTexte, setRemiseTexte] = useState(sourceQuote?.remiseTexte ?? '');
  const [prestations, setPrestations] = useState<string[]>(sourceQuote?.prestations ?? []);

  const frozen = sourceQuote ? isDocStatutFrozen(sourceQuote, bundle) : false;
  const inferredSent = sourceQuote?.statut === 'Q_SENT' && !frozen;
  const canEditDocStatut = !frozen && !terminalOpp;
  const canEditCommercial = frozen && !terminalOpp;
  const numero = sourceQuote?.numero ?? (mode === 'create' ? 'Nouveau' : '…');
  const showForm = mode === 'create' || quoteId != null;

  const netPreview =
    brut !== '' && taux !== '' && !Number.isNaN(Number(brut)) && !Number.isNaN(Number(taux))
      ? calcMontantNet(Number(brut), Number(taux))
      : sourceQuote?.montantNetEur ?? null;

  useEffect(() => {
    const q = quoteId ? bundle.quotes.find((x) => x.id === quoteId) : null;
    if (!q) return;
    setLabel(q.label);
    setStatut(q.statut);
    setStatutCommercial(q.statutCommercial);
    setWantsPilot(bundle.pilotageId === q.id);
    setBrut(q.montantBrutEur != null ? String(q.montantBrutEur) : '');
    setTaux(q.tauxRemise != null ? String(q.tauxRemise) : '');
    setRemiseTexte(q.remiseTexte ?? '');
    setPrestations(q.prestations);
    setPendingFile(null);
  }, [quoteId, bundle]);

  async function handleEnregistrer() {
    setBusy(true);
    setError(null);
    try {
      const montantBrutEur = brut === '' ? null : Number(brut);
      const tauxRemise = taux === '' ? null : Number(taux);
      if (montantBrutEur != null && Number.isNaN(montantBrutEur)) throw new Error('Montant brut invalide');
      if (tauxRemise != null && Number.isNaN(tauxRemise)) throw new Error('Remise % invalide');

      let activeQuoteId = quoteId;
      let bundleForPatch = bundle;
      if (!activeQuoteId) {
        const created = await apiFetchWithSession<{
          bundle: PortailBundle;
          stage: string;
          newQuoteId: string;
        }>(`/api/opportunities/${opportunityId}/portail-bundle/quotes`, {
          method: 'POST',
          body: JSON.stringify({ label: label.trim() || 'Devis' }),
        });
        activeQuoteId = created.newQuoteId;
        bundleForPatch = created.bundle;
        setQuoteId(activeQuoteId);
      }

      const patchBody: Record<string, unknown> = {
        label: label.trim() || 'Devis',
        montantBrutEur,
        tauxRemise,
        remiseTexte: remiseTexte.trim() || null,
        prestations,
      };
      const qBeforePatch =
        bundleForPatch.quotes.find((x) => x.id === activeQuoteId) ??
        null;
      const quoteFrozen = qBeforePatch ? isDocStatutFrozen(qBeforePatch, bundleForPatch) : false;
      if (!quoteFrozen) patchBody.statut = statut;

      let res = await apiFetchWithSession<{ bundle: PortailBundle; stage: string }>(
        `/api/opportunities/${opportunityId}/portail-bundle/quotes/${activeQuoteId}`,
        { method: 'PATCH', body: JSON.stringify(patchBody) },
      );

      if (wantsPilot && res.bundle.pilotageId !== activeQuoteId) {
        res = await apiFetchWithSession<{ bundle: PortailBundle; stage: string }>(
          `/api/opportunities/${opportunityId}/portail-bundle/pilotage`,
          { method: 'PATCH', body: JSON.stringify({ quoteId: activeQuoteId }) },
        );
      }

      if (pendingFile) {
        const fd = new FormData();
        fd.append('file', pendingFile);
        res = await apiUploadWithSession<{ bundle: PortailBundle; stage: string }>(
          `/api/opportunities/${opportunityId}/portail-bundle/quotes/${activeQuoteId}/document`,
          fd,
          'PUT',
        );
      }

      if (
        canEditCommercial &&
        activeQuoteId &&
        statutCommercial === 'GAGNE' &&
        res.bundle.quotes.find((x) => x.id === activeQuoteId)?.statutCommercial !== 'GAGNE'
      ) {
        res = await apiFetchWithSession<{ bundle: PortailBundle; stage: string }>(
          `/api/opportunities/${opportunityId}/portail-bundle/mark-won`,
          { method: 'POST', body: JSON.stringify({ quoteId: activeQuoteId }) },
        );
      }

      onSaved(res.bundle, res.stage);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Enregistrement impossible'));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkSent() {
    if (!quoteId || !isPilot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetchWithSession<{ bundle: PortailBundle; stage: string }>(
        `/api/opportunities/${opportunityId}/portail-bundle/mark-sent`,
        { method: 'POST', body: JSON.stringify({ quoteId }) },
      );
      onSaved(res.bundle, res.stage);
      setStatut('Q_SENT');
    } catch (e) {
      setError(getErrorMessage(e, 'Marquage envoyé impossible'));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkWon() {
    if (!quoteId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetchWithSession<{ bundle: PortailBundle; stage: string }>(
        `/api/opportunities/${opportunityId}/portail-bundle/mark-won`,
        { method: 'POST', body: JSON.stringify({ quoteId }) },
      );
      onSaved(res.bundle, res.stage);
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, 'Passage en gagné impossible'));
    } finally {
      setBusy(false);
    }
  }

  const presetTaux = REMISE_PRESETS.includes(Number(taux) as (typeof REMISE_PRESETS)[number]);

  return (
    <>
      <div
        className="fixed inset-0 z-[64] bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 z-[65] flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="devis-layer-title"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <DevisLayerHeader companyName={companyName} numero={numero} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              title={wantsPilot ? 'Devis pilotage' : 'Définir comme pilotage'}
              disabled={busy || terminalOpp}
              onClick={() => setWantsPilot((v) => !v)}
              className={`rounded-lg p-2 transition ${
                wantsPilot ? 'bg-primary-100 text-primary-600' : 'text-gray-300 hover:bg-gray-100'
              }`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={wantsPilot ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {showForm && (
            <>
              {canEditDocStatut && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                    Statut documentaire
                  </span>
                  <select
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                    value={statut}
                    disabled={busy}
                    onChange={(e) => setStatut(e.target.value as PortailQuoteDocStatus)}
                  >
                    {quoteStatutSelectOptions(statut, inferredSent).map((s) => (
                      <option key={s} value={s}>
                        {quoteStatutLabel(s)}
                      </option>
                    ))}
                  </select>
                  {inferredSent && (
                    <p className="mt-1 text-xs text-gray-500">
                      Devis importé comme « envoyé » — vous pouvez le repasser en préparation avant envoi
                      client.
                    </p>
                  )}
                </label>
              )}

              {!canEditDocStatut && sourceQuote && (
                <p className="text-sm text-gray-600">
                  Statut documentaire :{' '}
                  <span className="font-medium">{quoteStatutLabel(sourceQuote.statut)}</span>
                  {frozen && (
                    <span className="ml-1 text-xs text-gray-400">(figé après envoi client)</span>
                  )}
                </p>
              )}

              {canEditCommercial && (
                <label className="block text-sm">
                  <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                    Résultat commercial
                  </span>
                  <select
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                    value={statutCommercial}
                    disabled={busy}
                    onChange={(e) =>
                      setStatutCommercial(e.target.value as PortailQuoteCommercialStatus)
                    }
                  >
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="GAGNE">Gagné (retenir ce devis)</option>
                  </select>
                </label>
              )}

              {!canEditCommercial && !canEditDocStatut && sourceQuote && (
                <p className="text-sm text-gray-600">
                  Résultat commercial :{' '}
                  <span className="font-medium">{quoteCommercialLabel(sourceQuote.statutCommercial)}</span>
                </p>
              )}

              <label className="block text-sm">
                <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                  Libellé
                </span>
                <Input value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                    Montant brut (€)
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={brut}
                    disabled={busy}
                    onChange={(e) => setBrut(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                    Remise %
                  </span>
                  <div className="flex gap-1">
                    <select
                      className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm"
                      value={presetTaux ? taux : 'custom'}
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') setTaux(e.target.value);
                      }}
                    >
                      {REMISE_PRESETS.map((p) => (
                        <option key={p} value={String(p)}>
                          {p} %
                        </option>
                      ))}
                      <option value="custom">Autre…</option>
                    </select>
                    <Input
                      className="w-20"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={taux}
                      disabled={busy}
                      onChange={(e) => setTaux(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <p className="text-sm">
                Prix remisé :{' '}
                <span className="font-semibold text-gray-900">
                  {netPreview != null ? `${netPreview.toLocaleString('fr-FR')} €` : '—'}
                </span>
                <span className="ml-2 text-xs text-gray-400">(calculé)</span>
              </p>

              <label className="block text-sm">
                <span className="mb-1 block text-[11px] font-semibold uppercase text-gray-400">
                  Note remise (interne)
                </span>
                <textarea
                  className="min-h-[4rem] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={remiseTexte}
                  disabled={busy}
                  placeholder="Optionnel — non visible client"
                  onChange={(e) => setRemiseTexte(e.target.value)}
                />
              </label>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase text-gray-400">Prestations</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESTATION_OPTIONS.map((code) => {
                    const on = prestations.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setPrestations((prev) =>
                            on ? prev.filter((p) => p !== code) : [...prev, code],
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          on
                            ? 'border-primary-300 bg-primary-50 text-primary-800'
                            : 'border-gray-200 bg-white text-gray-500'
                        }`}
                      >
                        {PRESTATION_LABELS[code] ?? code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase text-gray-400">Document Word</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPendingFile(f);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {pendingFile || sourceQuote?.documentKey ? 'Remplacer .docx' : 'Importer .docx'}
                  </Button>
                  {sourceQuote?.documentKey && !pendingFile && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (!quoteId) return;
                        void downloadQuoteDocument(
                          opportunityId,
                          quoteId,
                          sourceQuote.documentFileName ?? `devis-${numero}.docx`,
                        ).catch((e) => setError(getErrorMessage(e, 'Téléchargement impossible')));
                      }}
                    >
                      Télécharger
                    </Button>
                  )}
                </div>
                {(pendingFile?.name ?? sourceQuote?.documentFileName) && (
                  <p className="mt-2 text-xs text-gray-500">
                    {pendingFile ? `À enregistrer : ${pendingFile.name}` : sourceQuote?.documentFileName}
                  </p>
                )}
              </div>

              {!terminalOpp && quoteId && (
                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  {isPilot && statut === 'Q_READY_TO_SEND' && (
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void handleMarkSent()}>
                      Marquer envoyé
                    </Button>
                  )}
                  {(frozen || sourceQuote?.statutCommercial === 'EN_ATTENTE') && (
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void handleMarkWon()}>
                      Retenir (gagné)
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
          <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            disabled={busy}
            onClick={() => void handleEnregistrer()}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </aside>
    </>
  );
}

function DevisLayerHeader({
  companyName,
  numero,
}: {
  companyName?: string | null;
  numero: string;
}) {
  return (
    <div>
      {companyName && <p className="text-xs text-gray-400">{companyName}</p>}
      <h2 id="devis-layer-title" className="text-lg font-bold text-gray-900">
        Devis : <span className="font-mono text-base">{numero}</span>
      </h2>
    </div>
  );
}
