const domain = process.env.DOMAIN || 'xp.inc';
const externalPort = parseInt(process.env.EXTERNAL_PORT || '0', 10);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: domain === 'localhost' || domain === '127.0.0.1'
    ? `http://${domain}${externalPort ? `:${externalPort}` : ''}`
    : `https://${domain}`,
  domain,
  externalPort,

  db: {
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'port',
    user: process.env.DB_USER || 'port',
    password: process.env.DB_PASSWORD || 'port_secret',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  },

  ai: {
    endpoint: process.env.AI_ENDPOINT_URL || '',
    apiKey: process.env.AI_API_KEY || '',
  },

  storage: {
    sitesDir: process.env.SITES_DIR || '/data/sites',
    uploadsDir: process.env.UPLOADS_DIR || '/data/uploads',
  },


};
