import { format, parseISO, startOfDay } from 'date-fns';

export function localDateKey(value = new Date()) {
  return format(startOfDay(value), 'yyyy-MM-dd');
}

export function parseDateKey(dateKey) {
  return startOfDay(parseISO(dateKey));
}