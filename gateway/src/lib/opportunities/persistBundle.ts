import * as Portail from '../opportunityPortailBundle';
import {
  BUNDLE_FIELD,
  patchToGraphqlDataLines,
  readOpportunityForBundle,
  updateOpportunityViaGraphql,
} from '../opportunityGraphql';
import { stageToStatutDevis } from '../opportunityStages';
import { bundleFromRecord, stageFromRecord } from './bundleRecord';
import type { Env } from '../../index';

export type PersistBundleOptions = {
  syncMirrorStage?: boolean;
  forceMirrorStage?: boolean;
  allowWhenTerminal?: boolean;
  syncPilotFields?: boolean;
  terminalStage?: string;
  terminalStatutDevis?: string;
};

export async function persistPortailBundle(
  env: Env,
  opportunityId: string,
  mutator: (bundle: Portail.PortailBundle) => Portail.PortailBundle,
  opts: PersistBundleOptions = {},
): Promise<{ bundle: Portail.PortailBundle; stage: string }> {
  const { record, status } = await readOpportunityForBundle(env, opportunityId);
  if (status < 200 || status >= 300 || !record) {
    throw new Error('Opportunité introuvable');
  }
  const currentStage = stageFromRecord(record);
  if (Portail.isTerminalStage(currentStage) && !opts.allowWhenTerminal) {
    throw new Error('Opportunité terminée : modification impossible.');
  }
  let bundle = mutator(bundleFromRecord(record));
  bundle = {
    ...bundle,
    quotes: bundle.quotes.map((q) => Portail.normalizeQuoteAmounts(q)),
  };
  const patch: Record<string, unknown> = { [BUNDLE_FIELD]: Portail.stringifyPortailBundle(bundle) };

  if (opts.syncPilotFields !== false) {
    const pilot = Portail.getPilotQuote(bundle);
    if (pilot) {
      Object.assign(patch, Portail.pilotSyncPatchFromQuote(pilot));
    }
  }

  if (opts.terminalStage) {
    patch.stage = opts.terminalStage;
    patch.statutDevis = opts.terminalStatutDevis ?? stageToStatutDevis(opts.terminalStage);
  } else if (opts.syncMirrorStage) {
    const pilot = Portail.getPilotQuote(bundle);
    const mirror = opts.forceMirrorStage === true || !bundle.standby.active;
    if (mirror && pilot && !Portail.isTerminalStage(currentStage)) {
      patch.stage = Portail.mirrorStageFromPilot(pilot);
      if (pilot.statutCommercial === 'EN_ATTENTE') {
        patch.statutDevis = stageToStatutDevis(String(patch.stage));
      }
    }
  }

  const { lines, bundle: bundlePayload } = patchToGraphqlDataLines(patch);
  const updated = await updateOpportunityViaGraphql(env, opportunityId, lines, bundlePayload);
  const newStage = typeof patch.stage === 'string' ? patch.stage : updated.stage || currentStage;
  return { bundle, stage: newStage };
}
