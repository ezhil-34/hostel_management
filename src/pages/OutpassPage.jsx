import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, QrCode, Plus, Calendar, Clock, CheckCircle2 } from 'lucide-react';

export default function OutpassPage() {
  const [outpasses] = useState([
    {
      id: 'OUT-8921',
      destination: 'Home / Local Market',
      leaveTime: '2026-08-22 10:00 AM',
      returnTime: '2026-08-22 08:00 PM',
      reason: 'Personal work',
      status: 'Approved',
    },
    {
      id: 'OUT-8810',
      destination: 'City Center',
      leaveTime: '2026-08-15 02:00 PM',
      returnTime: '2026-08-15 09:00 PM',
      reason: 'Shopping',
      status: 'Completed',
    },
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold">Outpass Management</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Request Outpass
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Active QR Outpass Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white mb-8 shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <span className="bg-blue-500/30 text-blue-100 text-xs font-semibold px-3 py-1 rounded-full border border-blue-400/30">
                Active Outpass
              </span>
              <h2 className="text-2xl font-bold mt-2">Home / Local Market</h2>
              <div className="flex items-center gap-4 text-blue-100 text-sm mt-3">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Today</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 10:00 AM - 08:00 PM</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl flex flex-col items-center">
              <QrCode className="w-24 h-24 text-slate-900" />
              <span className="text-slate-600 text-xs font-mono mt-1">#OUT-8921</span>
            </div>
          </div>
        </div>

        {/* History Table */}
        <h3 className="text-lg font-bold text-slate-800 mb-4">Outpass History</h3>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="p-4">Pass ID</th>
                <th className="p-4">Destination</th>
                <th className="p-4">Leave Time</th>
                <th className="p-4">Return Time</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outpasses.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-4 font-mono font-medium text-slate-900">{item.id}</td>
                  <td className="p-4 font-medium text-slate-800">{item.destination}</td>
                  <td className="p-4">{item.leaveTime}</td>
                  <td className="p-4">{item.returnTime}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}