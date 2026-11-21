// AuditPage.jsx — admin only: immutable log of every action in the system.
// Shows who did what and when. Useful for compliance and debugging.

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function AuditPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/admin/audit');
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Every action taken in the system, in order.</p>
        </div>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <Spinner className="mt-12" />
      ) : logs.length === 0 ? (
        <EmptyState message="No audit events yet." />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{log.user_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700 uppercase tracking-wide">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">
                      {log.entity}{log.entity_id ? ` #${log.entity_id}` : ''}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[280px]">
                      {log.details
                        ? (typeof log.details === 'string'
                          ? log.details
                          : JSON.stringify(log.details))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
