const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
};

const optional = (name, fallback) => process.env[name] ?? fallback;

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  isProd,
  port: parseInt(optional('PORT', '3001'), 10),
  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),
  hostSecret: isProd ? required('HOST_SECRET') : optional('HOST_SECRET', 'dev-host-secret-change-me'),
  adminPassword: isProd ? required('ADMIN_PASSWORD') : optional('ADMIN_PASSWORD', 'dev-admin'),
  // 1.0 = real durations. Set e.g. 0.1 in dev for ~6s phases.
  phaseScale: parseFloat(optional('PD_PHASE_SCALE', '1')),
  databaseUrl: optional('DATABASE_URL', null),
  r2: {
    endpoint: optional('R2_ENDPOINT', null),
    accessKeyId: optional('R2_ACCESS_KEY_ID', null),
    secretAccessKey: optional('R2_SECRET_ACCESS_KEY', null),
    bucket: optional('R2_BUCKET', 'prompt-deception-images'),
    publicUrl: optional('R2_PUBLIC_URL', null),
  },
  get isR2Configured() {
    return !!(
      this.r2.endpoint &&
      this.r2.accessKeyId &&
      this.r2.secretAccessKey &&
      this.r2.publicUrl
    );
  },
};
