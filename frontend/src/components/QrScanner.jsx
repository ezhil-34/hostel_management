import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Loader2, X } from 'lucide-react';

import { canScan, isSecureForCamera } from '../lib/qr';

/**
 * Reads a payment QR with the device camera.
 *
 * Uses the browser's own `BarcodeDetector` rather than a bundled decoder. That
 * keeps this dependency-free — which matters here, because adding one to the
 * frontend means reaching into a running container to install it, and a missed
 * install shows up as a page that will not load rather than a scanner that will
 * not scan.
 *
 * The trade is that `BarcodeDetector` is not in every browser. Everywhere it is
 * missing, and everywhere the camera is refused, this component says so plainly
 * and the typed-code field beside it still works. Scanning is the convenience;
 * typing is the path that always exists.
 */

export default function QrScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const doneRef = useRef(false);

  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');

  /** Stops the camera. Called on unmount, on error, and on the first hit. */
  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

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
        setError('This browser cannot read QR codes on its own. Type the code instead.');
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

        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || doneRef.current || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            const value = found?.[0]?.rawValue;
            if (value && !doneRef.current) {
              // Guard against firing twice: detect() runs every frame and a code
              // stays in view for many of them.
              doneRef.current = true;
              stop();
              onResult(value);
              return;
            }
          } catch {
            // A single failed frame is normal while focusing. Keep going.
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
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
  }, [onResult, stop]);

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
