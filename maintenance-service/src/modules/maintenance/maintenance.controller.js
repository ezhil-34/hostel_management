import * as maintenanceService from './maintenance.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const query = (req) => req.validated?.query ?? { status: 'ALL', category: 'ALL' };

export const create = async (req, res, next) => {
  try {
    const { request, snapshotUnavailable } = await maintenanceService.createRequest(
      req.user,
      req.accessToken,
      req.body,
    );
    ok(res, { request, snapshotUnavailable, message: `Request ${request.reference} logged` }, 201);
  } catch (err) {
    next(err);
  }
};

export const listMine = async (req, res, next) => {
  try {
    ok(res, { requests: await maintenanceService.listOwnRequests(req.user, query(req)) });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    ok(res, await maintenanceService.getRequest(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
};

export const withdraw = async (req, res, next) => {
  try {
    const request = await maintenanceService.withdrawRequest(req.user, req.params.id);
    ok(res, { request, message: `Request ${request.reference} withdrawn` });
  } catch (err) {
    next(err);
  }
};

export const reopen = async (req, res, next) => {
  try {
    const request = await maintenanceService.reopenRequest(req.user, req.params.id, req.body);
    ok(res, { request, message: `Request ${request.reference} reopened` });
  } catch (err) {
    next(err);
  }
};

export const close = async (req, res, next) => {
  try {
    const request = await maintenanceService.closeRequest(req.user, req.params.id);
    ok(res, { request, message: `Request ${request.reference} closed — thanks for confirming` });
  } catch (err) {
    next(err);
  }
};

export const comment = async (req, res, next) => {
  try {
    const created = await maintenanceService.addComment(req.user, req.params.id, req.body);
    ok(res, { comment: created, message: 'Message added' }, 201);
  } catch (err) {
    next(err);
  }
};

export const queue = async (req, res, next) => {
  try {
    ok(res, { requests: await maintenanceService.listQueue(req.user, query(req)) });
  } catch (err) {
    next(err);
  }
};

export const accept = async (req, res, next) => {
  try {
    const request = await maintenanceService.acceptRequest(req.user, req.params.id);
    ok(res, { request, message: `You picked up ${request.reference}` });
  } catch (err) {
    next(err);
  }
};

export const resolve = async (req, res, next) => {
  try {
    const request = await maintenanceService.resolveRequest(req.user, req.params.id, req.body);
    ok(res, { request, message: `Request ${request.reference} marked resolved` });
  } catch (err) {
    next(err);
  }
};

export const listAll = async (req, res, next) => {
  try {
    const [requests, counts] = await Promise.all([
      maintenanceService.listAll(req.user, query(req)),
      maintenanceService.stats(),
    ]);
    ok(res, { requests, counts });
  } catch (err) {
    next(err);
  }
};

export const reassign = async (req, res, next) => {
  try {
    const request = await maintenanceService.reassignRequest(req.user, req.params.id, req.body);
    ok(res, { request, message: `Reassigned to ${request.assigneeName}` });
  } catch (err) {
    next(err);
  }
};
