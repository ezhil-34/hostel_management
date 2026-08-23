import 'dotenv/config';

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${key}. Copy maintenance-service/.env.example to maintenance-service/.env and fill it in.`,
    );
  }
  return value;
};

const asInt = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const asList = (value, fallback) =>
  (value ?? fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: asInt(process.env.PORT, 5100),

  /** This service's own database. Nothing else reads or writes it. */
  databaseUrl: required('DATABASE_URL'),

  /**
   * The contract with the core API: the same signing secret, so this service
   * verifies access tokens on its own with no network call. It never needs the
   * refresh secret — issuing sessions is the core API's job, not ours.
   */
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),

  /**
   * Where to fetch a filer's name/roll/room when they file non-anonymously.
   * Used at write time only; if it is unreachable the request is still
   * recorded, just without the display snapshot.
   */
  coreApiUrl: (process.env.CORE_API_URL ?? 'http://backend:5000').replace(/\/+$/, ''),
  coreApiTimeoutMs: asInt(process.env.CORE_API_TIMEOUT_MS, 3000),

  corsOrigins: asList(process.env.CORS_ORIGINS, 'http://localhost:5173,http://localhost:3000'),
};

export default env;
