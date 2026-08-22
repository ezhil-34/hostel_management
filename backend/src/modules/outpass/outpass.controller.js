import * as outpassService from './outpass.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const query = (req) => req.validated?.query ?? { status: 'ALL', overdue: false };

export const create = async (req, res, next) => {
  try {
    const outpass = await outpassService.createOutpass(req.user.id, req.body);
    ok(res, { outpass, message: `Outpass ${outpass.reference} sent for approval` }, 201);
  } catch (err) {
    next(err);
  }
};

export const listMine = async (req, res, next) => {
  try {
    ok(res, { outpasses: await outpassService.listOwnOutpasses(req.user.id, query(req)) });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    ok(res, { outpass: await outpassService.getOwnOutpass(req.user.id, req.params.id) });
  } catch (err) {
    next(err);
  }
};

export const cancel = async (req, res, next) => {
  try {
    const outpass = await outpassService.cancelOutpass(req.user.id, req.params.id);
    ok(res, { outpass, message: `Outpass ${outpass.reference} cancelled` });
  } catch (err) {
    next(err);
  }
};

export const listForReview = async (req, res, next) => {
  try {
    ok(res, { outpasses: await outpassService.listForReview(query(req)) });
  } catch (err) {
    next(err);
  }
};

export const review = async (req, res, next) => {
  try {
    const outpass = await outpassService.reviewOutpass(req.user.id, req.params.id, req.body);
    ok(res, {
      outpass,
      message: `Outpass ${outpass.reference} ${outpass.status.toLowerCase()}`,
    });
  } catch (err) {
    next(err);
  }
};

export const verify = async (req, res, next) => {
  try {
    ok(res, await outpassService.verifyByToken(req.params.token));
  } catch (err) {
    next(err);
  }
};

export const markExit = async (req, res, next) => {
  try {
    const result = await outpassService.markExit(req.user.id, req.params.token);
    ok(res, { ...result, message: `${result.outpass.user.name} checked out` });
  } catch (err) {
    next(err);
  }
};

export const markReturn = async (req, res, next) => {
  try {
    const result = await outpassService.markReturn(req.user.id, req.params.token);
    ok(res, {
      ...result,
      message: `${result.outpass.user.name} checked in${
        result.outpass.returnedLate ? ' — returned late' : ''
      }`,
    });
  } catch (err) {
    next(err);
  }
};
