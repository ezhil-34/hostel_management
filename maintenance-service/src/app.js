import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import routes from './routes/index.js';
import buildCorsDelegate from './config/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(buildCorsDelegate(env, 'maintenance-service')));

  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // Mounted where the gateway sends it, so the path a browser uses and the path
  // this service sees are the same — one less thing to reason about when
  // debugging a proxy rule.
  app.use('/api/maintenance', routes);

  // Hitting the port in a browser lands here. A bare 404 reads like the service
  // is broken when it is merely an API with nothing mounted at the root, so
  // point the way instead.
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'maintenance-service',
        message: 'API only — every route lives under /api/maintenance.',
        health: '/api/maintenance/health',
        app: 'http://localhost:5173',
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
