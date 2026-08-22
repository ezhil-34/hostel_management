import * as profileService from './profile.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const getProfile = async (req, res, next) => {
  try {
    ok(res, await profileService.getProfile(req.user.id, req.user.role));
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await profileService.updateOwnProfile(req.user.id, req.user.role, req.body);
    ok(res, { user, message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
};

export const createRequest = async (req, res, next) => {
  try {
    const request = await profileService.createChangeRequest(req.user.id, req.user.role, req.body);
    ok(
      res,
      { request, message: `Request ${request.reference} submitted for review` },
      201,
    );
  } catch (err) {
    next(err);
  }
};

export const listMyRequests = async (req, res, next) => {
  try {
    const status = req.validated?.query?.status;
    ok(res, { requests: await profileService.listOwnRequests(req.user.id, status) });
  } catch (err) {
    next(err);
  }
};

export const cancelRequest = async (req, res, next) => {
  try {
    const request = await profileService.cancelOwnRequest(req.user.id, req.params.id);
    ok(res, { request, message: `Request ${request.reference} cancelled` });
  } catch (err) {
    next(err);
  }
};

export const listAllRequests = async (req, res, next) => {
  try {
    const status = req.validated?.query?.status;
    ok(res, { requests: await profileService.listAllRequests(status) });
  } catch (err) {
    next(err);
  }
};

export const reviewRequest = async (req, res, next) => {
  try {
    const request = await profileService.reviewRequest(req.user.id, req.params.id, req.body);
    ok(res, {
      request,
      message: `Request ${request.reference} ${request.status.toLowerCase()}`,
    });
  } catch (err) {
    next(err);
  }
};
