import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Coffee, Shirt, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function PointsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold">Points Tracker</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Balances Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-500">Total Points</span>
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">1,250</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-500">Snacks Balance</span>
              <Coffee className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">450 pts</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-500">Laundry Balance</span>
              <Shirt className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900">800 pts</p>
          </div>
        </div>

        {/* Transactions List */}
        <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Transactions</h3>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Snack Counter - Evening Coffee</p>
                <p className="text-xs text-slate-400">22 Aug 2026, 05:30 PM</p>
              </div>
            </div>
            <span className="font-bold text-red-600">- 40 pts</span>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Laundry - 5kg Wash & Fold</p>
                <p className="text-xs text-slate-400">20 Aug 2026, 11:00 AM</p>
              </div>
            </div>
            <span className="font-bold text-red-600">- 100 pts</span>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Monthly Top-up</p>
                <p className="text-xs text-slate-400">01 Aug 2026, 09:00 AM</p>
              </div>
            </div>
            <span className="font-bold text-emerald-600">+ 1,000 pts</span>
          </div>
        </div>
      </main>
    </div>
  );
}