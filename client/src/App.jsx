// App.jsx — sets up routing and wraps everything in auth context.
// Each protected route uses <ProtectedRoute> so unauthorized access redirects cleanly.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';

import LoginPage         from './pages/LoginPage.jsx';
import DashboardPage     from './pages/DashboardPage.jsx';
import RequestsPage      from './pages/RequestsPage.jsx';
import InventoryPage     from './pages/InventoryPage.jsx';
import BatchesPage       from './pages/BatchesPage.jsx';
import BatchDetailPage   from './pages/BatchDetailPage.jsx';
import TracePage         from './pages/TracePage.jsx';
import UsersPage         from './pages/UsersPage.jsx';
import AuditPage         from './pages/AuditPage.jsx';

// Wraps a page component in Layout (sidebar) + ProtectedRoute (auth check)
function AppPage({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Everyone logged in */}
          <Route path="/"           element={<AppPage><DashboardPage /></AppPage>} />
          <Route path="/requests"   element={<AppPage><RequestsPage /></AppPage>} />
          <Route path="/inventory"  element={<AppPage><InventoryPage /></AppPage>} />
          <Route path="/batches"    element={<AppPage><BatchesPage /></AppPage>} />
          <Route path="/batches/:id" element={<AppPage><BatchDetailPage /></AppPage>} />
          <Route path="/trace"      element={<AppPage><TracePage /></AppPage>} />
          <Route path="/trace/:lotNumber" element={<AppPage><TracePage /></AppPage>} />

          {/* Admin only */}
          <Route path="/users" element={<AppPage allowedRoles={['admin']}><UsersPage /></AppPage>} />
          <Route path="/audit" element={<AppPage allowedRoles={['admin']}><AuditPage /></AppPage>} />

          {/* Catch-all → dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
