import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { 
  ArrowLeft, Plus, Calendar, Clock, CheckCircle2, 
  X, AlertCircle, Eye 
} from 'lucide-react';

export default function OutpassPage() {
  // Student Profile Info
  const studentInfo = {
    name: 'John Doe',
    rollNumber: '21CS104',
    phone: '+91 98765 43210',
    roomNo: 'B-302',
  };

  const [outpasses, setOutpasses] = useState([
    {
      id: 'OUT-8921',
      studentName: 'John Doe',
      rollNumber: '21CS104',
      phone: '+91 98765 43210',
      roomNo: 'B-302',
      destination: 'Home / Local Market',
      leaveTime: '2026-08-22 10:00 AM',
      returnTime: '2026-08-22 08:00 PM',
      reason: 'Personal work',
      status: 'Approved',
    },
    {
      id: 'OUT-8810',
      studentName: 'John Doe',
      rollNumber: '21CS104',
      phone: '+91 98765 43210',
      roomNo: 'B-302',
      destination: 'City Center',
      leaveTime: '2026-08-15 02:00 PM',
      returnTime: '2026-08-15 09:00 PM',
      reason: 'Shopping',
      status: 'Completed',
    },
  ]);

  const activeOutpass = outpasses[0];

  // Modal Control
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    roomNo: studentInfo.roomNo,
    destination: '',
    leaveTime: '',
    returnTime: '',
  });

  // Generates scannable plain text format for Google Scanner / Google Lens
  const getQrTextData = (pass) => {
    if (!pass) return '';
    return `=== OUTPASS VERIFICATION ===
Pass ID: #${pass.id}
Name: ${pass.studentName || studentInfo.name}
Roll No: ${pass.rollNumber || studentInfo.rollNumber}
Phone: ${pass.phone || studentInfo.phone}
Room No: ${pass.roomNo || studentInfo.roomNo}
Destination: ${pass.destination}
Leave: ${pass.leaveTime}
Return: ${pass.returnTime}
Status: ${pass.status}`;
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setIsConfirmOpen(true);
  };

  const handleFinalConfirm = () => {
    const newOutpass = {
      id: `OUT-${Math.floor(1000 + Math.random() * 9000)}`,
      studentName: studentInfo.name,
      rollNumber: studentInfo.rollNumber,
      phone: studentInfo.phone,
      roomNo: formData.roomNo,
      destination: formData.destination,
      leaveTime: formData.leaveTime.replace('T', ' '),
      returnTime: formData.returnTime.replace('T', ' '),
      reason: `Room ${formData.roomNo}`,
      status: 'Approved',
    };

    setOutpasses([newOutpass, ...outpasses]);
    setFormData({ roomNo: studentInfo.roomNo, destination: '', leaveTime: '', returnTime: '' });
    setIsConfirmOpen(false);
    setIsFormOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium">
            <ArrowLeft className="w-5 h-5" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold">Outpass Management</h1>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Request Outpass
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Active Outpass Card */}
        {activeOutpass && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white mb-8 shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <span className="bg-blue-500/30 text-blue-100 text-xs font-semibold px-3 py-1 rounded-full border border-blue-400/30">
                  Active Outpass
                </span>
                <h2 className="text-2xl font-bold mt-2">{activeOutpass.destination}</h2>
                <div className="flex flex-wrap items-center gap-4 text-blue-100 text-sm mt-3">
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {activeOutpass.leaveTime.split(' ')[0]}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {activeOutpass.leaveTime.split(' ')[1]} - {activeOutpass.returnTime.split(' ')[1]}</span>
                </div>
              </div>

              {/* SVG QR Code Rendering */}
              <div 
                onClick={() => setIsQrModalOpen(true)}
                className="bg-white p-3 rounded-2xl flex flex-col items-center cursor-pointer hover:scale-105 transition-transform shadow-lg"
              >
                <div className="p-1 bg-white rounded-lg">
                  <QRCode 
                    value={getQrTextData(activeOutpass)} 
                    size={112}
                    level="M"
                  />
                </div>
                <span className="text-slate-900 font-bold text-[11px] mt-2 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-blue-600" />  Scan Here
                </span>
                <span className="text-slate-500 text-[10px] font-mono">#{activeOutpass.id}</span>
              </div>
            </div>
          </div>
        )}

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

      {/* REQUEST OUTPASS FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Request New Outpass</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Room Number</label>
                <input
                  type="text"
                  name="roomNo"
                  required
                  placeholder="e.g. B-302"
                  value={formData.roomNo}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Destination</label>
                <input
                  type="text"
                  name="destination"
                  required
                  placeholder="e.g. City Mall"
                  value={formData.destination}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Leave Time</label>
                <input
                  type="datetime-local"
                  name="leaveTime"
                  required
                  value={formData.leaveTime}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Return Time</label>
                <input
                  type="datetime-local"
                  name="returnTime"
                  required
                  value={formData.returnTime}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION POPUP MODAL */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Outpass Request</h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to request an outpass for <span className="font-semibold text-slate-800">{formData.destination}</span>?
            </p>

            <div className="bg-slate-50 rounded-xl p-3 text-left text-xs text-slate-600 space-y-1 mb-6 border border-slate-200">
              <p><strong>Room:</strong> {formData.roomNo}</p>
              <p><strong>Leave:</strong> {formData.leaveTime.replace('T', ' ')}</p>
              <p><strong>Return:</strong> {formData.returnTime.replace('T', ' ')}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleFinalConfirm}
                className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LARGE ENLARGED QR MODAL FOR GATES */}
      {isQrModalOpen && activeOutpass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-100 text-center">
            <button 
              onClick={() => setIsQrModalOpen(false)} 
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved Pass
            </span>
            <h3 className="text-xl font-bold text-slate-900">Scan Outpass QR</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: #{activeOutpass.id}</p>

            {/* Enlarged SVG QR Code */}
            <div className="bg-slate-50 p-6 rounded-2xl flex flex-col items-center justify-center my-6 border border-slate-200">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <QRCode 
                  value={getQrTextData(activeOutpass)} 
                  size={200}
                  level="M"
                />
              </div>
              <p className="text-xs font-medium text-slate-600 mt-4"></p>
            </div>

            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}