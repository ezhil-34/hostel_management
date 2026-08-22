import 'dotenv/config';

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${key}. Copy backend/.env.example to backend/.env and fill it in.`,
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
  port: asInt(process.env.PORT, 5000),

  databaseUrl: required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  bcryptRounds: asInt(process.env.BCRYPT_ROUNDS, 12),

  corsOrigins: asList(process.env.CORS_ORIGINS, 'http://localhost:5173,http://localhost:3000'),

  /**
   * Origin baked into outpass QR codes. Must be an address the *guard's phone*
   * can reach — set it to the host machine's LAN IP to scan with a real device,
   * since `localhost` inside a QR resolves to the phone itself.
   */
  appPublicUrl: (process.env.APP_PUBLIC_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),

  cookieName: process.env.REFRESH_COOKIE_NAME ?? 'hostel_refresh',
};

export default env;
