import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Prisma errors are matched by `name`, not `instanceof`.
 *
 * `Prisma.PrismaClientKnownRequestError` is undefined until `prisma generate`
 * has run, and `x instanceof undefined` throws — inside the error handler, that
 * turns a tidy 500 into an unhandled crash, in exactly the situation (client not
 * generated) where you most need a readable message. Prisma sets `.name` on
 * every one of these classes, so this is equivalent and cannot blow up.
 */
const isPrismaError = (err, name) => err?.name === name;

/** Prisma validation messages echo the whole query; the summary is the last line. */
const summaryLine = (message = '') => {
  const lines = String(message)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? message;
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message ?? 'Internal server error';
  let details = err.details;

  const staleClient = isPrismaError(err, 'PrismaClientValidationError');

  if (isPrismaError(err, 'PrismaClientKnownRequestError')) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const fields = err.meta?.target ?? [];
      message = `A record with this ${Array.isArray(fields) ? fields.join(', ') : fields} already exists`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
    } else {
      statusCode = 400;
      message = 'Database request failed';
      details = env.isProd ? undefined : { code: err.code };
    }
  } else if (isPrismaError(err, 'PrismaClientInitializationError')) {
    statusCode = 503;
    message = 'Database unavailable — is PostgreSQL running and migrated?';
  } else if (staleClient) {
    // Nearly always a stale generated client: schema.prisma has moved on but
    // `prisma generate` has not run, so the client still knows the old columns.
    // Say what to do rather than returning a 2,000-character query dump.
    statusCode = 503;
    message =
      'The database client is out of date with the schema. Run: ' +
      'docker compose exec backend npx prisma migrate dev — then restart the backend.';
    details = env.isProd ? undefined : { hint: summaryLine(err.message) };
  }

  if (statusCode >= 500) {
    // A validation error's stack is enormous and its useful part is one line.
    if (staleClient) {
      console.error('[error] Prisma client/schema mismatch:', summaryLine(err.message));
    } else {
      console.error('[error]', err);
    }
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
      ...(details ? { details } : {}),
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
};
