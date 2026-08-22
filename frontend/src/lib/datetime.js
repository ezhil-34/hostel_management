/** "22 Aug, 5:30 pm" — compact, locale-aware, used across outpass views. */
export const formatDateTime = (value) =>
  new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * `datetime-local` inputs want "YYYY-MM-DDTHH:mm" in *local* wall-clock time.
 * `toISOString()` would silently shift the value by the UTC offset.
 */
export const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};
