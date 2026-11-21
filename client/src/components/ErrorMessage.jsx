// ErrorMessage.jsx — red banner shown when an API call fails.
// The message comes directly from the server so the user understands what went wrong.

import { AlertCircle } from 'lucide-react';

export default function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
