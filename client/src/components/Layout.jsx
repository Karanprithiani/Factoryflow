// Layout.jsx — the app shell: sidebar on desktop, top-nav on mobile.
// Every authenticated page is wrapped in this layout.

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, FlaskConical,
  Search, Users, ClipboardList, LogOut, Menu, X, Factory,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';

// nav items — each has the route, icon, label, and which roles can see it
const NAV_ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',          roles: ['requester','approver','store','admin'] },
  { to: '/requests',  icon: ShoppingCart,    label: 'Purchase Requests',  roles: ['requester','approver','store','admin'] },
  { to: '/inventory', icon: Package,         label: 'Inventory',          roles: ['requester','approver','store','admin'] },
  { to: '/batches',   icon: FlaskConical,    label: 'Batches',            roles: ['requester','approver','store','admin'] },
  { to: '/trace',     icon: Search,          label: 'Traceability',       roles: ['requester','approver','store','admin'] },
  { to: '/users',     icon: Users,           label: 'Users',              roles: ['admin'] },
  { to: '/audit',     icon: ClipboardList,   label: 'Audit Log',          roles: ['admin'] },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-brand-600 text-white shadow-md'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Only show nav items this user's role can access
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
          <Factory className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 leading-none">FactoryFlow</p>
          <p className="text-xs text-gray-400 mt-0.5">Fermentation Tracker</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavItem
            key={item.to}
            {...item}
            onClick={() => setSidebarOpen(false)}
          />
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 text-sm font-semibold">
              {user?.name?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar — fixed on the left */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar — slides in from the left */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-white shadow-2xl z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-brand-600" />
            <span className="font-bold text-gray-900">FactoryFlow</span>
          </div>
          <div className="w-9" /> {/* spacer */}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
