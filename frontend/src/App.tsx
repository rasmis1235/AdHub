import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AdsPage from './pages/AdsPage';
import AdminDashboard from './pages/AdminDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, fetchMe, accessToken } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (accessToken && !isAuthenticated && !isLoading) {
      fetchMe();
    }
  }, [accessToken, isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Protected User Routes */}
      <Route path="/*" element={
        <RequireAuth>
          <Layout>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/ads" element={<AdsPage />} />
              <Route path="/transactions" element={<div className="p-6"><h1 className="text-xl font-bold">Transaction History</h1></div>} />
              <Route path="/withdraw" element={<div className="p-6"><h1 className="text-xl font-bold">Withdraw</h1></div>} />
              <Route path="/referrals" element={<div className="p-6"><h1 className="text-xl font-bold">Referrals</h1></div>} />
              <Route path="/settings" element={<div className="p-6"><h1 className="text-xl font-bold">Settings</h1></div>} />

              {/* Admin Routes */}
              <Route path="/admin" element={
                <RequireAdmin><AdminDashboard /></RequireAdmin>
              } />
              <Route path="/admin/users" element={
                <RequireAdmin><div className="p-6"><h1 className="text-xl font-bold">User Management</h1></div></RequireAdmin>
              } />
              <Route path="/admin/ads" element={
                <RequireAdmin><div className="p-6"><h1 className="text-xl font-bold">Ad Management</h1></div></RequireAdmin>
              } />
              <Route path="/admin/withdrawals" element={
                <RequireAdmin><div className="p-6"><h1 className="text-xl font-bold">Withdrawal Management</h1></div></RequireAdmin>
              } />
              <Route path="/admin/fraud" element={
                <RequireAdmin><div className="p-6"><h1 className="text-xl font-bold">Fraud Monitor</h1></div></RequireAdmin>
              } />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        </RequireAuth>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '10px',
                background: '#1f2937',
                color: '#fff',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#22c55e', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
}
