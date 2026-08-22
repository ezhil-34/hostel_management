import ApiError from '../utils/ApiError.js';

/**
 * Validates req.body / req.query / req.params against a zod schema and
 * replaces the raw value with the parsed (typed, trimmed) result.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }

    if (source === 'body') {
      req.body = result.data;
    } else {
      req.validated = { ...(req.validated ?? {}), [source]: result.data };
    }
    return next();
  };

export default validate;
