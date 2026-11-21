// utils.js — shared formatting helpers used across all pages
// These are pure functions (no React, no state) so they're easy to test and explain.

/**
 * formatDate('2026-12-31') → '31 Dec 2026'
 * Uses the browser's built-in Intl API — no library needed.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Add time so the date isn't shifted by time-zone offset
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/**
 * formatQty(50, 'kg') → '50 kg'
 * Keeps numbers with up to 3 decimal places when needed.
 */
export function formatQty(qty, unit) {
  if (qty == null) return '—';
  const n = parseFloat(qty);
  const formatted = Number.isInteger(n) ? n : n.toFixed(3).replace(/\.?0+$/, '');
  return unit ? `${formatted} ${unit}` : `${formatted}`;
}

/**
 * expiryClass(daysLeft) → Tailwind text color class
 * Red ≤ 7 days, Amber ≤ 30 days, otherwise normal grey.
 */
export function expiryClass(daysLeft) {
  if (daysLeft == null) return 'text-gray-600';
  if (daysLeft <= 7)  return 'text-red-600 font-semibold';
  if (daysLeft <= 30) return 'text-amber-600 font-semibold';
  return 'text-gray-600';
}

/**
 * daysUntil('2026-12-31') → number of whole days from today
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

/**
 * statusColors — badge colors for every status value
 */
export const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800',
  approved:  'bg-blue-100  text-blue-800',
  rejected:  'bg-red-100   text-red-800',
  received:  'bg-green-100 text-green-800',
  running:   'bg-blue-100  text-blue-800',
  completed: 'bg-green-100 text-green-800',
};
