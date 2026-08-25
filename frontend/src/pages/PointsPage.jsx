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
import {
  ArrowLeft,
  Coffee,
  Shirt,
  QrCode,
  Lock,
  CheckCircle2,
  X,
  ShoppingBag,
  History,
  Loader2,
  ServerCrash,
  RefreshCw,
  Wallet as WalletIcon,
  Plus,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { pointsApi, ApiRequestError } from '../lib/api';
import { formatDateTime } from '../lib/datetime';
import { PinPromptModal, SetPinModal } from '../components/PinModal';

const OVERSIGHT_ROLES = ['WARDEN', 'ADMIN'];

const WALLET_META = {
  CANTEEN: { label: 'Canteen', Icon: Coffee },
  LAUNDRY: { label: 'Laundry', Icon: Shirt },
};

export default function PointsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const isOversight = OVERSIGHT_ROLES.includes(user?.role);

  const [wallets, setWallets] = useState([]);
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  /** Staff have wallets too, but topping students up is what they came for. */
  const [tab, setTab] = useState(() => (isOversight ? 'topup' : 'CANTEEN'));

  // The purchase flow, one step at a time.
  const [scannerOpen, setScannerOpen] = useState(false);
  const [counterMenu, setCounterMenu] = useState(null);
  const [pendingItem, setPendingItem] = useState(null);
  const [pinError, setPinError] = useState('');
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const [setPinOpen, setSetPinOpen] = useState(false);
  const [pinSetupError, setPinSetupError] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  // --- loading ---------------------------------------------------------------

  const load = useCallback(async () => {
    const [{ wallets: w }, { counters: c }] = await Promise.all([
      pointsApi.wallets(),
      pointsApi.counters(),
    ]);
    setWallets(w);
    setCounters(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) setLoadError('');
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not reach the server. Is the API running?',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const activeWallet = useMemo(() => wallets.find((w) => w.type === tab) ?? null, [wallets, tab]);

  const hasPin = wallets.some((w) => w.hasPin);

  // --- the purchase flow -----------------------------------------------------

  const openScanner = () => {
    setScannerOpen(true);
    setCounterMenu(null);
  };

  /**
   * Stands in for pointing a camera at a counter's QR code. The token is what
   * the code contains, and the menu and prices come back from the server — the
   * browser never gets to say what something costs.
   */
  const scanCounter = async (token) => {
    try {
      const { counter } = await pointsApi.counter(token);
      setCounterMenu({ ...counter, token });
    } catch (err) {
      toast.error('Could not read that code', err.message);
    }
  };

  const chooseItem = (item) => {
    if (!hasPin) {
      setScannerOpen(false);
      setCounterMenu(null);
      setPinSetupError('');
      setSetPinOpen(true);
      toast.info('Set a PIN first', 'You need a spending PIN before your first purchase.');
      return;
    }
    setPendingItem(item);
    setPinError('');
    setScannerOpen(false);
  };

  const pay = async (pin) => {
    setPaying(true);
    setPinError('');
    try {
      const result = await pointsApi.spend({
        counterToken: counterMenu.token,
        itemId: pendingItem.id,
        pin,
      });
      await load();
      setPendingItem(null);
      setReceipt({ ...result, counterName: counterMenu.name });
      setCounterMenu(null);
    } catch (err) {
      // A wrong PIN belongs on the PIN box, not in a toast that covers it.
      setPinError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const savePin = async (payload) => {
    setSavingPin(true);
    setPinSetupError('');
    try {
      const { message } = await pointsApi.setPin(payload);
      await load();
      setSetPinOpen(false);
      toast.success('PIN saved', message);
    } catch (err) {
      setPinSetupError(err.message);
    } finally {
      setSavingPin(false);
    }
  };

  // --- render ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const walletTabs = wallets.map((w) => ({ id: w.type, ...WALLET_META[w.type] }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" /> Back to Dashboard
          </Link>
          <h1 className="order-last w-full text-xl font-bold sm:order-none sm:w-auto">Points</h1>

          {tab !== 'topup' && (
            <button
              type="button"
              onClick={openScanner}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <QrCode className="h-4 w-4" /> Scan a counter
            </button>
          )}
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          {walletTabs.map(({ id, label, Icon }) => (
            <TabButton key={id} active={tab === id} onClick={() => setTab(id)} Icon={Icon}>
              {label}
            </TabButton>
          ))}
          {isOversight && (
            <TabButton active={tab === 'topup'} onClick={() => setTab('topup')} Icon={Plus}>
              Top up a student
            </TabButton>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-8 text-center">
            <ServerCrash className="mx-auto h-8 w-8 text-red-500" />
            <h2 className="mt-3 text-base font-bold text-red-700">{loadError}</h2>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}

        {tab === 'topup' && isOversight ? (
          <TopUpPanel toast={toast} onCredited={load} />
        ) : (
          activeWallet && (
            <WalletPanel
              wallet={activeWallet}
              hasPin={hasPin}
              onSetPin={() => {
                setPinSetupError('');
                setSetPinOpen(true);
              }}
            />
          )
        )}
      </main>

      {scannerOpen && (
        <ScannerModal
          counters={counters}
          menu={counterMenu}
          walletType={tab === 'topup' ? 'CANTEEN' : tab}
          balance={activeWallet?.balance ?? 0}
          onScan={scanCounter}
          onPick={chooseItem}
          onBack={() => setCounterMenu(null)}
          onClose={() => {
            setScannerOpen(false);
            setCounterMenu(null);
          }}
        />
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

      {pendingItem && counterMenu && (
        <PinPromptModal
          item={pendingItem}
          counterName={counterMenu.name}
          balance={wallets.find((w) => w.type === counterMenu.type)?.balance ?? 0}
          error={pinError}
          submitting={paying}
          onCancel={() => {
            setPendingItem(null);
            setPinError('');
          }}
          onSubmit={pay}
        />
      )}

      {setPinOpen && (
        <SetPinModal
          error={pinSetupError}
          submitting={savingPin}
          onCancel={() => setSetPinOpen(false)}
          onSubmit={savePin}
        />
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TabButton({ active, onClick, Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function WalletPanel({ wallet, hasPin, onSetPin }) {
  const { label, Icon } = WALLET_META[wallet.type];
  const debits = wallet.transactions.filter((t) => t.type === 'DEBIT');
  const spent = debits.reduce((sum, t) => sum + t.points, 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label} balance
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">{wallet.balance}</p>
              <p className="mt-1 text-xs text-slate-400">points</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Spent recently
              </p>
              <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">{spent}</p>
              <p className="mt-1 text-xs text-slate-400">
                across {debits.length} purchase{debits.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {!hasPin ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">No spending PIN yet</p>
              <p className="text-xs text-amber-800">
                Set one and it is asked for on every purchase, on both wallets.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSetPin}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Set a PIN
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3">
          <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-500">
            <Lock className="h-3.5 w-3.5 text-emerald-600" /> Spending PIN is set
          </p>
          <button
            type="button"
            onClick={onSetPin}
            className="text-xs font-semibold text-blue-700 transition-colors hover:text-blue-900"
          >
            Change it
          </button>
        </div>
      )}

      <section className="mt-6">
        <h2 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-slate-800">
          <History className="h-4 w-4" /> Statement
        </h2>

        {wallet.transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <WalletIcon className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">Nothing here yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Ask the hostel office to add points, then scan a counter to spend them.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {wallet.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      t.type === 'CREDIT'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {t.type === 'CREDIT' ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDateTime(t.createdAt)}
                      {t.counterName ? ` · ${t.counterName}` : ''}
                      {t.type === 'CREDIT' && t.actorName ? ` · added by ${t.actorName}` : ''}
                      {` · ${t.reference}`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      t.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'
                    }`}
                  >
                    {t.type === 'CREDIT' ? '+' : '−'}
                    {t.points}
                  </p>
                  <p className="text-xs tabular-nums text-slate-400">{t.balanceAfter} left</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Counter picker, then that counter's menu. Stands in for a camera. */
function ScannerModal({ counters, menu, walletType, balance, onScan, onPick, onBack, onClose }) {
  const relevant = counters.filter((c) => c.type === walletType);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 id="scanner-title" className="text-base font-bold text-slate-900">
                {menu ? menu.name : 'Scan a counter'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {menu
                  ? `${balance} points available`
                  : 'Point your camera at the QR code on the counter.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!menu ? (
          <div className="p-5">
            <p className="mb-3 text-xs text-slate-500">
              No camera here yet — pick the counter you are standing at and it works exactly as a
              scan would.
            </p>
            <ul className="space-y-2">
              {relevant.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onScan(c.qrToken)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                    <QrCode className="h-4 w-4 text-slate-400" />
                  </button>
                </li>
              ))}
              {relevant.length === 0 && (
                <li className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                  No counters are open for this wallet right now.
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div className="p-5">
            <ul className="space-y-2">
              {menu.items.map((item) => {
                const affordable = item.points <= balance;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onPick(item)}
                      disabled={!affordable}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                        affordable
                          ? 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                          : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-70'
                      }`}
                    >
                      <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                        {item.points}
                        {!affordable && (
                          <span className="ml-2 text-xs font-medium text-red-600">not enough</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {menu.items.length === 0 && (
                <li className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                  This counter has nothing on its menu right now.
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
            >
              ← Pick a different counter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptModal({ receipt, onClose }) {
  const t = receipt.transaction;
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 id="receipt-title" className="mt-4 text-lg font-bold text-slate-900">
          Paid {t.points} points
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t.title} · {receipt.counterName}
        </p>

        <dl className="mt-5 space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-left">
          <div className="flex justify-between gap-3 text-xs">
            <dt className="text-slate-500">Receipt</dt>
            <dd className="font-mono font-medium text-slate-800">{t.reference}</dd>
          </div>
          <div className="flex justify-between gap-3 text-xs">
            <dt className="text-slate-500">Balance left</dt>
            <dd className="font-semibold tabular-nums text-slate-800">{receipt.balance}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** Warden and admin: find a student and add points to one of their wallets. */
function TopUpPanel({ toast, onCredited }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);

  const [type, setType] = useState('CANTEEN');
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const { students } = await pointsApi.findStudents(q.trim());
      setResults(students);
      if (students.length === 0) toast.info('No match', `Nothing found for “${q.trim()}”.`);
    } catch (err) {
      toast.error('Search failed', err.message);
    } finally {
      setSearching(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const amount = Number(points);
    if (!Number.isInteger(amount) || amount < 1) {
      setError('Enter a whole number of points, at least 1.');
      return;
    }
    if (note.trim().length < 3) {
      setError('Say what this is for — it appears on the student’s statement.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await pointsApi.credit({
        identifier: selected.rollNumber ?? selected.email,
        type,
        points: amount,
        note: note.trim(),
      });
      toast.success('Points added', result.message);
      setPoints('');
      setNote('');
      // Refresh the row so the new balance shows without searching again.
      const { students } = await pointsApi.findStudents(q.trim());
      setResults(students);
      setSelected(students.find((s) => s.id === selected.id) ?? null);
      await onCredited();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-800">Find a student</h2>
        <p className="mt-0.5 text-xs text-slate-500">Search by name, roll number or email.</p>

        <form onSubmit={search} className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. 21CS104"
            aria-label="Search students"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={searching || !q.trim()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelected(s)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected?.id === s.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.rollNumber}
                  {s.roomNo ? ` · Room ${s.roomNo}` : ''}
                </p>
                <p className="mt-1 text-xs tabular-nums text-slate-600">
                  Canteen {s.balances.CANTEEN ?? 0} · Laundry {s.balances.LAUNDRY ?? 0}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-800">Add points</h2>
        {!selected ? (
          <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
            Pick a student on the left first.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">{selected.name}</p>
              <p className="text-xs text-slate-500">{selected.rollNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="wallet-type"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Wallet
                </label>
                <select
                  id="wallet-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="CANTEEN">Canteen</option>
                  <option value="LAUNDRY">Laundry</option>
                </select>
              </div>
              <div>
                <label htmlFor="points" className="mb-1 block text-xs font-semibold text-slate-600">
                  Points
                </label>
                <input
                  id="points"
                  type="number"
                  min="1"
                  step="1"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="note" className="mb-1 block text-xs font-semibold text-slate-600">
                What is this for?
              </label>
              <input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. 500 rupees paid at the hostel office"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-400">
                Appears on the student’s statement next to your name.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add points
            </button>
          </form>
        )}
      </section>
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