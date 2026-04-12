import { config } from '../lib/config';

export async function uploadToZeendoc(buffer: Buffer, filename: string, metadata: Record<string, string>) {
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);
  Object.entries(metadata).forEach(([k, v]) => formData.append(k, v));

  const res = await fetch(`${config.zeendoc.apiUrl}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.zeendoc.apiKey}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Zeendoc upload failed: ${res.statusText}`);
  return res.json();
}
