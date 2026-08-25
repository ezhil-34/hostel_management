import * as pointsService from './points.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const wallets = async (req, res, next) => {
  try {
    ok(res, { wallets: await pointsService.getWallets(req.user.id) });
  } catch (err) {
    next(err);
  }
};

export const history = async (req, res, next) => {
  try {
    const query = req.validated?.query ?? { type: 'ALL', limit: 50 };
    ok(res, { transactions: await pointsService.getHistory(req.user.id, query) });
  } catch (err) {
    next(err);
  }
};

export const counters = async (_req, res, next) => {
  try {
    ok(res, { counters: await pointsService.listCounters() });
  } catch (err) {
    next(err);
  }
};

export const counterByToken = async (req, res, next) => {
  try {
    const { token } = req.validated.params;
    ok(res, { counter: await pointsService.getCounterByToken(token) });
  } catch (err) {
    next(err);
  }
};

export const setPin = async (req, res, next) => {
  try {
    ok(res, await pointsService.setPin(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
};

export const spend = async (req, res, next) => {
  try {
    const result = await pointsService.spend(req.user.id, req.user.name, req.body);
    ok(
      res,
      {
        ...result,
        message: result.replayed
          ? `Already paid — receipt ${result.transaction.reference}`
          : `Paid ${result.transaction.points} points · ${result.transaction.reference}`,
      },
      result.replayed ? 200 : 201,
    );
  } catch (err) {
    next(err);
  }
};

export const credit = async (req, res, next) => {
  try {
    ok(res, await pointsService.credit(req.user, req.body), 201);
  } catch (err) {
    next(err);
  }
};

export const lookup = async (req, res, next) => {
  try {
    ok(res, await pointsService.lookupStudent(req.validated?.query ?? {}));
  } catch (err) {
    next(err);
  }
};
