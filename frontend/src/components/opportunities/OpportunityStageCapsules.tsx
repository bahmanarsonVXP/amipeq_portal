'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import {
  mapLegacyStageToOpp,
  OPPORTUNITY_STAGE_SELECT_OPTIONS,
  OPPORTUNITY_STAGES,
} from '@/lib/opportunityStages';

interface Props {
  currentStage: string;
  updatingStage: string | null;
  errorMessage: string | null;
  onSelectStage: (stage: string) => boolean | Promise<boolean>;
}

function isTerminalStage(stage: string): boolean {
  return stage === OPPORTUNITY_STAGES.WON || stage === OPPORTUNITY_STAGES.LOST;
}

export function OpportunityStageCapsules({
  currentStage,
  updatingStage,
  errorMessage,
  onSelectStage,
}: Props) {
  const [confirmStage, setConfirmStage] = useState<string | null>(null);
  const normalizedCurrent = mapLegacyStageToOpp(currentStage) ?? currentStage;
  const busy = updatingStage !== null;

  function isActive(value: string): boolean {
    return normalizedCurrent === value;
  }

  function handleCapsuleClick(value: string) {
    if (isActive(value) || busy) return;
    if (isTerminalStage(value)) {
      setConfirmStage(value);
      return;
    }
    void onSelectStage(value);
  }

  async function handleConfirm() {
    if (!confirmStage) return;
    const ok = await onSelectStage(confirmStage);
    if (ok) setConfirmStage(null);
  }

  const confirmIsWon = confirmStage === OPPORTUNITY_STAGES.WON;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Statut
      </p>
      {errorMessage && <p className="mb-2 text-sm text-red-600">{errorMessage}</p>}
      <div className="flex flex-wrap gap-2">
        {OPPORTUNITY_STAGE_SELECT_OPTIONS.map((option) => {
          const active = isActive(option.value);
          const loading = updatingStage === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              aria-current={active ? 'true' : undefined}
              onClick={() => handleCapsuleClick(option.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                active
                  ? 'cursor-default border-blue-200 bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                  : 'border-transparent bg-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-200',
                busy && !loading && 'cursor-not-allowed opacity-50',
              )}
            >
              {loading ? `${option.label}…` : option.label}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmStage !== null}
        title={
          confirmIsWon
            ? 'Marquer cette opportunité comme gagnée ?'
            : 'Marquer cette opportunité comme perdue ?'
        }
        description={
          confirmIsWon
            ? 'Les tâches de relance ouvertes seront clôturées. Vous pourrez ensuite renseigner le bon de commande.'
            : 'Cette action clôture le dossier côté commercial. Les tâches de relance ouvertes seront clôturées.'
        }
        confirmLabel={confirmIsWon ? 'Marquer gagné' : 'Marquer perdu'}
        variant={confirmIsWon ? 'primary' : 'danger'}
        loading={busy}
        errorMessage={confirmStage !== null ? errorMessage : null}
        onClose={() => {
          if (!busy) setConfirmStage(null);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

