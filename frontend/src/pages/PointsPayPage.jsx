import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, Lock, CheckCircle2, XCircle, Coffee, Shirt, ArrowLeft, KeyRound,
} from 'lucide-react';

import { useToast } from '../context/ToastContext';
import { pointsApi } from '../lib/api';

/**
 * Where a counter's secret payment QR lands when scanned. Mirrors
 * GateVerifyPage.jsx's shape: read the token, show what it is worth, then
 * require the signed-in student's own PIN before anything moves.
 */
export default function PointsPayPage() {
  const { token } = useParams();
  const toast = useToast();

  const [state, setState] = useState({ loading: true, error: '', qr: null });
  const [hasPin, setHasPin] = useState(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(
    async (isCancelled = () => false) => {
      try {
        const [{ qr }, pinInfo] = await Promise.all([
          pointsApi.previewPay(token),
          pointsApi.pinStatus(),
        ]);
        if (isCancelled()) return;
        setState({ loading: false, error: '', qr });
        setHasPin(pinInfo.hasPin);
      } catch (err) {
        if (!isCancelled()) setState({ loading: false, error: err.message, qr: null });
      }
    },
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load(() => cancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const pay = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await pointsApi.pay(token, { pin });
      toast.success('Payment successful', data.message);
      setResult(data);
    } catch (err) {
      toast.error('Payment failed', err.message);
      setPin('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (state.loading || hasPin === null) {
    return (
      <Shell>
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-slate-500">Reading payment code…</p>
      </Shell>
    );
  }

  if (result) {
    return (
      <Shell>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">Payment successful!</h1>
        <p className="mt-1 text-sm text-slate-500">{result.qr.title}</p>
        <div className="mt-4 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm space-y-1.5">
          <Row label="Paid" value={`${result.transaction.amount} pts`} highlight="red" />
          <Row label="New balance" value={`${result.wallet.balance} pts`} highlight="emerald" />
        </div>
        <Link
          to="/points"
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 text-sm transition-colors"
        >
          Go to Points Portal
        </Link>
      </Shell>
    );
  }

  if (state.error) {
    return (
      <Shell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-3">
          <XCircle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Payment code not valid</h1>
        <p className="mt-1.5 text-sm text-slate-600">{state.error}</p>
        <Link to="/points" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Back to Points Portal
        </Link>
      </Shell>
    );
  }

  const { qr } = state;

  if (qr.status !== 'PENDING' || qr.isExpired) {
    const label = qr.isExpired ? 'expired' : qr.status.toLowerCase();
    return (
      <Shell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-3">
          <XCircle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">This code was already {label}</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Ask the counter to generate a new payment code if you still need to pay.
        </p>
      </Shell>
    );
  }

  const Icon = qr.walletType === 'CANTEEN' ? Coffee : Shirt;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={`p-5 text-white ${qr.walletType === 'CANTEEN' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-indigo-600 to-indigo-700'}`}>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full">
              <Icon className="h-3.5 w-3.5" /> {qr.walletType === 'CANTEEN' ? 'Canteen' : 'Laundry'} Payment
            </span>
            <h1 className="mt-2 text-xl font-bold">{qr.title}</h1>
            <p className="text-sm text-white/80 font-mono">{qr.reference}</p>
          </div>

          <div className="p-5">
            <p className="text-center text-4xl font-extrabold text-slate-900">{qr.amount} <span className="text-lg font-medium text-slate-400">pts</span></p>

            {!hasPin ? (
              <SetPinInline
                onDone={async () => {
                  setHasPin(true);
                  toast.success('PIN set', 'You can pay now.');
                }}
                toast={toast}
              />
            ) : (
              <form onSubmit={pay} className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 text-center mb-1.5 flex items-center justify-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Enter your PIN to pay
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="• • • •"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-widest font-bold border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Pay ${qr.amount} pts`}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetPinInline({ onDone, toast }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await pointsApi.setPin({ pin, confirmPin });
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
        <KeyRound className="w-3.5 h-3.5" /> Set a PIN first — this is your first payment.
      </p>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        required
        placeholder="New PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        className="w-full text-center text-xl tracking-widest font-bold border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        required
        placeholder="Confirm PIN"
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
        className="w-full text-center text-xl tracking-widest font-bold border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Set PIN & Continue'}
      </button>
    </form>
  );
}

function Row({ label, value, highlight }) {
  const colors = { red: 'text-red-600', emerald: 'text-emerald-700' };
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${colors[highlight] ?? 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="flex flex-col items-center">{children}</div>
      </div>
    </div>
  );
}
