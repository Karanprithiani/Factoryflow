// BatchDetailPage.jsx — shows one batch's info plus every lot it used.
// Store/admin can mark a running batch as complete by entering the yield.

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FlaskConical, ExternalLink } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate, formatQty } from '../utils.js';

export default function BatchDetailPage() {
  const { id }     = useParams();
  const { user }   = useAuth();
  const [batch,    setBatch]    = useState(null);
  const [lots,     setLots]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [showComplete, setShowComplete] = useState(false);

  const canManage = ['store', 'admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/batches/${id}`);
      setBatch(data.batch);
      setLots(data.lots || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner className="mt-24" />;
  if (error)   return <div className="space-y-4"><ErrorMessage message={error} /></div>;
  if (!batch)  return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link to="/batches" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to batches
      </Link>

      {/* Batch header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
              <FlaskConical className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-mono">{batch.batch_code}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{batch.strain}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={batch.status} />
            {canManage && batch.status === 'running' && (
              <button
                id="complete-batch-btn"
                onClick={() => setShowComplete(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Complete batch
              </button>
            )}
          </div>
        </div>

        {/* Batch metadata */}
        <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Started</dt>
            <dd className="font-medium text-gray-800 mt-0.5">{formatDate(batch.started_at?.slice(0, 10))}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Ended</dt>
            <dd className="font-medium text-gray-800 mt-0.5">{batch.ended_at ? formatDate(batch.ended_at.slice(0, 10)) : '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Yield</dt>
            <dd className="font-medium text-gray-800 mt-0.5">
              {batch.yield_kg != null ? formatQty(batch.yield_kg, 'kg') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Created by</dt>
            <dd className="font-medium text-gray-800 mt-0.5">{batch.created_by_name}</dd>
          </div>
        </dl>

        {batch.notes && (
          <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{batch.notes}</p>
        )}
      </div>

      {/* Lots used table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Lots Used</h2>
          <p className="text-xs text-gray-400 mt-0.5">Every lot of raw material consumed by this batch.</p>
        </div>
        {lots.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No lots recorded for this batch.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Lot number</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Quantity used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lots.map((lot) => (
                  <tr key={lot.lot_number} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/trace/${lot.lot_number}`}
                        className="font-mono text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                      >
                        {lot.lot_number}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{lot.item_name}</td>
                    <td className="px-4 py-3 text-gray-500">{lot.supplier || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(lot.expiry_date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {formatQty(lot.quantity_used, lot.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete batch modal */}
      {showComplete && (
        <CompleteBatchModal
          batchId={id}
          batchCode={batch.batch_code}
          onClose={() => setShowComplete(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── Complete Batch Modal ─────────────────────────────────────────────────────
function CompleteBatchModal({ batchId, batchCode, onClose, onSaved }) {
  const [yieldKg,  setYieldKg]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(`/batches/${batchId}/complete`, { yield_kg: Number(yieldKg) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Complete Batch" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Mark <span className="font-semibold font-mono">{batchCode}</span> as completed.
        Enter the final protein yield.
      </p>
      <ErrorMessage message={error} />
      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Yield (kg) *</label>
          <input
            id="yield-kg-input"
            type="number"
            min="0"
            step="any"
            required
            value={yieldKg}
            onChange={(e) => setYieldKg(e.target.value)}
            placeholder="e.g. 12.5"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            id="submit-complete-batch"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? 'Completing…' : 'Complete batch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
