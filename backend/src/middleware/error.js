import { Prisma } from '@prisma/client';
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message ?? 'Internal server error';
  let details = err.details;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
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
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    message = 'Database unavailable — is PostgreSQL running and migrated?';
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details ? { details } : {}),
      ...(env.isProd ? {} : { stack: err.stack }),
    },
  });
};
