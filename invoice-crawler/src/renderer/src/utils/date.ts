/** Formatting helpers for ISO timestamps shown in the UI. UK locale. */

const FULL_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** "3 May 2026, 14:32" — used for definite, in-the-past timestamps. */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', FULL_OPTIONS);
}

/**
 * Friendly relative form: "Just now", "5 minutes ago", "3 hours ago",
 * "2 days ago". Falls back to the full date for anything older than a week.
 */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  return formatFullDate(iso);
}
