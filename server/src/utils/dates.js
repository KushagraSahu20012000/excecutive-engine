import { parseISO } from 'date-fns';

const APP_TIME_ZONE = 'Asia/Kolkata';

function datePartsInAppTimeZone(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateKey(value = new Date()) {
  const parts = datePartsInAppTimeZone(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parseDateKey(dateKey) {
  return parseISO(`${dateKey}T00:00:00+05:30`);
}