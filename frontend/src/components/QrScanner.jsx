import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Loader2, X } from 'lucide-react';
import jsQR from 'jsqr';

import { canScan, isSecureForCamera, hasNativeDetector } from '../lib/qr';

/**
 * Reads a payment QR with the device camera.
 *
 * Two decoders, in preference order:
 *
 *   1. The browser's own `BarcodeDetector` — free and fast, but Chromium ships
 *      it only on Android, ChromeOS and macOS, and Firefox not at all.
 *   2. `jsqr`, bundled. Slower, works everywhere.
 *
 * The original relied on (1) alone. That is defensible when the frontend runs in
 * a container — adding a dependency there means installing into a running
 * container, and a missed install breaks the whole page rather than one button.
 * Run natively, that cost is gone, and the price of the old trade was that the
 * scan button sat permanently disabled on every Linux and Windows desktop.
 *
 * Typing the code beside this still works and always did; scanning is the
 * convenience. What changed is that the convenience now exists off Android.
 */

/** jsQR walks every pixel, so give it a small frame and a slow clock. */
const DECODE_INTERVAL_MS = 120;
const MAX_DECODE_WIDTH = 480;

export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(0);
  const doneRef = useRef(false);

  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');

  // The effect below must not re-run when the parent re-renders with a fresh
  // inline callback — that tore the camera down and started it again mid-scan.
  // Holding it in a ref keeps the effect's dependencies genuinely stable.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  /** Stops the camera. Called on unmount, on error, and on the first hit. */
  const stop = useCallback(() => {
    clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    doneRef.current = false;

    (async () => {
      if (!isSecureForCamera()) {
        setStatus('blocked');
        setError(
          'The camera only works on a secure connection. On localhost it is fine; over a plain http:// address on your network the browser blocks it. Type the code instead.',
        );
        return;
      }

      if (!canScan()) {
        setStatus('unsupported');
        setError('This browser will not give the page a camera. Type the code instead.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        // The component may have unmounted while the permission prompt was up.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('scanning');

        const detector = hasNativeDetector()
          ? new window.BarcodeDetector({ formats: ['qr_code'] })
          : null;

        /** Draws the current frame down to a workable size and runs jsQR on it. */
        const decodeWithJsQr = (video) => {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return undefined;

          const scale = Math.min(1, MAX_DECODE_WIDTH / vw);
          const w = Math.round(vw * scale);
          const h = Math.round(vh * scale);

          const canvas = (canvasRef.current ??= document.createElement('canvas'));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const { data } = ctx.getImageData(0, 0, w, h);

          return jsQR(data, w, h, { inversionAttempts: 'dontInvert' })?.data;
        };

        const tick = async () => {
          if (cancelled || doneRef.current || !videoRef.current) return;

          try {
            const value = detector
              ? (await detector.detect(videoRef.current))?.[0]?.rawValue
              : decodeWithJsQr(videoRef.current);

            if (value && !doneRef.current) {
              // Guard against firing twice: a code stays in view for many frames.
              doneRef.current = true;
              stop();
              onResultRef.current(value);
              return;
            }
          } catch {
            // A single failed frame is normal while focusing. Keep going.
          }

          timerRef.current = setTimeout(tick, DECODE_INTERVAL_MS);
        };

        timerRef.current = setTimeout(tick, DECODE_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setStatus('denied');
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow it in your browser, or type the code instead.'
            : 'No camera available on this device. Type the code instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  const failed = status !== 'starting' && status !== 'scanning';

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
          {failed ? (
            <CameraOff className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <Camera className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {status === 'starting' && 'Starting the camera…'}
          {status === 'scanning' && 'Point at the code on the counter screen'}
          {failed && 'Camera unavailable'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the scanner"
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {failed ? (
        <p className="px-4 py-6 text-center text-xs leading-relaxed text-slate-300">{error}</p>
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            muted
            playsInline
            className="block max-h-[46vh] w-full bg-black object-cover"
          />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          )}
          {/* A frame to aim with. Purely visual, so it is hidden from readers. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        </div>
      )}
    </div>
  );
}
