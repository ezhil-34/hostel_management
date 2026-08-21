import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench, Upload, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold">Maintenance Portal</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Report Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> Report an Issue
          </h2>
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Category</label>
              <select className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>Furniture / Carpentry</option>
                <option>Cleanliness</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea
                rows="3"
                placeholder="Describe the issue in detail..."
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Upload Photo</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 transition-colors">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <span className="text-xs text-slate-500">Click to upload photo</span>
              </div>
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              Submit Ticket
            </button>
          </form>
        </div>

        {/* Complaints Tracker */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Your Complaints</h2>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" /> In Progress
                </span>
                <span className="text-xs font-mono text-slate-400">#MNT-104</span>
              </div>
              <h3 className="font-bold text-slate-800">Bathroom Tap Leaking</h3>
              <p className="text-sm text-slate-500 mt-1">Water leak in room 302 attached washroom.</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">Logged 2h ago</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Resolved
                </span>
                <span className="text-xs font-mono text-slate-400">#MNT-098</span>
              </div>
              <h3 className="font-bold text-slate-800">Study Table Chair Broken</h3>
              <p className="text-sm text-slate-500 mt-1">Replaced with new chair by carpentry staff.</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">Yesterday</span>
          </div>
        </div>
      </main>
    </div>
  );
}