// RequestsPage.jsx — purchase request list with role-based actions.
//
// REQUESTER: sees own requests + "New request" button
// APPROVER:  sees all requests + Approve/Reject on pending rows
// STORE:     sees all requests + Receive on approved rows
// ADMIN:     all of the above

import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, X, ArrowDownToLine } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatQty } from '../utils.js';

// Status filter tabs
const FILTERS = ['all', 'pending', 'approved', 'rejected', 'received'];

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests]   = useState([]);
  const [items,    setItems]      = useState([]);
  const [filter,   setFilter]     = useState('all');
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState('');

  // Modal states
  const [showNewForm,    setShowNewForm]    = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [selectedReq,    setSelectedReq]   = useState(null);

  const canCreateRequest = ['requester', 'admin'].includes(user?.role);
  const canApprove       = ['approver', 'admin'].includes(user?.role);
  const canReceive       = ['store', 'admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = filter !== 'all' ? `?status=${filter}` : '';
      const [reqs, itms] = await Promise.all([
        api.get(`/purchase-requests${query}`),
        api.get('/items'),
      ]);
      setRequests(reqs);
      setItems(itms);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function openReject(req) { setSelectedReq(req); setShowRejectForm(true); }
  function openReceive(req) { setSelectedReq(req); setShowReceiveForm(true); }

  async function handleApprove(req) {
    setError('');
    try {
      await api.post(`/purchase-requests/${req.id}/decision`, { decision: 'approved', note: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            {canCreateRequest ? 'Create and track your material requests.' : 'Review and manage material requests.'}
          </p>
        </div>
        {canCreateRequest && (
          <button
            id="new-request-btn"
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New request
          </button>
        )}
      </div>

      <ErrorMessage message={error} />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            id={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <Spinner className="mt-12" />
      ) : requests.length === 0 ? (
        <EmptyState message={`No ${filter === 'all' ? '' : filter + ' '}requests found.`} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Needed by</th>
                  <th className="px-4 py-3 font-medium">Requested by</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{req.item_name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatQty(req.quantity, req.unit)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(req.needed_by)}</td>
                    <td className="px-4 py-3 text-gray-600">{req.requested_by_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-gray-500 italic text-xs max-w-[180px] truncate" title={req.decision_note}>
                      {req.decision_note || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Approve / Reject buttons for pending rows */}
                        {canApprove && req.status === 'pending' && (
                          <>
                            <button
                              id={`approve-${req.id}`}
                              onClick={() => handleApprove(req)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              id={`reject-${req.id}`}
                              onClick={() => openReject(req)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {/* Receive button for approved rows */}
                        {canReceive && req.status === 'approved' && (
                          <button
                            id={`receive-${req.id}`}
                            onClick={() => openReceive(req)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" /> Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewForm && (
        <NewRequestModal
          items={items}
          onClose={() => setShowNewForm(false)}
          onSaved={load}
        />
      )}
      {showRejectForm && selectedReq && (
        <RejectModal
          request={selectedReq}
          onClose={() => { setShowRejectForm(false); setSelectedReq(null); }}
          onSaved={load}
        />
      )}
      {showReceiveForm && selectedReq && (
        <ReceiveModal
          request={selectedReq}
          onClose={() => { setShowReceiveForm(false); setSelectedReq(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── New Request Modal ────────────────────────────────────────────────────────
// Space at the top is left for the AI parser (Part 2).
function NewRequestModal({ items, onClose, onSaved }) {
  const [itemId,   setItemId]   = useState('');
  const [quantity, setQuantity] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [reason,   setReason]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/purchase-requests', {
        item_id:   Number(itemId),
        quantity:  Number(quantity),
        needed_by: neededBy || undefined,
        reason:    reason   || undefined,
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
    <Modal title="New Purchase Request" onClose={onClose}>
      {/* ── AI ASSISTANT PLACEHOLDER (Part 2 will fill this) ── */}
      <div id="ai-request-box" className="mb-4 p-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400 text-center">
        AI request assistant coming in Part 2
      </div>

      <ErrorMessage message={error} />
      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
          <select
            id="new-req-item"
            required
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          >
            <option value="">Select an item…</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{it.name} ({it.unit})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
          <input
            id="new-req-qty"
            type="number"
            min="0.001"
            step="any"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 50"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Needed by</label>
          <input
            id="new-req-date"
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            id="new-req-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need this material?"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none text-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            id="submit-new-request"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ request, onClose, onSaved }) {
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post(`/purchase-requests/${request.id}/decision`, {
        decision: 'rejected',
        note,
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
    <Modal title="Reject Request" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Rejecting <span className="font-semibold">{request.item_name}</span> ({formatQty(request.quantity, request.unit)}).
        A note is required.
      </p>
      <ErrorMessage message={error} />
      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rejection note *</label>
          <textarea
            id="reject-note"
            rows={3}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why you are rejecting this request…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm resize-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            id="submit-reject"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? 'Rejecting…' : 'Reject request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
function ReceiveModal({ request, onClose, onSaved }) {
  const [qtyReceived, setQtyReceived] = useState(request.quantity ?? '');
  const [expiryDate,  setExpiryDate]  = useState('');
  const [supplier,    setSupplier]    = useState('');
  const [lotNumber,   setLotNumber]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [successLot,  setSuccessLot]  = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.post(`/purchase-requests/${request.id}/receive`, {
        quantity_received: Number(qtyReceived),
        expiry_date:       expiryDate  || undefined,
        supplier:          supplier    || undefined,
        lot_number:        lotNumber   || undefined,
      });
      setSuccessLot(result.lot?.lot_number || '—');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (successLot) {
    return (
      <Modal title="Goods Received" onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Goods received successfully.</p>
          <p className="text-sm text-gray-500">Lot number assigned:</p>
          <p className="mt-2 text-xl font-bold text-gray-900 font-mono">{successLot}</p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Receive Goods" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Receiving <span className="font-semibold">{request.item_name}</span>.
      </p>
      <ErrorMessage message={error} />
      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity received *</label>
          <input
            id="receive-qty"
            type="number"
            min="0.001"
            step="any"
            required
            value={qtyReceived}
            onChange={(e) => setQtyReceived(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry date</label>
          <input
            id="receive-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <input
            id="receive-supplier"
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="e.g. Sigma-Aldrich"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lot number (optional)</label>
          <input
            id="receive-lot"
            type="text"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            placeholder="Leave blank to auto-generate"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-brand-500 outline-none text-sm"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            id="submit-receive"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? 'Saving…' : 'Confirm receipt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
