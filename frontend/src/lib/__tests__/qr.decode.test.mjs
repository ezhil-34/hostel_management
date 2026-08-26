/**
 * Proves the scan chain end to end without a browser: encode a real pay URL as
 * a QR, rasterise it, decode it with the bundled decoder, and reduce the result
 * to the token the API resolves.
 *
 * This is the path that BarcodeDetector used to own. It is worth a test because
 * the failure it replaces was silent — on any browser without BarcodeDetector
 * the button simply sat disabled and nothing said why.
 *
 * Run: node src/lib/__tests__/qr.decode.test.mjs
 */
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

import { extractCode } from '../qr.js';

const SCALE = 8;
const QUIET = 4;

/** QR matrix -> RGBA bitmap, the shape jsQR and a <canvas> both speak. */
const rasterise = (text) => {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  const side = (size + QUIET * 2) * SCALE;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!modules.data[y * size + x]) continue;
      for (let dy = 0; dy < SCALE; dy += 1) {
        for (let dx = 0; dx < SCALE; dx += 1) {
          const px = ((y + QUIET) * SCALE + dy) * side + ((x + QUIET) * SCALE + dx);
          data[px * 4] = 0;
          data[px * 4 + 1] = 0;
          data[px * 4 + 2] = 0;
        }
      }
    }
  }
  return { data, side };
};

const decode = (text) => {
  const { data, side } = rasterise(text);
  return jsQR(data, side, side)?.data;
};

let failures = 0;
const test = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
};

// A real base64url token, the shape points.service.js#newToken produces.
const TOKEN = '8HU2UysGXq1gLqDkNKF5wVzVAaPa69HK6sj7MHXF35o';
const PAY_URL = `http://localhost:5173/points/pay/${TOKEN}`;

console.log('qr decode chain');

test('decodes a scanned pay URL back to the exact URL', () => {
  assert.equal(decode(PAY_URL), PAY_URL);
});

test('extractCode reduces a decoded pay URL to the bare token', () => {
  assert.equal(extractCode(decode(PAY_URL)), TOKEN);
});

test('survives a base64url token containing - and _', () => {
  const tricky = 'a-b_c8HU2UysGXq1gLqDkNKF5wVzVAaPa69HK6s';
  const url = `http://localhost:5173/points/pay/${tricky}`;
  assert.equal(extractCode(decode(url)), tricky);
});

test('decodes a LAN pay URL, the case a phone actually scans', () => {
  const url = `http://192.168.194.56:5173/points/pay/${TOKEN}`;
  assert.equal(extractCode(decode(url)), TOKEN);
});

test('extractCode passes a typed short reference straight through', () => {
  assert.equal(extractCode('PTS-233551'), 'PTS-233551');
});

test('extractCode trims whitespace around a typed reference', () => {
  assert.equal(extractCode('  PTS-233551  '), 'PTS-233551');
});

console.log(failures ? `\n${failures} failing` : '\nall passing');
process.exit(failures ? 1 : 0);
