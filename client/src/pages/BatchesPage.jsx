// BatchesPage.jsx — list of fermentation batches + "New batch" form for store/admin.
//
// Key feature: the "New Batch" form sends consumption items to the server.
// The server uses FEFO (First Expiry, First Out) to allocate lots automatically.
// If stock is insufficient, the server returns 409 and nothing changes.

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatQty } from '../utils.js';

export default function BatchesPage() {
  const { user }   = useAuth();
  const [batches,  setBatches]  = useState([]);
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [showNew,  setShowNew]  = useState(false);

  const canManage = ['store', 'admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bts, itms] = await Promise.all([
        api.get('/batches'),
        api.get('/items'),
      ]);
      setBatches(bts);
      setItems(itms);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fermentation Batches</h1>
          <p className="text-sm text-gray-500 mt-1">Track every run in the fermentation tank.</p>
        </div>
        {canManage && (
          <button
            id="new-batch-btn"
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New batch
          </button>
        )}
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <Spinner className="mt-12" />
      ) : batches.length === 0 ? (
        <EmptyState message="No batches yet. Create the first one!" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Batch code</th>
                  <th className="px-4 py-3 font-medium">Strain</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-4 py-3 font-medium">Yield</th>
                  <th className="px-4 py-3 font-medium">Lots used</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{batch.batch_code}</td>
                    <td className="px-4 py-3 text-gray-700">{batch.strain}</td>
                    <td className="px-4 py-3"><StatusBadge status={batch.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(batch.started_at?.slice(0, 10))}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {batch.yield_kg != null ? formatQty(batch.yield_kg, 'kg') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {batch.lots_used ?? 0} lot{batch.lots_used !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/batches/${batch.id}`}
                        className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium"
                      >
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewBatchModal
          items={items}
          onClose={() => setShowNew(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── New Batch Modal ──────────────────────────────────────────────────────────
// Collects strain, notes, and a list of {item_id, quantity} consumption rows.
// After success, shows the FEFO allocations returned by the server.
function NewBatchModal({ items, onClose, onSaved }) {
  const [strain,      setStrain]      = useState('');
  const [notes,       setNotes]       = useState('');
  // Each row: { item_id: '', quantity: '' }
  const [consumption, setConsumption] = useState([{ item_id: '', quantity: '' }]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [allocations, setAllocations] = useState(null); // shown after success

  function addRow() {
    setConsumption((prev) => [...prev, { item_id: '', quantity: '' }]);
  }

  function removeRow(idx) {
    setConsumption((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRow(idx, field, value) {
    setConsumption((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validate rows — every row must have an item and quantity
    const rows = consumption.filter((r) => r.item_id && r.quantity);
    if (rows.length === 0) {
      setError('Add at least one material with a quantity.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.post('/batches', {
        strain,
        notes: notes || undefined,
        consumption: rows.map((r) => ({
          item_id:  Number(r.item_id),
          quantity: Number(r.quantity),
        })),
      });
      setAllocations(result.allocations);
      onSaved();
    } catch (err) {
      setError(err.message); // 409 "not enough stock" shows here
    } finally {
      setLoading(false);
    }
  }

  // After saving, show which lots were used (FEFO allocation result)
  if (allocations) {
    return (
      <Modal title="Batch Created" onClose={onClose} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            The batch was created. The system allocated stock from these lots (FEFO order):
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Lot used</th>
                  <th className="px-4 py-2.5 font-medium">Quantity used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allocations.map((a, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-800">{a.item_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-brand-600">{a.lot_number}</td>
                    <td className="px-4 py-2.5 text-gray-700">{formatQty(a.quantity_used, a.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New Fermentation Batch" onClose={onClose} size="lg">
      <ErrorMessage message={error} />
      <form onSubmit={handleSubmit} className="space-y-5 mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Strain name *</label>
            <input
              id="batch-strain"
              type="text"
              required
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="e.g. E. coli BL21"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              id="batch-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* Material rows */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Materials consumed *</label>
            <button
              type="button"
              id="add-material-row"
              onClick={addRow}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              + Add another material
            </button>
          </div>
          <div className="space-y-2">
            {consumption.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  id={`material-item-${idx}`}
                  required
                  value={row.item_id}
                  onChange={(e) => updateRow(idx, 'item_id', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
                >
                  <option value="">Select item…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
                  ))}
                </select>
                <input
                  id={`material-qty-${idx}`}
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={row.quantity}
                  onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="w-28 px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
                />
                {consumption.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            id="submit-batch"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? 'Creating…' : 'Create batch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
