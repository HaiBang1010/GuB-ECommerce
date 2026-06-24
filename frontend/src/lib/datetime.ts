function intlLocale(locale: string): string {
  return locale === 'vi' ? 'vi-VN' : 'en-US';
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
