import { defineConfig } from 'drizzle-kit';

const usePglite = (process.env.DATABASE_DRIVER ?? (process.env.DATABASE_URL ? 'postgres' : 'pglite')) === 'pglite';

export default defineConfig(
  usePglite
    ? {
        dialect: 'postgresql',
        driver: 'pglite',
        schema: './src/schema.ts',
        out: './drizzle',
        dbCredentials: { url: process.env.PGLITE_DIR ?? '../../.pgdata' },
        verbose: true,
      }
    : {
        dialect: 'postgresql',
        schema: './src/schema.ts',
        out: './drizzle',
        dbCredentials: { url: process.env.DATABASE_URL! },
        verbose: true,
      },
);
