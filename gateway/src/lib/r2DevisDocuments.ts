import type { Env } from '../index';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 10 * 1024 * 1024;

export function devisDocumentR2Key(opportunityId: string, quoteId: string): string {
  return `opportunities/${opportunityId}/quotes/${quoteId}/devis.docx`;
}

export function assertDocxUpload(file: File): void {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.docx')) {
    throw new Error('Seuls les fichiers .docx sont acceptés.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Fichier trop volumineux (max 10 Mo).');
  }
  const mime = file.type;
  if (mime && mime !== DOCX_MIME && mime !== 'application/octet-stream') {
    throw new Error('Type MIME invalide pour un devis Word.');
  }
}

export async function putDevisDocument(
  env: Env,
  opportunityId: string,
  quoteId: string,
  file: File,
): Promise<{ key: string; fileName: string }> {
  assertDocxUpload(file);
  const bucket = env.DEVIS_DOCUMENTS;
  if (!bucket) {
    throw new Error('Stockage R2 non configuré (binding DEVIS_DOCUMENTS).');
  }
  const key = devisDocumentR2Key(opportunityId, quoteId);
  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: { contentType: DOCX_MIME },
    customMetadata: {
      opportunityId,
      quoteId,
      originalName: file.name.slice(0, 200),
    },
  });
  return { key, fileName: file.name };
}

export async function getDevisDocument(
  env: Env,
  key: string,
): Promise<{ body: ReadableStream; fileName: string } | null> {
  const bucket = env.DEVIS_DOCUMENTS;
  if (!bucket) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  const fileName =
    obj.customMetadata?.originalName ??
    key.split('/').pop() ??
    'devis.docx';
  return { body: obj.body, fileName };
}
