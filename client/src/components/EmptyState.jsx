// EmptyState.jsx — shown when a list has zero items (the "nothing here yet" state).
// Every page needs 3 states: loading, error, and empty. This handles the third.

import { PackageOpen } from 'lucide-react';

export default function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <PackageOpen className="w-12 h-12 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
