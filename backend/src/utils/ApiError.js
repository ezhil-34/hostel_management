export class ApiError extends Error {
  /**
   * `code` is a stable identifier for callers that must branch on *which*
   * failure this is, not merely its status. The browser's API client uses it to
   * tell "your access token expired, refresh and retry" apart from every other
   * 401 — matching on the human-readable message instead would break the moment
   * someone improved the wording.
   */
  constructor(statusCode, message, details = undefined, code = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized', code = undefined) {
    return new ApiError(401, message, undefined, code);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict', details) {
    return new ApiError(409, message, details);
  }
}

export default ApiError;
