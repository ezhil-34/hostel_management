import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Wrench, Upload, Clock, CheckCircle2, 
  AlertCircle, X, User, Phone, Hash, Home 
} from 'lucide-react';

export default function MaintenancePage() {
  // Auto-fetched Student Profile Data
  const studentInfo = {
    name: 'John Doe',
    rollNumber: '21CS104',
    phone: '+91 98765 43210',
    roomNo: 'B-302',
  };

  // State for complaints tracker
  const [complaints, setComplaints] = useState([
    {
      id: 'MNT-104',
      category: 'Plumbing',
      description: 'Water leak in room 302 attached washroom.',
      status: 'In Progress',
      time: 'Logged 2h ago',
      studentName: 'John Doe',
      rollNumber: '21CS104',
      phone: '+91 98765 43210',
      roomNo: 'B-302',
    },
    {
      id: 'MNT-098',
      category: 'Furniture / Carpentry',
      description: 'Replaced with new chair by carpentry staff.',
      status: 'Resolved',
      time: 'Yesterday',
      studentName: 'John Doe',
      rollNumber: '21CS104',
      phone: '+91 98765 43210',
      roomNo: 'B-302',
    },
  ]);

  // Form State
  const [category, setCategory] = useState('Plumbing');
  const [description, setDescription] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Trigger Confirmation Popup Modal
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    setIsConfirmOpen(true);
  };

  // Final Ticket Creation after Confirmation
  const handleFinalSubmit = () => {
    const newTicket = {
      id: `MNT-${Math.floor(100 + Math.random() * 900)}`,
      category: category,
      description: description,
      status: 'In Progress',
      time: 'Just now',
      studentName: studentInfo.name,
      rollNumber: studentInfo.rollNumber,
      phone: studentInfo.phone,
      roomNo: studentInfo.roomNo,
    };

    setComplaints([newTicket, ...complaints]);
    setDescription('');
    setIsConfirmOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
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
        {/* Clean Report Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> Report an Issue
          </h2>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
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
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-sm"
            >
              Submit Ticket
            </button>
          </form>
        </div>

        {/* Complaints Tracker with Student Profile Details */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Your Complaints</h2>

          {complaints.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  {item.status === 'In Progress' ? (
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" /> In Progress
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Resolved
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-400">#{item.id}</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">{item.time}</span>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-base">{item.category} Issue</h3>
                <p className="text-sm text-slate-600 mt-0.5">{item.description}</p>
              </div>

              {/* Student Details attached inside the ticket */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 bg-slate-50/60 p-2.5 rounded-xl">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <User className="w-3.5 h-3.5 text-slate-400" /> {item.studentName}
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-400" /> {item.rollNumber}
                </span>
                <span className="flex items-center gap-1">
                  <Home className="w-3.5 h-3.5 text-slate-400" /> Room {item.roomNo}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {item.phone}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* CONFIRMATION POPUP MODAL */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center relative">
            <button 
              onClick={() => setIsConfirmOpen(false)} 
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Confirm Ticket Submission</h3>
            <p className="text-xs text-slate-500 mb-4">
              Review your issue summary before logging this request with hostel staff.
            </p>

            <div className="bg-slate-50 rounded-xl p-3 text-left text-xs text-slate-600 space-y-1.5 mb-5 border border-slate-200">
              <p><strong>Category:</strong> {category}</p>
              <p><strong>Description:</strong> {description}</p>
              <hr className="my-1.5 border-slate-200" />
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Auto-Attaching Student Profile:</p>
              <p><strong>Name:</strong> {studentInfo.name} ({studentInfo.rollNumber})</p>
              <p><strong>Room / Contact:</strong> Room {studentInfo.roomNo} • {studentInfo.phone}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleFinalSubmit}
                className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}