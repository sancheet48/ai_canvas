import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

// Page Imports
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';
import { Explore } from './pages/Explore';
import { Board } from './pages/Board';
import { AdminDashboard } from './pages/AdminDashboard';

// 1. ROUTE GUARD: PRIVATE / AUTH REQUIRED
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-xs text-dark-200">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-4" />
        <span>Restoring your drawing session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 2. ROUTE GUARD: ADMIN ONLY
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-xs text-dark-200">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-4" />
        <span>Checking permissions...</span>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/explore" replace />;
  }

  return <>{children}</>;
};

// 3. ROUTE GUARD: UNAUTHENTICATED ONLY (Redirects logged in users to explore)
const UnauthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center text-xs text-dark-200">
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mb-4" />
        <span>Loading...</span>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/explore" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { restoreSession } = useAuthStore();

  // Restore user session on startup
  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Authentication routes */}
        <Route 
          path="/login" 
          element={
            <UnauthRoute>
              <Login />
            </UnauthRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <UnauthRoute>
              <Register />
            </UnauthRoute>
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            <UnauthRoute>
              <ForgotPassword />
            </UnauthRoute>
          } 
        />
        <Route 
          path="/reset-password" 
          element={
            <UnauthRoute>
              <ResetPassword />
            </UnauthRoute>
          } 
        />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Private Workspace routes */}
        <Route 
          path="/explore" 
          element={
            <ProtectedRoute>
              <Explore />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/board/:id" 
          element={
            <ProtectedRoute>
              <Board />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/board" 
          element={
            <ProtectedRoute>
              <Board />
            </ProtectedRoute>
          } 
        />

        {/* Admin protected console */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
