import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import {
  ArrowLeft, Coffee, Shirt, ArrowUpRight, ArrowDownLeft,
  Lock, ShoppingBag, History, Loader2, ShieldCheck, KeyRound,
  Sparkles, Ban, Copy, Check, Wallet as WalletIcon,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { pointsApi } from '../lib/api';

const ADMIN_ROLES = ['WARDEN', 'ADMIN'];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

export default function PointsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  const [activeTab, setActiveTab] = useState('canteen'); // 'canteen' | 'laundry'
  const [section, setSection] = useState('wallet'); // 'wallet' | 'admin'

  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [hasPin, setHasPin] = useState(true); // assume true until checked, so no banner flash
  const [loading, setLoading] = useState(true);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ wallets: w }, { transactions: t }, pin] = await Promise.all([
      pointsApi.wallets(),
      pointsApi.transactions({ walletType: 'ALL', limit: 100 }),
      pointsApi.pinStatus(),
    ]);
    setWallets(w);
    setTransactions(t);
    setHasPin(pin.hasPin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) toast.error('Could not load points', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, toast]);

  const walletFor = (type) => wallets.find((w) => w.type === type);
  const txFor = (type) => transactions.filter((t) => t.wallet.type === type);

  const activeBalance = walletFor(activeTab.toUpperCase())?.balance ?? 0;
  const activeSpent = txFor(activeTab.toUpperCase())
    .filter((t) => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

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

          {isAdmin && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setSection('wallet')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  section === 'wallet' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Wallet
              </button>
              <button
                onClick={() => setSection('admin')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  section === 'admin' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Tools
              </button>
            </div>
          )}

          {section === 'wallet' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full sm:w-auto justify-center border border-slate-200">
              <button
                onClick={() => setActiveTab('canteen')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'canteen' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coffee className="w-4 h-4" /> Canteen
              </button>
              <button
                onClick={() => setActiveTab('laundry')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'laundry' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shirt className="w-4 h-4" /> Laundry
              </button>
            </div>
          )}
        </div>
      </header>

      {section === 'admin' ? (
        <AdminTools toast={toast} />
      ) : (
        <main className="max-w-6xl mx-auto px-6 py-8">
          {!hasPin && (
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">Set your payment PIN</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    You need a 4–6 digit PIN before you can pay with points at the counter.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPinModalOpen(true)}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
              >
                Set PIN
              </button>
            </div>
          )}

          {/* METRICS OVERVIEW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} Remaining Balance
                </span>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">
                  {activeBalance} <span className="text-lg font-medium text-slate-500">pts</span>
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${activeTab === 'canteen' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {activeTab === 'canteen' ? <Coffee className="w-8 h-8" /> : <Shirt className="w-8 h-8" />}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Total {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} Spent
                </span>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">
                  {activeSpent} <span className="text-lg font-medium text-slate-500">pts</span>
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-red-50 text-red-600">
                <ShoppingBag className="w-8 h-8" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              {hasPin ? 'Payment PIN is set.' : 'Payment PIN not set yet.'}
            </p>
            <button
              onClick={() => setPinModalOpen(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {hasPin ? 'Change PIN' : 'Set PIN'}
            </button>
          </div>

          <p className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 mb-6">
            To pay, scan the secret QR the counter generates for your order with your phone
            camera — it opens a payment page here where you confirm with your PIN.
          </p>

          {/* SPENDING DETAILS & HISTORY LIST */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              {activeTab === 'canteen' ? 'Canteen' : 'Laundry'} History
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              {txFor(activeTab.toUpperCase()).length} Records
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
            {txFor(activeTab.toUpperCase()).length === 0 && (
              <p className="p-6 text-center text-sm text-slate-400">No transactions yet.</p>
            )}
            {txFor(activeTab.toUpperCase()).map((item) => {
              const isCredit = item.type === 'CREDIT';
              return (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(item.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'} {item.amount} pts
                  </span>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {pinModalOpen && (
        <PinModal
          hasPin={hasPin}
          onClose={() => setPinModalOpen(false)}
          onSuccess={async () => {
            setPinModalOpen(false);
            await load();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Set / change payment PIN
// -----------------------------------------------------------------------------

function PinModal({ hasPin, onClose, onSuccess, toast }) {
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (hasPin) {
        await pointsApi.changePin({ currentPin, newPin: pin, confirmNewPin: confirmPin });
        toast.success('PIN updated', 'Your payment PIN has been changed.');
      } else {
        await pointsApi.setPin({ pin, confirmPin });
        toast.success('PIN set', 'You can now pay with points at the counter.');
      }
      await onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{hasPin ? 'Change your PIN' : 'Set your payment PIN'}</h3>
        <p className="text-xs text-slate-500">This PIN authorizes every points payment you make.</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {hasPin && (
          <PinInput label="Current PIN" value={currentPin} onChange={setCurrentPin} />
        )}
        <PinInput label={hasPin ? 'New PIN' : 'PIN (4–6 digits)'} value={pin} onChange={setPin} />
        <PinInput label="Confirm PIN" value={confirmPin} onChange={setConfirmPin} />

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="w-1/2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : hasPin ? 'Update PIN' : 'Set PIN'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PinInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        required
        placeholder="• • • •"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="w-full text-center text-xl tracking-widest font-bold border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Warden / admin tools — fill points & generate the secret QR, or top up
// -----------------------------------------------------------------------------

function AdminTools({ toast }) {
  const [tab, setTab] = useState('qr'); // 'qr' | 'topup'
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState(null);

  const loadCodes = useCallback(async () => {
    const { codes: c } = await pointsApi.listQr('ALL');
    setCodes(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadCodes();
      } catch (err) {
        if (!cancelled) toast.error('Could not load payment codes', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCodes, toast]);

  const handleGenerate = async (payload) => {
    const { qr, message } = await pointsApi.createQr(payload);
    setGenerated(qr);
    toast.success('Payment code generated', message);
    await loadCodes();
  };

  const handleCancel = async (id) => {
    try {
      const { qr, message } = await pointsApi.cancelQr(id);
      toast.info('Code cancelled', message);
      setCodes((prev) => prev.map((c) => (c.id === qr.id ? qr : c)));
      if (generated?.id === qr.id) setGenerated(null);
    } catch (err) {
      toast.error('Could not cancel', err.message);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200 mb-6">
        <button
          onClick={() => setTab('qr')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === 'qr' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Fill Points &amp; Generate QR
        </button>
        <button
          onClick={() => setTab('topup')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === 'topup' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Top Up a Student
        </button>
      </div>

      {tab === 'qr' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <QrForm onGenerate={handleGenerate} />
            {generated && (
              <div className="mt-6 border-t border-slate-100 pt-6 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Show this to the student
                </p>
                <div className="inline-block bg-white p-4 rounded-2xl border border-slate-200">
                  <QRCode value={generated.qrUrl} size={180} level="M" />
                </div>
                <p className="mt-3 text-sm font-bold text-slate-800">{generated.title}</p>
                <p className="text-xs text-slate-500 font-mono">{generated.reference}</p>
                <p className="text-lg font-extrabold text-slate-900 mt-1">{generated.amount} pts</p>
                <p className="text-xs text-slate-400 mt-1">Expires {formatDateTime(generated.expiresAt)}</p>
                <CopyLink url={generated.qrUrl} />
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" /> Codes you generated
              </h3>
            </div>
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            ) : codes.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">No payment codes yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {codes.map((qr) => (
                  <div key={qr.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{qr.title}</p>
                      <p className="text-xs text-slate-400 font-mono">{qr.reference}</p>
                      {qr.paidBy && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Paid by {qr.paidBy.name} ({qr.paidBy.rollNumber})
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">{qr.amount} pts</p>
                      <StatusPill status={qr.isExpired ? 'EXPIRED' : qr.status} />
                      {qr.status === 'PENDING' && !qr.isExpired && (
                        <button
                          onClick={() => handleCancel(qr.id)}
                          className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 ml-auto"
                        >
                          <Ban className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <TopUpForm toast={toast} />
      )}
    </main>
  );
}

function QrForm({ onGenerate }) {
  const [walletType, setWalletType] = useState('CANTEEN');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onGenerate({ walletType, amount: Number(amount), title: title || undefined });
      setAmount('');
      setTitle('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" /> Fill Points &amp; Generate Secret QR
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Enter the order amount, generate a one-time QR, and let the student scan and pay with their PIN.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Wallet</label>
        <div className="flex gap-2">
          {['CANTEEN', 'LAUNDRY'].map((wt) => (
            <button
              type="button"
              key={wt}
              onClick={() => setWalletType(wt)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                walletType === wt
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {wt === 'CANTEEN' ? 'Canteen' : 'Laundry'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (points)</label>
        <input
          type="number"
          min="1"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 60"
          className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Item / note (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Veg Thali Meal"
          maxLength={120}
          className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Generate QR Code'}
      </button>
    </form>
  );
}

function TopUpForm({ toast }) {
  const [rollNumber, setRollNumber] = useState('');
  const [walletType, setWalletType] = useState('CANTEEN');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await pointsApi.topUp({
        rollNumber,
        walletType,
        amount: Number(amount),
        note: note || undefined,
      });
      setResult(data);
      toast.success('Points added', data.message);
      setAmount('');
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <WalletIcon className="w-5 h-5 text-blue-600" /> Top Up a Student's Wallet
      </h3>
      <p className="text-xs text-slate-500 mt-1 mb-4">
        Adds points directly — fetched by roll number, so this always credits the right account.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Roll Number</label>
          <input
            type="text"
            required
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            placeholder="e.g. 21CS104"
            className="w-full border border-slate-300 rounded-xl p-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Wallet</label>
          <div className="flex gap-2">
            {['CANTEEN', 'LAUNDRY'].map((wt) => (
              <button
                type="button"
                key={wt}
                onClick={() => setWalletType(wt)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  walletType === wt
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                {wt === 'CANTEEN' ? 'Canteen' : 'Laundry'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (points)</label>
          <input
            type="number"
            min="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add Points'}
        </button>
      </form>

      {result && (
        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
          <p className="font-semibold text-slate-800">
            {result.student.name} · {result.student.rollNumber}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">Room {result.student.roomNo ?? '—'}</p>
          <p className="mt-2 text-emerald-700 font-bold">New balance: {result.wallet.balance} pts</p>
        </div>
      )}
    </div>
  );
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy payment link'}
    </button>
  );
}

function StatusPill({ status }) {
  const styles = {
    PENDING: 'bg-blue-50 text-blue-700',
    PAID: 'bg-emerald-50 text-emerald-700',
    CANCELLED: 'bg-slate-100 text-slate-500',
    EXPIRED: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[status] ?? styles.CANCELLED}`}>
      {status}
    </span>
  );
}
