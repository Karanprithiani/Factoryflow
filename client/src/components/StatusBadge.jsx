// StatusBadge.jsx — colored pill badge for status values.
// All status colors are defined in one place (utils.js) so changing a color updates everywhere.

import { STATUS_COLORS } from '../utils.js';

export default function StatusBadge({ status }) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}>
      {status}
    </span>
  );
}
