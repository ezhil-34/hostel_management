import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Wrench, Wallet, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export default function HomePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  // Get first letter of user name
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Sign out?',
      message: 'You will need your password to sign back in.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      tone: 'logout',
    });
    if (!confirmed) return;

    await logout();
    toast.info('Signed out', 'See you next time.');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold leading-tight text-slate-900">Hostel Management</h1>
              <p className="text-xs text-slate-500 font-medium">Platform for seamless hostel operations</p>
            </div>
          </div>

          {/* Conditional Rendering: Profile Icon + Logout OR Auth Buttons */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Avatar + name open the profile page */}
                <Link
                  to="/profile"
                  title="View your profile"
                  className="flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-100"
                >
                  <div className="w-9 h-9 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center text-sm shadow-sm uppercase">
                    {userInitial}
                  </div>
                  <span className="text-sm font-semibold text-slate-800 hidden sm:inline">
                    {user.name}
                  </span>
                </Link>

                {/* Log Out Button */}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-3.5 py-2 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Header */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            3 key tools for hassle-free hostel management
          </h2>
          <p className="text-slate-500 mt-2 text-base sm:text-lg">
            Three focused tools that replace paperwork, waiting lines, and lost registers.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Outpass Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Outpass</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Request and manage your hostel outpass digitally with quick approvals and secure QR-based entry and exit.
              </p>
            </div>
            <Link
              to="/outpass"
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
            >
              Manage Outpass <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Maintenance Card */}
          <div className="bg-white border-2 border-blue-400/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-md shadow-blue-500/5 relative">
            <div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Maintenance</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Report hostel issues, upload photos, track complaints, and stay updated until the issue is resolved.
              </p>
            </div>
            <Link
              to="/maintenance"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
            >
              Report an Issue <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Points Tracker Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <Wallet className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Points Tracker</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Track your hostel points, view transactions, and monitor your Snacks and Laundry balances in one place.
              </p>
            </div>
            <Link
              to="/points"
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
            >
              View Points <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}