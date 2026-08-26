import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Coffee,
  History,
  Loader2,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ServerCrash,
  Shirt,
  ShoppingBag,
  X,
  ScanLine,
} from 'lucide-react';

import QrScanner from '../components/QrScanner';
import { canScan, isSecureForCamera, extractCode } from '../lib/qr';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiRequestError, pointsApi } from '../lib/api';
import { formatDateTime } from '../lib/datetime';
import { PinPromptModal, SetPinModal } from '../components/PinModal';

const OVERSIGHT_ROLES = ['WARDEN', 'ADMIN'];

const WALLET_META = {
  CANTEEN: {
    label: 'Canteen',
    Icon: Coffee,
  },
  LAUNDRY: {
    label: 'Laundry',
    Icon: Shirt,
  },
};

export default function PointsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const isOversight = OVERSIGHT_ROLES.includes(user?.role);

  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [tab, setTab] = useState(() =>
    isOversight ? 'topup' : 'CANTEEN',
  );

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentToken, setPaymentToken] = useState('');
  const [paymentQr, setPaymentQr] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [setPinOpen, setSetPinOpen] = useState(false);
  const [pinSetupError, setPinSetupError] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const load = useCallback(async () => {
    const response = await pointsApi.wallets();

    const walletData = Array.isArray(response?.wallets)
      ? response.wallets
      : [];

    setWallets(walletData);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);

      try {
        await load();

        if (!cancelled) {
          setLoadError('');
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiRequestError
              ? err.message
              : 'Could not reach the server. Is the API running?',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [load]);

  const activeWallet = useMemo(
    () =>
      wallets.find((wallet) => wallet.type === tab) ?? null,
    [wallets, tab],
  );

  const hasPin = useMemo(
    () => wallets.some((wallet) => wallet.hasPin),
    [wallets],
  );

  const walletTabs = useMemo(
    () =>
      wallets
        .filter((wallet) => WALLET_META[wallet.type])
        .map((wallet) => ({
          id: wallet.type,
          ...WALLET_META[wallet.type],
        })),
    [wallets],
  );

  const openPayment = () => {
    setPaymentToken('');
    setPaymentQr(null);
    setPaymentError('');
    setPaymentOpen(true);
  };

  const previewPayment = async (event) => {
    event.preventDefault();

    const token = paymentToken.trim();

    if (!token) {
      setPaymentError('Enter the payment code.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');
    setPaymentQr(null);

    try {
      const response = await pointsApi.previewPay(token);

      setPaymentQr(response?.qr ?? null);

      if (!response?.qr) {
        setPaymentError('Invalid payment code.');
      }
    } catch (err) {
      setPaymentError(
        err?.message || 'Could not read the payment code.',
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const pay = async (pin) => {
    const token = paymentToken.trim();

    if (!token) {
      setPaymentError('Payment code is missing.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const response = await pointsApi.pay(token, { pin });

      await load();

      setPaymentOpen(false);
      setPaymentToken('');
      setPaymentQr(null);

      toast.success(
        'Payment successful',
        response?.message ||
          'Your points payment was completed.',
      );
    } catch (err) {
      setPaymentError(
        err?.message ||
          'Payment failed. Please check your PIN and try again.',
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const savePin = async (payload) => {
    setSavingPin(true);
    setPinSetupError('');

    try {
      const response = hasPin
        ? await pointsApi.changePin(payload)
        : await pointsApi.setPin(payload);

      await load();

      setSetPinOpen(false);

      toast.success(
        hasPin ? 'PIN changed' : 'PIN saved',
        response?.message ||
          (hasPin
            ? 'Your spending PIN has been changed.'
            : 'Your spending PIN has been saved.'),
      );
    } catch (err) {
      setPinSetupError(
        err?.message || 'Could not save your PIN.',
      );
    } finally {
      setSavingPin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </Link>

          <h1 className="order-last w-full text-xl font-bold sm:order-none sm:w-auto">
            Points
          </h1>

          {tab !== 'topup' && (
            <button
              type="button"
              onClick={openPayment}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <QrCode className="h-4 w-4" />
              Pay with QR
            </button>
          )}
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
          {walletTabs.map(({ id, label, Icon }) => (
            <TabButton
              key={id}
              active={tab === id}
              onClick={() => setTab(id)}
              Icon={Icon}
            >
              {label}
            </TabButton>
          ))}

          {isOversight && (
            <TabButton
              active={tab === 'topup'}
              onClick={() => setTab('topup')}
              Icon={Plus}
            >
              Top up a student
            </TabButton>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-8 text-center">
            <ServerCrash className="mx-auto h-8 w-8 text-red-500" />

            <h2 className="mt-3 text-base font-bold text-red-700">
              {loadError}
            </h2>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {tab === 'topup' && isOversight ? (
          <TopUpPanel
            toast={toast}
            onCredited={load}
          />
        ) : activeWallet ? (
          <WalletPanel
            wallet={activeWallet}
            hasPin={hasPin}
            onSetPin={() => {
              setPinSetupError('');
              setSetPinOpen(true);
            }}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <WalletIcon />

            <p className="mt-3 text-sm font-bold text-slate-700">
              No wallet available
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Your account does not currently have a points wallet.
            </p>
          </div>
        )}
      </main>

      {paymentOpen && (
        <PaymentModal
          token={paymentToken}
          qr={paymentQr}
          loading={paymentLoading}
          error={paymentError}
          hasPin={hasPin}
          onTokenChange={setPaymentToken}
          onPreview={previewPayment}
          onPay={pay}
          onClose={() => {
            if (!paymentLoading) {
              setPaymentOpen(false);
              setPaymentToken('');
              setPaymentQr(null);
              setPaymentError('');
            }
          }}
        />
      )}

      {setPinOpen && (
        <SetPinModal
          existing={hasPin}
          error={pinSetupError}
          submitting={savingPin}
          onCancel={() => {
            if (!savingPin) {
              setSetPinOpen(false);
            }
          }}
          onSubmit={savePin}
        />
      )}
    </div>
  );
}

function WalletIcon() {
  return (
    <div className="mx-auto flex h-8 w-8 items-center justify-center text-slate-300">
      <ShoppingBag className="h-8 w-8" />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  Icon,
  children,
}) {
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

function WalletPanel({
  wallet,
  hasPin,
  onSetPin,
}) {
  const meta = WALLET_META[wallet.type];
  const Icon = meta?.Icon ?? ShoppingBag;
  const label = meta?.label ?? wallet.type;

  const transactions = Array.isArray(wallet.transactions)
    ? wallet.transactions
    : [];

  const debits = transactions.filter(
    (transaction) => transaction.type === 'DEBIT',
  );

  const spent = debits.reduce(
    (sum, transaction) =>
      sum + Number(transaction.points || 0),
    0,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label} balance
              </p>

              <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
                {wallet.balance ?? 0}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                points
              </p>
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

              <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
                {spent}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                across {debits.length} purchase
                {debits.length === 1 ? '' : 's'}
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
              <p className="text-sm font-bold text-amber-900">
                No spending PIN yet
              </p>

              <p className="text-xs text-amber-800">
                Set one before making a purchase.
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
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            Spending PIN is set
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
          <History className="h-4 w-4" />
          Statement
        </h2>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-slate-300" />

            <p className="mt-3 text-sm font-bold text-slate-700">
              Nothing here yet
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Ask the hostel office to add points, then use a
              payment QR to spend them.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {transactions.map((transaction) => {
              const isCredit =
                transaction.type === 'CREDIT';

              return (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isCredit
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {transaction.title}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {formatDateTime(transaction.createdAt)}
                        {transaction.counterName
                          ? ` · ${transaction.counterName}`
                          : ''}
                        {isCredit &&
                        transaction.actorName
                          ? ` · added by ${transaction.actorName}`
                          : ''}
                        {transaction.reference
                          ? ` · ${transaction.reference}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        isCredit
                          ? 'text-emerald-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {isCredit ? '+' : '−'}
                      {transaction.points ?? 0}
                    </p>

                    <p className="text-xs tabular-nums text-slate-400">
                      {transaction.balanceAfter ?? 0} left
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function PaymentModal({
  token,
  qr,
  loading,
  error,
  hasPin,
  onTokenChange,
  onPreview,
  onPay,
  onClose,
}) {
  const [pinOpen, setPinOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Scanning is the convenience; the field below is the path that always works.
  // A decoder is bundled, so this no longer turns on whether the browser has
  // BarcodeDetector. What remains is the camera itself: it needs a secure
  // context, so over a plain http:// LAN address — the way this gets
  // demonstrated on a phone — it is simply unavailable.
  const cameraAvailable = canScan() && isSecureForCamera();

  const startPayment = () => {
    if (!hasPin) {
      return;
    }

    setPinOpen(true);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <QrCode className="h-5 w-5" />
            </div>

            <div>
              <h2
                id="payment-title"
                className="text-base font-bold text-slate-900"
              >
                Pay with QR
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Enter the payment code shown by the counter.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          {scanning ? (
            <div className="mb-4">
              <QrScanner
                onResult={(value) => {
                  setScanning(false);
                  // A scanned QR holds the whole pay URL; reduce it to the code
                  // the field and the API both expect.
                  onTokenChange(extractCode(value));
                }}
                onClose={() => setScanning(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setScanning(true)}
              disabled={!cameraAvailable}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ScanLine className="h-4 w-4" />
              Scan the code
            </button>
          )}

          {!cameraAvailable && !scanning && (
            <p className="mb-4 text-xs text-slate-500">
              {isSecureForCamera()
                ? 'This browser will not give the page a camera — type the code instead.'
                : 'The camera needs a secure connection, so it is unavailable on this address. Type the code instead.'}
            </p>
          )}

          <form
            onSubmit={onPreview}
            className="space-y-3"
          >
            <label
              htmlFor="payment-token"
              className="block text-xs font-semibold text-slate-600"
            >
              Payment code
            </label>

            <input
              id="payment-token"
              value={token}
              onChange={(event) =>
                onTokenChange(event.target.value)
              }
              placeholder="PTS-4F2A19"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Read payment
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
            >
              {error}
            </p>
          )}

          {qr && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment details
                </p>

                <p className="mt-2 text-lg font-bold text-slate-900">
                  {qr.title || 'Points payment'}
                </p>

                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                  {qr.amount ?? 0}
                </p>

                <p className="text-xs text-slate-500">
                  {qr.walletType
                    ? `${qr.walletType.toLowerCase()} points`
                    : 'points'}
                </p>

                {qr.reference && (
                  <p className="mt-3 font-mono text-xs text-slate-400">
                    {qr.reference}
                  </p>
                )}
              </div>

              {!hasPin ? (
                <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-800">
                  Set your spending PIN before making a payment.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startPayment}
                  disabled={loading}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Pay {qr.amount ?? 0} points
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {pinOpen && (
        <PinPromptModal
          item={{
            name: qr?.title || 'Points payment',
            points: qr?.amount ?? 0,
          }}
          counterName={qr?.title || 'Payment counter'}
          balance={null}
          error={error}
          submitting={loading}
          onCancel={() => setPinOpen(false)}
          onSubmit={async (pin) => {
            await onPay(pin);
            setPinOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TopUpPanel({
  toast,
  onCredited,
}) {
  const [rollNumber, setRollNumber] = useState('');
  const [walletType, setWalletType] = useState('CANTEEN');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const roll = rollNumber.trim();
    const value = Number(amount);
    const trimmedNote = note.trim();

    if (!roll) {
      setError('Enter the student roll number.');
      return;
    }

    if (!Number.isInteger(value) || value < 1) {
      setError('Enter a whole number of points, at least 1.');
      return;
    }

    if (trimmedNote.length === 0) {
      setError('Enter a note for this top-up.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await pointsApi.topUp({
        rollNumber: roll.toUpperCase(),
        walletType,
        amount: value,
        note: trimmedNote,
      });

      toast.success(
        'Points added',
        result?.message ||
          'Points were added successfully.',
      );

      setAmount('');
      setNote('');

      await onCredited();
    } catch (err) {
      setError(
        err?.message || 'Could not add points.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-800">
          Top up a student
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Add points directly to a student's wallet.
        </p>

        <form
          onSubmit={submit}
          className="mt-5 space-y-4"
        >
          <div>
            <label
              htmlFor="roll-number"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Roll number
            </label>

            <input
              id="roll-number"
              value={rollNumber}
              onChange={(event) =>
                setRollNumber(event.target.value)
              }
              placeholder="e.g. 21CS104"
              maxLength={30}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="topup-wallet"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Wallet
              </label>

              <select
                id="topup-wallet"
                value={walletType}
                onChange={(event) =>
                  setWalletType(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="CANTEEN">
                  Canteen
                </option>
                <option value="LAUNDRY">
                  Laundry
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="topup-amount"
                className="mb-1 block text-xs font-semibold text-slate-600"
              >
                Points
              </label>

              <input
                id="topup-amount"
                type="number"
                min="1"
                max="100000"
                step="1"
                required
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm tabular-nums outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="topup-note"
              className="mb-1 block text-xs font-semibold text-slate-600"
            >
              Note
            </label>

            <input
              id="topup-note"
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
              placeholder="Reason for this top-up"
              maxLength={200}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Add points
          </button>
        </form>
      </section>
    </div>
  );
}