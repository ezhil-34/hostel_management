import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OutpassPage from './pages/OutpassPage';
import MaintenancePage from './pages/MaintenancePage';
import PointsPage from './pages/PointsPage';
import PointsPayPage from './pages/PointsPayPage';
import ProfilePage from './pages/ProfilePage';
import GateVerifyPage from './pages/GateVerifyPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';

const protectedRoutes = [
  { path: '/outpass', element: <OutpassPage /> },
  // Served by the maintenance service; the gateway routes /api/maintenance there.
  { path: '/maintenance', element: <MaintenancePage /> },
  { path: '/points', element: <PointsPage /> },
  { path: '/points/pay/:token', element: <PointsPayPage /> },
  { path: '/profile', element: <ProfilePage /> },
  // Where an outpass QR code lands. Protected, so an unauthenticated scan is
  // sent to sign-in and returned here afterwards.
  { path: '/verify/:token', element: <GateVerifyPage /> },
];

export default function App() {
  return (
    // Toast and Confirm sit outside Auth so that auth flows can use them too.
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<SignUpPage />} />

              {protectedRoutes.map(({ path, element }) => (
                <Route
                  key={path}
                  path={path}
                  element={<ProtectedRoute>{element}</ProtectedRoute>}
                />
              ))}
            </Routes>
          </Router>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
