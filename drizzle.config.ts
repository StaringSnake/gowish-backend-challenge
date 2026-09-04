import type { Config } from 'drizzle-kit';

export default {
  schema: './libs/*/src/entities/*.schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  // driver: '',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/app.db',
  },
} satisfies Config; 