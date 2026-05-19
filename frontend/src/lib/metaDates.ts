const metaDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

export function formatMetaDate(date: string | null | undefined): string {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';
  return metaDateFormatter.format(parsed);
}

export function formatCreatedUpdatedMeta(
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined,
): string {
  return `Cr. ${formatMetaDate(createdAt)} | Maj. ${formatMetaDate(updatedAt)}`;
}
