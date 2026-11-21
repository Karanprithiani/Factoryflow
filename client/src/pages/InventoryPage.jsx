// InventoryPage.jsx — shows all items and all lots.
// Store/admin can add new items. Lot numbers link to the traceability page.

import { useState, useEffect, useCallback } from 'react';
import { Plus, AlertTriangle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import { formatDate, formatQty, expiryClass, daysUntil } from '../utils.js';

const UNITS = ['kg', 'g', 'L', 'mL', 'units'];
const CATEGORIES = ['Carbon Source', 'Nitrogen Source', 'Mineral', 'Vitamin', 'Buffer', 'Other'];

export default function InventoryPage() {
  const { user }   = useAuth();
  const [items,    setItems]    = useState([]);
  const [lots,     setLots]     = useState([]);
  const [inStock,  setInStock]  = useState(false); // filter toggle for lots
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [showAdd,  setShowAdd]  = useState(false);

  const canManage = ['store', 'admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const lotQuery = inStock ? '?in_stock=true' : '';
      const [itms, lts] = await Promise.all([
        api.get('/items'),
        api.get(`/lots${lotQuery}`),
      ]);
      setItems(itms);
      setLots(lts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [inStock]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Items catalogue and lot details.</p>
        </div>
        {canManage && (
          <button
            id="add-item-btn"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Add item
          </button>
        )}
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <Spinner className="mt-12" />
      ) : (
        <div className="space-y-8">
          {/* Items table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Items</h2>
            </div>
            {items.length === 0 ? (
              <EmptyState message="No items in the catalogue yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Unit</th>
                      <th className="px-4 py-3 font-medium">Stock</th>
                      <th className="px-4 py-3 font-medium">Reorder level</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => {
                      const isLow = item.stock <= item.reorder_level;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                          <td className="px-4 py-3 text-gray-500">{item.category || '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">
                            {formatQty(item.stock, item.unit)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {formatQty(item.reorder_level, item.unit)}
                          </td>
                          <td className="px-4 py-3">
                            {isLow && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                <AlertTriangle className="w-3 h-3" /> Low
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lots table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Lots</h2>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  id="in-stock-filter"
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Only in stock
              </label>
            </div>
            {lots.length === 0 ? (
              <EmptyState message="No lots found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Lot number</th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Supplier</th>
                      <th className="px-4 py-3 font-medium">Remaining / Received</th>
                      <th className="px-4 py-3 font-medium">Expiry</th>
                      <th className="px-4 py-3 font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lots.map((lot) => {
                      const days = daysUntil(lot.expiry_date);
                      return (
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
                          <td className="px-4 py-3 text-gray-700">
                            {formatQty(lot.quantity_remaining, lot.unit)}
                            <span className="text-gray-400"> / {formatQty(lot.quantity_received, lot.unit)}</span>
                          </td>
                          <td className={`px-4 py-3 ${expiryClass(days)}`}>
                            {lot.expiry_date ? formatDate(lot.expiry_date) : '—'}
                            {days != null && lot.expiry_date && (
                              <span className="ml-1 text-xs opacity-70">({days}d)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(lot.received_at?.slice(0, 10))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add item modal */}
      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────
function AddItemModal({ onClose, onSaved }) {
  const [name,         setName]         = useState('');
  const [category,     setCategory]     = useState('');
  const [unit,         setUnit]         = useState('kg');
  const [reorderLevel, setReorderLevel] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/items', {
        name,
        category: category || undefined,
        unit,
        reorder_level: Number(reorderLevel),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add Item" onClose={onClose}>
      <ErrorMessage message={error} />
      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            id="add-item-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Glucose"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            id="add-item-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          >
            <option value="">Select…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
          <select
            id="add-item-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reorder level *</label>
          <input
            id="add-item-reorder"
            type="number"
            min="0"
            step="any"
            required
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
            placeholder="e.g. 100"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            id="submit-add-item"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? 'Saving…' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
