import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Coffee, Shirt, ArrowUpRight, 
  QrCode, Lock, CheckCircle2, X, AlertCircle, ShoppingBag, History
} from 'lucide-react';

export default function PointsPage() {
  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('canteen'); // 'canteen' | 'laundry'

  // Canteen State
  const [canteenBalance, setCanteenBalance] = useState(450);
  const [canteenTransactions, setCanteenTransactions] = useState([
    { id: 1, title: 'Evening Coffee & Snacks', date: '22 Aug 2026, 05:30 PM', points: 40 },
    { id: 2, title: 'Lunch Meal Combo', date: '21 Aug 2026, 01:15 PM', points: 80 },
    { id: 3, title: 'Fresh Orange Juice', date: '19 Aug 2026, 11:00 AM', points: 35 },
  ]);

  // Laundry State
  const [laundryBalance, setLaundryBalance] = useState(800);
  const [laundryTransactions, setLaundryTransactions] = useState([
    { id: 101, title: '5kg Wash & Fold', date: '20 Aug 2026, 11:00 AM', points: 100 },
    { id: 102, title: 'Shirt & Trousers Ironing', date: '18 Aug 2026, 04:00 PM', points: 45 },
    { id: 103, title: 'Blanket Dry Cleaning', date: '12 Aug 2026, 10:30 AM', points: 150 },
  ]);

  // Modals & Flow State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Calculations
  const canteenSpent = canteenTransactions.reduce((sum, item) => sum + item.points, 0);
  const laundrySpent = laundryTransactions.reduce((sum, item) => sum + item.points, 0);

  // Vendor QR Mock Options based on active page
  const mockQrItems = {
    canteen: [
      { title: 'Canteen - Sandwich & Tea Combo', cost: 60 },
      { title: 'Canteen - Fresh Mango Juice', cost: 35 },
      { title: 'Canteen - Veg Thali Meal', cost: 90 },
      { title: 'Canteen - Cold Coffee', cost: 40 },
    ],
    laundry: [
      { title: 'Laundry - 5kg Express Wash & Fold', cost: 110 },
      { title: 'Laundry - 3kg Steam Ironing', cost: 50 },
      { title: 'Laundry - Jacket Dry Clean', cost: 130 },
      { title: 'Laundry - Shoe Cleaning Service', cost: 70 },
    ],
  };

  // Step 1: Scan QR
  const handleScanItem = (item) => {
    setSelectedItem(item);
    setIsScannerOpen(false);
    setPin('');
    setErrorMsg('');
    setIsPinModalOpen(true);
  };

  // Step 2: Confirm with PIN
  const handleConfirmTransaction = (e) => {
    e.preventDefault();

    if (pin !== '1234') {
      setErrorMsg('Invalid PIN. Use default PIN: 1234');
      return;
    }

    const currentBalance = activeTab === 'canteen' ? canteenBalance : laundryBalance;

    if (currentBalance < selectedItem.cost) {
      setErrorMsg(`Insufficient ${activeTab === 'canteen' ? 'Canteen' : 'Laundry'} points balance!`);
      return;
    }

    // Process Deduction & History update
    const newTx = {
      id: Date.now(),
      title: selectedItem.title,
      date: 'Just Now',
      points: selectedItem.cost,
    };

    if (activeTab === 'canteen') {
      setCanteenBalance((prev) => prev - selectedItem.cost);
      setCanteenTransactions([newTx, ...canteenTransactions]);
    } else {
      setLaundryBalance((prev) => prev - selectedItem.cost);
      setLaundryTransactions([newTx, ...laundryTransactions]);
    }

    setIsPinModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative">
      {/* HEADER & TOP NAV */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm">
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-xl font-bold ml-4 hidden sm:block">Points Portal</h1>
          </div>

          {/* INDEPENDENT PAGE SWITCHER / NAV TABS */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full sm:w-auto justify-center border border-slate-200">
            <button
              onClick={() => setActiveTab('canteen')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'canteen'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Coffee className="w-4 h-4" /> Canteen
            </button>
            <button
              onClick={() => setActiveTab('laundry')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'laundry'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shirt className="w-4 h-4" /> Laundry
            </button>
          </div>

          {/* DEDICATED PAGE QR SCANNER BUTTON */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className={`w-full sm:w-auto text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm ${
              activeTab === 'canteen' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <QrCode className="w-4 h-4" /> Scan {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} QR
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA FOR ACTIVE PAGE */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {/* PAGE METRICS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Remaining Points */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} Remaining Balance
              </span>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {activeTab === 'canteen' ? canteenBalance : laundryBalance} <span className="text-lg font-medium text-slate-500">pts</span>
              </p>
            </div>
            <div className={`p-4 rounded-2xl ${activeTab === 'canteen' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {activeTab === 'canteen' ? <Coffee className="w-8 h-8" /> : <Shirt className="w-8 h-8" />}
            </div>
          </div>

          {/* Total Points Spent */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} Spent
              </span>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">
                {activeTab === 'canteen' ? canteenSpent : laundrySpent} <span className="text-lg font-medium text-slate-500">pts</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-red-50 text-red-600">
              <ShoppingBag className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* SPENDING DETAILS & HISTORY LIST */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-500" />
            {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} Spending History
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            {(activeTab === 'canteen' ? canteenTransactions : laundryTransactions).length} Records
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
          {(activeTab === 'canteen' ? canteenTransactions : laundryTransactions).map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                  <p className="text-xs text-slate-400">{item.date}</p>
                </div>
              </div>
              <span className="font-bold text-red-600 text-sm">- {item.points} pts</span>
            </div>
          ))}
        </div>
      </main>

      {/* SCANNER MODAL (PAGE SPECIFIC) */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <button
              onClick={() => setIsScannerOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
              activeTab === 'canteen' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {activeTab === 'canteen' ? 'Canteen Counter' : 'Laundry Desk'} Scanner
            </span>

            <h3 className="text-lg font-bold text-slate-900 mt-2 mb-1">
              Scan {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} QR
            </h3>
            <p className="text-xs text-slate-500 mb-4">Point camera at QR code or pick a simulated scan below</p>

            {/* Simulated Camera Viewfinder */}
            <div className="w-full h-40 bg-slate-900 rounded-2xl relative flex items-center justify-center overflow-hidden mb-4 border-2 border-slate-800">
              <div className={`w-28 h-28 border-2 border-dashed rounded-xl animate-pulse flex items-center justify-center ${
                activeTab === 'canteen' ? 'border-amber-400' : 'border-indigo-400'
              }`}>
                <QrCode className="w-10 h-10 text-white/40" />
              </div>
            </div>

            {/* QR Mock Presets */}
            <p className="text-left text-xs font-semibold text-slate-600 mb-2">Select Mock Scanned Item:</p>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {mockQrItems[activeTab].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleScanItem(item)}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all flex justify-between items-center text-xs"
                >
                  <span className="font-semibold text-slate-800">{item.title}</span>
                  <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">
                    {item.cost} pts
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PIN & AUTHORIZATION MODAL */}
      {isPinModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsPinModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                activeTab === 'canteen' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Authorize Transaction</h3>
              <p className="text-xs text-slate-500">Confirm payment with your 4-digit PIN</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 mb-4 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Item / Service:</span>
                <span className="font-semibold text-slate-900">{selectedItem.title}</span>
              </div>
              <div className="flex justify-between text-slate-600 border-t border-slate-200/60 pt-2">
                <span>Points to Deduct:</span>
                <span className="font-bold text-red-600 text-sm">-{selectedItem.cost} pts</span>
              </div>
            </div>

            <form onSubmit={handleConfirmTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 text-center mb-1">
                  Enter Security PIN
                </label>
                <input
                  type="password"
                  maxLength="4"
                  required
                  placeholder="• • • •"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full text-center text-xl tracking-widest font-bold border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-[10px] text-slate-400 text-center mt-1">Demo PIN: 1234</p>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`w-1/2 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm ${
                    activeTab === 'canteen' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION SUCCESS MODAL */}
      {isSuccessModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900">Payment Successful!</h3>
            <p className="text-xs text-slate-500 mt-1">Point deduction logged successfully.</p>

            <div className="bg-slate-50 rounded-2xl p-4 my-5 border border-slate-200 text-xs space-y-2">
              <p className="font-bold text-slate-800 text-sm">{selectedItem.title}</p>
              <p className="text-red-600 font-bold text-base">-{selectedItem.cost} Points</p>
              <hr className="border-slate-200" />
              <p className="text-slate-500">
                New {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} Balance:{' '}
                <span className="font-bold text-slate-900">
                  {activeTab === 'canteen' ? canteenBalance : laundryBalance} pts
                </span>
              </p>
            </div>

            <button
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}