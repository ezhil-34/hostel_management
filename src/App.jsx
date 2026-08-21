import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import OutpassPage from './pages/OutpassPage';
import MaintenancePage from './pages/MaintenancePage';
import PointsPage from './pages/PointsPage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/outpass" element={<OutpassPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/points" element={<PointsPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
      </Routes>
    </Router>
  );
}