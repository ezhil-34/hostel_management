import env from '../../config/env.js';
import * as authService from './auth.service.js';

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: env.isProd ? 'strict' : 'lax',
  secure: env.isProd,
  path: '/api/auth',
  maxAge: authService.refreshTtlMs,
};

const sendSession = (res, status, { user, accessToken, refreshToken }) => {
  res.cookie(env.cookieName, refreshToken, refreshCookieOptions);
  res.status(status).json({
    success: true,
    data: {
      user,
      accessToken,
      // Also returned in the body so non-browser clients (Postman, mobile)
      // can use refresh without cookie support.
      refreshToken,
    },
  });
};

const readRefreshToken = (req) => req.cookies?.[env.cookieName] ?? req.body?.refreshToken;

export const signup = async (req, res, next) => {
  try {
    sendSession(res, 201, await authService.signup(req.body));
  } catch (err) {
    next(err);
  }
};

export const signin = async (req, res, next) => {
  try {
    sendSession(res, 200, await authService.signin(req.body));
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    sendSession(res, 200, await authService.refresh(readRefreshToken(req)));
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    await authService.logout(readRefreshToken(req));
    res.clearCookie(env.cookieName, { ...refreshCookieOptions, maxAge: undefined });
    res.status(200).json({ success: true, data: { message: 'Signed out' } });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    res.json({ success: true, data: { user: await authService.getProfile(req.user.id) } });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body);
    res.clearCookie(env.cookieName, { ...refreshCookieOptions, maxAge: undefined });
    res.json({
      success: true,
      data: { message: 'Password updated — please sign in again' },
    });
  } catch (err) {
    next(err);
  }
};
