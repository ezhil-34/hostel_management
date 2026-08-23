import * as pointsService from './points.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const txQuery = (req) => req.validated?.query ?? { walletType: 'ALL', limit: 50 };
const qrQuery = (req) => req.validated?.query ?? { status: 'ALL' };

// --- Student: wallets, history, PIN -----------------------------------------

export const wallets = async (req, res, next) => {
  try {
    ok(res, { wallets: await pointsService.getOwnWallets(req.user.id) });
  } catch (err) {
    next(err);
  }
};

export const transactions = async (req, res, next) => {
  try {
    ok(res, { transactions: await pointsService.listOwnTransactions(req.user.id, txQuery(req)) });
  } catch (err) {
    next(err);
  }
};

export const pinStatus = async (req, res, next) => {
  try {
    ok(res, await pointsService.pinStatus(req.user.id));
  } catch (err) {
    next(err);
  }
};

export const setPin = async (req, res, next) => {
  try {
    ok(res, await pointsService.setPin(req.user.id, req.body.pin), 201);
  } catch (err) {
    next(err);
  }
};

export const changePin = async (req, res, next) => {
  try {
    ok(res, await pointsService.changePin(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
};

// --- Student: scan & pay -----------------------------------------------------

export const previewPay = async (req, res, next) => {
  try {
    ok(res, { qr: await pointsService.previewQrCode(req.params.token) });
  } catch (err) {
    next(err);
  }
};

export const pay = async (req, res, next) => {
  try {
    const result = await pointsService.payQrCode(req.user.id, req.params.token, req.body.pin);
    ok(res, {
      ...result,
      message: `Paid ${result.transaction.amount} ${result.qr.walletType.toLowerCase()} points`,
    });
  } catch (err) {
    next(err);
  }
};

// --- Admin / warden: fill points + secret QR --------------------------------

export const createQr = async (req, res, next) => {
  try {
    const qr = await pointsService.createQrCode(req.user.id, req.body);
    ok(res, { qr, message: `Payment code ${qr.reference} generated` }, 201);
  } catch (err) {
    next(err);
  }
};

export const listQr = async (req, res, next) => {
  try {
    ok(res, { codes: await pointsService.listOwnQrCodes(req.user.id, qrQuery(req)) });
  } catch (err) {
    next(err);
  }
};

export const cancelQr = async (req, res, next) => {
  try {
    const qr = await pointsService.cancelQrCode(req.user.id, req.params.id);
    ok(res, { qr, message: `Payment code ${qr.reference} cancelled` });
  } catch (err) {
    next(err);
  }
};

export const topUp = async (req, res, next) => {
  try {
    const result = await pointsService.topUpWallet(req.user.id, req.body);
    ok(
      res,
      {
        ...result,
        message: `Added ${req.body.amount} ${req.body.walletType.toLowerCase()} points to ${result.student.name} (${result.student.rollNumber})`,
      },
      201,
    );
  } catch (err) {
    next(err);
  }
};
