import { format, parseISO, isValid } from 'date-fns';
import { it } from 'date-fns/locale';

export function formatDate(date: Date | string | null | undefined, formatStr = 'dd/MM/yyyy'): string {
  if (!date) return '-';

  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) return '-';

  return format(dateObj, formatStr, { locale: it });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getDatePath(date: Date = new Date()): string {
  return format(date, 'yyyy/MM/dd');
}

export function parseDate(dateString: string, formatStr = 'dd-MM-yyyy'): Date | null {
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
