import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

/**
 * Independent JWT verification — deliberately NOT imported from the core API.
 *
 * The contract between the two services is the *token*, not shared code: an
 * HS256 access token signed with `JWT_ACCESS_SECRET`, carrying `sub` (user id),
 * `role` and `email`. Verifying it here is pure computation, so this service
 * authenticates every request without a single network call to the core API —
 * which is what lets it keep serving while the core API is down.
 *
 * The cost of not sharing code is drift. `.verify/cross-service-auth.mjs` is the
 * contract test that catches it: a token minted by the real core API must be
 * accepted here, and tokens signed with the wrong secret must not be.
 *
 * Note what this does NOT do: look the user up. There is no users table in this
 * database. Everything downstream works from the claims plus data this service
 * owns.
 */
export const requireAuth = (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Missing or malformed Authorization header');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'] });
    } catch (err) {
      throw ApiError.unauthorized(
        err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token',
      );
    }

    if (!payload.sub || !payload.role) {
      throw ApiError.unauthorized('Token is missing required claims');
    }

    req.user = { id: payload.sub, role: payload.role, email: payload.email ?? null };
    // Kept so the service can call the core API as the user, without ever
    // holding a service account of its own.
    req.accessToken = token;

    return next();
  } catch (err) {
    return next(err);
  }
};

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have access to this resource'));
    }
    return next();
  };
