// TracePage.jsx — TRACEABILITY. The hero feature.
//
// You type a lot number and see:
//   - Lot details (item, supplier, quantities, expiry)
//   - Every batch that ever used that lot
//
// This is critical for safety recalls: if a lot is contaminated, you can
// immediately find every batch it touched.

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, ShieldCheck, Package, FlaskConical, AlertCircle, ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import Spinner from '../components/Spinner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatQty, expiryClass, daysUntil } from '../utils.js';

export default function TracePage() {
  const { lotNumber: urlLot } = useParams(); // set when navigating to /trace/:lotNumber
  const navigate              = useNavigate();

  const [query,   setQuery]   = useState(urlLot || '');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null);  // { lot, batches }
  const [notFound, setNotFound] = useState(false);

  // If a lot number is in the URL, search immediately on mount
  useEffect(() => {
    if (urlLot) {
      doSearch(urlLot);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLot]);

  async function doSearch(lotNum) {
    const q = (lotNum || query).trim().toUpperCase();
    if (!q) return;

    setLoading(true);
    setError('');
    setNotFound(false);
    setResult(null);

    try {
      const data = await api.get(`/lots/${q}/trace`);
      setResult(data);
      // Update the URL so this search is bookmarkable
      navigate(`/trace/${q}`, { replace: true });
    } catch (err) {
      if (err.message?.toLowerCase().includes('not found') || err.message?.includes('404')) {
        setNotFound(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    doSearch(query);
  }

  const days = result ? daysUntil(result.lot?.expiry_date) : null;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Hero header */}
      <div className="text-center pt-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-lg shadow-brand-200 mb-4">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Lot Traceability</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">
          Enter a lot number to see every fermentation batch that used that material.
          Essential for quality investigations and safety recalls.
        </p>
      </div>

      {/* Search box */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="lot-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="e.g. LOT-YE-0001"
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-gray-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-50 outline-none text-base font-mono tracking-wide transition-all"
            />
          </div>
          <button
            id="lot-search-btn"
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors shadow-md shadow-brand-200"
          >
            {loading ? 'Searching…' : 'Trace'}
          </button>
        </div>
      </form>

      {/* Loading */}
      {loading && <Spinner className="mt-8" />}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Not found */}
      {notFound && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">Lot not found</p>
          <p className="text-sm text-gray-400 mt-1">
            No lot with number <span className="font-mono font-semibold">{query}</span> exists in the system.
          </p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Lot detail card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Green accent bar */}
            <div className="h-2 bg-gradient-to-r from-brand-600 to-brand-400" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Lot Number</p>
                  <p className="text-xl font-bold text-gray-900 font-mono leading-tight">
                    {result.lot.lot_number}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wider">Item</dt>
                  <dd className="font-semibold text-gray-800 mt-1">{result.lot.item_name}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wider">Supplier</dt>
                  <dd className="font-semibold text-gray-800 mt-1">{result.lot.supplier || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wider">Received</dt>
                  <dd className="font-semibold text-gray-800 mt-1">{formatDate(result.lot.received_at?.slice(0, 10))}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wider">Received qty</dt>
                  <dd className="font-semibold text-gray-800 mt-1">
                    {formatQty(result.lot.quantity_received, result.lot.unit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wider">Remaining qty</dt>
                  <dd className="font-semibold text-gray-800 mt-1">
                    {formatQty(result.lot.quantity_remaining, result.lot.unit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs font-medium uppercase tracking-wider">Expiry</dt>
                  <dd className={`font-semibold mt-1 ${expiryClass(days)}`}>
                    {result.lot.expiry_date ? formatDate(result.lot.expiry_date) : '—'}
                    {days != null && result.lot.expiry_date && (
                      <span className="ml-1 text-xs font-normal">({days}d left)</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Batches that used this lot */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <FlaskConical className="w-5 h-5 text-brand-600" />
              <div>
                <h2 className="font-semibold text-gray-800">Batches Using This Lot</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {result.batches.length === 0
                    ? 'This lot has not been used in any batch yet.'
                    : `${result.batches.length} batch${result.batches.length !== 1 ? 'es' : ''} found`}
                </p>
              </div>
            </div>

            {result.batches.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                This lot has not been used in any batch yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-left text-gray-500">
                      <th className="px-4 py-3 font-medium">Batch code</th>
                      <th className="px-4 py-3 font-medium">Strain</th>
                      <th className="px-4 py-3 font-medium">Qty used</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Yield</th>
                      <th className="px-4 py-3 font-medium">Started</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.batches.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 group">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">{b.batch_code}</td>
                        <td className="px-4 py-3 text-gray-700">{b.strain}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatQty(b.quantity_used, result.lot.unit)}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3 text-gray-600">
                          {b.yield_kg != null ? formatQty(b.yield_kg, 'kg') : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(b.started_at?.slice(0, 10))}</td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/batches/${b.id}`}
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            View <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
