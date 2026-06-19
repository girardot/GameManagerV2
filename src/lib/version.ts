export const appVersion = {
  hash: __APP_COMMIT_HASH__,
  date: __APP_COMMIT_DATE__,
}

export function formatAppVersionDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function appVersionLabel(): string {
  return `${appVersion.hash} · ${formatAppVersionDate(appVersion.date)}`
}
