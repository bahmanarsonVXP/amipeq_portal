import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:8787',
  internalSecret: process.env.INTERNAL_SECRET || 'dev-secret',
  twenty: {
    apiUrl: process.env.TWENTY_API_URL || '',
    apiKey: process.env.TWENTY_API_KEY || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  zeendoc: {
    apiUrl: process.env.ZEENDOC_API_URL || '',
    apiKey: process.env.ZEENDOC_API_KEY || '',
  },
};
