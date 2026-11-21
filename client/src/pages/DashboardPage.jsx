// DashboardPage.jsx — the home screen showing key metrics at a glance.
// Uses real data from GET /dashboard. Admin can trigger the daily checks manually.

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { AlertTriangle, Package, Clock, FlaskConical, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDate, formatQty, expiryClass, daysUntil } from '../utils.js';

// Colors for the pie chart slices (pending, approved, rejected, received)
const PIE_COLORS = {
  pending:  '#f59e0b',
  approved: '#3b82f6',
  rejected: '#ef4444',
  received: '#22c55e',
};

function StatCard({ icon: Icon, label, value, colorClass = 'text-brand-600', bgClass = 'bg-brand-50' }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api.get('/dashboard');
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runChecks() {
    setChecking(true);
    try {
      await api.post('/admin/run-checks');
      await load(); // refresh dashboard after checks
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  if (loading) return <Spinner className="mt-24" />;
  if (error)   return <ErrorMessage message={error} />;
  if (!data)   return null;

  // Build pie chart data from requests_by_status object
  const pieData = Object.entries(data.requests_by_status || {}).map(([name, value]) => ({
    name,
    value: Number(value),
  }));

  // Count running batches from yield_per_batch isn't available directly —
  // the dashboard returns pending_approvals and low_stock counts only.
  // We derive "running batches" count from the recent_alerts or show pending_approvals.

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
        </div>
        {user?.role === 'admin' && (
          <button
            id="run-checks-btn"
            onClick={runChecks}
            disabled={checking}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Running…' : 'Run daily check'}
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Pending approvals"
          value={data.pending_approvals}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low-stock items"
          value={data.low_stock?.length ?? 0}
          colorClass="text-red-600"
          bgClass="bg-red-50"
        />
        <StatCard
          icon={Package}
          label="Lots expiring ≤ 30 days"
          value={data.expiring_soon?.length ?? 0}
          colorClass="text-orange-600"
          bgClass="bg-orange-50"
        />
        <StatCard
          icon={FlaskConical}
          label="Requests received"
          value={data.requests_by_status?.received ?? 0}
          colorClass="text-brand-600"
          bgClass="bg-brand-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Yield per batch bar chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Yield per Batch (kg)</h2>
          {data.yield_per_batch?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.yield_per_batch} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="batch_code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" kg" />
                <Tooltip formatter={(v) => `${v} kg`} />
                <Bar dataKey="yield_kg" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No completed batches yet." />
          )}
        </div>

        {/* Requests by status pie chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Requests by Status</h2>
          {pieData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No purchase requests yet." />
          )}
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Low stock table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Low Stock Items</h2>
          {data.low_stock?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Stock</th>
                  <th className="pb-2 font-medium">Reorder at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.low_stock.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-800">{item.name}</td>
                    <td className="py-2.5 text-red-600 font-semibold">{formatQty(item.stock, item.unit)}</td>
                    <td className="py-2.5 text-gray-500">{formatQty(item.reorder_level, item.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="All items are well stocked." />
          )}
        </div>

        {/* Expiring lots table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Lots Expiring Soon</h2>
          {data.expiring_soon?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">Lot</th>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Qty left</th>
                  <th className="pb-2 font-medium">Days left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.expiring_soon.map((lot) => (
                  <tr key={lot.lot_number} className="hover:bg-gray-50">
                    <td className="py-2.5 font-mono text-xs text-gray-700">{lot.lot_number}</td>
                    <td className="py-2.5 text-gray-800">{lot.item_name}</td>
                    <td className="py-2.5 text-gray-600">{formatQty(lot.quantity_remaining, lot.unit)}</td>
                    <td className={`py-2.5 ${expiryClass(lot.days_left)}`}>
                      {lot.days_left} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No lots expiring in the next 30 days." />
          )}
        </div>
      </div>

      {/* Recent alerts */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Alerts</h2>
        {data.recent_alerts?.length > 0 ? (
          <ul className="space-y-3">
            {data.recent_alerts.map((alert, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-gray-800">{alert.message}</span>
                  <span className="text-gray-400 ml-2 text-xs">{formatDate(alert.created_at?.slice(0, 10))}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No alerts. Everything looks good!" />
        )}
      </div>
    </div>
  );
}
