import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export const createApp = () => {
  const app = express();

  // Behind nginx / a container proxy, trust the first hop so rate limiting
  // and secure cookies see the real client IP and protocol.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server requests that send no Origin.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.isProd ? 300 : 5000,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  app.use('/api', routes);

  // Hitting the port in a browser lands here. A bare 404 reads like the service
  // is broken when it is merely an API with nothing mounted at the root, so
  // point the way instead.
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'core-api',
        message: 'API only — every route lives under /api.',
        health: '/api/health',
        app: 'http://localhost:5173',
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
